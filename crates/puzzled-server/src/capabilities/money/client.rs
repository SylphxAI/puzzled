//! Thin REST client for the Money calls Puzzled uses, shaped from
//! `contracts/generated/openapi.json` (cloud#10272): `entitlement_grants:check`,
//! `checkout_sessions` and `catalogs/default`. Nothing else is called.
//!
//! Entitlement answers are cached at most 60 seconds and never past the
//! answer's `expire_time`; a Money call that fails answers "not entitled"
//! (fail closed) and is never served stale past that cache window.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};

/// Longest a positive entitlement answer is reused (Money integration rule).
pub const GRANT_CACHE_TTL: Duration = Duration::from_secs(60);
/// A "not entitled" answer is reused only briefly, so a buyer whose grant has
/// just arrived is not kept waiting a full minute.
pub const DENIED_CACHE_TTL: Duration = Duration::from_secs(10);
/// How long a read catalogue is reused.
pub const CATALOG_CACHE_TTL: Duration = Duration::from_secs(300);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);
const DEFAULT_PUBLIC_URL: &str = "https://puzzled.gg";

/// Why a Money call did not answer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MoneyError {
    /// Money could not be reached or answered 5xx / unreadable.
    Unavailable(String),
    /// Money answered with a refusal (4xx); `code` is its problem code.
    Refused { status: u16, code: String },
}

impl std::fmt::Display for MoneyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unavailable(why) => write!(f, "money unavailable: {why}"),
            Self::Refused { status, code } => write!(f, "money refused ({status}): {code}"),
        }
    }
}

/// Money's answer to one entitlement check.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Grant {
    pub entitled: bool,
    /// For a `limit` feature, the allowance the subject holds.
    pub limit: Option<u32>,
    /// When the answering grant ends; None for no end.
    pub ends_at: Option<DateTime<Utc>>,
}

impl Grant {
    /// The fail-closed answer.
    #[must_use]
    pub fn denied() -> Self {
        Self::default()
    }
}

#[derive(Deserialize)]
struct CheckResponse {
    #[serde(default)]
    entitled: bool,
    #[serde(default)]
    limit: Option<String>,
    #[serde(default)]
    expire_time: Option<String>,
}

/// A catalogue price as `GET catalogs/default` publishes it.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct CatalogPrice {
    pub key: String,
    #[serde(default)]
    pub recurring_interval: Option<String>,
    #[serde(default)]
    pub tax_behavior: Option<String>,
    #[serde(default)]
    pub archived: bool,
    /// Upper-case ISO 4217 code to minor units, as a decimal string.
    #[serde(default)]
    pub unit_amounts: std::collections::BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct CatalogProduct {
    pub key: String,
    #[serde(default)]
    pub prices: Vec<CatalogPrice>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Deserialize)]
pub struct Catalog {
    #[serde(default)]
    pub spec: CatalogSpec,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Deserialize)]
pub struct CatalogSpec {
    #[serde(default)]
    pub products: Vec<CatalogProduct>,
}

impl Catalog {
    /// Every price of every product.
    pub fn prices(&self) -> impl Iterator<Item = &CatalogPrice> {
        self.spec.products.iter().flat_map(|p| p.prices.iter())
    }
}

type GrantCache = HashMap<(String, String), (Instant, Grant)>;

#[derive(Clone)]
pub struct Money {
    http: reqwest::Client,
    /// The environment's resource URL: `https://api.sylphx.com/v1/orgs/{org}/projects/{project}/envs/{env}`.
    base: String,
    secret_key: String,
    public_url: String,
    grants: Arc<Mutex<GrantCache>>,
    catalog: Arc<Mutex<Option<(Instant, Arc<Catalog>)>>>,
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

impl Money {
    /// Money is used when the environment URL and the server's secret key are
    /// both configured; otherwise Puzzled keeps its existing behaviour.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        Some(Self::new(
            &env_value("SYLPHX_MONEY_URL")?,
            &env_value("SYLPHX_SECRET_KEY")?,
            &env_value("PUZZLED_PUBLIC_URL").unwrap_or_else(|| DEFAULT_PUBLIC_URL.into()),
        ))
    }

    #[must_use]
    pub fn new(base: &str, secret_key: &str, public_url: &str) -> Self {
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .unwrap_or_default();
        Self {
            http,
            base: base.trim_end_matches('/').to_string(),
            secret_key: secret_key.to_string(),
            public_url: public_url.trim_end_matches('/').to_string(),
            grants: Arc::default(),
            catalog: Arc::default(),
        }
    }

    #[must_use]
    pub fn public_url(&self) -> &str {
        &self.public_url
    }

    async fn call(&self, request: reqwest::RequestBuilder) -> Result<Value, MoneyError> {
        let response = request
            .bearer_auth(&self.secret_key)
            .send()
            .await
            .map_err(|e| MoneyError::Unavailable(e.to_string()))?;
        let status = response.status();
        let body: Value = response.json().await.unwrap_or(Value::Null);
        if status.is_success() {
            return Ok(body);
        }
        if status.is_server_error() {
            return Err(MoneyError::Unavailable(format!("status {status}")));
        }
        let code = ["code", "title", "detail"]
            .iter()
            .find_map(|key| body.get(key).and_then(Value::as_str))
            .unwrap_or("refused")
            .to_string();
        Err(MoneyError::Refused {
            status: status.as_u16(),
            code,
        })
    }

    /// One entitlement check, uncached. `feature` is a catalogue feature key.
    pub async fn check_uncached(&self, user_id: &str, feature: &str) -> Result<Grant, MoneyError> {
        let body = self
            .call(
                self.http
                    .post(format!("{}/entitlement_grants:check", self.base))
                    .json(&json!({"subject": {"end_user": user_id}, "feature": feature})),
            )
            .await?;
        let parsed: CheckResponse = serde_json::from_value(body)
            .map_err(|e| MoneyError::Unavailable(format!("unreadable answer: {e}")))?;
        let ends = parsed
            .expire_time
            .as_deref()
            .filter(|s| !s.is_empty())
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|t| t.with_timezone(&Utc));
        // An answer whose own end has passed grants nothing.
        let entitled = parsed.entitled && ends.is_none_or(|end| end > Utc::now());
        Ok(Grant {
            entitled,
            limit: parsed.limit.as_deref().and_then(|l| l.trim().parse().ok()),
            ends_at: ends,
        })
    }

    /// The entitlement answer for `feature`, from the 60-second cache when it
    /// is fresh and otherwise from Money. Fails closed: a Money error answers
    /// [`Grant::denied`], which is not cached.
    pub async fn check(&self, user_id: &str, feature: &str) -> Grant {
        let key = (user_id.to_string(), feature.to_string());
        if let Some((fresh_until, grant)) =
            self.grants.lock().ok().and_then(|c| c.get(&key).cloned())
        {
            if fresh_until > Instant::now() && grant.ends_at.is_none_or(|end| end > Utc::now()) {
                return grant;
            }
        }
        let grant = match self.check_uncached(user_id, feature).await {
            Ok(grant) => grant,
            Err(error) => {
                tracing::warn!(%error, feature, "Money entitlement check failed; treating as not entitled");
                return Grant::denied();
            }
        };
        // The cache window is 60 s, and never runs past the grant's own end.
        let ttl = if grant.entitled {
            GRANT_CACHE_TTL
        } else {
            DENIED_CACHE_TTL
        };
        let until_end = grant
            .ends_at
            .and_then(|end| (end - Utc::now()).to_std().ok())
            .unwrap_or(ttl);
        let fresh_until = Instant::now() + ttl.min(until_end);
        if let Ok(mut cache) = self.grants.lock() {
            cache.insert(key, (fresh_until, grant.clone()));
        }
        grant
    }

    /// The default catalogue, cached five minutes.
    pub async fn catalog(&self) -> Result<Arc<Catalog>, MoneyError> {
        if let Some((at, catalog)) = self.catalog.lock().ok().and_then(|c| c.clone()) {
            if at.elapsed() < CATALOG_CACHE_TTL {
                return Ok(catalog);
            }
        }
        let body = self
            .call(self.http.get(format!("{}/catalogs/default", self.base)))
            .await?;
        let catalog: Arc<Catalog> = Arc::new(
            serde_json::from_value(body)
                .map_err(|e| MoneyError::Unavailable(format!("unreadable catalogue: {e}")))?,
        );
        if let Ok(mut slot) = self.catalog.lock() {
            *slot = Some((Instant::now(), catalog.clone()));
        }
        Ok(catalog)
    }

    /// Does `user_id` hold a subscription in Money that still renews (active,
    /// trialing or past due, not set to end at the period end)? Pages through
    /// `customer_subscriptions` and re-checks each row's subject itself, so a
    /// filter Money ignores cannot hide or invent a match. Any error is
    /// returned: the caller must refuse rather than assume "none".
    pub async fn has_renewing_subscription(&self, user_id: &str) -> Result<bool, MoneyError> {
        let filter = format!("subject.end_user = \"{}\"", user_id.replace('"', ""));
        let mut token = String::new();
        loop {
            let mut query = vec![("filter", filter.as_str()), ("page_size", "100")];
            if !token.is_empty() {
                query.push(("page_token", token.as_str()));
            }
            let body = self
                .call(
                    self.http
                        .get(format!("{}/customer_subscriptions", self.base))
                        .query(&query),
                )
                .await?;
            for sub in body
                .get("customer_subscriptions")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                let mine =
                    sub.pointer("/subject/end_user").and_then(Value::as_str) == Some(user_id);
                let live = matches!(
                    sub.get("status").and_then(Value::as_str),
                    Some("active" | "trialing" | "past_due")
                );
                let ends = sub
                    .get("cancel_at_period_end")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                if mine && live && !ends {
                    return Ok(true);
                }
            }
            token = body
                .get("next_page_token")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            if token.is_empty() {
                return Ok(false);
            }
        }
    }

    /// Create a checkout session; returns the hosted page's URL.
    pub async fn create_checkout_session(&self, session: &Value) -> Result<String, MoneyError> {
        let body = self
            .call(
                self.http
                    .post(format!("{}/checkout_sessions", self.base))
                    .json(session),
            )
            .await?;
        body.get("url")
            .and_then(Value::as_str)
            .filter(|url| !url.is_empty())
            .map(str::to_string)
            .ok_or_else(|| MoneyError::Unavailable("checkout session has no url".into()))
    }
}
