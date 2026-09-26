//! Stripe REST adapter for Puzzled Plus.
//!
//! Stripe is the payment processor (owner architecture standard, merchant
//! payments exception). It holds prices, customers, subscriptions, invoices
//! and refunds. Puzzled never trusts a webhook body: every event is read back
//! from Stripe before it changes a row.
//!
//! The API version is pinned so the fields read here (`current_period_end`,
//! `invoice.charge`) keep their meaning when the account default moves.

use std::sync::Arc;
use std::time::{Duration, Instant};

use serde_json::Value;
use tokio::sync::Mutex;

pub const STRIPE_API_VERSION: &str = "2024-06-20";
const DEFAULT_API_BASE: &str = "https://api.stripe.com";
const DEFAULT_PUBLIC_URL: &str = "https://puzzled.gg";
const PRICE_CACHE_TTL: Duration = Duration::from_secs(300);
/// Largest clock difference accepted on a webhook signature.
pub const WEBHOOK_TOLERANCE_SECS: i64 = 300;

/// A Puzzled Plus price as Stripe publishes it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StripePrice {
    pub id: String,
    pub plan_id: &'static str,
    pub interval: String,
    /// (currency, unit amount in minor units), default currency first.
    pub amounts: Vec<(String, i64)>,
}

/// A subscription as read back from Stripe.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StripeSubscription {
    pub id: String,
    pub customer: String,
    pub status: String,
    pub plan_id: Option<&'static str>,
    pub current_period_end: i64,
    pub cancel_at_period_end: bool,
    pub start_date: i64,
    pub user_id: Option<String>,
    /// First-touch campaign tags copied into metadata at checkout
    /// (`utm_source` ... `ref`), as a JSON object; None when there are none.
    pub attribution: Option<Value>,
}

/// When the prices were read, and what they were.
type PriceCache = (Instant, Vec<StripePrice>);

#[derive(Clone)]
pub struct Stripe {
    http: reqwest::Client,
    secret_key: String,
    webhook_secret: String,
    api_base: String,
    public_url: String,
    prices: Arc<Mutex<Option<PriceCache>>>,
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

impl Stripe {
    /// Sales are open only when both the API key and the webhook secret are
    /// configured: without the webhook nothing could confirm a payment.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        let secret_key = env_value("STRIPE_SECRET_KEY")?;
        let webhook_secret = env_value("STRIPE_WEBHOOK_SECRET")?;
        Some(Self::new(
            secret_key,
            webhook_secret,
            env_value("STRIPE_API_BASE").unwrap_or_else(|| DEFAULT_API_BASE.to_string()),
            env_value("PUZZLED_PUBLIC_URL").unwrap_or_else(|| DEFAULT_PUBLIC_URL.to_string()),
        ))
    }

    #[must_use]
    pub fn new(
        secret_key: String,
        webhook_secret: String,
        api_base: String,
        public_url: String,
    ) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap_or_default();
        Self {
            http,
            secret_key,
            webhook_secret,
            api_base: api_base.trim_end_matches('/').to_string(),
            public_url: public_url.trim_end_matches('/').to_string(),
            prices: Arc::new(Mutex::new(None)),
        }
    }

    #[must_use]
    pub fn public_url(&self) -> &str {
        &self.public_url
    }

    /// Test-mode keys start with `sk_test_` / `rk_test_`.
    #[must_use]
    pub fn live_mode(&self) -> bool {
        self.secret_key.starts_with("sk_live_") || self.secret_key.starts_with("rk_live_")
    }

    async fn send(&self, request: reqwest::RequestBuilder) -> Result<Value, String> {
        let response = request
            .bearer_auth(&self.secret_key)
            .header("Stripe-Version", STRIPE_API_VERSION)
            .send()
            .await
            .map_err(|e| format!("stripe request failed: {e}"))?;
        let status = response.status();
        let body: Value = response
            .json()
            .await
            .map_err(|e| format!("stripe response unreadable: {e}"))?;
        if status.is_success() {
            Ok(body)
        } else {
            let message = body
                .pointer("/error/message")
                .and_then(Value::as_str)
                .unwrap_or("unknown error");
            Err(format!("stripe {status}: {message}"))
        }
    }

    pub async fn get(&self, path: &str, query: &[(&str, &str)]) -> Result<Value, String> {
        let url = format!("{}{path}", self.api_base);
        self.send(self.http.get(url).query(query)).await
    }

    pub async fn post(
        &self,
        path: &str,
        form: &[(String, String)],
        idempotency_key: Option<&str>,
    ) -> Result<Value, String> {
        let url = format!("{}{path}", self.api_base);
        let mut request = self.http.post(url).form(form);
        if let Some(key) = idempotency_key {
            request = request.header("Idempotency-Key", key);
        }
        self.send(request).await
    }

    pub async fn delete(&self, path: &str) -> Result<Value, String> {
        let url = format!("{}{path}", self.api_base);
        self.send(self.http.delete(url)).await
    }

    /// The four Puzzled Plus prices, by lookup key; cached for five minutes.
    pub async fn prices(&self) -> Result<Vec<StripePrice>, String> {
        let mut cache = self.prices.lock().await;
        if let Some((at, prices)) = cache.as_ref() {
            if at.elapsed() < PRICE_CACHE_TTL {
                return Ok(prices.clone());
            }
        }
        let keys: Vec<String> = puzzled_core::billing_access::policy::PLAN_IDS
            .iter()
            .map(|plan| puzzled_core::billing_access::policy::price_lookup_key(plan))
            .collect();
        let mut query: Vec<(&str, &str)> = vec![
            ("active", "true"),
            ("limit", "20"),
            ("expand[]", "data.currency_options"),
        ];
        for key in &keys {
            query.push(("lookup_keys[]", key.as_str()));
        }
        let body = self.get("/v1/prices", &query).await?;
        let prices = parse_prices(&body);
        *cache = Some((Instant::now(), prices.clone()));
        Ok(prices)
    }

    pub async fn subscription(&self, id: &str) -> Result<StripeSubscription, String> {
        let body = self
            .get(&format!("/v1/subscriptions/{}", path_segment(id)?), &[])
            .await?;
        parse_subscription(&body).ok_or_else(|| "stripe subscription unreadable".to_string())
    }

    pub async fn customer_subscriptions(
        &self,
        customer: &str,
    ) -> Result<Vec<StripeSubscription>, String> {
        let body = self
            .get(
                "/v1/subscriptions",
                &[("customer", customer), ("status", "all"), ("limit", "20")],
            )
            .await?;
        Ok(body
            .get("data")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(parse_subscription).collect())
            .unwrap_or_default())
    }

    /// Verify a `Stripe-Signature` header over the raw body.
    #[must_use]
    pub fn verify_webhook(&self, payload: &[u8], header: &str, now_secs: i64) -> bool {
        verify_webhook_signature(payload, header, &self.webhook_secret, now_secs)
    }
}

/// Stripe ids are opaque tokens; refuse anything that could change the path.
pub fn path_segment(id: &str) -> Result<&str, String> {
    let ok = !id.is_empty()
        && id.len() <= 255
        && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_');
    if ok {
        Ok(id)
    } else {
        Err("invalid stripe id".to_string())
    }
}

#[must_use]
pub fn parse_prices(body: &Value) -> Vec<StripePrice> {
    let Some(items) = body.get("data").and_then(Value::as_array) else {
        return Vec::new();
    };
    let mut prices: Vec<StripePrice> = items
        .iter()
        .filter_map(|item| {
            let lookup = item.get("lookup_key")?.as_str()?;
            let plan_id = puzzled_core::billing_access::policy::plan_id_from_lookup_key(lookup)?;
            let currency = item.get("currency")?.as_str()?.to_string();
            let amount = item.get("unit_amount")?.as_i64()?;
            let mut amounts = vec![(currency.clone(), amount)];
            if let Some(options) = item.get("currency_options").and_then(Value::as_object) {
                let mut extra: Vec<(String, i64)> = options
                    .iter()
                    .filter(|(code, _)| **code != currency)
                    .filter_map(|(code, option)| {
                        Some((code.clone(), option.get("unit_amount")?.as_i64()?))
                    })
                    .collect();
                extra.sort();
                amounts.extend(extra);
            }
            Some(StripePrice {
                id: item.get("id")?.as_str()?.to_string(),
                plan_id,
                interval: item.pointer("/recurring/interval")?.as_str()?.to_string(),
                amounts,
            })
        })
        .collect();
    let order = |plan: &str| {
        puzzled_core::billing_access::policy::PLAN_IDS
            .iter()
            .position(|p| *p == plan)
            .unwrap_or(usize::MAX)
    };
    prices.sort_by_key(|price| order(price.plan_id));
    prices
}

#[must_use]
pub fn parse_subscription(body: &Value) -> Option<StripeSubscription> {
    let lookup = body
        .pointer("/items/data/0/price/lookup_key")
        .and_then(Value::as_str);
    Some(StripeSubscription {
        id: body.get("id")?.as_str()?.to_string(),
        customer: match body.get("customer")? {
            Value::String(id) => id.clone(),
            other => other.get("id")?.as_str()?.to_string(),
        },
        status: body.get("status")?.as_str()?.to_string(),
        plan_id: lookup.and_then(puzzled_core::billing_access::policy::plan_id_from_lookup_key),
        current_period_end: body.get("current_period_end")?.as_i64()?,
        cancel_at_period_end: body
            .get("cancel_at_period_end")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        start_date: body.get("start_date")?.as_i64()?,
        user_id: body
            .pointer("/metadata/user_id")
            .and_then(Value::as_str)
            .map(str::to_string),
        attribution: attribution_from_metadata(body.get("metadata")),
    })
}

/// The campaign tags in a Stripe metadata object.
fn attribution_from_metadata(metadata: Option<&Value>) -> Option<Value> {
    let metadata = metadata?.as_object()?;
    let tags: serde_json::Map<String, Value> = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "ref",
    ]
    .into_iter()
    .filter_map(|key| Some((key.to_string(), metadata.get(key)?.clone())))
    .collect();
    (!tags.is_empty()).then_some(Value::Object(tags))
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    use sha2::{Digest, Sha256};
    const BLOCK: usize = 64;
    let mut block = [0u8; BLOCK];
    if key.len() > BLOCK {
        let digest: [u8; 32] = Sha256::digest(key).into();
        block[..32].copy_from_slice(&digest);
    } else {
        block[..key.len()].copy_from_slice(key);
    }
    let mut inner = Sha256::new();
    inner.update(block.map(|b| b ^ 0x36));
    inner.update(message);
    let inner: [u8; 32] = inner.finalize().into();
    let mut outer = Sha256::new();
    outer.update(block.map(|b| b ^ 0x5c));
    outer.update(inner);
    outer.finalize().into()
}

fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(DIGITS[usize::from(b >> 4)] as char);
        out.push(DIGITS[usize::from(b & 0x0f)] as char);
    }
    out
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Stripe webhook signature: `t=<unix>,v1=<hex hmac>` over `"{t}.{payload}"`
/// with the endpoint secret, inside [`WEBHOOK_TOLERANCE_SECS`].
#[must_use]
pub fn verify_webhook_signature(payload: &[u8], header: &str, secret: &str, now_secs: i64) -> bool {
    let mut timestamp: Option<i64> = None;
    let mut signatures: Vec<&str> = Vec::new();
    for part in header.split(',') {
        match part.trim().split_once('=') {
            Some(("t", value)) => timestamp = value.parse().ok(),
            Some(("v1", value)) => signatures.push(value),
            _ => {}
        }
    }
    let Some(timestamp) = timestamp else {
        return false;
    };
    if (now_secs - timestamp).abs() > WEBHOOK_TOLERANCE_SECS || secret.is_empty() {
        return false;
    }
    let mut signed = timestamp.to_string().into_bytes();
    signed.push(b'.');
    signed.extend_from_slice(payload);
    let expected = hex(&hmac_sha256(secret.as_bytes(), &signed));
    signatures
        .iter()
        .any(|candidate| constant_time_eq(candidate.as_bytes(), expected.as_bytes()))
}

/// Build a valid signature header (tests and local webhook replay).
#[must_use]
pub fn sign_webhook(payload: &[u8], secret: &str, timestamp: i64) -> String {
    let mut signed = timestamp.to_string().into_bytes();
    signed.push(b'.');
    signed.extend_from_slice(payload);
    format!(
        "t={timestamp},v1={}",
        hex(&hmac_sha256(secret.as_bytes(), &signed))
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn hmac_matches_rfc4231_case_2() {
        let mac = hmac_sha256(b"Jefe", b"what do ya want for nothing?");
        assert_eq!(
            hex(&mac),
            "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"
        );
    }

    #[test]
    fn webhook_signature_accepts_valid_and_rejects_tampered_or_stale() {
        let body = br#"{"id":"evt_1"}"#;
        let header = sign_webhook(body, "whsec_test", 1_000);
        assert!(verify_webhook_signature(body, &header, "whsec_test", 1_100));
        assert!(!verify_webhook_signature(
            br#"{"id":"evt_2"}"#,
            &header,
            "whsec_test",
            1_100
        ));
        assert!(!verify_webhook_signature(
            body,
            &header,
            "whsec_other",
            1_100
        ));
        assert!(!verify_webhook_signature(
            body,
            &header,
            "whsec_test",
            1_000 + 301
        ));
        assert!(!verify_webhook_signature(
            body,
            "v1=abc",
            "whsec_test",
            1_000
        ));
    }

    #[test]
    fn prices_parse_currency_options_and_ignore_foreign_lookup_keys() {
        let body = json!({"data": [
            {"id": "price_y", "lookup_key": "puzzled_individual_yearly", "currency": "usd",
             "unit_amount": 3999, "recurring": {"interval": "year"},
             "currency_options": {"usd": {"unit_amount": 3999}, "gbp": {"unit_amount": 3299}}},
            {"id": "price_m", "lookup_key": "puzzled_individual_monthly", "currency": "usd",
             "unit_amount": 499, "recurring": {"interval": "month"}},
            {"id": "price_x", "lookup_key": "other_app", "currency": "usd",
             "unit_amount": 1, "recurring": {"interval": "month"}}
        ]});
        let prices = parse_prices(&body);
        assert_eq!(prices.len(), 2);
        assert_eq!(prices[0].plan_id, "individual_monthly");
        assert_eq!(
            prices[1].amounts,
            vec![("usd".to_string(), 3999), ("gbp".to_string(), 3299)]
        );
    }

    #[test]
    fn subscription_parses_plan_and_owner() {
        let body = json!({
            "id": "sub_1", "customer": "cus_1", "status": "active",
            "current_period_end": 2_000, "cancel_at_period_end": false, "start_date": 1_000,
            "metadata": {"user_id": "u1", "utm_source": "tryit", "ref": "r1"},
            "items": {"data": [{"price": {"lookup_key": "puzzled_family_monthly"}}]}
        });
        let sub = parse_subscription(&body).expect("subscription");
        assert_eq!(sub.plan_id, Some("family_monthly"));
        assert_eq!(sub.user_id.as_deref(), Some("u1"));
        assert_eq!(
            sub.attribution,
            Some(json!({"utm_source": "tryit", "ref": "r1"}))
        );
    }

    #[test]
    fn path_segment_refuses_traversal() {
        assert!(path_segment("sub_1AbC").is_ok());
        assert!(path_segment("../v1/charges").is_err());
        assert!(path_segment("").is_err());
    }
}
