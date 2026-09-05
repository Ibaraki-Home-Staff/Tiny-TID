//! Traffic info items: port of renderTrafficInfo text composition.

use crate::model::TrafficDoc;
use serde_json::Value;

use crate::vmtypes::{TrafficItem, TrafficItems};

fn vstr(v: &Value) -> String {
    v.as_str().map(|s| s.trim().to_string()).unwrap_or_default()
}

/// Port: string as-is; object `{from,to}` with `{start,end}` fallbacks joined " ~ ".
fn section_text(section: &Value) -> String {
    match section {
        Value::String(s) => s.trim().to_string(),
        Value::Object(map) => {
            let get = |k: &str| {
                map.get(k)
                    .and_then(Value::as_str)
                    .map(|s| s.trim().to_string())
                    .unwrap_or_default()
            };
            let f = get("from");
            let t = get("to");
            let from = if f.is_empty() { get("start") } else { f };
            let to = if t.is_empty() { get("end") } else { t };
            if from.is_empty() && to.is_empty() {
                String::new()
            } else {
                format!("{} ~ {}", from, to).trim().to_string()
            }
        }
        _ => String::new(),
    }
}

fn push_deduped(
    list: &mut Vec<TrafficItem>,
    seen: &mut std::collections::HashSet<String>,
    text: String,
    url: String,
) {
    let key = format!("{}|{}", text, url);
    if !text.is_empty() && seen.insert(key) {
        list.push(TrafficItem { text, url });
    }
}

/// Port of renderTrafficInfo: iterate SCOPE line ids (not doc keys),
/// prefix `[display name] ` when the scope has multiple lines, dedupe per section.
pub fn build_traffic_items(
    doc: &TrafficDoc,
    scope_lines: &[String],
    names: &std::collections::BTreeMap<String, String>,
) -> TrafficItems {
    let mut out = TrafficItems::default();
    let multi = scope_lines.len() > 1;

    let mut seen_line = std::collections::HashSet::new();
    for line_id in scope_lines {
        let Some(entry) = doc.lines.get(line_id) else {
            continue;
        };
        let mut body = String::new();
        let section = section_text(&entry.section);
        if !section.is_empty() {
            body.push_str(&format!("{section}: "));
        }
        let cause = vstr(&entry.cause);
        let status = vstr(&entry.status);
        let url = vstr(&entry.url);
        if !cause.is_empty() {
            body.push_str(&format!("{cause} により "));
        }
        body.push_str(&status);
        let body = body.trim().to_string();
        if body.is_empty() {
            continue;
        }
        let display = names.get(line_id).map(String::as_str).unwrap_or(line_id);
        let text = if multi { format!("[{display}] {body}") } else { body };
        push_deduped(&mut out.lines, &mut seen_line, text, url);
    }

    let mut seen_express = std::collections::HashSet::new();
    for line_id in scope_lines {
        let Some(entry) = doc.express.get(line_id) else {
            continue;
        };
        let name = vstr(&entry.name);
        let cause = vstr(&entry.cause);
        let status = vstr(&entry.status);
        let url = vstr(&entry.url);
        let mut body = String::new();
        if !name.is_empty() {
            body.push_str(&format!("特急 {name}: "));
        }
        if !cause.is_empty() {
            body.push_str(&format!("{cause} により "));
        }
        body.push_str(&status);
        let body = body.trim().to_string();
        if body.is_empty() {
            continue;
        }
        let display = names.get(line_id).map(String::as_str).unwrap_or(line_id);
        let text = if multi { format!("[{display}] {body}") } else { body };
        push_deduped(&mut out.express, &mut seen_express, text, url);
    }

    out
}
