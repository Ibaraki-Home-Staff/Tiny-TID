//! View pipeline: port of tid.js refreshTrains data path.

use crate::category::{
    base_type_text_class, configured_type_text_class, normalize_display_type, train_category,
    UNKNOWN,
};
use crate::model::{Dest, TrainPosDoc, TrainsItem};
use crate::network::{merge_scope_on_line, normalize_name, MergedIndex};
use crate::vmtypes::{StationIdx, StationRef, TrafficItems, TrainVm, ViewResponse};
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};


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
    /// When set, the stations list (dropdown + alarm geometry) is limited
    /// to units containing this line; train filtering still uses the full
    /// merge so through trains from other payloads keep working.
    pub station_line: Option<&'a str>,
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
    /// representative unit codes ("" when unresolvable)
    at_unit: String,
    next_unit: String,
    stopped: bool,
    pos_index: f64,
    dest_index: Option<f64>,
    /// Farthest segment endpoint from the anchor (segment countermeasure:
    /// a straddling midpoint would collapse to the anchor).
    edge_index: f64,
    /// Any endpoint at the anchor, or endpoints on opposite sides of it:
    /// the train is here, keep regardless of destination.
    touches_anchor: bool,
    category: i8,
    color_class: String,
}

pub fn build_view(
    source: &MergedScopeSource<'_>,
    input: &ViewInput<'_>,
) -> ViewResponse {
    let merged = merge_scope_on_line(
        source.snapshot,
        source.lines,
        source.primary_line,
        input.station,
        input.station_line,
    );

    // Anchor resolution prefers the viewed line: numeric codes are reused
    // across areas (kosei 0614 安曇川 vs 0614 東郡家), so a bare rep lookup
    // may hit another area's unit in a snapshot-wide merge.
    let selected_node = (|| {
        if let Some(l) = input.station_line {
            if let Some(u) = merged.unit(l, input.station) {
                return Some(u.clone());
            }
        }
        if let Some(u) = merged.by_code.get(input.station) {
            return Some(u.clone());
        }
        let wanted = normalize_name(input.station);
        if wanted.is_empty() {
            return None;
        }
        let mut fallback = None;
        for n in merged.by_code.values() {
            if normalize_name(&n.name) == wanted {
                if input
                    .station_line
                    .map(|l| merged.unit_has_line(&n.code, l))
                    .unwrap_or(true)
                {
                    return Some(n.clone());
                }
                if fallback.is_none() {
                    fallback = Some(n.clone());
                }
            }
        }
        fallback
    })();
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

    // hidePassed port + pass-through rule (replaces hideTerminatesBeforeSelected).
    if let Some(idx) = selected_idx {
        // The track graph is only needed for destinations outside the scope
        // merge; skip building it when every destination resolved in-merge.
        let need_graph = list.iter().any(|e| e.dest_index.is_none());
        let graph = need_graph.then(|| build_track_graph(source.snapshot));
        up.retain(|e| {
            if !e.pos_index.is_finite() || e.pos_index < idx {
                return false;
            }
            match locate_dest(&e.raw, &merged, source.snapshot, graph.as_ref()) {
                // Present but resolving nowhere in the national snapshot:
                // drop, unless a via route marks it as through service.
                // via trains head for termini outside JR-West coverage
                // (敦賀 since the Shinkansen extension: isolated node), so
                // the routing itself is the arrival evidence. Dest-less
                // trains stay: nothing to judge by.
                Some(d) => passes_selected(e.edge_index, e.touches_anchor, d),
                None => {
                    e.raw.dest.is_none()
                        || !e.raw.via.as_deref().map(str::trim).unwrap_or_default().is_empty()
                }
            }
        });
        down.retain(|e| {
            if !e.pos_index.is_finite() || e.pos_index > idx {
                return false;
            }
            match locate_dest(&e.raw, &merged, source.snapshot, graph.as_ref()) {
                Some(d) => passes_selected(e.edge_index, e.touches_anchor, d),
                None => {
                    e.raw.dest.is_none()
                        || !e.raw.via.as_deref().map(str::trim).unwrap_or_default().is_empty()
                }
            }
        });
    } else if input.station.trim().is_empty() {
        // All-trains mode over a wider merge: keep only trains currently on
        // the requested line (either segment endpoint carries the line).
        // Without this the station-less path keeps every fetched payload.
        if let Some(l) = input.station_line {
            let on_line = |e: &&Enhanced| {
                merged.unit_has_line(&e.at_unit, l) || merged.unit_has_line(&e.next_unit, l)
            };
            up.retain(on_line);
            down.retain(on_line);
        }
    }
    // posPart port: stopped→atName / up→nextName → atName / down→atName → nextName
    let to_vm = |e: &Enhanced| -> TrainVm {
        let uname = |code: &str| -> String {
            merged
                .unit(&e.line_id, code)
                .map(|u| u.name.clone())
                .filter(|n| !n.is_empty())
                .or_else(|| merged.unit_by_any_code(code).map(|u| u.name.clone()))
                .filter(|n| !n.is_empty())
                .or_else(|| snapshot_name(source.snapshot, &e.line_id, code))
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
            via: e.raw.via.clone().unwrap_or_default().trim().to_string(),
            cars: e.raw.number_of_cars,
            delay_minutes: e.raw.delay_minutes,
            at_code: e.at_code.clone(),
            next_code: e.next_code.clone(),
            at_unit,
            next_unit,
            stopped: e.stopped,
            pos_index: e.pos_index,
            pos_label,
            dest_text: dest_text(e, &merged, source.snapshot),
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
            .filter(|c| match input.station_line {
                Some(l) => merged.unit_has_line(c, l),
                None => true,
            })
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
        area_name: String::new(),
        line_names: BTreeMap::new(),
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
    // Signed farther endpoint from the anchor (segment countermeasure: a
    // straddling midpoint would collapse to the anchor). The sign is the
    // side; magnitude ties only occur on straddles, where `touches_anchor`
    // decides anyway. Matches the user rule: |p + d| < max(|p|, |d|).
    let edge_index = match (at_idx, next_idx) {
        (Some(a), Some(n)) => {
            if a.abs() >= n.abs() {
                a
            } else {
                n
            }
        }
        (Some(a), None) => a,
        (None, Some(n)) => n,
        (None, None) => f64::INFINITY,
    };
    let touches_anchor = match (at_idx, next_idx) {
        (Some(a), Some(n)) => a == 0.0 || n == 0.0 || a.signum() != n.signum(),
        (Some(a), None) => a == 0.0,
        (None, Some(n)) => n == 0.0,
        (None, None) => false,
    };
    // Fully unresolvable position (out-of-scope codes in a foreign payload,
    // live kyoto-payload 4706C-class at 0419/1508): +inf sorts last and can
    // never equal the anchor index. 0.0 here once masqueraded such trains
    // as sitting AT the selected station (4705C topped the down list).
    let pos_index = match (at_idx, next_idx) {
        (Some(a), Some(n)) if !stopped => (a + n) / 2.0,
        (Some(a), _) => a,
        (_, Some(n)) => n,
        _ => f64::INFINITY,
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
        at_unit: at_unit.map(|u| u.code.clone()).unwrap_or_default(),
        next_unit: next_unit.map(|u| u.code.clone()).unwrap_or_default(),
        stopped,
        pos_index,
        dest_index: resolve_dest_index(raw, merged),
        edge_index,
        touches_anchor,
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

/// Display-only name lookup across the whole snapshot (not just the scope
/// merge): own line first (pos codes are line-local), then the unique
/// match across all lines. Ambiguous codes (shared by several lines) yield
/// nothing — a raw code display beats a wrong name. Labels only, never
/// geometry.
fn snapshot_name(snapshot: &NetworkSnapshot, line_id: &str, code: &str) -> Option<String> {
    if code.trim().is_empty() {
        return None;
    }
    if let Some(st) = snapshot.lines.get(line_id).and_then(|m| m.get(code)) {
        if !st.name.trim().is_empty() {
            return Some(st.name.trim().to_string());
        }
    }
    let mut found: Option<String> = None;
    for (line, m) in &snapshot.lines {
        if line == line_id {
            continue;
        }
        if let Some(st) = m.get(code) {
            if st.name.trim().is_empty() {
                continue;
            }
            if found.is_some() {
                return None; // ambiguous: reused code, refuse to guess
            }
            found = Some(st.name.trim().to_string());
        }
    }
    found
}

/// getDestText port: text/name first, then merged-index name, then code.
fn dest_text(e: &Enhanced, merged: &MergedIndex, snapshot: &NetworkSnapshot) -> String {
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
                    .filter(|n| !n.is_empty())
                    .or_else(|| snapshot_name(snapshot, &e.line_id, code))
                    .unwrap_or_else(|| code.clone()),
                None => String::new(),
            }
        }
    }
}

/// Destination anchor-relative index. Units unreachable from the anchor
/// (index 9999, ex-isolated 敦賀) resolve as None: their placeholder index
/// would otherwise read as same-side-farther and kill through trains.
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
                if u.index < 9999.0 {
                    return Some(u.index);
                }
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
        .filter(|n| n.index < 9999.0)
        .find(|n| normalize_name(&n.name) == name)
        .map(|n| n.index)
}

/// Pass-through rule (user spec): with anchor-relative signed distances, a
/// train passes the selected station iff its position and destination lie
/// on opposite sides: |p + d| < max(|p|, |d|). Touching or straddling the
/// anchor, or a destination AT the anchor, keeps the train. Callers decide
/// the unresolvable case (absent dest keeps, present-but-nowhere drops).
fn passes_selected(edge_index: f64, touches_anchor: bool, dest_index: f64) -> bool {
    if touches_anchor || dest_index == 0.0 {
        return true;
    }
    (edge_index + dest_index).abs() < edge_index.abs().max(dest_index.abs())
}

/// Destination anchor-relative index: merged-frame index when resolvable
/// there (ver1 parity), else a projection over the full snapshot track
/// graph (nearest scope attachment extended outward). Unreachable → None.
fn locate_dest(
    raw: &TrainsItem,
    merged: &MergedIndex,
    snapshot: &NetworkSnapshot,
    graph: Option<&TrackGraph>,
) -> Option<f64> {
    if let Some(i) = resolve_dest_index(raw, merged) {
        return Some(i);
    }
    let g = graph?;
    let seeds = dest_candidates(raw, snapshot);
    if seeds.is_empty() {
        return None;
    }
    project_dest(merged, g, &seeds)
}

/// Snapshot nodes that could be the destination: code matches across all
/// lines first (codes are line-local, collisions possible), else a name
/// match. Empty when nothing resembles the destination.
fn dest_candidates(raw: &TrainsItem, snapshot: &NetworkSnapshot) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut named = String::new();
    if let Some(Dest::Obj(o)) = raw.dest.as_ref() {
        if let Some(c) = o.code.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            for (line, m) in &snapshot.lines {
                if m.contains_key(c) {
                    out.push((line.clone(), c.to_string()));
                }
            }
        }
        if out.is_empty() {
            named = o
                .text
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .or_else(|| o.name.as_deref().map(str::trim).filter(|s| !s.is_empty()))
                .map(normalize_name)
                .unwrap_or_default();
        }
    } else if let Some(Dest::Str(s)) = raw.dest.as_ref() {
        named = normalize_name(s);
    }
    if out.is_empty() && !named.is_empty() {
        for (line, m) in &snapshot.lines {
            for (code, st) in m {
                if normalize_name(&st.name) == named {
                    out.push((line.clone(), code.clone()));
                }
            }
        }
    }
    out
}

type TrackGraph = HashMap<(String, String), Vec<(String, String)>>;

/// Full-snapshot undirected track graph: line orders plus identity and
/// neighbour edges. Mirrors the merge adjacency over all lines.
fn build_track_graph(snapshot: &NetworkSnapshot) -> TrackGraph {
    let mut g: TrackGraph = HashMap::new();
    let mut link = |a: (String, String), b: (String, String)| {
        if a == b {
            return;
        }
        g.entry(a.clone()).or_default().push(b.clone());
        g.entry(b).or_default().push(a);
    };
    for (line, order) in &snapshot.orders {
        let mut prev: Option<&String> = None;
        let mut seen = std::collections::BTreeSet::new();
        for code in order {
            if seen.insert(code.clone()) {
                if let Some(p) = prev {
                    link((line.clone(), p.clone()), (line.clone(), code.clone()));
                }
            }
            prev = Some(code);
        }
    }
    for (line, m) in &snapshot.lines {
        for (code, st) in m {
            for t in st.transfers.iter().chain(st.neighbors.iter()) {
                link((line.clone(), code.clone()), (t.line.clone(), t.code.clone()));
            }
        }
    }
    g
}

/// BFS from the destination candidates to the nearest scope-merged unit;
/// the proxy index extends that unit's signed index outward by the extra
/// hops. Scope-disconnected (9999) units are dead ends. Nothing reached →
/// None (keep, ver1-loose parity).
fn project_dest(
    merged: &MergedIndex,
    graph: &TrackGraph,
    seeds: &[(String, String)],
) -> Option<f64> {
    let mut visited: HashSet<(String, String)> = HashSet::new();
    let mut queue: VecDeque<((String, String), f64)> = VecDeque::new();
    for s in seeds {
        if visited.insert(s.clone()) {
            queue.push_back((s.clone(), 0.0));
        }
    }
    while let Some((node, extra)) = queue.pop_front() {
        if let Some(rep) = merged.unit_of.get(&node) {
            if let Some(u) = merged.by_code.get(rep) {
                if u.index < 9999.0 {
                    if u.index == 0.0 {
                        return Some(0.0);
                    }
                    return Some(u.index.signum() * (u.index.abs() + extra));
                }
            }
            continue;
        }
        if let Some(nbs) = graph.get(&node) {
            for m in nbs {
                if visited.insert(m.clone()) {
                    queue.push_back((m.clone(), extra + 1.0));
                }
            }
        }
    }
    None
}
