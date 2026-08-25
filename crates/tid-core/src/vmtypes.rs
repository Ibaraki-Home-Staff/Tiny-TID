//! Serialized view-model types shared by /api/view.

use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StationRef {
    pub code: String,
    pub name: String,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StationIdx {
    pub code: String,
    pub name: String,
    pub index: f64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrainVm {
    pub no: String,
    /// source line id (payload origin)
    #[serde(rename = "line")]
    pub line_id: String,
    pub direction: i64,
    pub display_type: String,
    pub nickname: String,
    pub cars: Option<i64>,
    pub delay_minutes: i64,
    pub at_code: String,
    pub next_code: Option<String>,
    /// representative unit codes for alarm geometry
    pub at_unit: String,
    pub next_unit: String,
    pub stopped: bool,
    pub pos_index: f64,
    pub pos_label: String,
    pub dest_text: String,
    pub category: i8,
    pub category_label: String,
    pub color_class: String,
    /// category allowed at selected station; null when unknown
    pub will_stop_here: Option<bool>,
}

#[derive(Serialize, Debug, Clone)]
pub struct TrafficItem {
    pub text: String,
    pub url: String,
}

#[derive(Serialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrafficItems {
    pub lines: Vec<TrafficItem>,
    pub express: Vec<TrafficItem>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ViewResponse {
    pub server_time: String,
    pub update: String,
    pub station: StationRef,
    /// stop categories allowed at the station (null = unknown)
    pub station_allowed_cats: Option<Vec<i8>>,
    /// merged normalized order for client-side alarm math / filter UI
    pub stations: Vec<StationIdx>,
    pub up: Vec<TrainVm>,
    pub down: Vec<TrainVm>,
    pub traffic: TrafficItems,
}
