//! Upstream JSON models (JR-West train-guide API v3), tolerant of unknown fields.

use serde::Deserialize;
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
// area_{area}_master.json — only the line id set matters for building
// ---------------------------------------------------------------------------

#[derive(Deserialize, Debug, Clone, Default)]
pub struct MasterDoc {
    #[serde(default)]
    pub lines: std::collections::BTreeMap<String, Value>,
}
