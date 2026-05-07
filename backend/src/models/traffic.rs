use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficInfoResponse {
    #[serde(default)]
    pub update: Option<String>,
    #[serde(default, alias = "routeTrafficInfo")]
    pub route_traffic_info: Option<Vec<RouteTrafficInfo>>,
    #[serde(default, alias = "limitedExpressTrafficInfo")]
    pub limited_express_traffic_info: Option<Vec<RouteTrafficInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteTrafficInfo {
    #[serde(default, alias = "lineId")]
    pub line_id: Option<String>,
    #[serde(default, alias = "lineName")]
    pub line_name: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default, alias = "from")]
    pub from_name: Option<String>,
    #[serde(default, alias = "to")]
    pub to_name: Option<String>,
    #[serde(default, alias = "fromStation")]
    pub from_station: Option<Vec<TrafficStationInfo>>,
    #[serde(default, alias = "toStation")]
    pub to_station: Option<Vec<TrafficStationInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrafficStationInfo {
    #[serde(default, alias = "stationName")]
    pub station_name: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
}
