//! Composition root: app state, router, health, lifecycle.

mod connect_health;
mod connect_puzzle;
mod connect_stats;
mod health;
mod lifecycle;
mod router;
mod state;

pub use lifecycle::{http_port, request_shutdown, shutdown_signal};
pub use router::router;
pub use state::AppState;
