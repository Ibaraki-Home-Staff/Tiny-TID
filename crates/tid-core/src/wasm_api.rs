//! WASM/Node entry points for the SORAHOST backend.
//!
//! Same `tid-core` domain as the Cloudflare worker, exposed as JSON
//! string in/out so the Node server (`server/`) needs no Rust toolchain.
//! Everything here mirrors `crates/tid-worker` logic 1:1; the worker stays
//! the reference implementation — do not fork behavior, port it.
//!
//! Build: `pwsh ./build-wasm.ps1` (feature `wasm`, wasm32-unknown-unknown).

use std::collections::{BTreeMap, HashMap};

use serde::Deserialize;

use crate::alarm::Prefs;
use crate::model::{MasterDoc, StationsDoc, TrafficDoc, TrainPosDoc};
use crate::network::{merge_scope, normalize_name, NetworkSnapshot};
use crate::view::{build_view, MergedScopeSource, PassSetting, ViewInput};

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

fn err(msg: impl ToString) -> String {
    msg.to_string()
}

#[derive(Deserialize, Default)]
struct StoredPrefs {
    #[serde(default)]
    cats: Vec<i8>,
    #[serde(default)]
    pass: bool,
    #[serde(default, alias = "carsMin")]
    cars_min: f64,
    #[serde(default, rename = "carsFilter")]
    cars_filter: bool,
    #[serde(default)]
    targets: HashMap<String, String>,
}

impl From<StoredPrefs> for Prefs {
    fn from(mut s: StoredPrefs) -> Self {
        let pass_target = s
            .targets
            .remove("pass")
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());
        Prefs {
            cats: s.cats,
            pass: s.pass,
            cars_min: s.cars_min,
            cars_filter_enabled: s.cars_filter,
            targets: s.targets,
            pass_target,
        }
    }
}

#[derive(Deserialize, Default)]
struct PrefsPair {
    #[serde(default)]
    up: Option<StoredPrefs>,
    #[serde(default)]
    down: Option<StoredPrefs>,
}

fn parse_pair(json: &str) -> (Prefs, Prefs) {
    let raw: PrefsPair = serde_json::from_str(json).unwrap_or(PrefsPair {
        up: None,
        down: None,
    });
    (
        raw.up.map(Into::into).unwrap_or_default(),
        raw.down.map(Into::into).unwrap_or_default(),
    )
}

fn parse_snapshot(json: &str) -> Result<NetworkSnapshot, String> {
    serde_json::from_str(json).map_err(err)
}

/// Full snapshot build = `tid-worker network_job::rebuild_network` pure part.
/// - `st_docs_json`: `[[lineId, StationsDoc]]`
/// - `masters_json`: `[[areaId, MasterDoc]]`
fn build_full_snapshot_inner(
    built_at: &str,
    st_docs_json: &str,
    masters_json: &str,
) -> Result<String, String> {
    let st_docs: Vec<(String, StationsDoc)> = serde_json::from_str(st_docs_json).map_err(err)?;
    let masters: Vec<(String, MasterDoc)> = serde_json::from_str(masters_json).map_err(err)?;
    let mut snap = crate::network::build_snapshot(built_at, &st_docs);
    let mut meta = BTreeMap::new();
    for (_, m) in &masters {
        meta.extend(crate::model::parse_line_meta(m));
    }
    crate::network::apply_line_meta(&mut snap, &meta);
    snap.areas = crate::model::build_area_index(&masters);
    serde_json::to_string(&snap).map_err(err)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ViewReq {
    /// `LINE_SCOPE` fallback when `viewed_line` is absent.
    scope_lines: Vec<String>,
    primary_line: String,
    fixed_station: String,
    fixed_area: String,
    /// `?line=` — when set, merge snapshot-wide like the worker.
    viewed_line: Option<String>,
    /// `?station=` (empty = none).
    station_query: String,
    pass: String,
    area_query: String,
    /// `[[lineId, TrainPosDoc]]`
    payloads: Vec<(String, TrainPosDoc)>,
    server_time: String,
    color_map: BTreeMap<String, String>,
    traffic_doc: Option<TrafficDoc>,
}

/// `/api/view` = `tid-worker routes::handle_view` pure part.
/// Returns the final `ViewResponse` JSON (traffic/areaName/lineNames filled).
fn build_view_inner(snapshot_json: &str, req_json: &str) -> Result<String, String> {
    let snapshot = parse_snapshot(snapshot_json)?;
    let req: ViewReq = serde_json::from_str(req_json).map_err(err)?;
    if let Some(l) = &req.viewed_line {
        if !snapshot.orders.contains_key(l.as_str()) {
            return Err("unknown line".to_string());
        }
    }
    let (scope, primary, station_line): (Vec<String>, String, Option<String>) =
        match req.viewed_line.clone() {
            Some(l) => (
                snapshot.orders.keys().cloned().collect(),
                l.clone(),
                Some(l),
            ),
            None => (req.scope_lines, req.primary_line, None),
        };
    let station = if req.viewed_line.is_some() {
        req.station_query.clone()
    } else if req.station_query.is_empty() {
        req.fixed_station.clone()
    } else {
        req.station_query.clone()
    };
    let area = if req.area_query.trim().is_empty() {
        req.fixed_area.clone()
    } else {
        req.area_query.clone()
    };
    let traffic_scope: Vec<String> = match station_line.clone() {
        Some(l) => vec![l],
        None => scope.clone(),
    };
    let line_names: BTreeMap<String, String> = traffic_scope
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
    let traffic = req
        .traffic_doc
        .as_ref()
        .map(|doc| crate::traffic::build_traffic_items(doc, &traffic_scope, &line_names))
        .unwrap_or_default();

    let source = MergedScopeSource {
        snapshot: &snapshot,
        lines: &scope,
        primary_line: &primary,
    };
    let input = ViewInput {
        station: &station,
        pass: PassSetting::parse(&req.pass),
        trains_payloads: &req.payloads,
        server_time: req.server_time.clone(),
        color_map: &req.color_map,
        station_line: station_line.as_deref(),
    };
    let mut resp = build_view(&source, &input);
    resp.traffic = traffic;
    resp.area_name = crate::model::area_name(&area).to_string();
    resp.line_names = line_names;
    serde_json::to_string(&resp).map_err(err)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CronReq {
    scope: Vec<String>,
    primary_line: String,
    station_query: String,
    /// `[[lineId, TrainPosDoc]]`
    payloads: Vec<(String, TrainPosDoc)>,
    area: String,
    scope_csv: String,
    prefs_json: String,
}

/// Minutely push evaluation = `tid-worker cron::run` pure part for one
/// station group. Returns `{"stationCode": "...", "events": [...]}`;
/// empty stationCode means the anchor is unknown (caller skips the group).
fn cron_evaluate_inner(snapshot_json: &str, req_json: &str) -> Result<String, String> {
    let snapshot = parse_snapshot(snapshot_json)?;
    let req: CronReq = serde_json::from_str(req_json).map_err(err)?;
    let merged = merge_scope(&snapshot, &req.scope, &req.primary_line, &req.station_query);
    let anchor = merged
        .by_code
        .get(req.station_query.as_str())
        .cloned()
        .or_else(|| {
            let w = normalize_name(&req.station_query);
            merged
                .by_code
                .values()
                .find(|n| normalize_name(&n.name) == w)
                .cloned()
        });
    let Some(anchor) = anchor else {
        return serde_json::to_string(&serde_json::json!({
            "stationCode": "",
            "events": [],
        }))
        .map_err(err);
    };
    let source = MergedScopeSource {
        snapshot: &snapshot,
        lines: &req.scope,
        primary_line: &req.primary_line,
    };
    let cmap = BTreeMap::new();
    let input = ViewInput {
        station: &anchor.code,
        pass: PassSetting::Show,
        trains_payloads: &req.payloads,
        server_time: String::new(),
        color_map: &cmap,
        station_line: None,
    };
    let resp = build_view(&source, &input);
    let trains: Vec<crate::vmtypes::TrainVm> =
        resp.up.into_iter().chain(resp.down.into_iter()).collect();
    let (up, down) = parse_pair(&req.prefs_json);
    let events = crate::alarm::evaluate(
        &merged,
        &trains,
        &anchor.code,
        &req.area,
        &req.scope_csv,
        &up,
        &down,
    );
    let out: Vec<serde_json::Value> = events
        .iter()
        .map(|ev| {
            serde_json::json!({
                "key": ev.key,
                "tag": ev.tag,
                "message": ev.message,
                "dir": ev.dir,
                "targetCode": ev.target_code,
            })
        })
        .collect();
    serde_json::to_string(&serde_json::json!({
        "stationCode": anchor.code,
        "events": out,
    }))
    .map_err(err)
}

fn parse_color_map_inner(text: &str) -> Result<String, String> {
    serde_json::to_string(&crate::category::parse_color_map(text)).map_err(err)
}

// ---------------------------------------------------------------------------
// wasm-bindgen surface (feature `wasm` only; native builds see plain fns).
// ---------------------------------------------------------------------------

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn build_full_snapshot(built_at: &str, st_docs_json: &str, masters_json: &str) -> Result<String, wasm_bindgen::JsValue> {
    build_full_snapshot_inner(built_at, st_docs_json, masters_json)
        .map_err(|e| wasm_bindgen::JsValue::from_str(&e))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn build_view_json(snapshot_json: &str, req_json: &str) -> Result<String, wasm_bindgen::JsValue> {
    build_view_inner(snapshot_json, req_json)
        .map_err(|e| wasm_bindgen::JsValue::from_str(&e))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn cron_evaluate_json(snapshot_json: &str, req_json: &str) -> Result<String, wasm_bindgen::JsValue> {
    cron_evaluate_inner(snapshot_json, req_json)
        .map_err(|e| wasm_bindgen::JsValue::from_str(&e))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn parse_color_map_json(text: &str) -> Result<String, wasm_bindgen::JsValue> {
    parse_color_map_inner(text).map_err(|e| wasm_bindgen::JsValue::from_str(&e))
}

#[cfg(feature = "wasm")]
#[wasm_bindgen]
pub fn snapshot_version() -> u32 {
    crate::network::SNAPSHOT_VERSION
}

// Native shims so `cargo test` covers the same code without wasm-bindgen.
#[cfg(not(feature = "wasm"))]
pub fn build_full_snapshot(
    built_at: &str,
    st_docs_json: &str,
    masters_json: &str,
) -> Result<String, String> {
    build_full_snapshot_inner(built_at, st_docs_json, masters_json)
}

#[cfg(not(feature = "wasm"))]
pub fn build_view_json(snapshot_json: &str, req_json: &str) -> Result<String, String> {
    build_view_inner(snapshot_json, req_json)
}

#[cfg(not(feature = "wasm"))]
pub fn cron_evaluate_json(snapshot_json: &str, req_json: &str) -> Result<String, String> {
    cron_evaluate_inner(snapshot_json, req_json)
}

#[cfg(not(feature = "wasm"))]
pub fn parse_color_map_json(text: &str) -> Result<String, String> {
    parse_color_map_inner(text)
}

#[cfg(not(feature = "wasm"))]
pub fn snapshot_version() -> u32 {
    crate::network::SNAPSHOT_VERSION
}

#[cfg(test)]
mod wasm_api_tests {
    use super::*;

    #[test]
    fn prefs_pair_parses_client_shape() {
        let (up, down) = parse_pair(
            r#"{"up":{"cats":[2],"pass":true,"carsMin":9,"carsFilter":true,"targets":{"pass":"0410"}},"down":{"cats":[]}}"#,
        );
        assert_eq!(up.cats, vec![2]);
        assert!(up.pass);
        assert_eq!(up.cars_min, 9.0);
        assert!(up.cars_filter_enabled);
        assert_eq!(up.pass_target.as_deref(), Some("0410"));
        assert!(down.cats.is_empty());
    }

    #[test]
    fn unknown_line_rejected() {
        let snap = serde_json::json!({
            "version": crate::network::SNAPSHOT_VERSION,
            "built_at": "2026-01-01T00:00:00Z",
            "orders": {"kyoto": ["a"]},
            "lines": {},
        });
        let req = serde_json::json!({
            "scopeLines": ["kyoto"], "primaryLine": "kyoto",
            "fixedStation": "茨木", "fixedArea": "kinki",
            "viewedLine": "nope", "stationQuery": "",
            "pass": "hide", "areaQuery": "",
            "payloads": [], "serverTime": "", "colorMap": {},
            "trafficDoc": null,
        });
        let e = build_view_json(
            &serde_json::to_string(&snap).unwrap(),
            &serde_json::to_string(&req).unwrap(),
        )
        .unwrap_err();
        assert_eq!(e, "unknown line");
    }
}
