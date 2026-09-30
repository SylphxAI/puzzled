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
pub const DAILY_REMINDERS_PATH: &str = "/internal/compute/daily-reminders";
pub const TRYIT_CONVERSIONS_PATH: &str = "/internal/compute/tryit-conversions";

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
/// Retry the Tryit conversions still queued (a 503 or a failed send).
pub async fn tryit_conversions_tick(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(reject) = state.ticks.admit(&headers, TRYIT_CONVERSIONS_PATH).await {
        return reject.response().into_response();
    }
    let (Some(pool), Some(reporter)) = (&state.pool, &state.tryit) else {
        // No database, or no SYLPHX_API_KEY: nothing can be sent yet.
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "not_configured"})),
        )
            .into_response();
    };
    match crate::capabilities::tryit_conversions::sweep(pool, reporter).await {
        Ok(reported) => (StatusCode::OK, Json(json!({"reported": reported}))).into_response(),
        Err(error) => {
            tracing::warn!(%error, "tryit conversions tick failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "sweep_failed"})),
            )
                .into_response()
        }
    }
}

/// Send the daily reminders that are due now, each at its player's own time.
pub async fn daily_reminders_tick(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(reject) = state.ticks.admit(&headers, DAILY_REMINDERS_PATH).await {
        return reject.response().into_response();
    }
    let Some(pool) = &state.pool else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({"error": "no_database"})),
        )
            .into_response();
    };
    match super::connect_jobs::send_due_daily_reminders(pool, chrono::Utc::now()).await {
        Ok(sent) => (StatusCode::OK, Json(json!({"sent": sent}))).into_response(),
        Err(errors) => {
            tracing::warn!(failed = errors.len(), "daily reminders tick had failures");
            // Failed sends were released; Compute retries and they go out then.
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "send_failed", "failed": errors.len()})),
            )
                .into_response()
        }
    }
}
