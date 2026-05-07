use std::collections::HashSet;

use crate::models::{EnhancedTrain, RawTrain, StationIndexes};

/// Enhance a raw train object with computed fields.
/// Returns None if the train lacks essential data (no number or no displayType).
pub fn enhance_train(
    raw: &RawTrain,
    indexes: &StationIndexes,
) -> Option<EnhancedTrain> {
    let no = raw.no.as_ref()?.trim().to_string();
    if no.is_empty() {
        return None;
    }

    let display_type_raw = raw.display_type.as_deref().unwrap_or("").trim().to_string();
    if display_type_raw.is_empty() {
        return None;
    }

    let direction = raw.direction.unwrap_or(0);

    // Parse position string: format "ATCODE_NEXTCODE" or "ATCODE" (stopped)
    let (at_code, at_name, next_code, next_name, stopped, pos_index) =
        parse_position(raw.pos.as_deref(), indexes);

    // Resolve destination: dest is an object {text, code, line} in the API
    let dest_code = raw.dest.as_ref().and_then(|d| d.code.as_deref()).unwrap_or("").trim().to_string();
    let dest_name = if dest_code.is_empty() {
        raw.dest.as_ref().and_then(|d| d.text.as_deref()).map(|s| s.to_string())
    } else {
        indexes
            .by_code
            .get(&dest_code)
            .map(|info| info.name.clone())
            .or_else(|| raw.dest.as_ref().and_then(|d| d.text.as_deref()).map(|s| s.to_string()))
    };

    // API uses "delayMinutes" and "numberOfCars"
    let delay = raw.delay_minutes;
    let cars = raw.number_of_cars;

    Some(EnhancedTrain {
        no,
        display_type: display_type_raw,
        nickname: raw.nickname.clone().filter(|n| !n.trim().is_empty()),
        category: 0, // filled in later by caller
        category_label: String::new(), // filled in later
        type_color_class: String::new(), // filled in later
        direction,
        cars,
        dest_code: if dest_code.is_empty() { None } else { Some(dest_code) },
        dest_name,
        at_code,
        at_name,
        next_code,
        next_name,
        pos_index,
        delay,
        stopped,
        line: raw.dest.as_ref().and_then(|d| d.line.clone()).filter(|l| !l.trim().is_empty()),
        line_name: raw.dest.as_ref().and_then(|d| d.line.clone()),
        lines: None,
    })
}

/// Parse position string like "ATCODE_NEXTCODE" or "ATCODE".
/// Returns (at_code, at_name, next_code, next_name, stopped, pos_index).
fn parse_position(
    pos: Option<&str>,
    indexes: &StationIndexes,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    bool,
    Option<f64>,
) {
    let pos_str = match pos {
        Some(s) => s.trim(),
        None => return (None, None, None, None, false, None),
    };
    if pos_str.is_empty() {
        return (None, None, None, None, false, None);
    }

    let parts: Vec<&str> = pos_str.split('_').collect();

    let at_code = parts[0].to_string();
    let at_idx = indexes.by_code.get(&at_code).map(|info| info.index as f64);
    let at_name = indexes
        .by_code
        .get(&at_code)
        .map(|info| info.name.clone());

    if parts.len() >= 2 {
        // Moving: between at_code and next_code
        let next_code = parts[1].to_string();
        let next_idx = indexes
            .by_code
            .get(&next_code)
            .map(|info| info.index as f64);
        let next_name = indexes
            .by_code
            .get(&next_code)
            .map(|info| info.name.clone());

        // Interpolate position
        let pos_index = match (at_idx, next_idx) {
            (Some(a), Some(n)) => {
                if a < n {
                    Some(a + 0.5)
                } else {
                    Some(a - 0.5)
                }
            }
            (Some(a), None) => Some(a + 0.5),
            _ => None,
        };

        (
            Some(at_code),
            at_name,
            Some(next_code),
            next_name,
            false,
            pos_index,
        )
    } else {
        // Stopped at station
        let pos_index = at_idx.map(|i| i + 0.1);
        (Some(at_code), at_name, None, None, true, pos_index)
    }
}

/// Merge train payloads from multiple lines, deduplicating by (no, pos, direction).
pub fn merge_train_payloads(payloads: Vec<(String, Vec<RawTrain>)>) -> Vec<RawTrain> {
    if payloads.len() <= 1 {
        return payloads.into_iter().flat_map(|(_, trains)| trains).collect();
    }

    let mut seen: HashSet<String> = HashSet::new();
    let mut merged: Vec<RawTrain> = Vec::new();

    for (line_id, trains) in payloads {
        for train in trains {
            // Build dedup key: no|pos|direction
            let no = train.no.as_deref().unwrap_or("");
            let pos = train.pos.as_deref().unwrap_or("");
            let dir = train.direction.unwrap_or(0);
            let key = format!("{}|{}|{}", no, pos, dir);

            if key != "||0" && !seen.insert(key) {
                continue; // Duplicate, skip
            }

            merged.push(train);
            let _ = line_id; // track line origin
        }
    }

    merged
}

/// Filter trains by station stop categories and sort by direction.
/// Returns (up_trains, down_trains) sorted by posIndex.
pub fn filter_and_sort(
    trains: &[EnhancedTrain],
    indexes: &StationIndexes,
    selected_code: &str,
    pass_setting: &str, // "show" or "hide"
) -> (Vec<EnhancedTrain>, Vec<EnhancedTrain>) {
    // Get the selected station's index
    let selected_idx = indexes
        .by_code
        .get(selected_code)
        .map(|info| info.index)
        .unwrap_or(0);

    let mut up_trains: Vec<EnhancedTrain> = Vec::new();
    let mut down_trains: Vec<EnhancedTrain> = Vec::new();

    for train in trains {
        if train.direction == 0 {
            // Up train: posIndex should be >= selected_idx
            if let Some(pi) = train.pos_index {
                if pi < selected_idx as f64 {
                    continue; // Already passed
                }
            }
            // Hide pass trains if pass_filter is "hide"
            if pass_setting == "hide" && !train.stopped {
                continue;
            }
            up_trains.push(train.clone());
        } else if train.direction == 1 {
            // Down train: posIndex should be <= selected_idx
            if let Some(pi) = train.pos_index {
                if pi > selected_idx as f64 {
                    continue; // Already passed
                }
            }
            if pass_setting == "hide" && !train.stopped {
                continue;
            }
            down_trains.push(train.clone());
        }
    }

    // Sort: up ascending, down descending
    up_trains.sort_by(|a, b| {
        a.pos_index
            .partial_cmp(&b.pos_index)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    down_trains.sort_by(|a, b| {
        b.pos_index
            .partial_cmp(&a.pos_index)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    (up_trains, down_trains)
}

/// Check whether a train stops at the given station.
#[allow(dead_code)]
pub fn train_stops_at_station(train: &EnhancedTrain, stop_trains: &[u8]) -> bool {
    stop_trains.contains(&train.category)
}

/// Get the station index for a given code.
#[allow(dead_code)]
pub fn station_index_for(code: &str, indexes: &StationIndexes) -> Option<usize> {
    indexes.by_code.get(code).map(|info| info.index)
}
