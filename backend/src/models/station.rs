use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// JR-West API response: stations are nested under .info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawStationEnvelope {
    pub info: RawStationInfo,
    #[serde(default)]
    pub design: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawStationInfo {
    pub name: String,
    pub code: String,
    #[serde(default, alias = "stopTrains")]
    pub stop_trains: Option<Vec<u8>>,
    #[serde(default)]
    pub transfer: Option<Vec<TransferInfo>>,
    #[serde(default)]
    pub line: Option<String>,
    #[serde(default, alias = "pairDisplay")]
    pub pair_display: Option<String>,
    #[serde(default)]
    pub lines: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub transfer_type: u8,
    pub code: String,
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default, alias = "linkCode")]
    pub link_code: Option<String>,
}

// Flattened station representation used internally
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawStation {
    pub code: String,
    pub name: String,
    pub index: usize,
    #[serde(default, alias = "stopTrains")]
    pub stop_trains: Vec<u8>,
    #[serde(default)]
    pub transfer: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawStationList {
    pub stations: Vec<RawStationEnvelope>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StationInfo {
    pub index: usize,
    pub name: String,
    #[serde(rename = "stopTrains")]
    pub stop_trains: Vec<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transfer: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StationIndexes {
    pub order: Vec<String>,
    #[serde(rename = "byCode")]
    pub by_code: HashMap<String, StationInfo>,
}

// Area master types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AreaMasterLine {
    pub line: String,
    #[serde(default, alias = "lineName")]
    pub line_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AreaMaster {
    pub lines: Vec<AreaMasterLine>,
}

// For the merged index, we need adjacency info
#[derive(Debug, Clone)]
pub struct LineAdjacency {
    pub stations: Vec<String>,
}

// Resolve station response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveStationResponse {
    pub code: String,
    pub name: String,
    pub line: String,
}

// View response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ViewResponse {
    pub update: String,
    pub station: Option<StationRef>,
    pub stations: StationIndexes,
    pub trains: DirectionalTrains,
    #[serde(rename = "trafficInfo")]
    pub traffic_info: serde_json::Value,
    #[serde(rename = "typeColors")]
    pub type_colors: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StationRef {
    pub code: String,
    pub name: String,
    pub index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectionalTrains {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub up: Option<Vec<EnhancedTrain>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub down: Option<Vec<EnhancedTrain>>,
}

// Import EnhancedTrain from train module
use super::train::EnhancedTrain;
