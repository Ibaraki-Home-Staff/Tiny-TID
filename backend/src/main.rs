mod api;
mod cache;
mod models;
mod processing;

use std::path::PathBuf;

use axum::{
    body::Body,
    extract::Path,
    http::{header, Request, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use reqwest::Client;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tiny_tid=info".into()),
        )
        .init();

    let app = Router::new()
        .route("/api/view", get(api::view::handle_view))
        .route("/api/resolve-station", get(api::view::handle_resolve_station))
        .route("/api/v3/{*path}", get(handle_proxy))
        .fallback_service(tower::util::service_fn(serve_static));

    let addr = "0.0.0.0:8000";
    tracing::info!("Tiny-TID backend starting on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn serve_static(req: Request<Body>) -> Result<Response, std::convert::Infallible> {
    let path = req.uri().path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    let file_path = PathBuf::from(".").join(path);

    // Prevent directory traversal
    let Ok(canonical) = file_path.canonicalize() else {
        return Ok(StatusCode::NOT_FOUND.into_response());
    };
    let Ok(root) = PathBuf::from(".").canonicalize() else {
        return Ok(StatusCode::INTERNAL_SERVER_ERROR.into_response());
    };
    if !canonical.starts_with(&root) {
        return Ok(StatusCode::FORBIDDEN.into_response());
    }

    let response = match tokio::fs::read(&canonical).await {
        Ok(contents) => {
            let mime = mime_guess::from_path(&canonical).first_or_octet_stream();
            Response::builder()
                .header(header::CONTENT_TYPE, mime.as_ref())
                .header(header::CACHE_CONTROL, "public, max-age=3600")
                .body(Body::from(contents))
                .unwrap()
        }
        Err(_) => {
            // Try index.html fallback for SPA-like routing
            let index = PathBuf::from(".").join("index.html");
            if let Ok(contents) = tokio::fs::read(&index).await {
                Response::builder()
                    .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                    .body(Body::from(contents))
                    .unwrap()
            } else {
                StatusCode::NOT_FOUND.into_response()
            }
        }
    };
    Ok(response)
}

async fn handle_proxy(Path(path): Path<String>) -> impl IntoResponse {
    let url = format!("https://www.train-guide.westjr.co.jp/api/v3/{}", path);
    eprintln!("[proxy] path={} -> {}", path, url);
    let client = Client::new();

    match client
        .get(&url)
        .header("Accept", "application/json")
        .header("User-Agent", "TinyTID/1.0")
        .send()
        .await
    {
        Ok(resp) => {
            let status_code = resp.status();
            eprintln!("[proxy] status={}", status_code);
            let headers = resp.headers().clone();

            match resp.text().await {
                Ok(body) => {
                    let content_type = headers
                        .get("content-type")
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("application/json")
                        .to_string();

                    let actual_content_type = if content_type.contains("euc-jp")
                        || content_type.contains("EUC-JP")
                    {
                        "application/json; charset=utf-8"
                    } else {
                        &content_type
                    };

                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
                        (
                            [("content-type", actual_content_type.to_string())],
                            serde_json::to_string(&parsed).unwrap_or(body),
                        )
                            .into_response()
                    } else {
                        (
                            [("content-type", actual_content_type.to_string())],
                            body,
                        )
                            .into_response()
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to read proxy response body: {}", e);
                    StatusCode::BAD_GATEWAY.into_response()
                }
            }
        }
        Err(e) => {
            tracing::error!("Proxy request failed for {}: {}", url, e);
            StatusCode::BAD_GATEWAY.into_response()
        }
    }
}
