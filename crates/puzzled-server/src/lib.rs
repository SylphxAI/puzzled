//! Puzzled Server — ADR-168 S1: health probes + leaderboard read slice.

pub mod db_config;

mod game_format;
mod game_slugs;
mod pattern_match;
mod placement;
mod random_lcg;
mod scoring;
mod wordle_eval;
mod nonogram_clues;
mod queens_conflict;
mod leaderboard;
mod leaderboard_db;

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use leaderboard::{leaderboard_stub, stats_leaderboard};
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;

pub use leaderboard::LeaderboardStubBody;
pub use game_format::{
    calculate_wordle_score, compare_by_time, format_time_score, format_timer, is_perfect_game,
};
pub use pattern_match::{find_all_sets, generate_all_cards, is_valid_set, Card, Color, Fill, Shape};
pub use placement::{is_valid_placement, GRID_SIZE};
pub use random_lcg::{pick_random, shuffle_array, SeededRandom};
pub use scoring::{validate_and_score, GameResult, GameSubmission, SubmissionStatus};
pub use wordle_eval::{evaluate_guess, is_winning_guess, LetterStatus, MAX_GUESSES, WORD_LENGTH};
pub use nonogram_clues::{generate_clues, is_grid_complete};
pub use queens_conflict::{get_conflicts, is_solved, Cell as QueensCell};

static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);

#[derive(Clone)]
pub struct AppState {
    started_at: Instant,
    pub pool: Option<PgPool>,
}

impl AppState {
    #[must_use]
    pub fn new(pool: Option<PgPool>) -> Self {
        Self {
            started_at: Instant::now(),
            pool,
        }
    }

    #[must_use]
    pub fn uptime_secs(&self) -> u64 {
        self.started_at.elapsed().as_secs()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new(None)
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

    let slice = if state.pool.is_some() { "S1" } else { "S0" };
    let postgres_ok = if let Some(pool) = &state.pool {
        postgres_ping(pool).await
    } else {
        false
    };

    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "uptime_s": state.uptime_secs(),
            "slice": slice,
            "dependencies": [
                {
                    "name": "postgres",
                    "ok": postgres_ok,
                    "detail": "sqlx leaderboard read (ADR-168 S1)"
                }
            ],
            "stub": state.pool.is_none(),
        })),
    )
        .into_response()
}

async fn postgres_ping(pool: &PgPool) -> bool {
    tokio::time::timeout(
        Duration::from_millis(500),
        sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(pool),
    )
    .await
    .ok()
    .and_then(Result::ok)
    .is_some()
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route("/api/leaderboard", get(leaderboard_stub))
        .route("/api/v1/stats/leaderboard", get(stats_leaderboard))
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
            Ok(mut stream) => {
                stream.recv().await;
            }
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
        let app = router(AppState::new(None));
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
        let app = router(AppState::new(None));
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

    #[tokio::test]
    async fn stats_leaderboard_invalid_query_returns_empty_array() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(
                Method::GET,
                "/api/v1/stats/leaderboard",
                Body::empty(),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("leaderboard request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert!(json.as_array().is_some_and(|entries| entries.is_empty()));
    }

    #[tokio::test]
    async fn stats_leaderboard_streak_returns_empty_array_without_db() {
        let app = router(AppState::new(None));
        let response = match app
            .oneshot(build_request(
                Method::GET,
                "/api/v1/stats/leaderboard?gameSlug=sudoku&type=streak",
                Body::empty(),
            ))
            .await
        {
            Ok(response) => response,
            Err(error) => panic!("leaderboard request: {error}"),
        };
        assert_eq!(response.status(), StatusCode::OK);
        let json = body_json(response).await;
        assert!(json.as_array().is_some_and(|entries| entries.is_empty()));
    }
}