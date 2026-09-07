//! HTTP routes: /api/view, /api/areas, /api/stations, /api/health,
//! /api/push/subscriptions, static assets fallback.
use worker::*;
use tid_core::view::{build_view, MergedScopeSource, PassSetting, ViewInput};
use tid_core::vmtypes::{StationRef, TrainVm, ViewResponse};

use crate::{network_job, util};

async fn load_ready_snapshot(
    env: &Env,
) -> Result<Option<std::sync::Arc<tid_core::network::NetworkSnapshot>>> {
    let db = env.d1("DB")?;
    Ok(network_job::load_network(&db).await)
}

fn warming_response() -> Result<Response> {
    Response::error("network snapshot unavailable; retry shortly", 503)
}

async fn handle_view(env: &Env, url: &Url) -> Result<Response> {
    let Some(snapshot) = load_ready_snapshot(env).await? else {
        return warming_response();
    };
    let query = url.query();
    // Generic single-line mode (?line=): geometry remains snapshot-wide so
    // destinations/through services can be projected across connected lines,
    // but live position fetches are limited to the viewed line (+ its
    // upstream `relatelines`) rather than every line in the national graph.
    let viewed: Option<String> = util::query_param(query, "line").filter(|s| !s.trim().is_empty());
    if let Some(l) = &viewed {
        if !snapshot.orders.contains_key(l.as_str()) {
            return Response::error("unknown line", 400);
        }
    }
    let (scope, primary, station_line): (Vec<String>, String, Option<String>) = match viewed.clone() {
        Some(l) => (snapshot.orders.keys().cloned().collect(), l.clone(), Some(l)),
        None => (util::scope_lines(env), util::primary_line(env), None),
    };
    // Generic mode: omitted station means all trains on the line.
    // Fixed scope: fall back to the fixed station as before.
    let station = util::query_param(query, "station")
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            if viewed.is_some() {
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

    if !snapshot.areas.contains_key(&area) {
        return Response::error("unknown area", 400);
    }

    let origin = util::origin(env);
    let master_path = format!("area_{area}_master.json");
    let Some(master) = crate::upstream::get_master_doc(&origin, &master_path).await else {
        return Response::error("upstream area master unavailable", 502);
    };
    if let Some(line) = &viewed {
        if !master.lines.contains_key(line) {
            return Response::error("line does not belong to requested area", 400);
        }
    }

    let live_lines: Vec<String> = match viewed.clone() {
        Some(line) => vec![line],
        None => scope.clone(),
    };
    let batch =
        crate::upstream::fetch_trains_for_with_master(&origin, &live_lines, Some(&master)).await;
    if !batch.missing_sources.is_empty() {
        console_error!(
            "view train fetch incomplete area={area}: {}",
            batch.missing_sources.join(",")
        );
        return Response::error("upstream train data incomplete", 502);
    }
    let payloads = batch.payloads;

    let traffic_doc = crate::upstream::get_traffic_doc(
        &origin,
        &format!("area_{area}_trafficinfo.json"),
    )
    .await;
    // Traffic + names follow the requested line in generic mode (the merge
    // itself stays snapshot-wide so through trains keep working).
    let traffic_scope: Vec<String> = match station_line.clone() {
        Some(l) => vec![l],
        None => scope.clone(),
    };
    let line_names: std::collections::BTreeMap<String, String> = traffic_scope
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
        .map(|doc| tid_core::traffic::build_traffic_items(&doc, &traffic_scope, &line_names))
        .unwrap_or_default();

    let source = MergedScopeSource {
        snapshot: &snapshot,
        lines: &scope,
        primary_line: &primary,
    };
    let input = ViewInput {
        station: &station,
        pass,
        trains_payloads: &payloads,
        server_time: util::iso_now(),
        color_map: &COLOR_MAP,
        station_line: station_line.as_deref(),
    };
    let mut resp: ViewResponse = build_view(&source, &input);
    resp.traffic = traffic;
    resp.area_name = tid_core::model::area_name(&area).to_string();
    resp.line_names = line_names;

    let body = serde_json::to_vec(&resp)
        .map_err(|e| Error::RustError(e.to_string().into()))?;
    let mut r = Response::from_bytes(body)?;
    let _ = r.headers_mut().set("cache-control", "no-store");
    let _ = r.headers_mut().set("x-tid-snapshot-built-at", &snapshot.built_at);
    Ok(r)
}

use std::sync::LazyLock;
/// Area selector index for select.html: { area_id: { name, lines: [{id, name}] } }.
async fn handle_areas(env: &Env) -> Result<Response> {
    let Some(snapshot) = load_ready_snapshot(env).await? else {
        return warming_response();
    };
    Response::from_json(&snapshot.areas)
}

/// Station list of one line in listing order (selector + generic viewer).
async fn handle_stations(env: &Env, url: &Url) -> Result<Response> {
    let Some(snapshot) = load_ready_snapshot(env).await? else {
        return warming_response();
    };
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

/// Lightweight production diagnostic that never triggers a rebuild.
async fn handle_health(env: &Env) -> Result<Response> {
    let Some(snapshot) = load_ready_snapshot(env).await? else {
        return warming_response();
    };
    let nodes = snapshot.lines.values().map(|m| m.len()).sum::<usize>();
    Response::from_json(&serde_json::json!({
        "ok": true,
        "snapshotVersion": snapshot.version,
        "builtAt": snapshot.built_at.clone(),
        "areas": snapshot.areas.len(),
        "lines": snapshot.lines.len(),
        "nodes": nodes,
    }))
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
        station_line: None,
    };
    let resp = build_view(&source, &input);
    resp.up.into_iter().chain(resp.down).collect()
}

pub async fn handle_fetch(req: Request, env: Env) -> Result<Response> {
    let url = req.url()?;
    let path = url.path().to_string();

    match (req.method(), path.as_str()) {
        (_, p) if p == "/api/view" => handle_view(&env, &url).await,
        (_, p) if p == "/api/areas" => handle_areas(&env).await,
        (_, p) if p == "/api/stations" => handle_stations(&env, &url).await,
        (_, p) if p == "/api/health" => handle_health(&env).await,
        (_, p) if p == "/api/push/subscriptions" => handle_subscribe(req, env).await,
        _ => {
            let assets = env.assets("ASSETS")?;
            assets.fetch_request(req).await
        }
    }
}
