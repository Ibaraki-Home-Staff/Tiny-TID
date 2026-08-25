//! All-area station network snapshot + selected-station hop normalization.
//!
//! Snapshot build: daily job fetches every area master + every `{line}_st.json`,
//! then [`build_snapshot`] produces a serializable graph:
//! - per-line ordered station lists (`orders`)
//! - unified nodes keyed by station code (`nodes`) with names, stop categories,
//!   member lines and explicit transfer links
//! - undirected edge set (`edges`): consecutive chain edges per line (skipping
//!   branch-rejoin repeats), transfer[] edges, and `design.upside/downside`
//!   continuation / branch edges (types 98 endpoint-continuation, 2 branch).
//!
//! [`merge_scope`] is the 1:1 port of buildMergedIndexesForLines/buildGraphMetrics:
//! BFS hop metrics from the selected station over the scope subgraph, signed by
//! the primary line's immediate neighbours (negativeHop/positiveHop).

use crate::model::{Design, MasterDoc, StationsDoc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::sync::LazyLock;

pub const SNAPSHOT_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct NetworkSnapshot {
    pub version: u32,
    pub built_at: String,
    /// line id -> ordered station codes (as listed in `{line}_st.json`)
    pub orders: BTreeMap<String, Vec<String>>,
    /// station code -> node
    pub nodes: BTreeMap<String, NetNode>,
    /// canonicalized undirected edges `[a, b]` with `a <= b`
    pub edges: BTreeSet<[String; 2]>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct NetNode {
    pub name: String,
    /// stopTrains category codes from `_st.json`
    #[serde(rename = "st", default)]
    pub stop_trains: Option<Vec<i64>>,
    /// lines this station belongs to
    #[serde(default)]
    pub lines: BTreeSet<String>,
    /// explicit transfer links to other lines (`transfer[]`)
    #[serde(default)]
    pub transfers: Vec<TransferEdge>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TransferEdge {
    pub line: String,
    pub code: String,
    /// `transfer[].type` value (0 = JR line)
    pub kind: i64,
}

/// Input bundle for a full-network build (all areas). Pure: fetching happens in the worker.
pub struct NetworkInputs<'a> {
    /// (area id, parsed master) for every area
    pub masters: &'a [(String, MasterDoc)],
    /// (line id, parsed stations doc) for every line of every area
    pub st_docs: &'a [(String, StationsDoc)],
}

/// Build the whole-network snapshot.
pub fn build_snapshot(built_at: &str, inputs: &NetworkInputs<'_>) -> NetworkSnapshot {
    let mut snap = NetworkSnapshot {
        version: SNAPSHOT_VERSION,
        built_at: built_at.to_string(),
        ..Default::default()
    };

    // Pass 1: nodes + per-line orders + chain edges.
    for (line_id, doc) in inputs.st_docs {
        let mut order: Vec<String> = Vec::with_capacity(doc.stations.len());
        let mut previous: Option<String> = None;
        let mut seen_in_line: BTreeSet<String> = BTreeSet::new();

        for item in &doc.stations {
            let info = &item.info;
            if info.code.trim().is_empty() {
                continue;
            }
            let code = info.code.trim().to_string();
            let name = if info.name.trim().is_empty() {
                code.clone()
            } else {
                info.name.trim().to_string()
            };
            order.push(code.clone());

            match snap.nodes.get_mut(&code) {
                Some(existing) => {
                    // Port of merge rules: fill only missing name/stopTrains.
                    if existing.name.is_empty() {
                        existing.name = name;
                    }
                    if existing
                        .stop_trains
                        .as_ref()
                        .map(|v| v.is_empty())
                        .unwrap_or(true)
                    {
                        if let Some(st) = info.stop_trains.as_ref() {
                            if !st.is_empty() {
                                existing.stop_trains = Some(st.clone());
                            }
                        }
                    }
                    existing.lines.insert(line_id.clone());
                }
                None => {
                    let transfers = info
                        .transfer
                        .as_ref()
                        .map(|list| {
                            list.iter()
                                .filter_map(|t| {
                                    let link = t.link.as_deref()?.trim();
                                    let link_code = t.link_code.as_deref()?.trim();
                                    if link.is_empty() || link_code.is_empty() {
                                        return None;
                                    }
                                    Some(TransferEdge {
                                        line: link.to_string(),
                                        code: link_code.to_string(),
                                        kind: t.r#type,
                                    })
                                })
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();
                    let mut lines = BTreeSet::new();
                    lines.insert(line_id.clone());
                    snap.nodes.insert(
                        code.clone(),
                        NetNode {
                            name,
                            stop_trains: info.stop_trains.clone(),
                            lines,
                            transfers,
                        },
                    );
                }
            }

            // Chain edge within the line sequence. A repeated code means the
            // listing left and re-entered (branch rejoin): do not bridge it.
            if seen_in_line.insert(code.clone()) {
                if let Some(prev) = &previous {
                    add_edge(&mut snap.edges, prev, &code);
                }
            }
            previous = Some(code);
        }

        if !order.is_empty() {
            snap.orders.insert(line_id.clone(), order);
        }
    }

    // Pass 2: design upside/downside continuation / branch edges.
    for (line_id, doc) in inputs.st_docs {
        for item in &doc.stations {
            let code = item.info.code.trim().to_string();
            if code.is_empty() || !snap.nodes.contains_key(&code) {
                continue;
            }
            collect_design_edges(&item.design, &code, &mut snap.edges, &snap.nodes);
        }
    }

    let _ = &inputs.masters; // masters validated upstream (line ids ⊆ fetched docs)
    snap
}

fn collect_design_edges(
    design: &Design,
    self_code: &str,
    edges: &mut BTreeSet<[String; 2]>,
    nodes: &BTreeMap<String, NetNode>,
) {
    let side_lists = design.upside.iter().chain(design.downside.iter());
    for side_list in side_lists {
        for item in side_list.iter() {
            let Some(link_code) = item.link_station_code.as_deref().map(str::trim) else {
                continue;
            };
            let Some(link_line) = item.link_line.as_deref().map(str::trim) else {
                continue;
            };
            if link_code.is_empty() || link_line.is_empty() || link_code == self_code {
                continue;
            }
            // Only add when the target is (or will be) a known node.
            if !nodes.contains_key(link_code) {
                continue;
            }
            add_edge(edges, self_code, link_code);
        }
    }
}

fn add_edge(edges: &mut BTreeSet<[String; 2]>, a: &str, b: &str) {
    if a == b {
        return;
    }
    if a < b {
        edges.insert([a.to_string(), b.to_string()]);
    } else {
        edges.insert([b.to_string(), a.to_string()]);
    }
}

impl NetworkSnapshot {
    /// Name lookup: snapshot node -> embedded global fallback table -> None.
    pub fn station_name(&self, code: &str) -> Option<String> {
        if let Some(node) = self.nodes.get(code) {
            if !node.name.is_empty() {
                return Some(node.name.clone());
            }
        }
        global_name(code)
    }
}

// ---------------------------------------------------------------------------
// Global fallback names (extracted from sample/westjr const.STATIONS)
// ---------------------------------------------------------------------------

static GLOBAL_NAMES: LazyLock<BTreeMap<String, String>> = LazyLock::new(|| {
    serde_json::from_str::<BTreeMap<String, BTreeMap<String, String>>>(crate::STATION_NAMES_JSON)
        .unwrap_or_default()
        .into_iter()
        .flat_map(|(_line, stations)| stations)
        .collect()
});

pub fn global_name(code: &str) -> Option<String> {
    GLOBAL_NAMES.get(code).cloned()
}

// ---------------------------------------------------------------------------
// Scope merge + hop normalization (port of buildMergedIndexesForLines)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default)]
pub struct IdxNode {
    pub code: String,
    pub name: String,
    pub stop_trains: Option<Vec<i64>>,
    /// normalized index: 0 at selected, sign*distance otherwise, 9999 unreachable
    pub index: f64,
    pub distance: f64,
    /// -1 / 0 / +1 normalized sign
    pub side: i32,
}

#[derive(Debug, Clone, Default)]
pub struct MergedIndex {
    pub by_code: BTreeMap<String, IdxNode>,
    pub order: Vec<String>,
}

/// Restrict the network to `scope_lines`, normalize indices around `selected`.
/// `selected` may be a station code or a whitespace-normalized station name.
pub fn merge_scope(
    snapshot: &NetworkSnapshot,
    scope_lines: &[String],
    primary_line: &str,
    selected: &str,
) -> MergedIndex {
    let scope_set: BTreeSet<&str> = scope_lines.iter().map(|s| s.as_str()).collect();

    // Scope nodes + per-line orders.
    let mut nodes: BTreeMap<String, IdxNode> = BTreeMap::new();
    let mut orders_by_line: Vec<(String, Vec<String>)> = Vec::new();
    for line_id in &scope_set {
        let Some(order) = snapshot.orders.get(*line_id) else {
            continue;
        };
        let mut line_order: Vec<String> = Vec::new();
        for code in order {
            line_order.push(code.clone());
            nodes.entry(code.clone()).or_insert_with(|| IdxNode {
                code: code.clone(),
                name: snapshot
                    .nodes
                    .get(code)
                    .map(|n| n.name.clone())
                    .unwrap_or_default(),
                stop_trains: snapshot.nodes.get(code).and_then(|n| n.stop_trains.clone()),
                ..Default::default()
            });
        }
        orders_by_line.push((line_id.to_string(), line_order));
    }
    orders_by_line.sort_by(|a, b| a.0.cmp(&b.0));

    // Subgraph edges: chain edges within scope ∪ any snapshot edge whose both
    // ends are scope nodes (transfers, branches, continuations).
    let node_set: BTreeSet<&str> = nodes.keys().map(|s| s.as_str()).collect();
    let mut sub_edges: BTreeSet<[String; 2]> = BTreeSet::new();
    for (_, order) in &orders_by_line {
        let mut prev: Option<&String> = None;
        let mut seen: BTreeSet<&str> = BTreeSet::new();
        for code in order {
            let first_visit = seen.insert(code.as_str());
            if first_visit {
                if let Some(p) = prev {
                    add_edge(&mut sub_edges, p, code);
                }
            }
            prev = Some(code);
        }
    }
    for e in &snapshot.edges {
        if node_set.contains(e[0].as_str()) && node_set.contains(e[1].as_str()) {
            sub_edges.insert(e.clone());
        }
    }

    // Locate selected station (exact code, then normalized-name match).
    let wanted = normalize_name(selected);
    let probe_order: Vec<String> = orders_by_line
        .first()
        .map(|(_, o)| o.clone())
        .unwrap_or_else(|| nodes.keys().cloned().collect());

    let find_by_order = |order: &[String]| -> Option<String> {
        for code in order {
            if let Some(n) = nodes.get(code) {
                if normalize_name(&n.name) == wanted {
                    return Some(code.clone());
                }
            }
        }
        None
    };

    let selected_code = if nodes.contains_key(selected) {
        Some(selected.to_string())
    } else {
        find_by_order(&probe_order)
            .or_else(|| {
            let ks: Vec<String> = nodes.keys().cloned().collect();
            find_by_order(&ks)
        })
            .or_else(|| {
                nodes
                    .iter()
                    .find(|(_, n)| normalize_name(&n.name) == wanted)
                    .map(|(c, _)| c.clone())
            })
    };

    let Some(selected_code) = selected_code else {
        // Port of the not-found fallback: deterministic sorted-by-code order.
        let mut codes: Vec<String> = nodes.keys().cloned().collect();
        codes.sort();
        let by_code = codes
            .iter()
            .enumerate()
            .map(|(i, c)| {
                (
                    c.clone(),
                    IdxNode {
                        code: c.clone(),
                        name: nodes[c].name.clone(),
                        stop_trains: nodes[c].stop_trains.clone(),
                        index: i as f64,
                        distance: i as f64,
                        side: 0,
                    },
                )
            })
            .collect();
        return MergedIndex { by_code, order: codes };
    };

    // Primary order selection: requested line first, then any containing it.
    let mut primary_order: Option<Vec<String>> = orders_by_line
        .iter()
        .find(|(id, _)| id == primary_line)
        .map(|(_, o)| o.clone());
    let mut selected_idx = primary_order
        .as_ref()
        .and_then(|o| o.iter().position(|c| *c == selected_code));
    if selected_idx.is_none() {
        for (_, order) in &orders_by_line {
            if let Some(i) = order.iter().position(|c| *c == selected_code) {
                primary_order = Some(order.clone());
                selected_idx = Some(i);
                break;
            }
        }
    }
    let primary_order = primary_order.unwrap_or(probe_order);
    let selected_idx = selected_idx.unwrap_or(usize::MAX);

    let negative_hop: String = if selected_idx != usize::MAX && selected_idx > 0 {
        primary_order[selected_idx - 1].clone()
    } else {
        String::new()
    };
    let positive_hop: String =
        if selected_idx != usize::MAX && selected_idx + 1 < primary_order.len() {
            primary_order[selected_idx + 1].clone()
        } else {
            String::new()
        };

    // BFS metrics (port of buildGraphMetrics).
    #[derive(Clone)]
    struct Metric {
        distance: f64,
        sign: i32,
        first_hop: String,
    }
    let mut metrics: BTreeMap<String, Metric> = BTreeMap::new();
    metrics.insert(
        selected_code.clone(),
        Metric {
            distance: 0.0,
            sign: 0,
            first_hop: selected_code.clone(),
        },
    );
    let mut queue: Vec<String> = vec![selected_code.clone()];
    let mut qi = 0;
    while qi < queue.len() {
        let cur_code = queue[qi].clone();
        qi += 1;
        let cur = metrics[&cur_code].clone();
        for neighbor in neighbors_of(&sub_edges, &cur_code) {
            if metrics.contains_key(neighbor) {
                continue;
            }
            let first_hop = if cur_code == selected_code {
                neighbor.to_string()
            } else {
                cur.first_hop.clone()
            };
            let sign = if first_hop == negative_hop {
                -1
            } else if first_hop == positive_hop {
                1
            } else if cur.sign != 0 {
                cur.sign
            } else {
                0
            };
            metrics.insert(
                neighbor.to_string(),
                Metric {
                    distance: cur.distance + 1.0,
                    sign,
                    first_hop,
                },
            );
            queue.push(neighbor.to_string());
        }
    }

    // Index assignment + sort comparator (index, distance, name, code).
    let mut with_index: Vec<IdxNode> = Vec::with_capacity(nodes.len());
    for (code, base) in &nodes {
        let metric = metrics.get(code);
        let has_metric = metric.map(|m| m.distance.is_finite()).unwrap_or(false);
        let distance = metric.map(|m| m.distance).unwrap_or(f64::MAX);
        let raw_sign = metric.map(|m| m.sign).unwrap_or(0);
        let normalized_sign = if *code == selected_code {
            0
        } else if raw_sign != 0 {
            raw_sign
        } else {
            1
        };
        let index = if *code == selected_code {
            0.0
        } else if has_metric {
            normalized_sign as f64 * distance
        } else {
            9999.0
        };
        with_index.push(IdxNode {
            code: code.clone(),
            name: base.name.clone(),
            stop_trains: base.stop_trains.clone(),
            index,
            distance,
            side: normalized_sign,
        });
    }
    with_index.sort_by(|l, r| {
        l.index
            .partial_cmp(&r.index)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                l.distance
                    .partial_cmp(&r.distance)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            // Approximation of localeCompare('ja') for tie-breaking only.
            .then_with(|| l.name.cmp(&r.name))
            .then_with(|| l.code.cmp(&r.code))
    });

    let order = with_index.iter().map(|n| n.code.clone()).collect();
    MergedIndex {
        by_code: with_index.into_iter().map(|n| (n.code.clone(), n)).collect(),
        order,
    }
}

fn neighbors_of<'a>(edges: &'a BTreeSet<[String; 2]>, code: &str) -> Vec<&'a str> {
    let mut out = Vec::new();
    for e in edges {
        if e[0] == code {
            out.push(e[1].as_str());
        } else if e[1] == code {
            out.push(e[0].as_str());
        }
    }
    out
}

/// Port of normalizeStationName: trim + remove all whitespace.
pub fn normalize_name(value: &str) -> String {
    value.trim().chars().filter(|c| !c.is_whitespace()).collect()
}
