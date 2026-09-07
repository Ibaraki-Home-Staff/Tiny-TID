//! Upstream fetching: isolate memory cache with expired-entry fallback.
//! Payloads are tiny (~50KB for all 6 lines, ~140KB for all 45), so
//! everything stays in memory and KV is gone: on fetch failure the expired
//! entry still serves (stale while revalidate, same isolate). Only a cold
//! isolate + simultaneous upstream outage yields empty data — rare and brief.
//! Failures arm a 30s per-key cooldown so an outage doesn't turn into a
//! sustained per-TTL hammering from every active isolate.
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use tid_core::model::{MasterDoc, StationsDoc, TrafficDoc, TrainPosDoc};
use worker::*;

const TRAINS_TTL_MS: u64 = 5_000;
const MASTER_TTL_MS: u64 = 24 * 60 * 60 * 1000;
const COOLDOWN_MS: u64 = 30_000;

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

async fn fetch_upstream(origin: &str, path: &str, edge_ttl_secs: i32) -> Result<Vec<u8>> {
    // Edge-shared cache: isolates in the same PoP reuse one upstream fetch.
    // Memory (per isolate) stays L1; this collapses N isolates to ~1 fetch
    // per PoP per TTL instead of N.
    let url = format!("{origin}/api/v3/{path}");
    let req = Request::new_with_init(
        &url,
        &RequestInit {
            method: Method::Get,
            cf: CfProperties {
                cache_ttl: Some(edge_ttl_secs),
                cache_everything: Some(true),
                ..Default::default()
            },
            ..Default::default()
        },
    )?;
    let mut resp = Fetch::Request(req).send().await?;
    if resp.status_code() >= 400 {
        return Err(Error::RustError(
            format!("upstream {path} -> {}", resp.status_code()).into(),
        ));
    }
    let bytes = resp.bytes().await?;
    Ok(bytes)
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
        Err(_) => {
            if let Ok(mut cd) = cooldown().lock() {
                cd.insert(key.clone(), now_ms() + COOLDOWN_MS);
            }
            expired_entry(&key)
        }
    }
}

macro_rules! getter {
    ($name:ident, $ty:ty, $ttl:expr) => {
        pub async fn $name(origin: &str, path: &str) -> Option<$ty> {
            let bytes = cached_fetch(origin, path, $ttl).await?;
            serde_json::from_slice::<$ty>(&bytes).ok()
        }
    };
}

getter!(get_trains_doc, TrainPosDoc, TRAINS_TTL_MS);
getter!(get_stations_doc, StationsDoc, MASTER_TTL_MS);
getter!(get_master_doc, MasterDoc, MASTER_TTL_MS);

getter!(get_traffic_doc, TrafficDoc, 30_000);

/// Fetch the given lines' train payloads in one sweep (tagged with line id).
/// Lines fetch concurrently: sequential RTTs used to stack into every cache miss.
pub async fn fetch_trains_for(
    origin: &str,
    lines: &[String],
) -> Vec<(String, tid_core::model::TrainPosDoc)> {
    let jobs = lines.iter().map(|line| {
        let origin = origin.to_string();
        let line = line.clone();
        async move {
            let path = format!("{line}.json");
            let doc = crate::upstream::get_trains_doc(&origin, &path).await;
            doc.map(|d| (line, d))
        }
    });
    futures::future::join_all(jobs).await.into_iter().flatten().collect()
}

/// Fetch every scope line's train payload in one sweep (tagged with line id).
pub async fn fetch_all_trains(
    env: &Env,
    origin: &str,
) -> Vec<(String, tid_core::model::TrainPosDoc)> {
    let scope = crate::util::scope_lines(env);
    fetch_trains_for(origin, &scope).await
}
