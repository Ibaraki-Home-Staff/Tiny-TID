use std::collections::HashMap;

use axum::{extract::Query, http::StatusCode, response::Json};
use serde::Deserialize;

use crate::api::proxy::JrWestClient;
use crate::cache::StationNameCache;
use crate::models::{
    DirectionalTrains, EnhancedTrain, ResolveStationResponse, StationRef, ViewResponse,
};
use crate::processing::category::{self, classify_category, normalize_display_type, type_color_class};
use crate::processing::stations::{build_station_indexes, merge_station_indexes};
use crate::processing::trains::{enhance_train, filter_and_sort, merge_train_payloads};

#[derive(Debug, Deserialize)]
pub struct ViewParams {
    pub area: String,
    pub lines: String,       // comma-separated
    pub station: String,     // station code
    #[serde(default)]
    pub dir: String,         // "up", "down", or "" (both)
}

#[derive(Debug, Deserialize)]
pub struct ResolveParams {
    pub area: String,
    pub name: String,
}

// Error wrapper that converts to HTTP error response
pub struct AppError(pub StatusCode, pub String);

impl axum::response::IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        (self.0, self.1).into_response()
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError(StatusCode::INTERNAL_SERVER_ERROR, s.to_string())
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.1)
    }
}

/// GET /api/view
/// Fetches all train data, processes it, and returns enhanced data for the frontend.
pub async fn handle_view(
    Query(params): Query<ViewParams>,
) -> Result<Json<ViewResponse>, AppError> {
    let client = JrWestClient::new();
    let cache = StationNameCache::new();

    let line_ids: Vec<String> = params
        .lines
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    if line_ids.is_empty() {
        return Err("No lines specified".into());
    }

    let selected_code = params.station.trim().to_string();

    // Fetch stations for all lines in parallel
    let mut line_stations: Vec<(String, Vec<_>)> = Vec::new();
    let mut fetch_errors: Vec<String> = Vec::new();
    for line_id in &line_ids {
        match client.fetch_stations(line_id).await {
            Ok(stations) => {
                line_stations.push((line_id.clone(), stations));
            }
            Err(e) => {
                fetch_errors.push(format!("{}: {}", line_id, e));
            }
        }
    }

    if line_stations.is_empty() {
        let detail = fetch_errors.join("; ");
        return Err(AppError(StatusCode::SERVICE_UNAVAILABLE, format!("No station data available. Errors: {}", detail)));
    }

    // Build station indexes (merged if multiple lines)
    let station_indexes = if line_stations.len() > 1 {
        merge_station_indexes(&line_stations.iter().map(|(id, st)| (id.clone(), st.clone())).collect::<Vec<_>>(), &selected_code)
    } else if let Some((_, stations)) = line_stations.first() {
        build_station_indexes(stations)
    } else {
        return Err("No station data available".into());
    };

    // Resolve selected station code in the merged indexes
    let selected_code = if station_indexes.by_code.contains_key(&selected_code) {
        selected_code.clone()
    } else {
        station_indexes
            .by_code
            .iter()
            .find(|(_, info)| info.name == selected_code)
            .map(|(code, _)| code.clone())
            .unwrap_or_else(|| {
                station_indexes.order.first().cloned().unwrap_or_default()
            })
    };

    let station_info = station_indexes.by_code.get(&selected_code);

    // Cache station names
    for (line_id, stations) in &line_stations {
        let mut names: HashMap<String, String> = HashMap::new();
        for st in stations {
            names.insert(st.code.clone(), st.name.clone());
        }
        cache.store_area_stations(line_id, names).await;
    }

    // Fetch train data for all lines in parallel
    let mut line_trains: Vec<(String, Vec<_>)> = Vec::new();
    for line_id in &line_ids {
        match client.fetch_trains(line_id).await {
            Ok(payload) => {
                line_trains.push((line_id.clone(), payload.trains));
            }
            Err(e) => {
                tracing::warn!("Failed to fetch trains for {}: {}", line_id, e);
            }
        }
    }

    let merged_trains = merge_train_payloads(line_trains);

    // Enhance all trains
    let type_colors = category::load_type_colors_from_config();

    let mut enhanced: Vec<EnhancedTrain> = Vec::new();
    for raw in &merged_trains {
        if let Some(mut train) = enhance_train(raw, &station_indexes) {
            let (normalized_type, nickname_suffix) = normalize_display_type(&train.display_type);

            if let Some(suffix) = nickname_suffix {
                let current_nick = train.nickname.as_deref().unwrap_or("");
                if !current_nick.contains(&suffix) {
                    train.nickname = Some(if current_nick.is_empty() {
                        suffix
                    } else {
                        format!("{} {}", current_nick, suffix)
                    });
                }
            }

            let category = classify_category(&normalized_type);
            let cat_label = category::get_category_label(category).to_string();
            let color_class = type_color_class(&normalized_type, category, &type_colors);

            let stopped = station_info
                .map(|info| info.stop_trains.contains(&(category as u8)))
                .unwrap_or(false);

            train.display_type = normalized_type;
            train.category = category as u8;
            train.category_label = cat_label;
            train.type_color_class = color_class;
            train.stopped = stopped;

            enhanced.push(train);
        }
    }

    // Filter and sort by direction
    let (up_trains, down_trains) =
        filter_and_sort(&enhanced, &station_indexes, &selected_code, "hide");

    // Fetch traffic info
    let traffic_info = match client.fetch_traffic_info(&params.area).await {
        Ok(info) => serde_json::to_value(info).unwrap_or_default(),
        Err(_) => serde_json::Value::Null,
    };

    let up = if params.dir.is_empty() || params.dir == "up" {
        Some(up_trains)
    } else {
        None
    };
    let down = if params.dir.is_empty() || params.dir == "down" {
        Some(down_trains)
    } else {
        None
    };

    let station = station_info.map(|info| StationRef {
        code: selected_code.clone(),
        name: info.name.clone(),
        index: info.index,
    });

    Ok(Json(ViewResponse {
        update: chrono::Utc::now().to_rfc3339(),
        station,
        stations: station_indexes,
        trains: DirectionalTrains { up, down },
        traffic_info,
        type_colors,
    }))
}

/// GET /api/resolve-station
/// Resolves a station name to a station code within an area.
pub async fn handle_resolve_station(
    Query(params): Query<ResolveParams>,
) -> Result<Json<ResolveStationResponse>, AppError> {
    let client = JrWestClient::new();

    let area_master = client.fetch_area_master(&params.area).await
        .map_err(|e| AppError(StatusCode::SERVICE_UNAVAILABLE, format!("Failed to fetch area master: {}", e)))?;

    let line_ids: Vec<String> = area_master
        .lines
        .iter()
        .map(|l| l.line.clone())
        .collect();

    for line_id in &line_ids {
        if let Ok(stations) = client.fetch_stations(line_id).await {
            for st in &stations {
                if st.name == params.name {
                    return Ok(Json(ResolveStationResponse {
                        code: st.code.clone(),
                        name: st.name.clone(),
                        line: line_id.clone(),
                    }));
                }
            }
        }
    }

    Err(AppError(StatusCode::NOT_FOUND, format!("Station '{}' not found in area '{}'", params.name, params.area)))
}

/// Helper: get station name from line station lists.
async fn get_station_name_in_lines(
    client: &JrWestClient,
    line_ids: &[String],
    code: &str,
) -> Option<String> {
    for line_id in line_ids {
        if let Ok(stations) = client.fetch_stations(line_id).await {
            for st in &stations {
                if st.code == code {
                    return Some(st.name.clone());
                }
            }
        }
    }
    None
}

/// Helper: resolve station code by name within area.
#[allow(dead_code)]
async fn resolve_by_name(
    client: &JrWestClient,
    area: &str,
    line_ids: &[String],
    name: &str,
) -> Option<String> {
    for line_id in line_ids {
        if let Ok(stations) = client.fetch_stations(line_id).await {
            for st in &stations {
                if st.name == name {
                    return Some(st.code.clone());
                }
            }
        }
    }

    if let Ok(master) = client.fetch_area_master(area).await {
        for line_entry in &master.lines {
            if line_ids.contains(&line_entry.line) {
                continue;
            }
            if let Ok(stations) = client.fetch_stations(&line_entry.line).await {
                for st in &stations {
                    if st.name == name {
                        return Some(st.code.clone());
                    }
                }
            }
        }
    }

    None
}
