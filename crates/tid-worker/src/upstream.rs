//! Upstream fetching: isolate memory cache with expired-entry fallback.
//! Payloads are tiny (~50KB for all 6 lines, ~140KB for all 45), so
//! everything stays in memory and KV is gone. Failures are logged; expired
//! entries are served when available so transient upstream outages do not
//! masquerade as valid empty data.
use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, Mutex};
use tid_core::model::{MasterDoc, StationsDoc, TrafficDoc, TrainPosDoc};
use worker::*;

const TRAINS_TTL_MS: u64 = 5_000;
const MASTER_TTL_MS: u64 = 24 * 60 * 60 * 1000;
const COOLDOWN_MS: u64 = 30_000;

// JR-West currently returns its HTML 404 page to Cloudflare Worker subrequests
// that use the runtime-default request headers. A normal browser-like request
// returns the JSON API correctly. Keep the headers explicit and stable.
const UPSTREAM_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36";

pub fn now_ms() -> u64 {
    coarsetime::Clock::now_since_epoch().as_u64()
}

static CACHE: LazyLock<Mutex<HashMap<String, (u64, Vec<u8>)>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static COOLDOWN: LazyLock<Mutex<HashMap<String, u64>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn cache() -> &'static Mutex<HashMap<String, (u64, Vec<u8>)>> {
    &CACHE
}

fn cooldown() -> &'static Mutex<HashMap<String, u64>> {
    &COOLDOWN
}

fn expired_entry(key: &str) -> Option<Vec<u8>> {
    if let Ok(map) = cache().lock() {
        if let Some((_, bytes)) = map.get(key) {
            return Some(bytes.clone());
        }
    }
    None
}

async fn fetch_upstream(origin: &str, path: &str, _edge_ttl_secs: i32) -> Result<Vec<u8>> {
    let url = format!("{origin}/api/v3/{path}");

    let headers = Headers::new();
    headers.set("user-agent", UPSTREAM_USER_AGENT)?;
    headers.set("accept", "application/json,text/plain,*/*")?;
    headers.set("referer", "https://www.train-guide.westjr.co.jp/")?;

    // Do not use `cf.cache_everything` here. A previous 404 from JR-West can
    // otherwise be cached at the Cloudflare edge for the master TTL and keep
    // poisoning rebuilds even after the request headers are corrected. The
    // isolate cache below already provides the TTL behavior we need.
    let req = Request::new_with_init(
        &url,
        &RequestInit {
            method: Method::Get,
            headers,
            ..Default::default()
        },
    )?;
    let mut resp = Fetch::Request(req).send().await?;
    let status = resp.status_code();
    if !(200..300).contains(&status) {
        return Err(Error::RustError(
            format!("upstream {path} -> {status}").into(),
        ));
    }
    Ok(resp.bytes().await?)
}

async fn cached_fetch(origin: &str, path: &str, ttl_ms: u64) -> Option<Vec<u8>> {
    let key = path.to_string();
    if let Ok(map) = cache().lock() {
        if let Some((ts, bytes)) = map.get(&key) {
            if now_ms() - ts < ttl_ms {
                return Some(bytes.clone());
            }
        }
    }
    if let Ok(cd) = cooldown().lock() {
        if let Some(until) = cd.get(&key) {
            if now_ms() < *until {
                drop(cd);
                return expired_entry(&key);
            }
        }
    }
    match fetch_upstream(origin, path, (ttl_ms / 1000).max(1) as i32).await {
        Ok(bytes) => {
            if let Ok(mut map) = cache().lock() {
                map.insert(key, (now_ms(), bytes.clone()));
            }
            Some(bytes)
        }
        Err(e) => {
            if let Ok(mut cd) = cooldown().lock() {
                cd.insert(key.clone(), now_ms() + COOLDOWN_MS);
            }
            if let Some(bytes) = expired_entry(&key) {
                console_warn!("upstream fetch failed; serving stale path={path}: {e}");
                Some(bytes)
            } else {
                console_error!("upstream fetch failed path={path}: {e}");
                None
            }
        }
    }
}

macro_rules! getter {
    ($name:ident, $ty:ty, $ttl:expr) => {
        pub async fn $name(origin: &str, path: &str) -> Option<$ty> {
            let bytes = cached_fetch(origin, path, $ttl).await?;
            match serde_json::from_slice::<$ty>(&bytes) {
                Ok(doc) => Some(doc),
                Err(e) => {
                    console_error!("upstream JSON parse failed path={path}: {e}");
                    None
                }
            }
        }
    };
}

getter!(get_trains_doc, TrainPosDoc, TRAINS_TTL_MS);
getter!(get_stations_doc, StationsDoc, MASTER_TTL_MS);
getter!(get_master_doc, MasterDoc, MASTER_TTL_MS);
getter!(get_traffic_doc, TrafficDoc, 30_000);

/// Normalize an area-master `/api/v3/...` path into the relative path used by
/// [`fetch_upstream`]. Full URLs containing `/api/v3/` are tolerated too.
pub(crate) fn normalize_api_path(raw: &str) -> Option<String> {
    let raw = raw.trim();
    if raw.is_empty() {
        return None;
    }
    let path = raw
        .split_once("/api/v3/")
        .map(|(_, tail)| tail)
        .unwrap_or_else(|| raw.trim_start_matches('/'))
        .trim();
    if path.is_empty() || path.contains("://") {
        None
    } else {
        Some(path.to_string())
    }
}

fn position_paths(master: Option<&MasterDoc>, line: &str) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(meta) = master.and_then(|m| m.lines.get(line)) {
        if let Some(path) = meta
            .get("pos")
            .and_then(|v| v.as_str())
            .and_then(normalize_api_path)
        {
            out.push(path);
        }
        if let Some(paths) = meta.get("relatelines").and_then(|v| v.as_array()) {
            for raw in paths.iter().filter_map(|v| v.as_str()) {
                if let Some(path) = normalize_api_path(raw) {
                    out.push(path);
                }
            }
        }
    }
    if out.is_empty() {
        out.push(format!("{line}.json"));
    }
    let mut seen = HashSet::new();
    out.retain(|path| seen.insert(path.clone()));
    out
}

#[derive(Debug, Default)]
pub struct TrainFetchBatch {
    pub payloads: Vec<(String, TrainPosDoc)>,
    /// `line:path` entries that could not be fetched or parsed and had no
    /// stale fallback. Callers must not present such a batch as complete.
    pub missing_sources: Vec<String>,
}

/// Fetch primary + `relatelines` position payloads for the requested lines.
/// Every related document is tagged with its owning line; positions outside
/// that line remain unresolvable and are ignored by the view geometry, while
/// through trains on the shared/linked section are retained.
pub async fn fetch_trains_for_with_master(
    origin: &str,
    lines: &[String],
    master: Option<&MasterDoc>,
) -> TrainFetchBatch {
    let mut specs = Vec::new();
    for line in lines {
        for path in position_paths(master, line) {
            specs.push((line.clone(), path));
        }
    }

    // Workers permit at most six simultaneous outgoing connections. Keep
    // concurrency bounded instead of launching every primary/related source
    // at once; the latter can exceed six once `relatelines` are included.
    let mut batch = TrainFetchBatch::default();
    for chunk in specs.chunks(6) {
        let jobs = chunk.iter().cloned().map(|(line, path)| {
            let origin = origin.to_string();
            async move {
                let doc = get_trains_doc(&origin, &path).await;
                (line, path, doc)
            }
        });
        for (line, path, doc) in futures::future::join_all(jobs).await {
            match doc {
                Some(doc) => batch.payloads.push((line, doc)),
                None => batch.missing_sources.push(format!("{line}:{path}")),
            }
        }
    }
    batch
}

/// Compatibility helper for callers that only need the primary `{line}.json`
/// convention and do not have an area master available.
pub async fn fetch_trains_for(origin: &str, lines: &[String]) -> Vec<(String, TrainPosDoc)> {
    fetch_trains_for_with_master(origin, lines, None)
        .await
        .payloads
}

/// Fetch every fixed-scope line for alarm evaluation. If any required source
/// is missing, return no trains rather than evaluating notifications against a
/// silently partial live-data set.
pub async fn fetch_all_trains(env: &Env, origin: &str) -> Vec<(String, TrainPosDoc)> {
    let scope = crate::util::scope_lines(env);
    let area = env
        .var("FIXED_AREA")
        .map(|v| v.to_string())
        .unwrap_or_else(|_| "kinki".to_string());
    let master_path = format!("area_{area}_master.json");
    let Some(master) = get_master_doc(origin, &master_path).await else {
        console_error!("push train fetch aborted: missing {master_path}");
        return Vec::new();
    };
    let batch = fetch_trains_for_with_master(origin, &scope, Some(&master)).await;
    if !batch.missing_sources.is_empty() {
        console_error!(
            "push train fetch incomplete: {}",
            batch.missing_sources.join(",")
        );
        Vec::new()
    } else {
        batch.payloads
    }
}
