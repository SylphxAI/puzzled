//! Compute schedule ticks (`[[compute.schedules]]` in sylphx.toml). Each tick
//! is admitted only with Compute's signed receipt for its exact URL
//! (`shared::tick_receipt`), never a shared secret.

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use super::state::AppState;
use crate::capabilities::daily_pipeline;
use crate::capabilities::jobs::adapters::jobs_db;

pub const DAILY_PUZZLES_PATH: &str = "/internal/compute/daily-puzzles";
pub const AUDIT_RETENTION_PATH: &str = "/internal/compute/audit-log-retention";

/// Store every missing daily puzzle (14 days ahead, 30-day archive).
pub async fn daily_puzzles_tick(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(reject) = state.ticks.admit(&headers, DAILY_PUZZLES_PATH).await {
        return reject.response().into_response();
    }
    let Some(pool) = &state.pool else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "no_database"})),
        )
            .into_response();
    };
    let today = puzzled_core::puzzle_play::daily_time::product_day_key(chrono::Utc::now());
    match daily_pipeline::fill(pool, today).await {
        Ok(report) => {
            let status = if report.failed.is_empty()
                && report.min_days_ahead >= daily_pipeline::ALERT_BELOW_DAYS
            {
                StatusCode::OK
            } else {
                // Compute retries a failed tick; the fill resumes where it stopped.
                StatusCode::SERVICE_UNAVAILABLE
            };
            (
                status,
                Json(json!({
                    "generated": report.generated,
                    "failed": report.failed.len(),
                    "min_days_ahead": report.min_days_ahead,
                })),
            )
                .into_response()
        }
        Err(error) => {
            tracing::warn!(%error, "daily puzzle tick failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "fill_failed"})),
            )
                .into_response()
        }
    }
}

/// Strip IPs after 30 days and delete audit rows after a year.
pub async fn audit_retention_tick(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(reject) = state.ticks.admit(&headers, AUDIT_RETENTION_PATH).await {
        return reject.response().into_response();
    }
    let Some(pool) = &state.pool else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "no_database"})),
        )
            .into_response();
    };
    match jobs_db::purge_audit_logs(pool).await {
        Ok((stripped, deleted)) => (
            StatusCode::OK,
            Json(json!({"stripped": stripped, "deleted": deleted})),
        )
            .into_response(),
        Err(error) => {
            tracing::warn!(%error, "audit-log retention tick failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "retention_failed"})),
            )
                .into_response()
        }
    }
}
