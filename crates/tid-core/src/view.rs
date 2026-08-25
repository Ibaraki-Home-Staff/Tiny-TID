//! View pipeline: port of tid.js refreshTrains data path.

use crate::category::{
    base_type_text_class, configured_type_text_class, normalize_display_type, train_category,
    UNKNOWN,
};
use crate::model::{Dest, TrainPosDoc, TrainsItem};
use crate::network::{merge_scope, normalize_name, MergedIndex};
use crate::vmtypes::{StationIdx, StationRef, TrafficItems, TrainVm, ViewResponse};
use std::collections::BTreeMap;


/// Bundle passed by the worker.
pub struct MergedScopeSource<'a> {
    pub snapshot: &'a NetworkSnapshot,
    pub lines: &'a [String],
    pub primary_line: &'a str,
}

use crate::network::NetworkSnapshot;

pub struct ViewInput<'a> {
    pub station: &'a str,
    pub pass: PassSetting,
    pub trains_payloads: &'a [(String, TrainPosDoc)],
    pub server_time: String,
    pub color_map: &'a BTreeMap<String, String>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PassSetting {
    Hide,
    Show,
}

impl PassSetting {
    pub fn parse(s: &str) -> Self {
        match s.trim() {
            "show" => PassSetting::Show,
            _ => PassSetting::Hide,
        }
    }
}

#[derive(Debug, Clone)]
struct Enhanced {
    raw: TrainsItem,
    line_id: String,
    display_type: String,
    nickname: String,
    at_code: String,
    next_code: Option<String>,
    stopped: bool,
    pos_index: f64,
    dest_index: Option<f64>,
    category: i8,
    color_class: String,
}

pub fn build_view(
    source: &MergedScopeSource<'_>,
    input: &ViewInput<'_>,
) -> ViewResponse {
    let merged = merge_scope(
        source.snapshot,
        source.lines,
        source.primary_line,
        input.station,
    );

    let wanted = normalize_name(input.station);
    let selected_node = merged.by_code.get(input.station).cloned().or_else(|| {
        merged
            .by_code
            .values()
            .find(|n| normalize_name(&n.name) == wanted)
            .cloned()
    });
    let selected_idx: Option<f64> = selected_node.as_ref().map(|n| n.index);

    // stationAllowedCategories port: null when stopTrains absent.
    let allowed_cats: Option<Vec<i8>> = selected_node
        .as_ref()
        .and_then(|n| n.stop_trains.clone())
        .map(|codes| {
            let mut cats: Vec<i8> = codes.iter().map(|c| *c as i8).collect();
            if !cats.contains(&crate::category::LOCAL) {
                cats.push(crate::category::LOCAL);
            }
            cats.sort();
            cats.dedup();
            cats
        });

    // mergeTrainPayloads port (same-format ISO strings compare lexicographically).
    let mut update = String::new();
    let mut seen = std::collections::HashSet::new();
    let mut flat: Vec<(&String, &TrainsItem)> = Vec::new();
    for (line_id, payload) in input.trains_payloads {
        if payload.update > update {
            update = payload.update.clone();
        }
        for t in &payload.trains {
            if seen.insert(format!("{}|{}|{}", t.no, t.pos, t.direction)) {
                flat.push((line_id, t));
            }
        }
    }

    let mut list: Vec<Enhanced> = flat
        .iter()
        .map(|(l, t)| enhance(l, t, &merged, input.color_map))
        .collect();

    // filterByStationSetting port.
    list.retain(|e| match &allowed_cats {
        None => true,
        Some(cats) => {
            let stops =
                (e.category != UNKNOWN && cats.contains(&e.category)) || e.category == UNKNOWN;
            input.pass == PassSetting::Show || stops
        }
    });

    let mut up: Vec<&Enhanced> = list.iter().filter(|e| e.raw.direction == 0).collect();
    let mut down: Vec<&Enhanced> = list.iter().filter(|e| e.raw.direction == 1).collect();
    up.sort_by(|a, b| a.pos_index.total_cmp(&b.pos_index));
    down.sort_by(|a, b| b.pos_index.total_cmp(&a.pos_index));

    // hidePassed + hideTerminatesBeforeSelected ports.
    if let Some(idx) = selected_idx {
        up.retain(|e| e.pos_index >= idx && !terminates_before(e, idx, 0));
        down.retain(|e| e.pos_index <= idx && !terminates_before(e, idx, 1));
    }

    // posPart port: stopped→atName / up→nextName → atName / down→atName → nextName
    let to_vm = |e: &Enhanced| -> TrainVm {
        let uname = |code: &str| -> String {
            merged
                .unit(&e.line_id, code)
                .map(|u| u.name.clone())
                .filter(|n| !n.is_empty())
                .or_else(|| merged.unit_by_any_code(code).map(|u| u.name.clone()))
                .unwrap_or_else(|| code.to_string())
        };
        let at_name = uname(&e.at_code);
        let next_name = e.next_code.as_deref().map(|c| uname(c)).unwrap_or_default();
        let pos_label = if e.stopped {
            at_name.clone()
        } else if e.raw.direction == 0 {
            format!("{next_name} → {at_name}")
        } else {
            format!("{at_name} → {next_name}")
        };
        let at_unit = merged.unit_of.get(&(e.line_id.clone(), e.at_code.clone())).cloned().unwrap_or_default();
        let next_unit = e.next_code.as_ref()
            .and_then(|c| merged.unit_of.get(&(e.line_id.clone(), c.clone())).cloned())
            .unwrap_or_default();
        TrainVm {
            no: e.raw.no.trim().to_string(),
            line_id: e.line_id.clone(),
            direction: e.raw.direction,
            display_type: e.display_type.clone(),
            nickname: e.nickname.clone(),
            cars: e.raw.number_of_cars,
            delay_minutes: e.raw.delay_minutes,
            at_code: e.at_code.clone(),
            next_code: e.next_code.clone(),
            at_unit,
            next_unit,
            stopped: e.stopped,
            pos_index: e.pos_index,
            pos_label,
            dest_text: dest_text(e, &merged),
            category: e.category,
            category_label: crate::category::category_label(e.category),
            color_class: e.color_class.clone(),
            will_stop_here: allowed_cats.as_ref().map(|cats| {
                (e.category != UNKNOWN && cats.contains(&e.category)) || e.category == UNKNOWN
            }),
        }
    };

    ViewResponse {
        server_time: input.server_time.clone(),
        update,
        station: StationRef {
            code: selected_node
                .as_ref()
                .map(|n| n.code.clone())
                .unwrap_or_default(),
            name: selected_node.map(|n| n.name).unwrap_or_default(),
        },
        station_allowed_cats: allowed_cats.clone(),
        stations: merged
            .order
            .iter()
            .filter_map(|c| {
                merged.by_code.get(c).map(|n| StationIdx {
                    code: n.code.clone(),
                    name: n.name.clone(),
                    index: n.index,
                })
            })
            .collect(),
        up: up.iter().map(|&e| to_vm(e)).collect(),
        down: down.iter().map(|&e| to_vm(e)).collect(),
        traffic: TrafficItems::default(),
    }
}

fn enhance(
    line_id: &str,
    raw: &TrainsItem,
    merged: &MergedIndex,
    color_map: &BTreeMap<String, String>,
) -> Enhanced {
    let (at_code, next_code, stopped) = parse_pos(&raw.pos);

    let at_unit = merged.unit(line_id, &at_code);
    let next_unit = next_code.as_deref().and_then(|c| merged.unit(line_id, c));
    let at_idx = at_unit.map(|u| u.index);
    let next_idx = next_unit.map(|u| u.index);
    let pos_index = match (at_idx, next_idx) {
        (Some(a), Some(n)) if !stopped => (a + n) / 2.0,
        (Some(a), _) => a,
        (_, Some(n)) => n,
        _ => 0.0,
    };

    let mut nickname = raw.nickname_text();
    let display_type =
        normalize_display_type(raw.display_type_trimmed().as_str(), &mut nickname);
    let category = train_category(&display_type);
    let configured = configured_type_text_class(&display_type, color_map);
    let color_class = if configured.is_empty() {
        base_type_text_class(category).to_string()
    } else {
        configured
    };

    Enhanced {
        raw: raw.clone(),
        line_id: line_id.to_string(),
        display_type,
        nickname,
        at_code,
        next_code,
        stopped,
        pos_index,
        dest_index: resolve_dest_index(raw, merged),
        category,
        color_class,
    }
}

/// parsePos port: `A_B` moving; `A####`/`A` stopped.
fn parse_pos(pos: &str) -> (String, Option<String>, bool) {
    let mut parts = pos.split('_');
    let left = parts.next().unwrap_or("").trim().to_string();
    match parts.next() {
        Some(right) if right != "####" && !right.is_empty() => {
            (left, Some(right.trim().to_string()), false)
        }
        _ => (left, None, true),
    }
}

fn name_of(merged: &MergedIndex, code: &str) -> String {
    merged
        .by_code
        .get(code)
        .map(|n| n.name.clone())
        .unwrap_or_else(|| code.to_string())
}

/// getDestText port: text/name first, then merged-index name, then code.
fn dest_text(e: &Enhanced, merged: &MergedIndex) -> String {
    match &e.raw.dest {
        None => String::new(),
        Some(Dest::Str(s)) => s.trim().to_string(),
        Some(Dest::Obj(o)) => {
            if let Some(t) = o.text.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                return t.to_string();
            }
            if let Some(n) = o.name.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
                return n.to_string();
            }
            match &o.code {
                Some(code) => merged
                    .unit_by_any_code(code)
                    .map(|u| u.name.clone())
                    .unwrap_or_else(|| code.clone()),
                None => String::new(),
            }
        }
    }
}

#[allow(dead_code)]
fn resolve_dest_index(raw: &TrainsItem, merged: &MergedIndex) -> Option<f64> {
    let dest = raw.dest.as_ref()?;
    let code: Option<String> = match dest {
        Dest::Str(_) => None,
        Dest::Obj(o) => o.code.clone().filter(|c| !c.is_empty()),
    };
    if let Some(code) = code {
        if let Some(rep) = merged.unit_of.values().find(|r| {
            merged.by_code.get(*r).map(|u| u.code == code).unwrap_or(false)
        }) {
            if let Some(u) = merged.by_code.get(rep) {
                return Some(u.index);
            }
        }
    }
    let name = match dest {
        Dest::Str(s) => normalize_name(s),
        Dest::Obj(o) => o
            .text
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .or_else(|| o.name.as_deref().filter(|s| !s.trim().is_empty()))
            .map(normalize_name)
            .unwrap_or_default(),
    };
    if name.is_empty() {
        return None;
    }
    merged
        .by_code
        .values()
        .find(|n| normalize_name(&n.name) == name)
        .map(|n| n.index)
}

fn terminates_before(e: &Enhanced, station_idx: f64, direction: i64) -> bool {
    match e.dest_index {
        Some(d) => {
            if direction == 0 {
                d <= station_idx
            } else {
                d >= station_idx
            }
        }
        None => false,
    }
}
