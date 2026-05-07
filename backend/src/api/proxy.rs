use reqwest::Client;
use serde::de::DeserializeOwned;

use crate::models::{AreaMaster, RawStation, RawStationEnvelope, RawStationList, TrainPayload, TrafficInfoResponse};

const JR_WEST_BASE: &str = "https://www.train-guide.westjr.co.jp/api/v3";

/// HTTP client for JR-West API calls.
pub struct JrWestClient {
    client: Client,
    base_url: String,
}

impl JrWestClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            base_url: JR_WEST_BASE.to_string(),
        }
    }

    /// Fetch area master (list of lines for an area).
    pub async fn fetch_area_master(&self, area: &str) -> Result<AreaMaster, String> {
        let url = format!("{}/area_{}_master.json", self.base_url, area);
        self.fetch_json(&url).await
    }

    /// Fetch station list for a line.
    pub async fn fetch_stations(&self, line: &str) -> Result<Vec<RawStation>, String> {
        let url = format!("{}/{}_st.json", self.base_url, line);
        let list: RawStationList = self.fetch_json(&url).await?;
        Ok(list.stations.into_iter().map(flatten_station).collect())
    }

    /// Fetch train data for a line.
    pub async fn fetch_trains(&self, line: &str) -> Result<TrainPayload, String> {
        let url = format!("{}/{}.json", self.base_url, line);
        self.fetch_json(&url).await
    }

    /// Fetch traffic info for an area.
    pub async fn fetch_traffic_info(&self, area: &str) -> Result<TrafficInfoResponse, String> {
        let url = format!("{}/area_{}_trafficinfo.json", self.base_url, area);
        self.fetch_json(&url).await
    }

    /// Generic JSON fetch with error handling.
    async fn fetch_json<T: DeserializeOwned>(&self, url: &str) -> Result<T, String> {
        eprintln!("[fetch] GET {}", url);
        let resp = self
            .client
            .get(url)
            .header("Accept", "application/json")
            .header("User-Agent", "TinyTID/1.0")
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            return Err(format!("HTTP {} for {}", status.as_u16(), url));
        }

        resp.json::<T>()
            .await
            .map_err(|e| format!("JSON parse error for {}: {}", url, e))
    }
}

impl Default for JrWestClient {
    fn default() -> Self {
        Self::new()
    }
}

fn flatten_station(env: RawStationEnvelope) -> RawStation {
    let transfer_codes: Option<Vec<String>> = env.info.transfer.map(|transfers| {
        transfers.iter().map(|t| t.code.clone()).collect()
    });

    RawStation {
        code: env.info.code,
        name: env.info.name,
        index: 0, // will be set during index building
        stop_trains: env.info.stop_trains.unwrap_or_default(),
        transfer: transfer_codes,
    }
}
