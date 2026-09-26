//! `POST /observability/test`: the production check for error capture.
//!
//! With `Authorization: Bearer <SYLPHX_API_KEY>` it fails on purpose: a
//! spawned task panics with `observability test error <nonce>` (the panic hook
//! captures it) and the response is a 500 (the 5xx middleware captures it).
//! Any other caller gets 404. See docs/observability.md.

use axum::body::Bytes;
use axum::http::{HeaderMap, StatusCode};
use sha2::Digest;

fn digest(value: &str) -> [u8; 32] {
    sha2::Sha256::digest(value.as_bytes()).into()
}

/// True when `header` is `Bearer <key>` (compared as digests, constant time).
pub(crate) fn authorized(header: Option<&str>, key: Option<&str>) -> bool {
    let (Some(header), Some(key)) = (header, key.map(str::trim).filter(|k| !k.is_empty())) else {
        return false;
    };
    let expected = digest(&format!("Bearer {key}"));
    let provided = digest(header.trim());
    expected
        .iter()
        .zip(provided.iter())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b))
        == 0
}

/// The nonce from `{"nonce": "..."}`, limited to word characters and dashes.
pub(crate) fn nonce(body: &[u8]) -> String {
    serde_json::from_slice::<serde_json::Value>(body)
        .ok()
        .and_then(|v| v.get("nonce")?.as_str().map(str::to_owned))
        .unwrap_or_default()
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .take(64)
        .collect()
}

pub(crate) async fn observability_test(headers: HeaderMap, body: Bytes) -> StatusCode {
    let key = std::env::var("SYLPHX_API_KEY").ok();
    let header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());
    if !authorized(header, key.as_deref()) {
        return StatusCode::NOT_FOUND;
    }
    let nonce = nonce(&body);
    let message = format!(
        "observability test error {}",
        if nonce.is_empty() { "no-nonce" } else { &nonce }
    );
    let _ = tokio::spawn(async move { panic!("{message}") }).await;
    StatusCode::INTERNAL_SERVER_ERROR
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_environment_key_is_accepted() {
        assert!(authorized(Some("Bearer k1"), Some("k1")));
        assert!(!authorized(Some("Bearer k2"), Some("k1")));
        assert!(!authorized(None, Some("k1")));
        assert!(!authorized(Some("Bearer "), None));
        assert!(!authorized(Some("Bearer "), Some(" ")));
    }

    #[test]
    fn nonce_keeps_word_characters_only() {
        assert_eq!(nonce(br#"{"nonce":"abc-123<script>"}"#), "abc-123script");
        assert_eq!(nonce(b"not json"), "");
    }
}
