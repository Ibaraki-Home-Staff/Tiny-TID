//! Network snapshot build + storage (D1-backed, isolate memory L1).
use std::sync::{Arc, OnceLock, RwLock};
use worker::*;

pub const AREAS: [&str; 5] = ["hokuriku", "kinki", "okayama", "hiroshima", "sanin"];
const SNAPSHOT_KEY: &str = "v1";

static SNAPSHOT_MEM: OnceLock<RwLock<Option<Arc<tid_core::network::NetworkSnapshot>>>> =
    OnceLock::new();

fn mem_slot() -> &'static RwLock<Option<Arc<tid_core::network::NetworkSnapshot>>> {
    SNAPSHOT_MEM.get_or_init(|| RwLock::new(None))
}

/// Daily job: fetch every master + `_st.json`, build one snapshot, persist to D1.
pub async fn rebuild_network(env: &Env, origin: &str) -> Result<String> {
    let db = env.d1("DB")?;
    let mut st_docs: Vec<(String, tid_core::model::StationsDoc)> = Vec::new();
    let mut masters: Vec<(String, tid_core::model::MasterDoc)> = Vec::new();
    let mut fetched = 0usize;

    for area in AREAS {
        let path = format!("area_{area}_master.json");
        if let Some(m) = crate::upstream::get_master_doc(origin, &path, None).await {
            masters.push((area.to_string(), m));
        }
    }
    for (_, m) in &masters {
        for line_id in m.lines.keys() {
            let path = format!("{line_id}_st.json");
            fetched += 1;
            if let Some(doc) = crate::upstream::get_stations_doc(origin, &path, None).await {
                st_docs.push((line_id.clone(), doc));
            }
        }
    }

    let built_at = crate::util::iso_now();
    let snap = tid_core::network::build_snapshot(&built_at, &st_docs);
    *mem_slot().write().unwrap() = Some(Arc::new(snap.clone()));

    use wasm_bindgen::JsValue;
    let json = serde_json::to_string(&snap).map_err(|e| Error::RustError(e.to_string().into()))?;
    db.prepare(
        "INSERT INTO network_snapshot (key,built_at,data) VALUES (?1,?2,?3)
         ON CONFLICT(key) DO UPDATE SET built_at=excluded.built_at, data=excluded.data",
    )
    .bind(&[
        JsValue::from_str(SNAPSHOT_KEY),
        JsValue::from_str(&built_at),
        JsValue::from_str(&json),
    ])?
    .run()
    .await?;

    Ok(format!(
        "areas={} lines_fetched={fetched} lines_built={} nodes={}",
        masters.len(),
        st_docs.len(),
        snap.lines.values().map(|m| m.len()).sum::<usize>()
    ))
}

pub async fn load_network(db: &D1Database) -> Option<Arc<tid_core::network::NetworkSnapshot>> {
    if let Some(snap) = mem_slot().read().unwrap().clone() {
        return Some(snap);
    }

    #[derive(serde::Deserialize)]
    struct Row {
        #[allow(dead_code)]
        built_at: String,
        data: String,
    }

    let row = db
        .prepare("SELECT built_at, data FROM network_snapshot WHERE key=?1")
        .bind(&[wasm_bindgen::JsValue::from_str(SNAPSHOT_KEY)])
        .ok()?
        .first::<Row>(None)
        .await
        .ok()
        .flatten()?;
    let snap: tid_core::network::NetworkSnapshot = serde_json::from_str(&row.data).ok()?;
    if snap.version != tid_core::network::SNAPSHOT_VERSION {
        // Pre-v4 envelopes fused design neighbour links into identity unions
        // (Tsukamoto-class mega-units). Refuse: the view path rebuilds inline.
        return None;
    }
    let arc = Arc::new(snap);
    *mem_slot().write().unwrap() = Some(arc.clone());
    Some(arc)
}
