//! puzzled-server binary — S0 health probes + domain stub.

use std::time::Duration;

use puzzled_server::{http_port, router, shutdown_signal, AppState};
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

    let state = AppState::new();
    let port = http_port();
    let listener = TcpListener::bind(("0.0.0.0", port)).await?;
    let app = router(state);

    info!(port, "puzzled-server listening on :{port} (/healthz, /readyz)");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tokio::time::sleep(Duration::from_millis(100)).await;
    Ok(())
}
