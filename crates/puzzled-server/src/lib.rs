//! Puzzled Server — ADR-168 S0 scaffold: health probes + domain stub.

use leaderboard::leaderboard_stub;

mod leaderboard;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use serde_json::json;

pub use leaderboard::LeaderboardStubBody;


static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

#[derive(Clone)]
pub struct AppState {
    started_at: Instant,
}

impl AppState {
    #[must_use]
    pub fn new() -> Self {
        Self { started_at: Instant::now() }
    }

    #[must_use]
    pub fn uptime_secs(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
}

pub fn request_shutdown() {
    SHUTTING_DOWN.store(true, Ordering::Relaxed);
}

fn shutting_down() -> bool {
    SHUTTING_DOWN.load(Ordering::Relaxed)
}

async fn healthz() -> Response {
    if shutting_down() {
        return (StatusCode::SERVICE_UNAVAILABLE, "shutting down").into_response();
    }
    (StatusCode::OK, Json(HealthBody { status: "ok" })).into_response()
}

async fn readyz(State(state): State<AppState>) -> Response {
    if shutting_down() {
        return (StatusCode::SERVICE_UNAVAILABLE, "shutting down").into_response();
    }
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "uptime_s": state.uptime_secs(),
            "stub": true,
        })),
    )
        .into_response()
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/api/leaderboard", get(leaderboard_stub))
        .with_state(state)
}

#[must_use]
pub fn http_port() -> u16 {
    std::env::var("PUZZLED_HTTP_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(8080)
}

pub async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(%error, "failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut stream) => { stream.recv().await; }
            Err(error) => tracing::error!(%error, "failed to install SIGTERM handler"),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => tracing::info!("shutdown signal received: SIGINT"),
        () = terminate => tracing::info!("shutdown signal received: SIGTERM"),
    }

    request_shutdown();
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{Method, Request};
    use tower::ServiceExt;

    fn build_request(method: Method, uri: &str, body: Body) -> Request<Body> {
        let method_name = method.as_str().to_owned();
        match Request::builder().method(method).uri(uri).body(body) {
            Ok(request) => request,
            Err(error) => panic!("build request {method_name} {uri}: {error}"),
        }
    }

    async fn body_json(response: Response) -> serde_json::Value {
        let body = match to_bytes(response.into_body(), usize::MAX).await {
            Ok(body) => body,
            Err(error) => panic!("read body: {error}"),
        };
        match serde_json::from_slice(&body) {
            Ok(json) => json,
            Err(error) => panic!("parse json: {error}"),
        }
    }

    #[tokio::test]
    async fn healthz_returns_ok_json() {
        let app = router(AppState::new());
        let response = match app
            .oneshot(build_request(Method::GET, "/healthz", Body::empty()))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("healthz request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert_eq!(json["status"], "ok");
    }

    #[tokio::test]
    async fn domain_stub_returns_contract() {
        let app = router(AppState::new());
        let response = match app
            .oneshot(build_request(Method::GET, "/api/leaderboard", Body::empty()))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("stub request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert!(json["entries"].as_array().is_some_and(|entries| entries.is_empty()));
        assert_eq!(json["stub"], true);
    }
}
