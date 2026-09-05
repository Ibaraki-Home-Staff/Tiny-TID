//! Upstream JSON models (JR-West train-guide API v3), tolerant of unknown fields.

use serde::{Deserialize, Serialize};
use serde_json::Value;
// ---------------------------------------------------------------------------
// {line}.json — running positions
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrainPosDoc {
    #[serde(default)]
    pub update: String,
    #[serde(default)]
    pub trains: Vec<TrainsItem>,
}

/// `dest` is an object in practice but may be a plain string.
#[derive(Deserialize, Debug, Clone, Default)]
pub struct DestInfo {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub line: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum Dest {
    Obj(DestInfo),
    Str(String),
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrainsItem {
    #[serde(default)]
    pub no: String,
    #[serde(default)]
    pub pos: String,
    #[serde(default)]
    pub direction: i64,
    /// string in practice; array per reference lib. Flattened by [`TrainsItem::nickname_text`].
    #[serde(default)]
    pub nickname: Option<Value>,
    #[serde(default)]
    pub r#type: String,
    #[serde(default)]
    pub display_type: String,
    #[serde(default)]
    pub dest: Option<Dest>,
    #[serde(default)]
    pub via: Option<String>,
    #[serde(default)]
    pub delay_minutes: i64,
    #[serde(default)]
    pub number_of_cars: Option<i64>,
    #[serde(default)]
    pub type_change: Option<String>,
}

impl TrainsItem {
    /// Port of getNickname(): trimmed string; arrays joined with a space.
    pub fn nickname_text(&self) -> String {
        match &self.nickname {
            None | Some(Value::Null) => String::new(),
            Some(Value::String(s)) => s.trim().to_string(),
            Some(Value::Array(items)) => items
                .iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join(" ")
                .trim()
                .to_string(),
            Some(other) => other.to_string().trim().to_string(),
        }
    }

    pub fn display_type_trimmed(&self) -> String {
        self.display_type.trim().to_string()
    }
}

// ---------------------------------------------------------------------------
// {line}_st.json — stations
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone, Default)]
pub struct StationsDoc {
    #[serde(default)]
    pub stations: Vec<StationsItem>,
}

#[derive(Deserialize, Debug, Clone, Default)]
pub struct StationsItem {
    #[serde(default)]
    pub info: StationInfo,
    #[serde(default)]
    pub design: Design,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct StationInfo {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub code: String,
    #[serde(default)]
    pub stop_trains: Option<Vec<i64>>,
    #[serde(default)]
    pub transfer: Option<Vec<TransferItem>>,
    #[serde(default)]
    pub pair_display: Option<PairDisplay>,
    #[serde(default)]
    pub line: Option<String>,
    #[serde(default)]
    pub end: Option<bool>,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TransferItem {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub r#type: i64,
    #[serde(default)]
    pub code: String,
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default)]
    pub link_code: Option<String>,
    #[serde(default)]
    pub substitute: Option<bool>,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PairDisplay {
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub position: Option<i64>,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Design {
    #[serde(default)]
    pub mark: Option<String>,
    #[serde(default)]
    pub upside: Option<Vec<SideItem>>,
    #[serde(default)]
    pub downside: Option<Vec<SideItem>>,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SideItem {
    #[serde(default)]
    pub r#type: i64,
    #[serde(default)]
    pub side: Option<i64>,
    #[serde(default)]
    pub link_line: Option<String>,
    #[serde(default)]
    pub link_station_code: Option<String>,
    #[serde(default)]
    pub line: Option<String>,
    #[serde(default)]
    pub link_direction: Option<i64>,
}

// ---------------------------------------------------------------------------
// area_{area}_trafficinfo.json
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone, Default)]
pub struct TrafficDoc {
    #[serde(default)]
    pub lines: std::collections::BTreeMap<String, TrafficEntry>,
    #[serde(default)]
    pub express: std::collections::BTreeMap<String, ExpressEntry>,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrafficEntry {
    #[serde(default)]
    pub status: Value,
    #[serde(default)]
    pub cause: Value,
    #[serde(default)]
    pub url: Value,
    #[serde(default)]
    pub section: Value,
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExpressEntry {
    #[serde(default)]
    pub name: Value,
    #[serde(default)]
    pub status: Value,
    #[serde(default)]
    pub cause: Value,
    #[serde(default)]
    pub url: Value,
}

// ---------------------------------------------------------------------------
// area_{area}_master.json — line display metadata + direction datum
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone, Default)]
pub struct MasterDoc {
    #[serde(default)]
    pub lines: std::collections::BTreeMap<String, Value>,
}

/// Per-line display + direction datum from the area master:
/// `name` (JR京都線), `upper`/`lower` (dest termini, dir0 side / dir1 side).
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct LineMeta {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub upper: String,
    #[serde(default)]
    pub lower: String,
}

/// Extract display metadata for every line in a master doc. Tolerant:
/// lines without name/dest are skipped, unknown fields ignored.
pub fn parse_line_meta(doc: &MasterDoc) -> std::collections::BTreeMap<String, LineMeta> {
    let mut out = std::collections::BTreeMap::new();
    for (id, v) in &doc.lines {
        let text = |key: &str| {
            v.get(key)
                .and_then(|x| x.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or_default()
                .to_string()
        };
        let dest = v.get("dest");
        let side = |key: &str| {
            dest.and_then(|d| d.get(key))
                .and_then(|x| x.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or_default()
                .to_string()
        };
        let meta = LineMeta {
            name: text("name"),
            upper: side("upper"),
            lower: side("lower"),
        };
        if !meta.name.is_empty() || !meta.upper.is_empty() || !meta.lower.is_empty() {
            out.insert(id.clone(), meta);
        }
    }
    out
}

/// Area id to WEB UI display name (repo convention from old/index.html).
/// Unknown ids pass through unchanged.
pub fn area_name(id: &str) -> &str {
    match id.trim() {
        "hokuriku" => "北陸",
        "kinki" => "近畿",
        "okayama" => "岡山",
        "hiroshima" => "広島",
        "sanin" => "山陰",
        _ => id,
    }
}


/// Area selector index entry: display name + lines in master order.
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct AreaLine {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct AreaInfo {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub lines: Vec<AreaLine>,
}

/// Build the area→lines index from area masters: `[(area_id, master)]`.
/// Line order follows the master's `index` field (fallback: master order).
pub fn build_area_index(
    masters: &[(String, MasterDoc)],
) -> std::collections::BTreeMap<String, AreaInfo> {
    let mut out = std::collections::BTreeMap::new();
    for (area_id, doc) in masters {
        let mut lines: Vec<(u64, usize, AreaLine)> = Vec::new();
        for (seq, (id, v)) in doc.lines.iter().enumerate() {
            let name = v
                .get("name")
                .and_then(|x| x.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or(id.as_str())
                .to_string();
            let order = v.get("index").and_then(|x| x.as_u64()).unwrap_or(u64::MAX);
            lines.push((order, seq, AreaLine { id: id.clone(), name }));
        }
        lines.sort_by(|a, b| (a.0, a.1).cmp(&(b.0, b.1)));
        out.insert(
            area_id.clone(),
            AreaInfo {
                name: area_name(area_id).to_string(),
                lines: lines.into_iter().map(|(_, _, l)| l).collect(),
            },
        );
    }
    out
}