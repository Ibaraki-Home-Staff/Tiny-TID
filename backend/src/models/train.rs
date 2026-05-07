use serde::{Deserialize, Serialize};

// JR-West API response: dest is an object, delayMinutes and numberOfCars are the real field names
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawTrain {
    #[serde(default)]
    pub no: Option<String>,
    #[serde(default, alias = "displayType")]
    pub display_type: Option<String>,
    #[serde(default)]
    pub nickname: Option<String>,
    #[serde(default)]
    pub direction: Option<u8>,
    #[serde(default, alias = "numberOfCars")]
    pub number_of_cars: Option<u16>,
    #[serde(default)]
    pub dest: Option<DestData>,
    #[serde(default)]
    pub pos: Option<String>,
    #[serde(default, alias = "delayMinutes")]
    pub delay_minutes: Option<u16>,
    #[serde(default, alias = "typeChange")]
    pub type_change: Option<String>,
    #[serde(default, alias = "aSeatInfo")]
    pub a_seat_info: Option<String>,
    #[serde(rename = "type", default)]
    pub train_type: Option<String>,
    #[serde(default)]
    pub via: Option<String>,
    #[serde(default, alias = "stopTime")]
    pub stop_time: Option<String>,
    #[serde(default, alias = "iconId")]
    pub icon_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DestData {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub line: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainPayload {
    pub update: String,
    pub trains: Vec<RawTrain>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedTrain {
    pub no: String,
    #[serde(rename = "displayType")]
    pub display_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nickname: Option<String>,
    pub category: u8,
    #[serde(rename = "categoryLabel")]
    pub category_label: String,
    #[serde(rename = "typeColorClass")]
    pub type_color_class: String,
    pub direction: u8,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cars: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "destCode")]
    pub dest_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "destName")]
    pub dest_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "atCode")]
    pub at_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "atName")]
    pub at_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "nextCode")]
    pub next_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "nextName")]
    pub next_name: Option<String>,
    #[serde(rename = "posIndex")]
    pub pos_index: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delay: Option<u16>,
    pub stopped: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "lineName")]
    pub line_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lines: Option<Vec<String>>,
}
