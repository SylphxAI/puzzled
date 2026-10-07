//! `POST /signals:induce`: the production check for quality signals
//! (owner standards/quality-signals.md "How it is judged").
//!
//! With `Authorization: Bearer <SYLPHX_API_KEY>` it reports one induced issue
//! and answers 503, so the readback is deterministic: call it once and the
//! desk alert intake files one item; call it again within the hour and the
//! same fingerprint is a note on that item. It changes no data.
//!
//! Any other caller gets 404. The key is the same one `/observability/test`
//! uses (the environment's Access key, minted and injected by the platform).

use axum::body::Bytes;
use axum::http::{HeaderMap, StatusCode};

use super::observability_test::{authorized, nonce};
use crate::shared::signals::{self, Kind};

/// The fingerprint the induce route reports for one request body: the nonce
/// when it has one, else a fixed name. The nonce keeps calls distinguishable
/// (a repeated readback is a note on the same item) without free text.
pub(crate) fn subject(body: &[u8]) -> String {
    match nonce(body) {
        s if s.is_empty() => "induce".to_owned(),
        s => s,
    }
}

pub(crate) async fn signals_induce(headers: HeaderMap, body: Bytes) -> StatusCode {
    let key = std::env::var("SYLPHX_API_KEY").ok();
    let header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());
    if !authorized(header, key.as_deref()) {
        return StatusCode::NOT_FOUND;
    }
    signals::issue(Kind::TurnFailed, &subject(&body), "503");
    StatusCode::SERVICE_UNAVAILABLE
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_subject_comes_from_the_nonce_or_a_fixed_name() {
        assert_eq!(subject(br#"{"nonce":"qa-1"}"#), "qa-1");
        assert_eq!(subject(b"{}"), "induce");
        // The nonce already keeps word characters only, so the fingerprint
        // stays a valid event name whatever the body held.
        assert_eq!(
            signals::fingerprint(Kind::TurnFailed, &subject(br#"{"nonce":"qa<pad>"}"#)),
            "puzzled.issue.turn_failed.qapad"
        );
    }
}
