//! HTTP routes: /api/view, /api/areas, /api/stations, /api/push/subscriptions,
//! static assets fallback.
use worker::*;
use tid_core::network::merge_scope;
use tid_core::view::{build_view, MergedScopeSource, PassSetting, ViewInput};
use tid_core::vmtypes::{StationRef, TrafficItems, TrainVm, ViewResponse};

use crate::{network_job, util};

/// Snapshot with lazy first build (covers fresh deploys before the daily cron).
async fn load_or_rebuild(env: &Env) -> Result<std::sync::Arc<tid_core::network::NetworkSnapshot>> {
    let db = env.d1("DB")?;
    match network_job::load_network(&db).await {
        Some(s) => Ok(s),
        None => {
            network_job::rebuild_network(env, &util::origin(env))
                .await
                .map_err(|e| Error::RustError(format!("snapshot build failed: {e}").into()))?;
            network_job::load_network(&db)
                .await
                .ok_or_else(|| Error::RustError("network snapshot not available".into()))
        }
    }
}

async fn handle_view(env: &Env, url: &Url) -> Result<Response> {
    let snapshot = load_or_rebuild(env).await?;
    let query = url.query();
    // Generic single-line mode (?line=): the scope narrows to that line.
    // Unknown ids are rejected; absence keeps the fixed scope.
    let scope = match util::query_param(query, "line").filter(|s| !s.trim().is_empty()) {
        Some(l) if snapshot.orders.contains_key(l.as_str()) => vec![l],
        Some(_) => return Response::error("unknown line", 400),
        None => util::scope_lines(env),
    };
    let primary = if scope.len() == 1 {
        scope[0].clone()
    } else {
        util::primary_line(env)
    };
    // Generic mode (?line=): omitted station means all trains on the line.
    // Fixed scope: fall back to the fixed station as before.
    let generic = util::query_param(query, "line")
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let station = util::query_param(query, "station")
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            if generic {
                String::new()
            } else {
                util::fixed_station(env)
            }
        });
    let pass = PassSetting::parse(&util::query_param(query, "pass").unwrap_or_else(|| "hide".into()));
    let area = util::query_param(query, "area")
        .filter(|s| !s.trim().is_empty())
        .or_else(|| env.var("FIXED_AREA").map(|v| v.to_string()).ok())
        .unwrap_or_else(|| "kinki".to_string());

    let origin = util::origin(env);
    let payloads = crate::upstream::fetch_trains_for(env, &origin, &scope).await;
    let kv_ref = env.kv("SNAPSHOTS").ok();
    let traffic_doc = crate::upstream::get_traffic_doc(
        &origin,
        &format!("area_{area}_trafficinfo.json"),
        kv_ref.as_ref(),
    )
    .await;
    let line_names: std::collections::BTreeMap<String, String> = scope
        .iter()
        .map(|l| {
            let name = snapshot
                .line_meta
                .get(l)
                .map(|m| m.name.clone())
                .filter(|n| !n.trim().is_empty())
                .unwrap_or_else(|| l.clone());
            (l.clone(), name)
        })
        .collect();
    let traffic = traffic_doc
        .map(|doc| tid_core::traffic::build_traffic_items(&doc, &scope, &line_names))
        .unwrap_or_default();

    let source = MergedScopeSource { snapshot: &snapshot, lines: &scope, primary_line: &primary };
    let input = ViewInput {
        station: &station,
        pass,
        trains_payloads: &payloads,
        server_time: util::iso_now(),
        color_map: &COLOR_MAP,
    };
    let mut resp: ViewResponse = build_view(&source, &input);
    resp.traffic = traffic;
    resp.area_name = tid_core::model::area_name(&area).to_string();
    resp.line_names = line_names;

    let body = serde_json::to_vec(&resp)
        .map_err(|e| Error::RustError(e.to_string().into()))?;
    let mut r = Response::from_bytes(body)?;
    let _ = r.headers_mut().set("cache-control", "no-store");
    Ok(r)
}

use std::sync::LazyLock;
/// Area selector index for select.html: { area_id: { name, lines: [{id, name}] } }.
async fn handle_areas(env: &Env) -> Result<Response> {
    let snapshot = load_or_rebuild(env).await?;
    Response::from_json(&snapshot.areas)
}

/// Station list of one line in listing order (selector + generic viewer).
async fn handle_stations(env: &Env, url: &Url) -> Result<Response> {
    let snapshot = load_or_rebuild(env).await?;
    let line = util::query_param(url.query(), "line")
        .map(|s| s.trim().to_string())
        .unwrap_or_default();
    if line.is_empty() {
        return Response::error("missing line", 400);
    }
    let (Some(order), Some(stations)) =
        (snapshot.orders.get(line.as_str()), snapshot.lines.get(line.as_str()))
    else {
        return Response::error("unknown line", 400);
    };
    let list: Vec<StationRef> = order
        .iter()
        .filter_map(|code| {
            stations.get(code).map(|st| StationRef {
                code: code.clone(),
                name: if st.name.trim().is_empty() {
                    code.clone()
                } else {
                    st.name.trim().to_string()
                },
            })
        })
        .collect();
    Response::from_json(&serde_json::json!({ "line": line, "stations": list }))
}

static COLOR_MAP: LazyLock<std::collections::BTreeMap<String, String>> = LazyLock::new(|| {
    tid_core::category::parse_color_map(include_str!("../../../assets/color.txt"))
});

#[derive(serde::Deserialize)]
struct SubBody {
    subscription: SubEndpoint,
    station: String,
    #[serde(default)]
    prefs_json: String,
}

#[derive(serde::Deserialize)]
struct SubEndpoint {
    endpoint: String,
    keys: SubKeys,
}

#[derive(serde::Deserialize)]
struct SubKeys {
    p256dh: String,
    auth: String,
}

async fn handle_subscribe(mut req: Request, env: Env) -> Result<Response> {
    let db = env.d1("DB")?;
    match req.method() {
        Method::Post => {
            let body: SubBody = serde_json::from_slice(&req.bytes().await?)
                .map_err(|e| Error::RustError(e.to_string().into()))?;
            let id = util::hash_id(&body.subscription.endpoint);
            use wasm_bindgen::JsValue;
            let j = JsValue::from_str;
            db.prepare(
                "INSERT INTO subscriptions (id,endpoint,p256dh,auth,station_code,prefs_json,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO UPDATE SET station_code=excluded.station_code, prefs_json=excluded.prefs_json",
            )
            .bind(&[
                j(&id), j(&body.subscription.endpoint), j(&body.subscription.keys.p256dh),
                j(&body.subscription.keys.auth), j(&body.station), j(&body.prefs_json),
                j(&util::iso_now()),
            ])?
            .run()
            .await?;
            Response::from_json(&serde_json::json!({"ok": true, "id": id}))
        }
        Method::Delete => {
            let url = req.url()?;
            let Some(id) = util::query_param(url.query(), "id") else {
                return Response::error("missing id", 400);
            };
            use wasm_bindgen::JsValue;
            db.prepare("DELETE FROM subscriptions WHERE id=?1")
                .bind(&[JsValue::from_str(&id)])?
                .run()
                .await?;
            Response::from_json(&serde_json::json!({"ok": true}))
        }
        _ => Response::error("method not allowed", 405),
    }
}

/// Trains for alarm evaluation (cron): full lists, pass=Show.
pub fn view_trains(
    snapshot: &tid_core::network::NetworkSnapshot,
    scope: &[String],
    primary: &str,
    station: &str,
    payloads: &[(String, tid_core::model::TrainPosDoc)],
) -> Vec<TrainVm> {
    let source = MergedScopeSource {
        snapshot,
        lines: scope,
        primary_line: primary,
    };
    let cmap = std::collections::BTreeMap::new();
    let input = ViewInput {
        station,
        pass: PassSetting::Show,
        trains_payloads: payloads,
        server_time: String::new(),
        color_map: &cmap,
    };
    let resp = build_view(&source, &input);
    resp.up.into_iter().chain(resp.down.into_iter()).collect()
}

pub async fn handle_fetch(req: Request, env: Env) -> Result<Response> {
    let url = req.url()?;
    let path = url.path().to_string();

    match (req.method(), path.as_str()) {
        (_, p) if p == "/api/view" => handle_view(&env, &url).await,
        (_, p) if p == "/api/areas" => handle_areas(&env).await,
        (_, p) if p == "/api/stations" => handle_stations(&env, &url).await,
        (_, p) if p == "/api/push/subscriptions" => handle_subscribe(req, env).await,
        _ => {
            let assets = env.assets("ASSETS")?;
            assets.fetch_request(req).await
        }
    }
}
