//! puzzled-server binary — S1 health probes + leaderboard read slice.

use std::time::Duration;

use puzzled_server::shared::db_config::select_database_url;
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
    puzzled_server::observability::init();

    // Cold-start + managed DNS: allow longer first connect so free-floor ritual
    // persist is not permanently demoted to S0 on a transient 3s timeout.
    let pool = match select_database_url() {
        Some(url) => match PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(15))
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

    // Platform JWKS loads and refreshes off the request path (async, bounded).
    let _jwks_refresher = puzzled_server::spawn_jwks_refresher();

    // Audit-log retention: IPs stripped after 30 days, rows deleted after a year.
    let _audit_retention =
        puzzled_server::capabilities::jobs::adapters::jobs_db::spawn_audit_log_retention(
            pool.clone(),
        );

    let stripe = puzzled_server::capabilities::billing::adapters::stripe::Stripe::from_env();
    match &stripe {
        Some(stripe) if stripe.live_mode() => {
            info!("Stripe configured (live mode); Plus is on sale once prices exist")
        }
        Some(_) => info!("Stripe configured (test mode); Plus is on sale once prices exist"),
        None => info!("Stripe not configured: Puzzled Plus is not on sale and nothing is locked"),
    }
    let state = AppState::new(pool).with_stripe(stripe);
    let slice = if state.pool.is_some() { "S1" } else { "S0" };
    let port = http_port();
    let listener = TcpListener::bind(("0.0.0.0", port)).await?;
    let app = router(state);

    info!(
        port,
        slice, "puzzled-server listening on :{port} (/healthz, /readyz, /api/v1/stats/leaderboard)"
    );

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tokio::time::sleep(Duration::from_millis(100)).await;
    Ok(())
}
