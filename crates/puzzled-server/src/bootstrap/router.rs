//! HTTP router composition root.
//!
//! Sole surface: Connect RPC services (healthz/readyz probes + Connect
//! fallback). The hand-rolled REST surface is deleted (ADR-170). The
//! non-Connect writes are the Compute schedule ticks and the key-guarded
//! Observability test trigger (docs/observability.md).
//! Every 5xx is captured into Sylphx Observability.

use axum::routing::{get, post};
use axum::Router;

use super::compute_ticks::{
    audit_retention_tick, daily_puzzles_tick, daily_reminders_tick, tryit_conversions_tick,
    AUDIT_RETENTION_PATH, DAILY_PUZZLES_PATH, DAILY_REMINDERS_PATH, TRYIT_CONVERSIONS_PATH,
};
use super::connect_admin::admin_connect_service;
use super::connect_announcements::announcement_connect_service;
use super::connect_billing::billing_connect_service;
use super::connect_gamification::gamification_connect_service;
use super::connect_health::health_connect_service;
use super::connect_jobs::jobs_connect_service;
use super::connect_preferences::preferences_connect_service;
use super::connect_puzzle::puzzle_connect_service;
use super::connect_stats::stats_connect_service;
use super::health::{healthz, readyz};
use super::observability_test::observability_test;
use super::state::AppState;
use crate::capabilities::identity_access::adapters::auth_session::attach_auth_session;

pub fn router(state: AppState) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(admin_connect_service(state.clone()))
        .add_service(announcement_connect_service(state.clone()))
        .add_service(billing_connect_service(state.clone()))
        .add_service(gamification_connect_service(state.clone()))
        .add_service(health_connect_service(state.clone()))
        .add_service(jobs_connect_service(state.clone()))
        .add_service(preferences_connect_service(state.clone()))
        .add_service(puzzle_connect_service(state.clone()))
        .add_service(stats_connect_service(state.clone()));

    let auth = state.auth.clone();
    let guest_pool = state.pool.clone();
    Router::new()
        .route(
            "/v1/guest/session",
            post(crate::capabilities::identity_access::adapters::guest_credentials::session),
        )
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .route(DAILY_PUZZLES_PATH, post(daily_puzzles_tick))
        .route(AUDIT_RETENTION_PATH, post(audit_retention_tick))
        .route(DAILY_REMINDERS_PATH, post(daily_reminders_tick))
        .route(TRYIT_CONVERSIONS_PATH, post(tryit_conversions_tick))
        .route("/observability/test", post(observability_test))
        .route(
            "/signals:induce",
            post(super::signals_induce::signals_induce),
        )
        .with_state(state)
        .fallback_service(connect.into_axum_service())
        .layer(axum::middleware::from_fn_with_state(
            guest_pool,
            crate::capabilities::identity_access::adapters::guest_credentials::attach_guest,
        ))
        // Sylphx Auth end-user sessions are checked once, before any service.
        .layer(axum::middleware::from_fn_with_state(
            auth,
            attach_auth_session,
        ))
        .layer(axum::middleware::from_fn(
            crate::capabilities::identity_access::adapters::guest_credentials::bootstrap_guard,
        ))
        .layer(axum::middleware::from_fn(
            crate::observability::capture_server_errors,
        ))
        // Quality signals (owner standards/quality-signals.md): a 5xx is one
        // `puzzled.issue.turn_failed.<route>` line, a finished write one
        // `puzzled.api.write.ok|failed` journey line. Outside the capturer so
        // it sees every response, including a captured error's.
        .layer(axum::middleware::from_fn(crate::shared::signals::observe))
}
