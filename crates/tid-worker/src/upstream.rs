//! Upstream fetching: isolate micro-cache + KV stale fallback.
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tid_core::model::{MasterDoc, StationsDoc, TrafficDoc, TrainPosDoc};
use worker::*;

const TRAINS_TTL_MS: u64 = 5_000;
const MASTER_TTL_MS: u64 = 24 * 60 * 60 * 1000;

pub fn now_ms() -> u64 {
    coarsetime::Clock::now_since_epoch().as_u64()
}

fn cache() -> &'static Mutex<HashMap<String, (u64, Vec<u8>)>> {
    static CACHE: OnceLock<Mutex<HashMap<String, (u64, Vec<u8>)>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

async fn fetch_upstream(origin: &str, path: &str) -> Result<Vec<u8>> {
    let url = format!("{origin}/api/v3/{path}");
    let req = Request::new(&url, Method::Get)?;
    let mut resp = Fetch::Request(req).send().await?;
    if resp.status_code() >= 400 {
        return Err(Error::RustError(
            format!("upstream {path} -> {}", resp.status_code()).into(),
        ));
    }
    let bytes = resp.bytes().await?;
    Ok(bytes)
}

/// Memory-cached fetch; on miss+failure returns None (caller may use KV).
async fn cached_fetch(origin: &str, path: &str, ttl_ms: u64) -> Option<Vec<u8>> {
    let key = path.to_string();
    if let Ok(map) = cache().lock() {
        if let Some((ts, bytes)) = map.get(&key) {
            if now_ms() - ts < ttl_ms {
                return Some(bytes.clone());
            }
        }
    }
    match fetch_upstream(origin, path).await {
        Ok(bytes) => {
            if let Ok(mut map) = cache().lock() {
                map.insert(key, (now_ms(), bytes.clone()));
            }
            Some(bytes)
        }
        Err(_) => None,
    }
}

// ---------------------------------------------------------------------------
// Typed getters with KV stale-if-error fallback
// ---------------------------------------------------------------------------

async fn kv_get(kv: &KvStore, key: &str) -> Option<Vec<u8>> {
    kv.get(key).bytes().await.ok().flatten()
}

async fn kv_put(kv: &KvStore, key: &str, val: &[u8]) {
    if let Ok(builder) = kv.put(key, val) {
        let _ = builder.execute().await;
    }
}

macro_rules! getter {
    ($name:ident, $ty:ty, $ttl:expr) => {
        pub async fn $name(
            origin: &str,
            path: &str,
            kv: Option<&KvStore>,
        ) -> Option<$ty> {
            let ttl = $ttl;
            let bytes = cached_fetch(origin, path, ttl).await;
            if let Some(b) = &bytes {
                if let Ok(v) = serde_json::from_slice::<$ty>(b) {
                    if let Some(kv) = kv {
                        kv_put(kv, &format!("stale:{path}"), b).await;
                    }
                    return Some(v);
                }
            }
            // stale fallback from KV
            if let Some(kv) = kv {
                if let Some(b) = kv_get(kv, &format!("stale:{path}")).await {
                    if let Ok(v) = serde_json::from_slice::<$ty>(&b) {
                        return Some(v);
                    }
                }
            }
            None
        }
    };
}

getter!(get_trains_doc, TrainPosDoc, TRAINS_TTL_MS);
getter!(get_stations_doc, StationsDoc, MASTER_TTL_MS);
getter!(get_master_doc, MasterDoc, MASTER_TTL_MS);

pub async fn get_traffic_doc(origin: &str, path: &str, kv: Option<&KvStore>) -> Option<TrafficDoc> {
    let bytes = cached_fetch(origin, path, 30_000).await;
    if let Some(b) = &bytes {
        if let Ok(v) = serde_json::from_slice::<TrafficDoc>(b) {
            return Some(v);
        }
    }
    None
}

/// Fetch the given lines' train payloads in one sweep (tagged with line id).
pub async fn fetch_trains_for(
    env: &Env,
    origin: &str,
    lines: &[String],
) -> Vec<(String, tid_core::model::TrainPosDoc)> {
    let kv = env.kv("SNAPSHOTS").ok();
    let mut out = Vec::with_capacity(lines.len());
    for line in lines {
        let path = format!("{line}.json");
        if let Some(doc) = crate::upstream::get_trains_doc(origin, &path, kv.as_ref()).await {
            out.push((line.clone(), doc));
        }
    }
    out
}

/// Fetch every scope line's train payload in one sweep (tagged with line id).
pub async fn fetch_all_trains(
    env: &Env,
    origin: &str,
) -> Vec<(String, tid_core::model::TrainPosDoc)> {
    let scope = crate::util::scope_lines(env);
    fetch_trains_for(env, origin, &scope).await
}
