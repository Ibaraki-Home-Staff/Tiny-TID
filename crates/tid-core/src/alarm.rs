//! Approach-alarm evaluation for background push.
//! Port of tid-alarm.js handleApproachAlarms trigger rules (stop + pass cases),
//! including the ver1 working-tree modification:
//! - stop case fires on geometry only (no per-target category gate)
//! - pass case gates on the SELECTED station's allowed categories
//!
//! Deduplication is NOT done here — the worker persists last-notified keys in D1
//! (`approach:{area}:{scope}:{station}:{dir}:{trainNo}`), mirroring the client's
//! 3-minute suppression window.

use std::collections::HashMap;

use crate::network::MergedIndex;
use crate::vmtypes::TrainVm;

/// Per-direction push preferences stored with each subscription.
#[derive(Debug, Clone, Default)]
pub struct Prefs {
    /// enabled category codes (CATEGORY enum values)
    pub cats: Vec<i8>,
    /// pass-train alarm enabled
    pub pass: bool,
    /// cars threshold when cars_filter_enabled
    pub cars_min: f64,
    pub cars_filter_enabled: bool,
    /// UI-chosen approach target per category (`cat:N` -> unit rep code).
    /// Absent or stale (not in current order) entries fall back to ahead[0].
    pub targets: HashMap<String, String>,
    /// UI-chosen pass-train target station (unit rep code).
    pub pass_target: Option<String>,
}

impl Prefs {
    fn has_cat(&self, cat: i8) -> bool {
        self.cats.contains(&cat)
    }
}

#[derive(Debug, Clone)]
pub struct AlarmEvent {
    /// queue key `${no}:${dir}:${targetCode}`
    pub key: String,
    /// suppression tag `approach:{area}:{scope}:{station}:{dir}:{no}`
    pub tag: String,
    /// human-readable message (buildAlarmMessage port)
    pub message: String,
    pub reason: &'static str,
    pub dir: i64,
    pub target_code: String,
}

/// Evaluate one direction's trains against prefs. `merged` must be built for
/// the same station/scope as `trains`.
pub fn evaluate(
    merged: &MergedIndex,
    trains: &[TrainVm],
    station_code: &str,
    area: &str,
    scope: &str,
    up: &Prefs,
    down: &Prefs,
) -> Vec<AlarmEvent> {
    let mut events = Vec::new();

    let selected_index = merged
        .by_code
        .get(station_code)
        .map(|n| n.index);
    let Some(selected_index) = selected_index else {
        return events;
    };
    let order_pos = merged.order.iter().position(|c| c == station_code);

    // Selected station's allowed categories (pass-case gate); null => unknown.
    let selected_allowed: Option<Vec<i8>> = merged
        .by_code
        .get(station_code)
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

    for t in trains {
        let prefs = if t.direction == 0 { up } else { down };

        // cars filter
        if prefs.cars_filter_enabled {
            match t.cars {
                Some(cars) if (cars as f64) >= prefs.cars_min => {}
                _ => continue,
            }
        }
        if prefs.cats.is_empty() && !prefs.pass {
            continue;
        }

        let cat = t.category;
        let alerted_holder = &mut false;

        // ahead = next three stations beyond selected in travel direction.
        let ahead: Vec<&String> = match order_pos {
            Some(idx) => {
                let mut out = Vec::with_capacity(3);
                if t.direction == 0 {
                    for k in 1..=3usize {
                        if idx + k < merged.order.len() {
                            out.push(&merged.order[idx + k]);
                        }
                    }
                } else {
                    for k in 1..=3usize {
                        if idx >= k && idx - k < merged.order.len() {
                            out.push(&merged.order[idx - k]);
                        }
                    }
                }
                out
            }
            None => Vec::new(),
        };
        let fallback_target: Option<&String> = ahead.first().copied();

        // ---- 1) Stop case -------------------------------------------------
        if prefs.has_cat(cat) {
            // UI-chosen target first; stale entries fall back to ahead[0].
            let saved = prefs
                .targets
                .get(&format!("cat:{cat}"))
                .filter(|c| merged.by_code.contains_key(c.as_str()));
            let target_code: Option<&String> = saved.or(fallback_target);
            if let Some(target) = target_code {
                let boundary = boundary_match(t, target);
                let range = segment_match(
                    merged,
                    t.pos_index,
                    selected_index,
                    target,
                    t.direction,
                ) && !boundary;
                if boundary || range {
                    *alerted_holder = true;
                    push_event(&mut events, merged, t, station_code, area, scope, target, if range { "range" } else { "segment" });
                }
            }
        }

        // ---- 2) Pass case -------------------------------------------------
        if !*alerted_holder && prefs.pass {
            let saved_pass = prefs
                .pass_target
                .as_ref()
                .filter(|c| merged.by_code.contains_key(c.as_str()));
            let Some(target) = saved_pass.or(fallback_target) else { continue };
            if !boundary_match(t, target) {
                continue;
            }
            // Gate on SELECTED station categories (ver1 modified behavior):
            // fire only when this train does NOT stop at our station.
            let stops_at_selected = match &selected_allowed {
                None => true,
                Some(cats) => {
                    (cat != crate::category::UNKNOWN && cats.contains(&cat))
                        || cat == crate::category::UNKNOWN
                }
            };
            if !stops_at_selected {
                push_event(&mut events, merged, t, station_code, area, scope, target, "pass");
            }
        }
    }

    events
}

fn push_event(
    events: &mut Vec<AlarmEvent>,
    merged: &MergedIndex,
    t: &TrainVm,
    station_code: &str,
    area: &str,
    scope: &str,
    target: &str,
    reason: &'static str,
) {
    let key = format!("{}:{}:{}", t.no, t.direction, target);
    let tag = format!("approach:{area}:{scope}:{station_code}:{}:{}", t.direction, t.no);
    let target_name = merged
        .by_code
        .get(target)
        .map(|n| n.name.clone())
        .unwrap_or_else(|| target.to_string());

    // buildAlarmMessage port.
    let mut parts: Vec<String> = Vec::new();
    let no = t.no.trim();
    let dtype = t.display_type.trim();
    let nickname = t.nickname.trim();
    if !no.is_empty() {
        parts.push(no.to_string());
    }
    if !dtype.is_empty() && !nickname.is_empty() {
        parts.push(format!("{dtype} {nickname}"));
    } else if !dtype.is_empty() {
        parts.push(format!("{dtype}列車"));
    }
    if !t.dest_text.is_empty() {
        if t.dest_text.ends_with("行き") {
            parts.push(t.dest_text.clone());
        } else {
            parts.push(format!("{}行き", t.dest_text));
        }
    }
    parts.push(format!("{target_name}に接近"));
    if t.delay_minutes > 0 {
        parts.push(format!("約{}分遅延", t.delay_minutes));
    }

    events.push(AlarmEvent {
        key,
        tag,
        message: parts.join("、"),
        reason,
        dir: t.direction,
        target_code: target.to_string(),
    });
}

/// Fires when the train is AT the target: stopped there, or moving with the
/// target directly behind it (selected station ahead).
///
/// Travel sense is `direction == 0` toward listing-start, `1` toward
/// listing-end (fixture-pinned by `direction_points_at_same_line_dest`).
/// The arms below assume kyoto-style `pos` (`A_B` with A listed before B,
/// true on five of six scope lines): for dir 0 the listed-first station
/// (`at`) lies ahead and listed-second (`next`) was just left; for dir 1
/// the reverse. kosei lists reversed, so there the moving arms may miss —
/// but range matching (`segment_match`) is endpoint-order independent and
/// remains the primary trigger, and stopped trains carry a single code.
///
/// Comparison is in unit (representative) namespace because `target` comes
/// from the merged order; raw line-local codes are only a fallback for
/// trains whose unit resolution failed (empty unit string).
fn boundary_match(t: &TrainVm, target: &str) -> bool {
    let at_u = if t.at_unit.is_empty() { t.at_code.as_str() } else { t.at_unit.as_str() };
    let next_u = if t.next_unit.is_empty() {
        t.next_code.as_deref().unwrap_or("")
    } else {
        t.next_unit.as_str()
    };
    let stopped_at_target = t.stopped && at_u == target;
    let moving_on_target = !t.stopped
        && (if t.direction == 0 {
            !next_u.is_empty() && next_u == target
        } else {
            at_u == target
        });
    stopped_at_target || moving_on_target
}

fn segment_match(
    merged: &MergedIndex,
    pos_idx: f64,
    selected_index: f64,
    target: &str,
    direction: i64,
) -> bool {
    let Some(target_node) = merged.by_code.get(target) else {
        return false;
    };
    let target_index = target_node.index;
    if direction == 0 && target_index < selected_index {
        return false;
    }
    if direction == 1 && target_index > selected_index {
        return false;
    }
    let lower = selected_index.min(target_index);
    let upper = selected_index.max(target_index);
    if lower == upper {
        return pos_idx == lower;
    }
    if direction == 0 {
        pos_idx >= selected_index && pos_idx <= upper
    } else if direction == 1 {
        pos_idx <= selected_index && pos_idx >= lower
    } else {
        pos_idx >= lower && pos_idx <= upper
    }
}
