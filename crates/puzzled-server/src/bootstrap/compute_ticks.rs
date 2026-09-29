//! Compute schedule ticks (`[[compute.schedules]]` in sylphx.toml). Each tick
//! is admitted only with Compute's signed receipt for its exact URL
//! (`shared::tick_receipt`), never a shared secret.

use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use super::state::AppState;
use crate::capabilities::billing_migration::{self, export, grants::EventsMailer};
use crate::capabilities::daily_pipeline;
use crate::capabilities::jobs::adapters::jobs_db;

pub const DAILY_PUZZLES_PATH: &str = "/internal/compute/daily-puzzles";
pub const AUDIT_RETENTION_PATH: &str = "/internal/compute/audit-log-retention";
pub const MIGRATE_GRANTS_PATH: &str = "/internal/compute/billing-migration/grants";
pub const MIGRATE_VERIFY_PATH: &str = "/internal/compute/billing-migration/verify";
pub const MIGRATE_EXPORT_PATH: &str = "/internal/compute/billing-migration/export";
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

fn unavailable(error: &'static str) -> Response {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({ "error": error })),
    )
        .into_response()
}

/// One-off, step 1 of the Stripe to Money subscriber migration: grants,
/// cancel at period end, email. 503 when any row failed, so Compute retries
/// (every step is idempotent).
pub async fn migrate_grants_tick(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(reject) = state.ticks.admit(&headers, MIGRATE_GRANTS_PATH).await {
        return reject.response().into_response();
    }
    let (Some(pool), Some(stripe), Some(money)) = (&state.pool, &state.stripe, &state.money) else {
        return unavailable("database_stripe_and_money_required");
    };
    match billing_migration::run_grants(pool, stripe, money, &EventsMailer).await {
        Ok(report) => {
            let status = if report.failed == 0 {
                StatusCode::OK
            } else {
                StatusCode::SERVICE_UNAVAILABLE
            };
            (
                status,
                Json(json!({
                    "live": report.live,
                    "granted": report.granted,
                    "already_granted": report.already_granted,
                    "cancelled": report.cancelled,
                    "already_cancelled": report.already_cancelled,
                    "emailed": report.emailed,
                    "no_email": report.no_email,
                    "skipped_ended": report.skipped_ended,
                    "failed": report.failed,
                })),
            )
                .into_response()
        }
        Err(error) => {
            tracing::warn!(%error, "subscriber migration grants run failed");
            unavailable("migration_failed")
        }
    }
}

/// Step 2, the readback: 200 only when every live row has its grants and
/// cancels at period end.
pub async fn migrate_verify_tick(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(reject) = state.ticks.admit(&headers, MIGRATE_VERIFY_PATH).await {
        return reject.response().into_response();
    }
    let (Some(pool), Some(stripe), Some(money)) = (&state.pool, &state.stripe, &state.money) else {
        return unavailable("database_stripe_and_money_required");
    };
    match billing_migration::verify(pool, stripe, money).await {
        Ok(found) => {
            let status = if found.complete() {
                StatusCode::OK
            } else {
                StatusCode::SERVICE_UNAVAILABLE
            };
            (
                status,
                Json(json!({
                    "live": found.live,
                    "missing_grant": found.missing_grant,
                    "still_renewing": found.still_renewing,
                })),
            )
                .into_response()
        }
        Err(error) => {
            tracing::warn!(%error, "subscriber migration readback failed");
            unavailable("readback_failed")
        }
    }
}

/// Step 3: export the `billing_*` rows and read them back.
pub async fn migrate_export_tick(State(state): State<AppState>, headers: HeaderMap) -> Response {
    if let Err(reject) = state.ticks.admit(&headers, MIGRATE_EXPORT_PATH).await {
        return reject.response().into_response();
    }
    let Some(pool) = &state.pool else {
        return unavailable("no_database");
    };
    let archive = match export::Archive::from_env() {
        Ok(archive) => archive,
        Err(error) => {
            tracing::warn!(%error, "billing export not configured");
            return unavailable("archive_not_configured");
        }
    };
    let prefix = export::prefix_for(chrono::Utc::now().date_naive());
    match export::run_export(pool, &archive, &prefix).await {
        Ok(tables) => (
            StatusCode::OK,
            Json(json!({
                "tables": tables
                    .iter()
                    .map(|t| json!({"table": t.table, "rows": t.rows}))
                    .collect::<Vec<_>>(),
            })),
        )
            .into_response(),
        Err(error) => {
            tracing::warn!(%error, "billing export failed");
            unavailable("export_failed")
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
