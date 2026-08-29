//! Commerce dest entitlement client (premium gating).
//!
//! One premium writer: dest Commerce `EvaluateEntitlement`. Failures default
//! to non-premium (free tier). Not Platform BaaS `SYLPHX_SECRET_KEY`,
//! `x-app-secret`, or `https://sylphx.com/billing/subscription`.

use std::time::Duration;

use serde_json::{json, Value};

const DEST_COMMERCE_ORIGIN: &str = "https://api.commerce.sylphx.com";
const DEST_EVALUATE_ENTITLEMENT: &str =
    "/v1/sylphx.commerce.v1.EntitlementService/EvaluateEntitlement";

fn dest_peel_origin(fallback: &str, raw: Option<&str>) -> String {
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

fn dest_commerce_origin() -> String {
    dest_peel_origin(
        DEST_COMMERCE_ORIGIN,
        std::env::var("COMMERCE_API_ORIGIN").ok().as_deref(),
    )
}

fn dest_commerce_credential() -> Option<String> {
    std::env::var("COMMERCE_API_KEY")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

pub(crate) fn entitlement_enabled(body: &Value) -> bool {
    let entitlement = body.get("entitlement").unwrap_or(body);
    entitlement
        .get("value")
        .and_then(|value| value.get("enabled"))
        .and_then(Value::as_bool)
        == Some(true)
}

/// Check premium entitlement for a dest Commerce subject id.
pub async fn is_premium(user_id: &str) -> bool {
    let Some(credential) = dest_commerce_credential() else {
        return false;
    };
    let policy_id = std::env::var("COMMERCE_ENTITLEMENT_POLICY_ID")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "premium".to_string());
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(client) => client,
        Err(error) => {
            tracing::warn!(%error, "commerce dest client build failed");
            return false;
        }
    };
    let origin = dest_commerce_origin();
    let response = match client
        .post(format!("{origin}{DEST_EVALUATE_ENTITLEMENT}"))
        .header("Authorization", format!("Bearer {credential}"))
        .json(&json!({
            "policy_id": policy_id,
            "subject_id": user_id,
            "as_of": chrono::Utc::now().to_rfc3339(),
        }))
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            tracing::warn!(%error, "commerce dest entitlement failed");
            return false;
        }
    };
    if !response.status().is_success() {
        tracing::warn!(status = %response.status(), "commerce dest entitlement non-2xx");
        return false;
    }
    let body: Value = match response.json().await {
        Ok(value) => value,
        Err(error) => {
            tracing::warn!(%error, "commerce dest entitlement parse failed");
            return false;
        }
    };
    entitlement_enabled(&body)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn dest_entitlement_enabled_is_premium() {
        assert!(entitlement_enabled(&json!({
            "entitlement": { "value": { "enabled": true } }
        })));
    }

    #[test]
    fn dest_entitlement_disabled_is_free() {
        assert!(!entitlement_enabled(&json!({
            "entitlement": { "value": { "enabled": false } }
        })));
        assert!(!entitlement_enabled(&json!({})));
    }

    #[test]
    fn dest_commerce_origin_rejects_suite_door() {
        assert_eq!(
            dest_peel_origin(DEST_COMMERCE_ORIGIN, Some("https://puzzled.api.sylphx.com")),
            DEST_COMMERCE_ORIGIN
        );
    }
}
