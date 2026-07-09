//! puzzled-server binary — S1 health probes + leaderboard read slice.

use std::time::Duration;

use puzzled_server::db_config::select_database_url;
use puzzled_server::{http_port, router, shutdown_signal, AppState};
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tracing::info;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let pool = match select_database_url() {
        Some(url) => match PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(3))
            .test_before_acquire(true)
            .max_lifetime(Some(Duration::from_secs(600)))
            .connect(&url)
            .await
        {
            Ok(pool) => {
                info!("postgres pool connected (ADR-168 S1)");
                Some(pool)
            }
            Err(error) => {
                tracing::warn!(%error, "postgres connect failed — running S0 stub leaderboard");
                None
            }
        },
        None => {
            tracing::info!("no database URL configured — running S0 stub leaderboard");
            None
        }
    };

    let state = AppState::new(pool);
    let slice = if state.pool.is_some() { "S1" } else { "S0" };
    let port = http_port();
    let listener = TcpListener::bind(("0.0.0.0", port)).await?;
    let app = router(state);

    info!(
        port,
        slice,
        "puzzled-server listening on :{port} (/healthz, /readyz, /api/v1/stats/leaderboard)"
    );

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tokio::time::sleep(Duration::from_millis(100)).await;
    Ok(())
}