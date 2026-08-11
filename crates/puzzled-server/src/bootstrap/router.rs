//! HTTP router composition root.
//!
//! Sole surface: Connect RPC services (healthz/readyz probes + Connect
//! fallback). The hand-rolled REST surface is deleted (ADR-170).

use axum::routing::get;
use axum::Router;

use super::connect_admin::admin_connect_service;
use super::connect_gamification::gamification_connect_service;
use super::connect_health::health_connect_service;
use super::connect_jobs::jobs_connect_service;
use super::connect_preferences::preferences_connect_service;
use super::connect_puzzle::puzzle_connect_service;
use super::connect_stats::stats_connect_service;
use super::health::{healthz, readyz};
use super::state::AppState;

pub fn router(state: AppState) -> Router {
    let connect = connectrpc::Router::new()
        .add_service(admin_connect_service(state.clone()))
        .add_service(gamification_connect_service(state.clone()))
        .add_service(health_connect_service(state.clone()))
        .add_service(jobs_connect_service(state.clone()))
        .add_service(preferences_connect_service(state.clone()))
        .add_service(puzzle_connect_service(state.clone()))
        .add_service(stats_connect_service(state.clone()));

    Router::new()
        .route("/healthz", get(healthz))
        .route("/readyz", get(readyz))
        .with_state(state)
        .fallback_service(connect.into_axum_service())
}
