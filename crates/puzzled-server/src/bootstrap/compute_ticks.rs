//! Compute schedule ticks (`[[compute.schedules]]` in sylphx.toml). Each tick
//! is admitted only with Compute's signed receipt for its exact URL
//! through `sylphx::auth::verify`, never a shared secret.

use axum::extract::{OriginalUri, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;
use sylphx::auth::verify::{TickVerifier, VerifyError};

use super::state::AppState;
use crate::capabilities::daily_pipeline;
use crate::capabilities::jobs::adapters::jobs_db;

pub const DAILY_PUZZLES_PATH: &str = "/internal/compute/daily-puzzles";
pub const AUDIT_RETENTION_PATH: &str = "/internal/compute/audit-log-retention";
pub const DAILY_REMINDERS_PATH: &str = "/internal/compute/daily-reminders";
pub const TRYIT_CONVERSIONS_PATH: &str = "/internal/compute/tryit-conversions";

/// Product transport mapping only; signature, claims and keys belong to the SDK.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TickError {
    Missing,
    Invalid,
    Unavailable,
}

impl TickError {
    fn response(self) -> (StatusCode, Json<serde_json::Value>) {
        let (status, error) = match self {
            Self::Missing => (StatusCode::UNAUTHORIZED, "tick_receipt_missing"),
            Self::Invalid => (StatusCode::UNAUTHORIZED, "tick_receipt_invalid"),
            Self::Unavailable => (StatusCode::SERVICE_UNAVAILABLE, "tick_receipt_unavailable"),
        };
        (status, Json(json!({"error": error})))
    }
}

/// Extract the bearer and exact public URL, then delegate admission to the SDK.
/// The edge preserves Host; forwarded-host is only a fallback for old routes.
pub async fn admit_tick(
    verifier: &TickVerifier,
    headers: &HeaderMap,
    path: &str,
) -> Result<(), TickError> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .ok_or(TickError::Missing)?;
    let host = headers
        .get(header::HOST)
        .or_else(|| headers.get("x-forwarded-host"))
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|h| !h.is_empty())
        .ok_or(TickError::Invalid)?;
    verifier
        .verify_tick_receipt(token, &format!("https://{host}{path}"))
        .await
        .map(|_| ())
        .map_err(|error| match error {
            VerifyError::Keys(_) => TickError::Unavailable,
            _ => TickError::Invalid,
        })
}

/// Store every missing daily puzzle (14 days ahead, 30-day archive).
pub async fn daily_puzzles_tick(
    State(state): State<AppState>,
    OriginalUri(uri): OriginalUri,
    headers: HeaderMap,
) -> Response {
    if let Err(reject) = admit_tick(
        &state.ticks,
        &headers,
        uri.path_and_query()
            .map(|p| p.as_str())
            .unwrap_or(uri.path()),
    )
    .await
    {
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
pub async fn audit_retention_tick(
    State(state): State<AppState>,
    OriginalUri(uri): OriginalUri,
    headers: HeaderMap,
) -> Response {
    if let Err(reject) = admit_tick(
        &state.ticks,
        &headers,
        uri.path_and_query()
            .map(|p| p.as_str())
            .unwrap_or(uri.path()),
    )
    .await
    {
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
pub async fn tryit_conversions_tick(
    State(state): State<AppState>,
    OriginalUri(uri): OriginalUri,
    headers: HeaderMap,
) -> Response {
    if let Err(reject) = admit_tick(
        &state.ticks,
        &headers,
        uri.path_and_query()
            .map(|p| p.as_str())
            .unwrap_or(uri.path()),
    )
    .await
    {
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
pub async fn daily_reminders_tick(
    State(state): State<AppState>,
    OriginalUri(uri): OriginalUri,
    headers: HeaderMap,
) -> Response {
    if let Err(reject) = admit_tick(
        &state.ticks,
        &headers,
        uri.path_and_query()
            .map(|p| p.as_str())
            .unwrap_or(uri.path()),
    )
    .await
    {
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
