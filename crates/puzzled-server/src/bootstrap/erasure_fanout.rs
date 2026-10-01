//! `POST /webhooks/sylphx/erasure`: the platform's user-deletion fan-out.
//! Verification and parsing live in `erasure_delivery`; the erasure and its
//! idempotency in `identity_access::erasure`. This is only the HTTP shell.

use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

use super::state::AppState;
use crate::capabilities::identity_access::adapters::erasure_delivery::DeliveryError;
use crate::capabilities::identity_access::erasure::{handle, EVIDENCE_RETRY_DELAYS};

pub const ERASURE_FANOUT_PATH: &str = "/webhooks/sylphx/erasure";

fn refuse(status: StatusCode, error: &str) -> Response {
    (status, Json(json!({ "error": error }))).into_response()
}

pub async fn erasure_fanout(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    erasure_fanout_with(&state, &headers, &body, &EVIDENCE_RETRY_DELAYS).await
}

pub(crate) async fn erasure_fanout_with(
    state: &AppState,
    headers: &HeaderMap,
    body: &[u8],
    retry_delays: &[std::time::Duration],
) -> Response {
    let (Some(pool), Some(transport)) = (&state.pool, &state.erasure_fanout) else {
        return refuse(StatusCode::SERVICE_UNAVAILABLE, "erasure_unavailable");
    };
    let request = match transport.verify_and_parse(headers, body, chrono::Utc::now().timestamp()) {
        Ok(request) => request,
        Err(DeliveryError::Unverified) => {
            return refuse(StatusCode::UNAUTHORIZED, "delivery_unverified")
        }
        Err(DeliveryError::Foreign) => return refuse(StatusCode::FORBIDDEN, "delivery_foreign"),
        Err(DeliveryError::Malformed) => {
            return refuse(StatusCode::BAD_REQUEST, "delivery_malformed")
        }
        Err(DeliveryError::Unconfigured) => {
            return refuse(StatusCode::SERVICE_UNAVAILABLE, "erasure_unavailable")
        }
    };
    match handle(pool, transport, state.stripe.as_ref(), &request, retry_delays).await {
        Ok(handled) => (
            StatusCode::OK,
            Json(json!({
                "request_id": request.request_id,
                "replay": handled.replay,
                "evidence": handled.evidence,
            })),
        )
            .into_response(),
        Err(error) => {
            // Not acknowledged: the fan-out redelivers, and the request stays
            // failed on Auth's side until Puzzled has reported.
            tracing::error!(%error, request_id = %request.request_id, "erasure fan-out failed");
            refuse(StatusCode::BAD_GATEWAY, "erasure_not_reported")
        }
    }
}

/// Tests only: sign `body` with the state's webhook secret and run the handler.
#[cfg(test)]
pub(crate) async fn erasure_fanout_signed(
    state: &AppState,
    body: &[u8],
    retry_delays: &[std::time::Duration],
) -> StatusCode {
    let now = chrono::Utc::now().timestamp();
    let mut headers = HeaderMap::new();
    headers.insert("webhook-id", "msg_t".parse().unwrap());
    headers.insert("webhook-timestamp", now.to_string().parse().unwrap());
    headers.insert(
        "webhook-signature",
        crate::capabilities::identity_access::adapters::erasure_delivery::sign_delivery(
            "test-erasure-signing-fixture",
            "msg_t",
            now,
            body,
        )
        .parse()
        .unwrap(),
    );
    erasure_fanout_with(state, &headers, body, retry_delays)
        .await
        .status()
}
