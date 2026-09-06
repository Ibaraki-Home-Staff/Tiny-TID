//! Env accessors + misc helpers.
use worker::*;

use crate::push::Vapid;

pub fn origin(env: &Env) -> String {
    env.var("UPSTREAM_ORIGIN")
        .map(|v| v.to_string())
        .unwrap_or_else(|_| "https://www.train-guide.westjr.co.jp".to_string())
}

pub fn scope_lines(env: &Env) -> Vec<String> {
    env.var("LINE_SCOPE")
        .map(|v| v.to_string())
        .unwrap_or_else(|_| "kyoto,kobesanyo,hokurikubiwako,ako,kosei,takarazuka".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

pub fn primary_line(env: &Env) -> String {
    env.var("FIXED_LINE")
        .map(|v| v.to_string())
        .unwrap_or_else(|_| "kyoto".to_string())
}

pub fn fixed_station(env: &Env) -> String {
    env.var("FIXED_STATION")
        .map(|v| v.to_string())
        .unwrap_or_else(|_| "茨木".to_string())
}

pub fn vapid_from_env(env: &Env) -> Result<Vapid> {
    Ok(Vapid {
        private_b64: env.secret("VAPID_PRIVATE_KEY")?.to_string(),
        subject: env
            .secret("VAPID_SUBJECT")?
            .to_string(),
    })
}

#[derive(serde::Deserialize, Default)]
pub struct StoredPrefs {
    #[serde(default)]
    pub cats: Vec<i8>,
    #[serde(default)]
    pub pass: bool,
    #[serde(default)]
    pub cars_min: f64,
    #[serde(default, rename = "carsFilter")]
    pub cars_filter: bool,
    /// UI-chosen approach targets (`cat:N` -> station code, plus `pass` key).
    /// Absent in old rows -> empty -> nearest-ahead fallback.
    #[serde(default)]
    pub targets: std::collections::HashMap<String, String>,
}

impl From<StoredPrefs> for tid_core::alarm::Prefs {
    fn from(mut s: StoredPrefs) -> Self {
        let pass_target = s
            .targets
            .remove("pass")
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());
        tid_core::alarm::Prefs {
            cats: s.cats,
            pass: s.pass,
            cars_min: s.cars_min,
            cars_filter_enabled: s.cars_filter,
            targets: s.targets,
            pass_target,
        }
    }
}

pub struct PrefsPair {
    pub up: tid_core::alarm::Prefs,
    pub down: tid_core::alarm::Prefs,
}

#[derive(serde::Deserialize)]
struct RawPair {
    #[serde(default)]
    up: Option<StoredPrefs>,
    #[serde(default)]
    down: Option<StoredPrefs>,
}

pub fn parse_prefs_pair(json: &str) -> PrefsPair {
    let raw: RawPair = serde_json::from_str(json).unwrap_or(RawPair { up: None, down: None });
    PrefsPair {
        up: raw.up.map(Into::into).unwrap_or_default(),
        down: raw.down.map(Into::into).unwrap_or_default(),
    }
}

/// RFC3339 UTC timestamp (JS Date epoch -> civil).
pub fn iso_now() -> String {
    let ms = js_sys::Date::now() as i64;
    let secs = ms / 1000;
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (y, m, d) = civil_from_days(days as i64);
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

/// Howard Hinnant's civil_from_days.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    ((if m <= 2 { y + 1 } else { y }) as i64, m as u32, d as u32)
}

/// Send one push; Ok(true)=delivered, Ok(false)=endpoint gone (delete row).
pub async fn push_send(
    vapid: &Vapid,
    endpoint: &str,
    p256dh: &str,
    auth: &str,
    message: &str,
) -> Result<bool> {
    let req = crate::push::build_request(vapid, endpoint, p256dh, auth, message.as_bytes())
        .map_err(|e| Error::RustError(e.into()))?;

    let headers = Headers::new();
    for (name, value) in req.headers().iter() {
        headers
            .set(name.as_str(), value.to_str().unwrap_or(""))?;
    }
    let init = RequestInit {
        method: Method::Post,
        headers,
        body: Some(req.body().clone().into()),
        ..Default::default()
    };
    let wr = Request::new_with_init(&req.uri().to_string(), &init)?;
    match Fetch::Request(wr).send().await {
        Ok(resp) => {
            let code = resp.status_code();
            if code == 404 || code == 410 {
                Ok(false)
            } else if (200..300).contains(&code) {
                Ok(true)
            } else {
                Err(Error::RustError(format!("push {code}").into()))
            }
        }
        Err(e) => Err(e),
    }
}

pub const NETWORK_CRON: &str = "0 18 * * *";

/// Stable short id from the endpoint URL (sha256 hex, first 32 chars).
pub fn hash_id(endpoint: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(endpoint.as_bytes());
    let out = h.finalize();
    out.iter().map(|b| format!("{b:02x}")).collect::<String>()[..32].to_string()
}

/// Minimal query-string parser with percent-decoding (+ as space).
pub fn query_param(query: Option<&str>, key: &str) -> Option<String> {
    let q = query?;
    for pair in q.split('&') {
        let mut it = pair.splitn(2, '=');
        let k = it.next()?;
        if k != key {
            continue;
        }
        let raw = it.next().unwrap_or("");
        return Some(percent_decode(raw));
    }
    None
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() + 1 && i + 2 <= bytes.len() - 1 => {
                let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok();
                if let Some(v) = hex.and_then(|h| u8::from_str_radix(h, 16).ok()) {
                    out.push(v);
                    i += 3;
                } else {
                    out.push(b'%');
                    i += 1;
                }
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).to_string()
}
