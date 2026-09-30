//! Composition root: app state, router, health, lifecycle.

mod compute_ticks;
mod connect_admin;
mod connect_billing;
mod connect_gamification;
mod connect_health;
mod connect_jobs;
mod connect_preferences;
mod connect_puzzle;
mod connect_stats;
mod health;
mod identity;
mod lifecycle;
mod observability_test;
mod erasure_fanout;
mod router;
mod state;

pub use lifecycle::{http_port, request_shutdown, shutdown_signal};
pub use router::router;
pub use state::AppState;

/// Runs the fan-out handler with custom evidence retry pauses (tests only).
#[cfg(test)]
pub(crate) async fn erasure_fanout_for_tests(
    state: &AppState,
    body: &[u8],
    retry_delays: &[std::time::Duration],
) -> axum::http::StatusCode {
    erasure_fanout::erasure_fanout_signed(state, body, retry_delays).await
}
