//! Public liveness and readiness probes (not product capability proof).

use std::time::Duration;

use axum::extract::State;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use sqlx::PgPool;

use super::lifecycle::shutting_down;
use super::state::AppState;

#[derive(Serialize)]
struct HealthBody {
    status: &'static str,
}

fn probe_response(ok: bool) -> Response {
    let (code, status) = if ok {
        (StatusCode::OK, "ok")
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "not_ready")
    };
    (
        code,
        [(header::CACHE_CONTROL, "no-store")],
        Json(HealthBody { status }),
    )
        .into_response()
}

pub(crate) async fn healthz() -> Response {
    probe_response(!shutting_down())
}

pub(crate) async fn readyz(State(state): State<AppState>) -> Response {
    if shutting_down() {
        return probe_response(false);
    }

    // Fail closed: readiness requires a live Postgres dependency.
    let ready = if let Some(pool) = &state.pool {
        postgres_ping(pool).await
    } else {
        false
    };
    probe_response(ready)
}

async fn postgres_ping(pool: &PgPool) -> bool {
    tokio::time::timeout(
        Duration::from_millis(500),
        sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(pool),
    )
    .await
    .ok()
    .and_then(Result::ok)
    .is_some()
}
