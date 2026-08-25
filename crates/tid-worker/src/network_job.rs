//! Cron handlers: daily network snapshot build + minutely push evaluation.
use worker::*;

pub const AREAS: [&str; 5] = ["hokuriku", "kinki", "okayama", "hiroshima", "sanin"];
const SNAPSHOT_KEY: &str = "network:v1";

/// Daily job: fetch every master + every `_st.json`, build one snapshot, store in KV.
pub async fn rebuild_network(env: &Env, origin: &str) -> Result<String> {
    let kv = env.kv("SNAPSHOTS")?;
    let mut st_docs: Vec<(String, tid_core::model::StationsDoc)> = Vec::new();
    let mut masters: Vec<(String, tid_core::model::MasterDoc)> = Vec::new();

    for area in AREAS {
        let master_path = format!("area_{area}_master.json");
        let Some(master) =
            crate::upstream::get_master_doc(origin, &master_path, Some(&kv)).await
        else {
            continue;
        };
        masters.push((area.to_string(), master));
    }
    for (_, m) in &masters {
        for line_id in m.lines.keys() {
            let path = format!("{line_id}_st.json");
            if let Some(doc) =
                crate::upstream::get_stations_doc(origin, &path, Some(&kv)).await
            {
                st_docs.push((line_id.clone(), doc));
            }
        }
    }

    let inputs = tid_core::network::NetworkInputs {
        masters: &masters,
        st_docs: &st_docs,
    };
    let built_at = crate::util::iso_now();
    let snap = tid_core::network::build_snapshot(&built_at, &inputs);
    let json = serde_json::to_vec(&snap).map_err(|e| Error::RustError(e.to_string().into()))?;
    kv.put(SNAPSHOT_KEY, json)?.execute().await?;
    Ok(format!(
        "areas={} lines={} nodes={}",
        masters.len(),
        st_docs.len(),
        snap.nodes.len()
    ))
}

pub async fn load_network(kv: &KvStore) -> Option<tid_core::network::NetworkSnapshot> {
    let Some(bytes) = kv.get(SNAPSHOT_KEY).bytes().await.ok().flatten() else { return None; };
    serde_json::from_slice(&bytes).ok()
}
