//! Platform BaaS billing entitlement client (premium gating).
//!
//! Mirrors `apps/puzzled/src/lib/billing/server.ts` `hasPremiumAccess`:
//! premium = active/trialing subscription on a paid plan. Failures default to
//! non-premium (free tier), matching the web's behavior.

use std::time::Duration;

use serde_json::Value;

const PREMIUM_PLANS: [&str; 3] = ["premium", "lifetime", "pro"];

/// Check premium entitlement for a platform user id.
pub async fn is_premium(user_id: &str) -> bool {
    let base = std::env::var("SYLPHX_PLATFORM_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "https://sylphx.com".to_string());
    let secret = std::env::var("SYLPHX_SECRET_KEY")
        .or_else(|_| std::env::var("PUZZLED_APP_SECRET"))
        .unwrap_or_default();
    if secret.trim().is_empty() {
        return false;
    }
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(error) => {
            tracing::warn!(%error, "billing client build failed");
            return false;
        }
    };
    let response = match client
        .get(format!("{base}/billing/subscription"))
        .query(&[("userId", user_id)])
        .header("x-app-secret", secret)
        .send()
        .await
    {
        Ok(r) => r,
        Err(error) => {
            tracing::warn!(%error, "billing check failed");
            return false;
        }
    };
    if !response.status().is_success() {
        tracing::warn!(status = %response.status(), "billing check non-2xx");
        return false;
    }
    let body: Value = match response.json().await {
        Ok(v) => v,
        Err(error) => {
            tracing::warn!(%error, "billing response parse failed");
            return false;
        }
    };
    let status = body.get("status").and_then(Value::as_str).unwrap_or("");
    let plan_slug = body
        .get("planSlug")
        .and_then(Value::as_str)
        .or_else(|| {
            body.get("plan")
                .and_then(|p| p.get("slug"))
                .and_then(Value::as_str)
        })
        .unwrap_or("");
    let active = status == "active" || status == "trialing";
    active && PREMIUM_PLANS.contains(&plan_slug)
}
