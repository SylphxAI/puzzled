//! puzzled-server binary — S1 health probes + leaderboard read slice.

use std::time::Duration;

use puzzled_server::shared::db_config::{select_database_url, writer_pool_options};
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
    // Operator commands run in the api's own environment (sylphx.toml
    // `[[jobs]]`), with its bindings, and exit instead of serving.
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().map(String::as_str) == Some("erase-player") {
        std::process::exit(
            puzzled_server::capabilities::preferences::erase_player::main(&args[1..]).await,
        );
    }
    puzzled_server::observability::init();
    if let Err(message) = puzzled_server::shared::public_origin::public_origin() {
        tracing::error!(message, "public origin configuration refused");
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, message).into());
    }

    // Cold-start + managed DNS: allow longer first connect so free-floor ritual
    // persist is not permanently demoted to S0 on a transient 3s timeout.
    let pool = match select_database_url() {
        Some(url) => match writer_pool_options(
            PgPoolOptions::new()
                .max_connections(5)
                .acquire_timeout(Duration::from_secs(15))
                .max_lifetime(Some(Duration::from_secs(600))),
        )
        .connect(&url)
        .await
        {
            Ok(pool) => {
                info!("postgres pool connected (ADR-168 S1)");
                Some(pool)
            }
            Err(error) => {
                // A configured store that cannot be reached must not leave a
                // stub pod in rotation for the life of the process: exit so the
                // platform restarts it until the database is back.
                tracing::error!(%error, "postgres connect failed; exiting");
                std::process::exit(1);
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

    // Daily puzzles: fill 14 days ahead and the archive at start-up; the
    // Compute schedule keeps it filled (issue #246).
    let _daily_fill =
        puzzled_server::capabilities::daily_pipeline::spawn_startup_fill(pool.clone());

    let money = puzzled_server::capabilities::money::Money::from_env();
    if let Some(money) = &money {
        // The org, project and env come from the key's own whoami.
        if let Err(error) = money.warm().await {
            tracing::warn!(%error, "Sylphx Money environment not resolved at start-up; retrying on use");
        }
    }
    match &money {
        Some(_) => {
            info!("Sylphx Money configured: entitlements, checkout and prices come from Money")
        }
        None => {
            info!("Sylphx Money not configured: Puzzled Plus is not on sale and nothing is locked")
        }
    }
    let state = AppState::new(pool).with_money(money);
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
