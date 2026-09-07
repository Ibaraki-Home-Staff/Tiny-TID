//! Network snapshot build + storage (D1-backed, isolate memory L1).
use std::collections::{BTreeMap, BTreeSet};
use std::sync::{Arc, OnceLock, RwLock};
use worker::*;

pub const AREAS: [&str; 5] = ["hokuriku", "kinki", "okayama", "hiroshima", "sanin"];
const SNAPSHOT_KEY: &str = "v1";

static SNAPSHOT_MEM: OnceLock<RwLock<Option<Arc<tid_core::network::NetworkSnapshot>>>> =
    OnceLock::new();

fn mem_slot() -> &'static RwLock<Option<Arc<tid_core::network::NetworkSnapshot>>> {
    SNAPSHOT_MEM.get_or_init(|| RwLock::new(None))
}

fn validate_snapshot(snap: &tid_core::network::NetworkSnapshot) -> std::result::Result<(), String> {
    if snap.version != tid_core::network::SNAPSHOT_VERSION {
        return Err(format!(
            "snapshot version {} != {}",
            snap.version,
            tid_core::network::SNAPSHOT_VERSION
        ));
    }

    let mut expected_lines = BTreeSet::new();
    for area in AREAS {
        let info = snap
            .areas
            .get(area)
            .ok_or_else(|| format!("snapshot missing area {area}"))?;
        if info.lines.is_empty() {
            return Err(format!("snapshot area {area} has no lines"));
        }
        for line in &info.lines {
            expected_lines.insert(line.id.clone());
        }
    }
    if expected_lines.is_empty() {
        return Err("snapshot has no indexed lines".to_string());
    }
    for line in expected_lines {
        let order = snap
            .orders
            .get(&line)
            .ok_or_else(|| format!("snapshot missing order for {line}"))?;
        let stations = snap
            .lines
            .get(&line)
            .ok_or_else(|| format!("snapshot missing stations for {line}"))?;
        if order.is_empty() || stations.is_empty() {
            return Err(format!("snapshot line {line} is empty"));
        }
    }
    Ok(())
}

/// Fetch every master + station document, validate the complete graph, then
/// atomically replace the persisted snapshot. A failed/partial rebuild never
/// overwrites the last known-good D1 or in-memory snapshot.
pub async fn rebuild_network(env: &Env, origin: &str) -> Result<String> {
    let db = env.d1("DB")?;

    let master_jobs = AREAS.into_iter().map(|area| {
        let origin = origin.to_string();
        async move {
            let path = format!("area_{area}_master.json");
            (area.to_string(), crate::upstream::get_master_doc(&origin, &path).await)
        }
    });
    let mut masters = Vec::new();
    let mut missing_masters = Vec::new();
    for (area, doc) in futures::future::join_all(master_jobs).await {
        match doc {
            Some(doc) => masters.push((area, doc)),
            None => missing_masters.push(area),
        }
    }
    if !missing_masters.is_empty() {
        return Err(Error::RustError(
            format!("missing area masters: {}", missing_masters.join(",")).into(),
        ));
    }

    // Use each master's explicit `st` path rather than assuming
    // `{line_id}_st.json`; reject conflicting duplicate definitions.
    let mut station_sources: BTreeMap<String, String> = BTreeMap::new();
    for (_, master) in &masters {
        for (line_id, meta) in &master.lines {
            let path = meta
                .get("st")
                .and_then(|v| v.as_str())
                .and_then(crate::upstream::normalize_api_path)
                .unwrap_or_else(|| format!("{line_id}_st.json"));
            if let Some(existing) = station_sources.get(line_id) {
                if existing != &path {
                    return Err(Error::RustError(
                        format!(
                            "conflicting station sources for {line_id}: {existing} vs {path}"
                        )
                        .into(),
                    ));
                }
            } else {
                station_sources.insert(line_id.clone(), path);
            }
        }
    }
    if station_sources.is_empty() {
        return Err(Error::RustError("area masters contain no lines".into()));
    }

    let fetched = station_sources.len();
    let station_sources: Vec<(String, String)> = station_sources.into_iter().collect();
    let mut st_docs = Vec::new();
    let mut missing_stations = Vec::new();
    // Cloudflare Workers cap simultaneous outgoing connections at six. Fetch
    // in bounded batches so a cold all-area rebuild cannot deadlock/fail by
    // opening every station document at once.
    for chunk in station_sources.chunks(6) {
        let station_jobs = chunk.iter().cloned().map(|(line_id, path)| {
            let origin = origin.to_string();
            async move {
                let doc = crate::upstream::get_stations_doc(&origin, &path).await;
                (line_id, path, doc)
            }
        });
        for (line_id, path, doc) in futures::future::join_all(station_jobs).await {
            match doc {
                Some(doc) => st_docs.push((line_id, doc)),
                None => missing_stations.push(path),
            }
        }
    }
    if !missing_stations.is_empty() {
        return Err(Error::RustError(
            format!(
                "missing station documents ({}/{}): {}",
                missing_stations.len(),
                fetched,
                missing_stations.join(",")
            )
            .into(),
        ));
    }

    let built_at = crate::util::iso_now();
    let mut snap = tid_core::network::build_snapshot(&built_at, &st_docs);
    let mut meta = BTreeMap::new();
    for (_, master) in &masters {
        meta.extend(tid_core::model::parse_line_meta(master));
    }
    tid_core::network::apply_line_meta(&mut snap, &meta);
    snap.areas = tid_core::model::build_area_index(&masters);
    validate_snapshot(&snap).map_err(|e| Error::RustError(e.into()))?;

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

    // Publish to isolate memory only after the durable write succeeded.
    *mem_slot().write().unwrap() = Some(Arc::new(snap.clone()));

    Ok(format!(
        "areas={} lines_fetched={fetched} lines_built={} nodes={}",
        masters.len(),
        st_docs.len(),
        snap.lines.values().map(|m| m.len()).sum::<usize>()
    ))
}

pub async fn load_network(db: &D1Database) -> Option<Arc<tid_core::network::NetworkSnapshot>> {
    let cached = { mem_slot().read().unwrap().clone() };
    if let Some(snap) = cached {
        match validate_snapshot(&snap) {
            Ok(()) => return Some(snap),
            Err(e) => {
                console_error!("discarding invalid in-memory network snapshot: {e}");
                *mem_slot().write().unwrap() = None;
            }
        }
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
    let snap: tid_core::network::NetworkSnapshot = match serde_json::from_str(&row.data) {
        Ok(snap) => snap,
        Err(e) => {
            console_error!("network snapshot JSON is invalid: {e}");
            return None;
        }
    };
    if let Err(e) = validate_snapshot(&snap) {
        console_error!("network snapshot rejected: {e}");
        return None;
    }
    let arc = Arc::new(snap);
    *mem_slot().write().unwrap() = Some(arc.clone());
    Some(arc)
}

/// Ensure a valid snapshot exists. Scheduled invocations call this every
/// minute, so deploys with an empty/old D1 self-heal promptly without relying
/// on a user request to perform the expensive rebuild.
pub async fn ensure_network(
    env: &Env,
    origin: &str,
) -> Result<Arc<tid_core::network::NetworkSnapshot>> {
    let db = env.d1("DB")?;
    if let Some(snap) = load_network(&db).await {
        return Ok(snap);
    }
    let summary = rebuild_network(env, origin).await?;
    console_log!("network auto-rebuilt: {summary}");
    load_network(&db)
        .await
        .ok_or_else(|| Error::RustError("network snapshot unavailable after rebuild".into()))
}
