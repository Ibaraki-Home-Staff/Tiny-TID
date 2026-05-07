use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// In-memory cache for station names across areas.
/// Caches station names with a TTL (default 30 days).
#[derive(Clone)]
pub struct StationNameCache {
    inner: Arc<RwLock<CacheInner>>,
}

struct CacheInner {
    /// Map<area, (stations_map, inserted_at)>
    /// stations_map: Map<code, name>
    areas: HashMap<String, (HashMap<String, String>, Instant)>,
    #[allow(dead_code)]
    ttl: Duration,
}

impl StationNameCache {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(CacheInner {
                areas: HashMap::new(),
                ttl: Duration::from_secs(30 * 24 * 3600), // 30 days
            })),
        }
    }

    /// Store station names for an area.
    pub async fn store_area_stations(
        &self,
        area: &str,
        stations: HashMap<String, String>,
    ) {
        let mut inner = self.inner.write().await;
        inner.areas.insert(
            area.to_string(),
            (stations, Instant::now()),
        );
    }

    /// Get a station name by code, searching across all cached areas.
    #[allow(dead_code)]
    pub async fn get_station_name(&self, code: &str) -> Option<String> {
        let inner = self.inner.read().await;
        for (_area, (stations, inserted)) in &inner.areas {
            // Check TTL
            if inserted.elapsed() > inner.ttl {
                continue;
            }
            if let Some(name) = stations.get(code) {
                return Some(name.clone());
            }
        }
        None
    }

    /// Get station names for an area if cached and not expired.
    #[allow(dead_code)]
    pub async fn get_area_stations(&self, area: &str) -> Option<HashMap<String, String>> {
        let inner = self.inner.read().await;
        inner.areas.get(area).and_then(|(stations, inserted)| {
            if inserted.elapsed() > inner.ttl {
                None
            } else {
                Some(stations.clone())
            }
        })
    }

    /// Check if an area is cached and not expired.
    #[allow(dead_code)]
    pub async fn has_area(&self, area: &str) -> bool {
        let inner = self.inner.read().await;
        inner.areas.get(area).map_or(false, |(_, inserted)| {
            inserted.elapsed() <= inner.ttl
        })
    }
}

impl Default for StationNameCache {
    fn default() -> Self {
        Self::new()
    }
}
