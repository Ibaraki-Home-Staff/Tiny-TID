use std::collections::{HashMap, HashSet, VecDeque};

use crate::models::{LineAdjacency, RawStation, StationIndexes, StationInfo};

/// Build station indexes from a flat list of stations.
pub fn build_station_indexes(stations: &[RawStation]) -> StationIndexes {
    let mut order = Vec::with_capacity(stations.len());
    let mut by_code = HashMap::new();

    for (idx, st) in stations.iter().enumerate() {
        order.push(st.code.clone());
        by_code.insert(
            st.code.clone(),
            StationInfo {
                index: idx, // array position as index (matching JS behavior)
                name: st.name.clone(),
                stop_trains: st.stop_trains.clone(),
                transfer: st.transfer.clone(),
            },
        );
    }

    StationIndexes { order, by_code }
}

/// Merge station indexes from multiple lines into a single graph using BFS.
/// Tries to create a unified order by walking outward from the anchor station.
pub fn merge_station_indexes(
    lines_stations: &[(String, Vec<RawStation>)],
    anchor_code: &str,
) -> StationIndexes {
    if lines_stations.len() == 1 {
        return build_station_indexes(&lines_stations[0].1);
    }

    // Build adjacency per line
    let mut adjacencies: HashMap<String, LineAdjacency> = HashMap::new();
    let mut all_names: HashMap<String, String> = HashMap::new();
    let mut all_stop_trains: HashMap<String, Vec<u8>> = HashMap::new();
    let mut all_transfers: HashMap<String, Vec<String>> = HashMap::new();
    let mut all_codes = HashSet::new();

    for (_line_id, stations) in lines_stations {
        let codes: Vec<String> = stations.iter().map(|s| s.code.clone()).collect();
        for st in stations {
            all_codes.insert(st.code.clone());
            all_names.entry(st.code.clone()).or_insert_with(|| st.name.clone());
            all_stop_trains
                .entry(st.code.clone())
                .or_insert_with(|| st.stop_trains.clone());
            if let Some(ref transfer) = st.transfer {
                all_transfers
                    .entry(st.code.clone())
                    .or_insert_with(|| transfer.clone());
            }
        }
        if !codes.is_empty() {
            adjacencies.insert(
                _line_id.clone(),
                LineAdjacency {
                    stations: codes,
                },
            );
        }
    }

    // BFS from anchor, using adjacency from all lines
    let mut order: Vec<String> = Vec::new();
    let mut visited: HashSet<String> = HashSet::new();
    let mut queue: VecDeque<(String, usize)> = VecDeque::new();

    if all_codes.contains(anchor_code) {
        queue.push_back((anchor_code.to_string(), 0));
    } else if let Some(first) = all_codes.iter().next() {
        queue.push_back((first.clone(), 0));
    }

    // Build forward/backward edges from each line's station order
    let mut forward: HashMap<String, Vec<String>> = HashMap::new();
    let mut backward: HashMap<String, Vec<String>> = HashMap::new();

    for adj in adjacencies.values() {
        for i in 0..adj.stations.len() {
            if i + 1 < adj.stations.len() {
                forward
                    .entry(adj.stations[i].clone())
                    .or_default()
                    .push(adj.stations[i + 1].clone());
            }
            if i > 0 {
                backward
                    .entry(adj.stations[i].clone())
                    .or_default()
                    .push(adj.stations[i - 1].clone());
            }
        }
    }

    // BFS: explore forward and backward
    while let Some((code, idx)) = queue.pop_front() {
        if !visited.insert(code.clone()) {
            continue;
        }
        // Expand until we have enough slots
        if order.len() <= idx {
            order.resize(idx + 1, String::new());
        }
        order[idx] = code.clone();

        // Explore forward neighbors
        if let Some(neighbors) = forward.get(&code) {
            for n in neighbors {
                if !visited.contains(n) {
                    queue.push_back((n.clone(), idx + 1));
                }
            }
        }
    }

    // If BFS didn't reach all stations, append remaining in arbitrary order
    // But preserve relative order within each line
    {
        let ordered_set: HashSet<&str> = order.iter().map(|s| s.as_str()).collect();
        let mut to_add: Vec<String> = Vec::new();
        for adj in adjacencies.values() {
            for code in &adj.stations {
                if !ordered_set.contains(code.as_str()) {
                    to_add.push(code.clone());
                }
            }
        }
        order.extend(to_add);
    }

    // Build by_code map with relative indices
    let mut by_code = HashMap::new();
    for (idx, code) in order.iter().enumerate() {
        let name = all_names.get(code).cloned().unwrap_or_default();
        let stop_trains = all_stop_trains.get(code).cloned().unwrap_or_default();
        let transfer = all_transfers.get(code).cloned();
        by_code.insert(
            code.clone(),
            StationInfo {
                index: idx,
                name,
                stop_trains,
                transfer,
            },
        );
    }

    StationIndexes { order, by_code }
}


