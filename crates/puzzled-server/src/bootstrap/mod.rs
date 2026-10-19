//! Composition root: app state, router, health, lifecycle.

mod compute_ticks;
mod connect_admin;
mod connect_announcements;
mod connect_billing;
mod connect_gamification;
mod connect_health;
mod connect_jobs;
mod connect_preferences;
mod connect_puzzle;
mod connect_stats;
mod health;
pub(crate) mod identity;
pub(crate) mod lifecycle;
mod observability_test;
mod router;
mod signals_induce;
mod state;

pub use lifecycle::{drain_tasks, http_port, request_shutdown, shutdown_signal};
pub use router::router;
pub use state::AppState;
