//! Dest product HTTP (Events + origin peel).
//!
//! Bearer product credentials. Not Apps Binding.

use std::time::Duration;

use reqwest::header::{HeaderMap as ReqHeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::{json, Value};

pub(crate) const DEST_EVENTS_ORIGIN: &str = "https://api.events.sylphx.com";
pub(crate) const DEST_COMMERCE_ORIGIN: &str = "https://api.commerce.sylphx.com";
const DEST_DELIVERIES: &str = "/v1/deliveries";

pub(crate) fn dest_peel_origin(fallback: &str, raw: Option<&str>) -> String {
    let Some(value) = raw.map(str::trim).filter(|s| !s.is_empty()) else {
        return fallback.to_string();
    };
    match reqwest::Url::parse(value) {
        Ok(url) => {
            let forbidden = url
                .host_str()
                .is_some_and(|host| host.to_ascii_lowercase().ends_with(".api.sylphx.com"));
            if forbidden {
                fallback.to_string()
            } else {
                value.trim_end_matches('/').to_string()
            }
        }
        Err(_) => fallback.to_string(),
    }
}

pub(crate) fn dest_events_origin() -> String {
    dest_peel_origin(
        DEST_EVENTS_ORIGIN,
        std::env::var("EVENTS_API_ORIGIN").ok().as_deref(),
    )
}

pub(crate) fn dest_events_credential() -> Option<String> {
    std::env::var("EVENTS_API_KEY")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn dest_product_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn retry_policy() -> Value {
    let expires_at = (chrono::Utc::now() + chrono::Duration::hours(1)).to_rfc3339();
    json!({
        "maximum_attempts": 3,
        "initial_backoff_seconds": 1,
        "maximum_backoff_seconds": 30,
        "per_attempt_timeout_seconds": 10,
        "expires_at": expires_at,
        "multiplier": 2.0,
    })
}

fn sanitize_idempotency(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for (index, ch) in raw.chars().enumerate() {
        if ch.is_ascii_alphanumeric() || (index > 0 && matches!(ch, '.' | '_' | ':' | '-')) {
            out.push(ch);
        } else {
            out.push('-');
        }
    }
    if out.len() < 8 {
        out.push_str("delivery");
    }
    out.truncate(128);
    out
}

pub(crate) fn dest_push_connector_id() -> Result<String, String> {
    dest_product_env("EVENTS_PUSH_CONNECTOR_ID")
        .ok_or_else(|| "EVENTS_PUSH_CONNECTOR_ID not configured".to_string())
}

pub(crate) fn dest_email_connector_id() -> Result<String, String> {
    dest_product_env("EVENTS_EMAIL_CONNECTOR_ID")
        .ok_or_else(|| "EVENTS_EMAIL_CONNECTOR_ID not configured".to_string())
}

pub(crate) fn dest_push_delivery(
    connector_id: &str,
    user_id: &str,
    title: &str,
    body: &str,
    url: &str,
) -> Value {
    let today = chrono::Utc::now().date_naive();
    let idempotency_key = sanitize_idempotency(&format!("daily-reminder-{user_id}-{today}"));
    json!({
        "idempotency_key": idempotency_key,
        "intent": {
            "push": {
                "connector_id": connector_id,
                "message": {
                    "targets": [user_id],
                    "title": title,
                    "body": body,
                    "data": { "url": url },
                }
            }
        },
        "retry_policy": retry_policy(),
    })
}

pub(crate) fn dest_email_delivery(
    connector_id: &str,
    user_id: &str,
    email: &str,
    email_type: &str,
    subject: &str,
    text_body: &str,
) -> Value {
    let sender =
        dest_product_env("EVENTS_EMAIL_FROM").unwrap_or_else(|| "noreply@puzzled.gg".to_string());
    let today = chrono::Utc::now().date_naive();
    let idempotency_key = sanitize_idempotency(&format!("win-back-{email_type}-{user_id}-{today}"));
    json!({
        "idempotency_key": idempotency_key,
        "intent": {
            "email": {
                "connector_id": connector_id,
                "message": {
                    "sender": { "address": sender },
                    "to": [{ "address": email }],
                    "subject": subject,
                    "text_body": text_body,
                }
            }
        },
        "retry_policy": retry_policy(),
    })
}

/// POST dest Events path with Bearer EVENTS_API_KEY.
pub(crate) async fn dest_events_post(path: &str, body: Value) -> Result<(), String> {
    let Some(credential) = dest_events_credential() else {
        return Err("events_dest_not_configured".to_string());
    };
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("events dest client build failed: {e}"))?;
    let mut headers = ReqHeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        AUTHORIZATION,
        HeaderValue::from_str(&format!("Bearer {credential}")).map_err(|e| e.to_string())?,
    );
    if let Some(key) = body.get("idempotency_key").and_then(Value::as_str) {
        if let Ok(value) = HeaderValue::from_str(key) {
            headers.insert("Idempotency-Key", value);
        }
    }
    let origin = dest_events_origin();
    let response = client
        .post(format!("{origin}{path}"))
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("events dest request failed: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("events dest {path} returned {status}: {text}"));
    }
    Ok(())
}

pub(crate) async fn dest_events_deliver(body: Value) -> Result<(), String> {
    dest_events_post(DEST_DELIVERIES, body).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dest_events_origin_rejects_suite_door() {
        assert_eq!(
            dest_peel_origin(DEST_EVENTS_ORIGIN, Some("https://puzzled.api.sylphx.com")),
            DEST_EVENTS_ORIGIN
        );
    }

    #[test]
    fn dest_commerce_origin_rejects_suite_door() {
        assert_eq!(
            dest_peel_origin(DEST_COMMERCE_ORIGIN, Some("https://puzzled.api.sylphx.com")),
            DEST_COMMERCE_ORIGIN
        );
    }

    #[test]
    fn dest_push_delivery_uses_events_path_fields() {
        let body = dest_push_delivery("conn-push", "user-a", "title", "body", "/");
        assert_eq!(body["intent"]["push"]["connector_id"], "conn-push");
        assert_eq!(body["intent"]["push"]["message"]["targets"][0], "user-a");
        assert!(body["idempotency_key"]
            .as_str()
            .is_some_and(|key| key.starts_with("daily-reminder-user-a")));
    }
}
