//! Station network snapshot v2 + scope hop normalization.
//!
//! Identity: `(line_id, code)` — numeric codes are reused across areas
//! (`0410` = 茨木 in kinki, 広野 elsewhere), so nodes are per-line and
//! connectivity comes only from explicit metadata:
//! - `info.transfer[]{link,linkCode}`
//! - `design.upside/downside[]{linkLine,linkStationCode}`

use crate::model::{StationsDoc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};

pub const SNAPSHOT_VERSION: u32 = 5;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct NetworkSnapshot {
    pub version: u32,
    pub built_at: String,
    /// line id -> ordered codes (normalized upper→lower, see below)
    pub orders: BTreeMap<String, Vec<String>>,
    /// line id -> { code -> station }
    pub lines: BTreeMap<String, BTreeMap<CodeKey, LineStation>>,
    /// line id -> display + direction datum from the area master
    #[serde(default)]
    pub line_meta: BTreeMap<String, crate::model::LineMeta>,
}

/// Store master metadata and normalize every listing to upper→lower order:
/// the travel rule (dir0 toward listing-start) then holds by construction,
/// even if upstream ever flips a listing. Unknown/missing ends leave the
/// order untouched.
pub fn apply_line_meta(snap: &mut NetworkSnapshot, meta: &BTreeMap<String, crate::model::LineMeta>) {
    for (line, lm) in meta {
        if lm.name.is_empty() && lm.upper.is_empty() && lm.lower.is_empty() {
            continue;
        }
        snap.line_meta.insert(line.clone(), lm.clone());
    }
    normalize_orders(snap);
}

fn normalize_orders(snap: &mut NetworkSnapshot) {
    let mut reversed: Vec<String> = Vec::new();
    for (line, order) in &snap.orders {
        let Some(lm) = snap.line_meta.get(line) else {
            continue;
        };
        let names: Vec<String> = order
            .iter()
            .map(|c| {
                snap.lines
                    .get(line)
                    .and_then(|m| m.get(c))
                    .map(|s| norm_name(&s.name))
                    .unwrap_or_default()
            })
            .collect();
        let (Some(up), Some(lo)) = (find_end(&names, &lm.upper), find_end(&names, &lm.lower)) else {
            continue;
        };
        if up > lo {
            reversed.push(line.clone());
        }
    }
    for line in reversed {
        if let Some(order) = snap.orders.get_mut(&line) {
            order.reverse();
        }
    }
}

/// Locate a terminus name in a listing: exact match first, then the first
/// matching part of compounds like 姫路・上郡.
fn find_end(names: &[String], want: &str) -> Option<usize> {
    let w = norm_name(want);
    if w.is_empty() {
        return None;
    }
    if let Some(i) = names.iter().position(|n| *n == w) {
        return Some(i);
    }
    for part in w.split(['・', '、', '/', '，']) {
        if part.is_empty() {
            continue;
        }
        if let Some(i) = names.iter().position(|n| *n == part) {
            return Some(i);
        }
    }
    None
}

/// JSON object keys are station codes; serde maps need String keys.
pub type CodeKey = String;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct LineStation {
    pub name: String,
    #[serde(rename = "st", default)]
    pub stop_trains: Option<Vec<i64>>,
    /// Same-station links across lines (identity for union).
    #[serde(default)]
    pub transfers: Vec<TransferEdge>,
    /// Track-neighbour links from design upside/downside (adjacency only,
    /// never identity: they point at the next station, not this one).
    #[serde(default)]
    pub neighbors: Vec<TransferEdge>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TransferEdge {
    pub line: String,
    pub code: String,
    /// 0=transfer(JR), other=design branch/continuation provenance
    pub kind: i64,
}

/// Pure builder; fetching happens in the worker.
pub fn build_snapshot(built_at: &str, st_docs: &[(String, StationsDoc)]) -> NetworkSnapshot {
    let mut snap = NetworkSnapshot {
        version: SNAPSHOT_VERSION,
        built_at: built_at.to_string(),
        ..Default::default()
    };

    for (line_id, doc) in st_docs {
        let mut order: Vec<String> = Vec::new();
        let mut seen_in_line: BTreeSet<String> = BTreeSet::new();
        let map = snap.lines.entry(line_id.clone()).or_default();

        for item in &doc.stations {
            let info = &item.info;
            if info.code.trim().is_empty() { continue; }
            let code = info.code.trim().to_string();
            let name = if info.name.trim().is_empty() { code.clone() } else { info.name.trim().to_string() };
            order.push(code.clone());

            let mut transfers: Vec<TransferEdge> = Vec::new();
            if let Some(list) = &info.transfer {
                for t in list {
                    let (Some(l), Some(c)) = (t.link.as_deref(), t.link_code.as_deref()) else { continue };
                    let (l, c) = (l.trim(), c.trim());
                    if l.is_empty() || c.is_empty() { continue; }
                    transfers.push(TransferEdge { line: l.to_string(), code: c.to_string(), kind: t.r#type });
                }
            }
            let mut neighbors: Vec<TransferEdge> = Vec::new();
            for side in item.design.upside.iter().chain(item.design.downside.iter()) {
                for d in side.iter() {
                    let (Some(ll), Some(lc)) =
                        (d.link_line.as_deref().map(str::trim), d.link_station_code.as_deref().map(str::trim))
                    else { continue };
                    if ll.is_empty() || lc.is_empty() || lc == code || ll == line_id.as_str() { continue; }
                    neighbors.push(TransferEdge { line: ll.to_string(), code: lc.to_string(), kind: d.r#type });
                }
            }

            let entry = map
                .entry(code.clone())
                .or_insert_with(|| LineStation { name: name.clone(), stop_trains: info.stop_trains.clone(), transfers, neighbors });
            if entry.name.is_empty() { entry.name = name; }
            let empty_st = entry.stop_trains.as_ref().map(|v| v.is_empty()).unwrap_or(true);
            if empty_st {
                if let Some(st) = info.stop_trains.as_ref() {
                    if !st.is_empty() { entry.stop_trains = Some(st.clone()); }
                }
            }

            // Chain edges are derived from `orders` at merge time; branch
            // rejoins (repeated code within one line listing) are not chained.
            seen_in_line.insert(code.clone());
        }

        if !order.is_empty() {
            snap.orders.insert(line_id.clone(), order);
        }
    }

    prune_links(&mut snap);
    implicit_unions(&mut snap);
    snap
}

fn prune_links(snap: &mut NetworkSnapshot) {
    for m in snap.lines.values_mut() {
        for st in m.values_mut() {
            st.transfers.retain(|t| !t.line.starts_with("http"));
            st.neighbors.retain(|t| !t.line.starts_with("http"));
        }
    }
    let keys: Vec<(String, String)> = snap
        .lines
        .iter()
        .flat_map(|(l, m)| m.keys().map(move |c| (l.clone(), c.clone())))
        .collect();
    let exists = |line: &str, code: &str| keys.contains(&(line.to_string(), code.to_string()));
    for m in snap.lines.values_mut() {
        for st in m.values_mut() {
            st.transfers.retain(|t| exists(&t.line, &t.code));
            st.neighbors.retain(|t| exists(&t.line, &t.code));
        }
    }
}

fn norm_name(v: &str) -> String {
    v.trim().chars().filter(|c| !c.is_whitespace()).collect()
}

fn implicit_unions(snap: &mut NetworkSnapshot) {
    // Line pairs that already share an explicit link (for Rule B).
    let mut direct: BTreeSet<[String; 2]> = BTreeSet::new();
    for (line_id, m) in &snap.lines {
        for st in m.values() {
            for t in &st.transfers {
                if snap.lines.contains_key(&t.line) {
                    let mut pair = [line_id.clone(), t.line.clone()];
                    pair.sort();
                    direct.insert(pair);
                }
            }
        }
    }

    // code -> [(line, normalized name)]
    let mut by_code: BTreeMap<String, Vec<(String, String)>> = BTreeMap::new();
    for (line_id, m) in &snap.lines {
        for (code, st) in m {
            let n = norm_name(&st.name);
            if !n.is_empty() {
                by_code.entry(code.clone()).or_default().push((line_id.clone(), n));
            }
        }
    }

    // Rule A: same code + same normalized name.
    for (code, entries) in &by_code {
        if entries.len() < 2 { continue; }
        for i in 0..entries.len() {
            for j in i + 1..entries.len() {
                let (la, na) = (&entries[i].0, &entries[i].1);
                let (lb, nb) = (&entries[j].0, &entries[j].1);
                if la == lb || na != nb { continue; }
                add_edge(snap, la, code, TransferEdge { line: lb.clone(), code: code.clone(), kind: -1 });
                add_edge(snap, lb, code, TransferEdge { line: la.clone(), code: code.clone(), kind: -1 });
            }
        }
    }

    // Rule B: same normalized name, different codes, on directly-linked lines.
    let mut by_name: BTreeMap<String, Vec<(String, String)>> = BTreeMap::new();
    for (line_id, m) in &snap.lines {
        for (code, st) in m {
            let n = norm_name(&st.name);
            if !n.is_empty() {
                by_name.entry(n).or_default().push((line_id.clone(), code.clone()));
            }
        }
    }
    for (_name, entries) in &by_name {
        if entries.len() < 2 { continue; }
        for i in 0..entries.len() {
            for j in i + 1..entries.len() {
                let (la, ca) = (&entries[i].0, &entries[i].1);
                let (lb, cb) = (&entries[j].0, &entries[j].1);
                if la == lb || ca == cb { continue; } // same code handled by Rule A
                let mut pair = [la.clone(), lb.clone()];
                pair.sort();
                if direct.contains(&pair) {
                    add_edge(snap, la, ca, TransferEdge { line: lb.clone(), code: cb.clone(), kind: -2 });
                    add_edge(snap, lb, cb, TransferEdge { line: la.clone(), code: ca.clone(), kind: -2 });
                }
            }
        }
    }
}

fn add_edge(snap: &mut NetworkSnapshot, line: &str, code: &str, t: TransferEdge) {
    if let Some(st) = snap.lines.get_mut(line).and_then(|m| m.get_mut(code)) {
        if !st.transfers.iter().any(|e| e.line == t.line && e.code == t.code) {
            st.transfers.push(t);
        }
    }
}

// ---------------------------------------------------------------------------
// Scope merge v2
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default)]
pub struct Unit {
    /// representative code (primary-line occurrence when present)
    pub code: String,
    pub name: String,
    pub stop_trains: Option<Vec<i64>>,
    pub index: f64,
    pub distance: f64,
    pub side: i32,
    /// false when the sign fell back to the +1 default (first hop was
    /// neither primary neighbour, or the unit is unreachable). Unsigned
    /// units sort after signed ones at the same index so they can never
    /// hijack the alarm ahead-window (order[idx+-1]).
    pub signed: bool,
}

#[derive(Debug, Clone, Default)]
pub struct MergedIndex {
    pub by_code: BTreeMap<String, Unit>,
    pub order: Vec<String>,
    /// (line,code) -> rep code
    pub unit_of: HashMap<(String, String), String>,
}

impl MergedIndex {
    /// First unit whose any member uses `code` (line-agnostic lookup).
    pub fn unit_by_any_code(&self, code: &str) -> Option<&Unit> {
        let mut best: Option<(&String, &Unit)> = None;
        for ((_, c), rep) in &self.unit_of {
            if c == code {
                if let Some(u) = self.by_code.get(rep) {
                    // Prefer the shortest rep (= least-suffixed) for stability.
                    if best.map(|(br, _)| rep.len() <= br.len()).unwrap_or(true) {
                        best = Some((rep, u));
                    }
                }
            }
        }
        best.map(|(_, u)| u)
    }

    pub fn unit(&self, line: &str, code: &str) -> Option<&Unit> {
        let rep = self.unit_of.get(&(line.to_string(), code.to_string()))?;
        self.by_code.get(rep)
    }
}

fn norm(v: &str) -> String {
    v.trim().chars().filter(|c| !c.is_whitespace()).collect()
}

struct Dsu(Vec<usize>);
impl Dsu {
    fn new(n: usize) -> Self { Self((0..n).collect()) }
    fn find(&mut self, mut x: usize) -> usize {
        while self.0[x] != x { self.0[x] = self.0[self.0[x]]; x = self.0[x]; }
        x
    }
    fn union(&mut self, a: usize, b: usize) {
        let ra = self.find(a); let rb = self.find(b);
        if ra != rb { self.0[ra] = rb; }
    }
}

struct Build {
    rep: String,
    /// [name_on_primary_line, first_name_seen]
    names: [String; 2],
    stops: Option<Vec<i64>>,
    members: Vec<(String, String)>,
}

pub fn merge_scope(
    snapshot: &NetworkSnapshot,
    scope_lines: &[String],
    primary_line: &str,
    selected: &str,
) -> MergedIndex {
    // -- collect scope nodes ---------------------------------------------------
    let mut id_of: HashMap<(String, String), usize> = HashMap::new();
    let mut nodes: Vec<(String, String)> = Vec::new();
    let mut orders_by_line: Vec<(String, Vec<String>)> = Vec::new();
    for line_id in scope_lines {
        let Some(order) = snapshot.orders.get(line_id.as_str()) else { continue };
        orders_by_line.push((line_id.clone(), order.clone()));
        for code in order {
            let id = nodes.len();
            id_of.insert((line_id.clone(), code.clone()), id);
            nodes.push((line_id.clone(), code.clone()));
        }
    }
    orders_by_line.sort_by(|a, b| a.0.cmp(&b.0));

    // -- union explicit cross-line links ---------------------------------------
    let mut dsu = Dsu::new(nodes.len());
    for (i, (l, c)) in nodes.iter().enumerate() {
        if let Some(st) = snapshot.lines.get(l).and_then(|m| m.get(c)) {
            for t in &st.transfers {
                if let Some(&j) = id_of.get(&(t.line.clone(), t.code.clone())) { dsu.union(i, j); }
            }
        }
    }

    // -- components ------------------------------------------------------------
    let mut comps: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for i in 0..nodes.len() { comps.entry(dsu.find(i)).or_default().push(i); }

    let primary_order: Option<&Vec<String>> =
        orders_by_line.iter().find(|(id, _)| id == primary_line).map(|(_, o)| o);

    // Pass 1: representative + metadata per component.
    struct Pre { best: Option<(String, String)>, names: [String; 2], stops: Option<Vec<i64>>, members: Vec<(String, String)> }
    let mut pres: Vec<Pre> = Vec::new();
    let mut comp_roots: Vec<usize> = Vec::new();
    for (_root, members) in &comps {
        comp_roots.push(*_root);
        let mut best: Option<(String, String)> = None;
        let mut best_primary = false;
        for &mi in members {
            let (l, c) = (&nodes[mi].0, &nodes[mi].1);
            let on_primary = l == primary_line
                && primary_order.map(|o| o.contains(c)).unwrap_or(false);
            let take = match (&best, best_primary) {
                (None, _) => true,
                (_, true) => false,
                (Some((bl, bc)), false) => on_primary
                    || (l.as_str(), c.as_str()) < (bl.as_str(), bc.as_str()),
            };
            if take { best = Some((l.clone(), c.clone())); best_primary = on_primary; }
        }
        let mut name_primary = String::new();
        let mut name_any = String::new();
        let mut stops: Option<Vec<i64>> = None;
        let mut members_out: Vec<(String, String)> = Vec::new();
        for &mi in members {
            let pair = (nodes[mi].0.clone(), nodes[mi].1.clone());
            if let Some(st) = snapshot.lines.get(&pair.0).and_then(|m| m.get(&pair.1)) {
                if !st.name.is_empty() {
                    if pair.0 == *primary_line && name_primary.is_empty() { name_primary = st.name.clone(); }
                    if name_any.is_empty() { name_any = st.name.clone(); }
                }
                if let Some(v) = &st.stop_trains {
                    let cur = stops.get_or_insert_with(Vec::new);
                    for x in v { if !cur.contains(x) { cur.push(*x); } }
                }
            }
            members_out.push(pair);
        }
        pres.push(Pre { best, names: [name_primary, name_any], stops, members: members_out });
    }

    // Pass 2: unique representatives.
    let mut used: BTreeSet<String> = BTreeSet::new();
    let mut reps: Vec<String> = Vec::with_capacity(pres.len());
    for pre in &pres {
        let mut rep = pre.best.as_ref().map(|(_, c)| c.clone()).unwrap_or_else(|| "?".to_string());
        if used.contains(&rep) {
            let mut i = 1usize;
            loop {
                let cand = format!("{rep}~{i}");
                if used.insert(cand.clone()) { rep = cand; break; }
                i += 1;
            }
        } else {
            used.insert(rep.clone());
        }
        reps.push(rep);
    }
    let mut root_rep: HashMap<usize, String> = HashMap::new();
    for (root, rep) in comp_roots.iter().zip(reps.iter()) {
        root_rep.insert(*root, rep.clone());
    }

    let mut builds: Vec<Build> = pres.into_iter().zip(reps.into_iter()).map(|(mut pre, rep)| {
        pre.names[0] = pre.names[0].clone();
        Build { rep, names: pre.names, stops: pre.stops, members: pre.members }
    }).collect();

    let mut unit_idx: HashMap<String, usize> = HashMap::new();
    for (ui, b) in builds.iter().enumerate() { unit_idx.entry(b.rep.clone()).or_insert(ui); }
    let mut unit_of: HashMap<(String, String), String> = HashMap::new();
    for (root, members) in &comps {
        if let Some(rep) = root_rep.get(root) {
            for &mi in members { unit_of.insert(nodes[mi].clone(), rep.clone()); }
        }
    }

    // -- adjacency between units ------------------------------------------------
    let mut adj: BTreeMap<usize, BTreeSet<usize>> = BTreeMap::new();
    {
        let mut link = |a: &(String, String), b: &(String, String)| {
            let ra = unit_of.get(a); let rb = unit_of.get(b);
            if let (Some(ra), Some(rb)) = (ra, rb) {
                let ua = unit_idx.get(ra).copied(); let ub = unit_idx.get(rb).copied();
                if let (Some(ua), Some(ub)) = (ua, ub) {
                    if ua != ub {
                        adj.entry(ua).or_default().insert(ub);
                        adj.entry(ub).or_default().insert(ua);
                    }
                }
            }
        };
        for (lid, order) in &orders_by_line {
            let mut prev: Option<&String> = None;
            let mut seen: BTreeSet<String> = BTreeSet::new();
            for code in order {
                if seen.insert(code.clone()) {
                    if let Some(p) = prev { link(&(lid.clone(), p.clone()), &(lid.clone(), code.clone())); }
                }
                prev = Some(code);
            }
        }
        for (l, c) in &nodes {
            if let Some(st) = snapshot.lines.get(l).and_then(|m| m.get(c)) {
                for t in &st.transfers { link(&(l.clone(), c.clone()), &(t.line.clone(), t.code.clone())); }
                // Neighbour (design) edges are track adjacency, never identity:
                // linked units stay separate but become BFS-reachable.
                for t in &st.neighbors { link(&(l.clone(), c.clone()), &(t.line.clone(), t.code.clone())); }
            }
        }
    }

    // -- anchor ------------------------------------------------------------------
    // Ranked match: exact rep code wins immediately; otherwise the best
    // candidate across all units wins (member code > name on primary line >
    // name elsewhere). The old first-hit order depended on component layout.
    let wanted = norm(selected);
    let mut anchor_ui: Option<usize> = None;
    let mut anchor_rank = u8::MAX;
    for (ui, b) in builds.iter().enumerate() {
        if b.rep == selected {
            anchor_ui = Some(ui);
            break;
        }
        let mut rank: Option<u8> = None;
        if b.members.iter().any(|(_, mc)| mc == selected) {
            rank = Some(1);
        } else if !wanted.is_empty() {
            let name_hit = b.names.iter().any(|n| norm(n) == wanted)
                || b.members.iter().any(|(ml, mc)| {
                    snapshot
                        .lines
                        .get(ml)
                        .and_then(|m| m.get(mc))
                        .map(|st| norm_name(&st.name) == wanted)
                        .unwrap_or(false)
                });
            if name_hit {
                let primary_hit = b.members.iter().any(|(ml, _)| ml.as_str() == primary_line);
                rank = Some(if primary_hit { 2 } else { 3 });
            }
        }
        if let Some(r) = rank {
            if r < anchor_rank {
                anchor_rank = r;
                anchor_ui = Some(ui);
            }
        }
    }

    // -- fallback when not found: deterministic sorted order ----------------------
    let Some(anchor_ui) = anchor_ui else {
        let mut reps: Vec<String> = builds.iter().map(|b| b.rep.clone()).collect();
        reps.sort();
        let mut by_code = BTreeMap::new();
        let mut order = Vec::new();
        for (i, rep) in reps.iter().enumerate() {
            let ui = unit_idx[rep];
            let b = &builds[ui];
            by_code.insert(rep.clone(), Unit {
                code: rep.clone(),
                name: if b.names[0].is_empty() { b.names[1].clone() } else { b.names[0].clone() },
                stop_trains: b.stops.clone(),
                index: i as f64,
                distance: i as f64,
                side: 0,
                signed: false,
            });
            order.push(rep.clone());
        }
        return MergedIndex { by_code, order, unit_of };
    };

    // -- BFS hop metrics -----------------------------------------------------------
    #[derive(Clone)]
    struct Metric { distance: f64, sign: i32, first_hop: usize }
    let mut metrics: HashMap<usize, Metric> = HashMap::new();
    metrics.insert(anchor_ui, Metric { distance: 0.0, sign: 0, first_hop: anchor_ui });

    let anchor_rep = builds[anchor_ui].rep.clone();
    let pos_in_primary = primary_order.and_then(|o| {
        o.iter().position(|c| {
            unit_of.get(&(primary_line.to_string(), c.clone()))
                .map(|r| r == &anchor_rep).unwrap_or(false)
        })
    });
    let mut neg_code = String::new(); let mut pos_code = String::new();
    if let (Some(p), Some(o)) = (pos_in_primary, primary_order) {
        if p > 0 { neg_code = o[p - 1].clone(); }
        if p + 1 < o.len() { pos_code = o[p + 1].clone(); }
    }
    let res_unit = |code: &String| -> Option<usize> {
        unit_of.get(&(primary_line.to_string(), code.clone()))
            .and_then(|r| unit_idx.get(r)).copied()
    };
    let neg_unit = res_unit(&neg_code);
    let pos_unit = res_unit(&pos_code);

    let mut queue = vec![anchor_ui];
    let mut qi = 0;
    while qi < queue.len() {
        let cur = queue[qi]; qi += 1;
        let cm = metrics[&cur].clone();
        for &nb in adj.get(&cur).into_iter().flatten() {
            if metrics.contains_key(&nb) { continue; }
            let first_hop = if cur == anchor_ui { nb } else { cm.first_hop };
            let sign = if Some(first_hop) == neg_unit { -1 }
                else if Some(first_hop) == pos_unit { 1 }
                else if cm.sign != 0 { cm.sign }
                else { 0 };
            metrics.insert(nb, Metric { distance: cm.distance + 1.0, sign, first_hop });
            queue.push(nb);
        }
    }

    // -- index assignment + sort ----------------------------------------------------
    let mut units: Vec<Unit> = Vec::with_capacity(builds.len());
    for (ui, b) in builds.iter().enumerate() {
        let is_anchor = ui == anchor_ui;
        let m = metrics.get(&ui);
        let has = m.is_some() || is_anchor;
        let distance = m.map(|x| x.distance).unwrap_or(f64::MAX);
        let raw_sign = m.map(|x| x.sign).unwrap_or(0);
        let side = if is_anchor { 0 } else if raw_sign != 0 { raw_sign } else { 1 };
        let signed = is_anchor || raw_sign != 0;
        let index = if is_anchor { 0.0 } else if has { side as f64 * distance } else { 9999.0 };
        units.push(Unit {
            code: b.rep.clone(),
            name: if b.names[0].is_empty() { b.names[1].clone() } else { b.names[0].clone() },
            stop_trains: b.stops.clone(),
            index,
            distance,
            side,
            signed,
        });
    }
    units.sort_by(|l, r| {
        l.index.partial_cmp(&r.index).unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| l.distance.partial_cmp(&r.distance).unwrap_or(std::cmp::Ordering::Equal))
            .then_with(|| r.signed.cmp(&l.signed))
            .then_with(|| l.name.cmp(&r.name))
            .then_with(|| l.code.cmp(&r.code))
    });

    let mut out = MergedIndex { unit_of, by_code: BTreeMap::new(), order: Vec::new() };
    for u in units {
        out.order.push(u.code.clone());
        out.by_code.insert(u.code.clone(), u);
    }
    out
}

/// normalizeStationName port: trim + remove all whitespace.
pub fn normalize_name(value: &str) -> String {
    norm(value)
}
