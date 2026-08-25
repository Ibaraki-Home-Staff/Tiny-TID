//! Web Push sending via web-push-native (verified wasm32-compatible).
use base64ct::{Base64UrlUnpadded, Encoding as _};
use p256::PublicKey;
use std::time::Duration;
use web_push_native::{jwt_simple::algorithms::ES256KeyPair, Auth, WebPushBuilder};

pub struct Vapid {
    pub private_b64: String,
    pub subject: String,
}

/// Build the HTTP request for one push; caller sends it via Fetch.
pub fn build_request(
    vapid: &Vapid,
    endpoint: &str,
    p256dh_b64: &str,
    auth_b64: &str,
    payload: &[u8],
) -> Result<http::Request<Vec<u8>>, String> {
    let priv_bytes = Base64UrlUnpadded::decode_vec(&vapid.private_b64)
        .map_err(|e| e.to_string())?;
    let kp = ES256KeyPair::from_bytes(&priv_bytes).map_err(|e| e.to_string())?;
    let p256dh = Base64UrlUnpadded::decode_vec(p256dh_b64).map_err(|e| e.to_string())?;
    let auth = Auth::clone_from_slice(
        &Base64UrlUnpadded::decode_vec(auth_b64).map_err(|e| e.to_string())?,
    );
    let ua_public = PublicKey::from_sec1_bytes(&p256dh).map_err(|e| e.to_string())?;

    let builder = WebPushBuilder::new(
        endpoint
            .parse::<http::Uri>()
            .map_err(|e| format!("{e}"))?,
        ua_public,
        auth,
    )
    .with_valid_duration(Duration::from_secs(2419200))
    .with_vapid(&kp, &vapid.subject);

    builder
        .build(payload.to_vec())
        .map_err(|e| e.to_string())
}
