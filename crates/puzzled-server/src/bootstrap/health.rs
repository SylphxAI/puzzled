//! Liveness and readiness probes (not product capability proof).

use std::time::Duration;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;

use super::lifecycle::shutting_down;
use super::state::AppState;

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    git_commit_sha: Option<String>,
}

fn git_commit_sha() -> Option<String> {
    for key in [
        "SYLPHX_GIT_COMMIT_SHA",
        "GIT_COMMIT_SHA",
        "GIT_SHA",
        "GITHUB_SHA",
    ] {
        if let Ok(value) = std::env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    option_env!("GIT_COMMIT").map(str::to_string)
}

pub(crate) async fn healthz() -> Response {
    if shutting_down() {
        return (StatusCode::SERVICE_UNAVAILABLE, "shutting down").into_response();
    }
    (
        StatusCode::OK,
        Json(HealthBody {
            status: "ok",
            git_commit_sha: git_commit_sha(),
        }),
    )
        .into_response()
}

pub(crate) async fn readyz(State(state): State<AppState>) -> Response {
    if shutting_down() {
        return (StatusCode::SERVICE_UNAVAILABLE, "shutting down").into_response();
    }

    // Fail closed: production readiness requires a live Postgres dependency.
    // Absence of DATABASE_URL or a failed ping is not "ready".
    let slice = if state.pool.is_some() { "S1" } else { "S0" };
    let postgres_ok = if let Some(pool) = &state.pool {
        postgres_ping(pool).await
    } else {
        false
    };
    let ready = postgres_ok;
    let status = if ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status,
        Json(json!({
            "status": if ready { "ok" } else { "not_ready" },
            "uptime_s": state.uptime_secs(),
            "slice": slice,
            "git_commit_sha": git_commit_sha(),
            "dependencies": [
                {
                    "name": "postgres",
                    "ok": postgres_ok,
                    "required": true,
                    "detail": "sqlx product persistence (fail-closed readiness)"
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
