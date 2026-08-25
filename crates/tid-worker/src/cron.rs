//! Minutely push-evaluation cron.
use std::collections::BTreeMap;
use worker::*;

use crate::util;

#[derive(serde::Deserialize)]
pub struct SubRow {
    pub id: String,
    pub endpoint: String,
    pub p256dh: String,
    pub auth: String,
    pub station_code: String,
    #[serde(default)]
    pub prefs_json: String,
    #[serde(default)]
    pub last_notified_key: Option<String>,
    #[serde(default)]
    pub last_notified_at: Option<i64>,
}

const SUPPRESS_MS: i64 = 3 * 60 * 1000;

async fn load_subs(db: &D1Database) -> Result<Vec<SubRow>> {
    Ok(db
        .prepare("SELECT id, endpoint, p256dh, auth, station_code, prefs_json, last_notified_key, last_notified_at FROM subscriptions")
        .all()
        .await?
        .results::<SubRow>()?)
}

pub async fn run(env: &Env, origin: &str) -> Result<usize> {
    let db = env.d1("DB")?;
    let Some(snapshot) = crate::network_job::load_network(&db).await else {
        return Ok(0);
    };
    let vapid = util::vapid_from_env(env)?;
    let scope = util::scope_lines(env);
    let primary = util::primary_line(env);

    // One upstream sweep serves every station group.
    let payloads = crate::upstream::fetch_all_trains(env, origin).await;

    let subs = load_subs(&db).await?;
    let mut by_station: BTreeMap<String, Vec<SubRow>> = BTreeMap::new();
    for s in subs {
        by_station
            .entry(s.station_code.trim().to_string())
            .or_default()
            .push(s);
    }

    let now = crate::upstream::now_ms() as i64;
    let mut sent = 0usize;

    for (station_query, group) in &by_station {
        let merged =
            tid_core::network::merge_scope(&snapshot, &scope, &primary, station_query);
        let anchor = merged
            .by_code
            .get(station_query.as_str())
            .cloned()
            .or_else(|| {
                let w = tid_core::network::normalize_name(station_query);
                merged
                    .by_code
                    .values()
                    .find(|n| tid_core::network::normalize_name(&n.name) == w)
                    .cloned()
            });
        let Some(anchor) = anchor else { continue };

        let trains = crate::routes::view_trains(
            &snapshot, &scope, &primary, &anchor.code, &payloads,
        );

        for sub in group {
            let prefs = util::parse_prefs_pair(&sub.prefs_json);
            let events = tid_core::alarm::evaluate(
                &merged, &trains, &anchor.code, "kinki", &scope.join(","), &prefs.up, &prefs.down,
            );
            for ev in events {
                let fresh = match (&sub.last_notified_key, &sub.last_notified_at) {
                    (Some(k), Some(ts)) => !(k == &ev.key && now - ts < SUPPRESS_MS),
                    _ => true,
                };
                if !fresh {
                    continue;
                }
                let payload = serde_json::json!({
                    "title": "列車接近",
                    "body": ev.message,
                    "tag": ev.tag,
                    "url": "/"
                })
                .to_string();
                match util::push_send(&vapid, &sub.endpoint, &sub.p256dh, &sub.auth, &payload).await {
                    Ok(true) => {
                        sent += 1;
                        use wasm_bindgen::JsValue;
                        let stmt = db.prepare(
                            "UPDATE subscriptions SET last_notified_key=?1, last_notified_at=?2 WHERE id=?3",
                        );
                        let bound = stmt.bind(&[
                            JsValue::from_str(&ev.key),
                            JsValue::from(now as f64),
                            JsValue::from_str(&sub.id),
                        ]);
                        if let Ok(s) = bound {
                            let _ = s.run().await;
                        }
                    }
                    Ok(false) => {
                        // endpoint gone (404/410) — drop the subscription
                        use wasm_bindgen::JsValue;
                        if let Ok(stmt) = db
                            .prepare("DELETE FROM subscriptions WHERE id=?1")
                            .bind(&[JsValue::from_str(&sub.id)])
                        {
                            let _ = stmt.run().await;
                        }
                    }
                    Err(_) => {}
                }
            }
        }
    }
    Ok(sent)
}
