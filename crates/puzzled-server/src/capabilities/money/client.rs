//! Thin REST client for the Money calls Puzzled uses, shaped from
//! `contracts/generated/openapi.json` (cloud#10272): `entitlement_grants:check`,
//! `checkout_sessions` and `price_catalogs/default`. Nothing else is called.
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
/// A failed Money check is remembered as "not entitled" this long, so an
/// outage does not turn every request into a slow timed-out call.
pub const FAILED_CACHE_TTL: Duration = Duration::from_secs(5);
/// How long a read catalogue is reused.
pub const CATALOG_CACHE_TTL: Duration = Duration::from_secs(300);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);
use crate::shared::public_origin::{parse_public_origin, DEFAULT_PUBLIC_URL};
const DEFAULT_API_URL: &str = "https://api.sylphx.com";

/// Log-only text from a Money problem body (`message` = its `detail` string,
/// plus `reason` and `processor_code` from `details[]`). Only these fields are
/// read, ids are limited to a safe alphabet, and anything shaped like a key is
/// redacted, so no secret can reach the log through it.
fn problem_note(body: &Value) -> String {
    let safe_id = |v: &Value| {
        v.as_str()
            .filter(|s| !s.is_empty() && s.len() <= 64)
            .filter(|s| {
                s.chars()
                    .all(|c| c.is_ascii_alphanumeric() || "_-.:".contains(c))
            })
            .map(str::to_string)
    };
    let detail = |key: &str| {
        let list = body.get("details").and_then(Value::as_array);
        list.into_iter()
            .flatten()
            .chain(body.get("detail").filter(|d| d.is_object()))
            .find_map(|d| d.get(key).and_then(safe_id))
    };
    let mut parts = Vec::new();
    if let Some(reason) = detail("reason") {
        parts.push(format!("reason={reason}"));
    }
    if let Some(code) = detail("processor_code") {
        parts.push(format!("processor_code={code}"));
    }
    if let Some(message) = body.get("detail").and_then(Value::as_str) {
        let clean: String = message
            .split_whitespace()
            .map(|w| {
                let w = w.trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '_');
                if ["sk_", "rk_", "pk_", "whsec_", "Bearer"]
                    .iter()
                    .any(|p| w.starts_with(p))
                {
                    "[redacted]"
                } else {
                    w
                }
            })
            .collect::<Vec<_>>()
            .join(" ");
        if !clean.is_empty() {
            parts.push(format!(
                "message={}",
                clean.chars().take(200).collect::<String>()
            ));
        }
    }
    parts.join(" ")
}

/// Why a Money call did not answer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MoneyError {
    /// Money could not be reached or answered 5xx / unreadable.
    Unavailable(String),
    /// Money answered with a refusal (4xx); `code` is its problem code.
    /// `note` is the log-only extra (message, reason, processor code); it is
    /// never matched on and never shown to a player.
    Refused {
        status: u16,
        code: String,
        note: String,
    },
}

impl std::fmt::Display for MoneyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unavailable(why) => write!(f, "money unavailable: {why}"),
            Self::Refused { status, code, note } if note.is_empty() => {
                write!(f, "money refused ({status}): {code}")
            }
            Self::Refused { status, code, note } => {
                write!(f, "money refused ({status}): {code} [{note}]")
            }
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

/// A customer subscription as Money mirrors it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Subscription {
    pub id: String,
    pub status: String,
    pub cancel_at_period_end: bool,
    pub current_period_end: Option<DateTime<Utc>>,
    /// When its trial ends (Money's `trial_end_time`); None without a trial.
    pub trial_end: Option<DateTime<Utc>>,
    /// The catalogue price keys it sells.
    pub price_keys: Vec<String>,
}

impl Subscription {
    /// Grants access now: trialing, active or past due.
    #[must_use]
    pub fn live(&self) -> bool {
        matches!(self.status.as_str(), "active" | "trialing" | "past_due")
    }

    /// Live and will renew.
    #[must_use]
    pub fn renews(&self) -> bool {
        self.live() && !self.cancel_at_period_end
    }

    /// Erasure guard: may this subscription still bill? Fail closed: every
    /// status except the ones known to be over counts, so a status Money adds
    /// later blocks erasure. Not an entitlement or display rule; those use
    /// [`live`](Self::live) and [`renews`](Self::renews).
    #[must_use]
    pub fn renews_for_erasure(&self) -> bool {
        !matches!(
            self.status.as_str(),
            "canceled" | "incomplete_expired" | "expired"
        ) && !self.cancel_at_period_end
    }
}

/// An RFC 3339 timestamp field of a Money resource; None when absent or unreadable.
fn timestamp(resource: &Value, field: &str) -> Option<DateTime<Utc>> {
    resource
        .get(field)
        .and_then(Value::as_str)
        .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
        .map(|t| t.with_timezone(&Utc))
}

/// A path segment that cannot escape its place in the URL.
fn segment(id: &str) -> String {
    id.chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
        .collect()
}

/// A catalogue price as `GET price_catalogs/default` publishes it.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct CatalogPrice {
    pub key: String,
    #[serde(default)]
    pub recurring_interval: Option<String>,
    #[serde(default)]
    pub tax_behavior: Option<String>,
    #[serde(default)]
    pub archived: bool,
    /// Free trial days before the first charge; 0 or absent: no trial.
    #[serde(default)]
    pub trial_days: u32,
    /// Upper-case ISO 4217 code to minor units, as a decimal string.
    #[serde(default)]
    pub unit_amounts: std::collections::BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct CatalogLicence {
    pub term: CatalogLicenceTerm,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct CatalogLicenceTerm {
    pub unit: String,
    pub count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct CatalogProduct {
    pub key: String,
    /// Feature grants: `plus`/`family` are `"true"`, `seats` a decimal string.
    #[serde(default)]
    pub features: std::collections::BTreeMap<String, String>,
    #[serde(default)]
    pub prices: Vec<CatalogPrice>,
    #[serde(default)]
    pub licence: Option<CatalogLicence>,
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

/// (fresh until, the answer; None is a failed check remembered briefly).
type GrantCache = HashMap<(String, String), (Instant, Option<Grant>)>;
type CatalogSlot = Option<(Instant, Arc<Catalog>)>;

#[derive(Clone)]
pub struct Money {
    sdk: Arc<sylphx::Client>,
    /// `https://api.sylphx.com`.
    origin: String,
    /// The environment's resource URL,
    /// `{origin}/v1/orgs/{org}/projects/{project}/envs/{env}`, read from the
    /// key's `whoami` on first use and kept. Never written in configuration:
    /// the env id it names is the key's own.
    base: Arc<tokio::sync::OnceCell<String>>,
    secret_key: String,
    public_url: String,
    grants: Arc<Mutex<GrantCache>>,
    catalog: Arc<Mutex<CatalogSlot>>,
}

struct WithHeaders<'a> {
    transport: &'a sylphx::HttpTransport,
    headers: &'a [(String, String)],
}

impl sylphx::Transport for WithHeaders<'_> {
    async fn send(
        &self,
        request: sylphx::HttpRequest,
    ) -> Result<sylphx::HttpResponse, sylphx::Error> {
        self.transport
            .send_with_headers(request, self.headers)
            .await
    }
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn redact_error(message: &str, secret_key: &str) -> String {
    let trimmed = secret_key.trim();
    if trimmed.is_empty() {
        message.to_string()
    } else {
        message.replace(trimmed, "[redacted]")
    }
}

pub(super) fn sdk(origin: &str, secret_key: &str) -> Arc<sylphx::Client> {
    let mut builder = sylphx::HttpTransport::builder()
        .base_url(origin.trim_end_matches('/'))
        .timeout(REQUEST_TIMEOUT)
        .max_retries(0);
    let key = secret_key.trim();
    if !key.is_empty() {
        builder = builder.api_key(key);
    }
    Arc::new(sylphx::Client::new(
        builder
            .build()
            .expect("valid Money transport configuration"),
    ))
}

/// The environment URL from a `whoami` body. `env` is the environment's full
/// resource name (`orgs/{o}/projects/{p}/envs/{e}`), used as-is under
/// `{origin}/v1/`; bare `org`/`project`/`env` ids build the same path.
pub(super) fn env_url(origin: &str, whoami: &Value) -> Result<String, MoneyError> {
    let part = |name: &str| {
        whoami
            .get(name)
            .and_then(Value::as_str)
            .map(|v| v.trim_matches('/'))
            .filter(|v| !v.is_empty())
    };
    if let Some(env) = part("env").filter(|e| e.starts_with("orgs/")) {
        return Ok(format!("{origin}/v1/{env}"));
    }
    match (part("org"), part("project"), part("env")) {
        (Some(org), Some(project), Some(env)) => Ok(format!(
            "{origin}/v1/orgs/{org}/projects/{project}/envs/{env}"
        )),
        _ => Err(MoneyError::Unavailable(
            "the API key is not scoped to an environment".into(),
        )),
    }
}

/// The environment resource URL a key belongs to, from its `whoami`:
/// `{origin}/v1/orgs/{org}/projects/{project}/envs/{env}`. The key must be
/// scoped to an environment.
pub async fn resolve_env_url(origin: &str, key: &str) -> Result<String, MoneyError> {
    resolve_env_url_with(&sdk(origin, key), origin, key).await
}

async fn resolve_env_url_with(
    sdk: &sylphx::Client,
    origin: &str,
    key: &str,
) -> Result<String, MoneyError> {
    let me = sdk.access().whoami(Default::default()).await.map_err(|e| {
        MoneyError::Unavailable(format!(
            "whoami failed: {}",
            redact_error(&e.to_string(), key)
        ))
    })?;
    let body = serde_json::to_value(me).map_err(|e| {
        MoneyError::Unavailable(format!(
            "whoami unreadable: {}",
            redact_error(&e.to_string(), key)
        ))
    })?;
    env_url(origin, &body)
}

impl Money {
    /// Money is used when its dedicated key (`SYLPHX_MONEY_API_KEY`, scopes
    /// billing:read and billing:write) is configured; its org, project and env
    /// come from the key's `whoami` (`SYLPHX_API_URL`, default
    /// `https://api.sylphx.com`). Without it Money is off and Puzzled keeps its
    /// existing behaviour; `SYLPHX_API_KEY` is never used for Money.
    #[must_use]
    pub fn from_env() -> Option<Self> {
        Self::from_lookup(env_value)
    }

    pub(super) fn from_lookup(get: impl Fn(&str) -> Option<String>) -> Option<Self> {
        Some(Self::discovering(
            &get("SYLPHX_API_URL").unwrap_or_else(|| DEFAULT_API_URL.into()),
            &get("SYLPHX_MONEY_API_KEY")?,
            &parse_public_origin(
                &get("PUZZLED_PUBLIC_URL").unwrap_or_else(|| DEFAULT_PUBLIC_URL.into()),
                !cfg!(debug_assertions),
            )
            .ok()?,
        ))
    }

    /// A client whose environment URL is read from the key on first use.
    #[must_use]
    pub fn discovering(origin: &str, secret_key: &str, public_url: &str) -> Self {
        let origin = origin.trim_end_matches('/').to_string();
        let mut money = Self::new("", secret_key, public_url);
        money.origin.clone_from(&origin);
        money.sdk = sdk(&origin, secret_key);
        money.base = Arc::default();
        money
    }

    /// A client with a known environment URL (tests, or a caller that already
    /// resolved it).
    #[must_use]
    pub fn new(env_url: &str, secret_key: &str, public_url: &str) -> Self {
        let trimmed_env = env_url.trim_end_matches('/').to_string();
        let origin = trimmed_env.split_once("/v1/").map_or_else(
            || DEFAULT_API_URL.to_string(),
            |(origin, _)| origin.to_string(),
        );
        let sdk = sdk(&origin, secret_key);
        let base = Arc::new(tokio::sync::OnceCell::new());
        if !trimmed_env.is_empty() {
            let _ = base.set(trimmed_env);
        }
        Self {
            sdk,
            origin,
            base,
            secret_key: secret_key.to_string(),
            public_url: public_url.trim_end_matches('/').to_string(),
            grants: Arc::default(),
            catalog: Arc::default(),
        }
    }

    /// The environment resource URL, discovered once and kept.
    async fn env_url(&self) -> Result<&str, MoneyError> {
        self.base
            .get_or_try_init(|| resolve_env_url_with(&self.sdk, &self.origin, &self.secret_key))
            .await
            .map(String::as_str)
    }

    pub async fn environment_resource(&self) -> Result<String, MoneyError> {
        self.env_url()
            .await?
            .split_once("/v1/")
            .map(|(_, name)| name.to_owned())
            .ok_or_else(|| MoneyError::Unavailable("environment binding unavailable".into()))
    }

    /// Resolve the environment now (at start-up), so a bad key shows in the
    /// log rather than on the first request. Failure is retried on use.
    pub async fn warm(&self) -> Result<(), MoneyError> {
        self.env_url().await.map(|_| ())
    }

    #[must_use]
    pub fn public_url(&self) -> &str {
        &self.public_url
    }

    fn map_sdk_error(&self, error: sylphx::Error) -> MoneyError {
        match error {
            sylphx::Error::Api {
                status,
                code,
                detail,
                problem,
                ..
            } if (400..500).contains(&status) && status != 408 && status != 429 => {
                let raw_code = [
                    problem.code.as_str(),
                    code.as_str(),
                    problem.title.as_str(),
                    detail.as_str(),
                ]
                .into_iter()
                .find(|s| !s.is_empty())
                .unwrap_or("refused");
                let problem_value = serde_json::to_value(&*problem).unwrap_or(Value::Null);
                MoneyError::Refused {
                    status,
                    code: redact_error(raw_code, &self.secret_key),
                    note: redact_error(&problem_note(&problem_value), &self.secret_key),
                }
            }
            other => MoneyError::Unavailable(redact_error(&other.to_string(), &self.secret_key)),
        }
    }

    /// One entitlement check, uncached. `feature` is a catalogue feature key.
    pub async fn check_uncached(&self, user_id: &str, feature: &str) -> Result<Grant, MoneyError> {
        let body = self
            .sdk
            .invoke(
                "money.entitlement_grants.check",
                json!({
                    "parent": self.environment_resource().await?,
                    "subject": {"end_user": user_id},
                    "feature": feature,
                }),
            )
            .await
            .map_err(|e| self.map_sdk_error(e))?;
        let parsed: CheckResponse = serde_json::from_value(body).map_err(|e| {
            MoneyError::Unavailable(format!(
                "unreadable answer: {}",
                redact_error(&e.to_string(), &self.secret_key)
            ))
        })?;
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

    /// Forget this account's cached answers on checkout return. This does not
    /// grant access: the next read must still be confirmed by Money. Clones
    /// share the cache, so paid play sees the same fresh answer as Settings.
    pub fn refresh_grants(&self, user_id: &str) {
        if let Ok(mut cache) = self.grants.lock() {
            cache.retain(|(subject, _), _| subject != user_id);
        }
    }

    /// The entitlement answer for `feature`, from the cache when it is fresh
    /// and otherwise from Money. A Money error is an `Err`, remembered for 5
    /// seconds so an outage is not retried per request; callers that must tell
    /// "Money said no" from "Money could not answer" use this.
    pub async fn try_check(&self, user_id: &str, feature: &str) -> Result<Grant, MoneyError> {
        let key = (user_id.to_string(), feature.to_string());
        if let Some((fresh_until, cached)) =
            self.grants.lock().ok().and_then(|c| c.get(&key).cloned())
        {
            if fresh_until > Instant::now() {
                match cached {
                    None => return Err(MoneyError::Unavailable("recent check failed".into())),
                    Some(grant) if grant.ends_at.is_none_or(|end| end > Utc::now()) => {
                        return Ok(grant);
                    }
                    Some(_) => {}
                }
            }
        }
        let grant = match self.check_uncached(user_id, feature).await {
            Ok(grant) => grant,
            Err(error) => {
                tracing::warn!(%error, feature, "Money entitlement check failed");
                if let Ok(mut cache) = self.grants.lock() {
                    cache.insert(key, (Instant::now() + FAILED_CACHE_TTL, None));
                }
                return Err(error);
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
            cache.insert(key, (fresh_until, Some(grant.clone())));
        }
        Ok(grant)
    }

    /// The entitlement answer for `feature`. Fails closed: a Money error
    /// answers [`Grant::denied`] (cached 5 seconds).
    pub async fn check(&self, user_id: &str, feature: &str) -> Grant {
        self.try_check(user_id, feature)
            .await
            .unwrap_or_else(|_| Grant::denied())
    }

    /// The default catalogue, cached five minutes.
    pub async fn catalog(&self) -> Result<Arc<Catalog>, MoneyError> {
        if let Some((at, catalog)) = self.catalog.lock().ok().and_then(|c| c.clone()) {
            if at.elapsed() < CATALOG_CACHE_TTL {
                return Ok(catalog);
            }
        }
        let body = self
            .sdk
            .invoke(
                "money.price_catalogs.get",
                json!({
                    "name": format!("{}/price_catalogs/default", self.environment_resource().await?),
                }),
            )
            .await
            .map_err(|e| self.map_sdk_error(e))?;
        let catalog: Arc<Catalog> = Arc::new(serde_json::from_value(body).map_err(|e| {
            MoneyError::Unavailable(format!(
                "unreadable catalogue: {}",
                redact_error(&e.to_string(), &self.secret_key)
            ))
        })?);
        if let Ok(mut slot) = self.catalog.lock() {
            *slot = Some((Instant::now(), catalog.clone()));
        }
        Ok(catalog)
    }

    /// Every customer subscription `user_id` holds. Pages through
    /// `customer_subscriptions` and re-checks each row's subject itself, so a
    /// filter Money ignores cannot hide or invent a match. Any error is
    /// returned: the caller must fail closed rather than assume "none".
    pub async fn subscriptions(&self, user_id: &str) -> Result<Vec<Subscription>, MoneyError> {
        let parent = self.environment_resource().await?;
        let filter = format!("subject.end_user = \"{}\"", user_id.replace('"', ""));
        let mut token = String::new();
        let mut found = Vec::new();
        loop {
            let body = self
                .sdk
                .invoke(
                    "money.customer_subscriptions.list",
                    json!({
                        "parent": parent,
                        "filter": filter,
                        "page_size": 100,
                        "page_token": token,
                    }),
                )
                .await
                .map_err(|e| self.map_sdk_error(e))?;
            for sub in body
                .get("customer_subscriptions")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
            {
                if sub.pointer("/subject/end_user").and_then(Value::as_str) != Some(user_id) {
                    continue;
                }
                found.push(Subscription {
                    id: sub
                        .get("name")
                        .and_then(Value::as_str)
                        .and_then(|name| name.rsplit('/').next())
                        .unwrap_or_default()
                        .to_string(),
                    status: sub
                        .get("status")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    cancel_at_period_end: sub
                        .get("cancel_at_period_end")
                        .and_then(Value::as_bool)
                        .unwrap_or(false),
                    current_period_end: timestamp(sub, "current_period_end_time"),
                    trial_end: timestamp(sub, "trial_end_time"),
                    price_keys: sub
                        .get("items")
                        .and_then(Value::as_array)
                        .into_iter()
                        .flatten()
                        .filter_map(|item| item.get("price").and_then(Value::as_str))
                        .map(str::to_string)
                        .collect(),
                });
            }
            token = body
                .get("next_page_token")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            if token.is_empty() {
                return Ok(found);
            }
        }
    }

    /// Does `user_id` hold a subscription that still renews? Errors are
    /// returned, never read as "no".
    pub async fn has_renewing_subscription(&self, user_id: &str) -> Result<bool, MoneyError> {
        Ok(self
            .subscriptions(user_id)
            .await?
            .iter()
            .any(Subscription::renews_for_erasure))
    }

    /// A hosted billing-portal page for `user_id` (payment method, invoices).
    pub async fn portal_url(&self, user_id: &str, return_url: &str) -> Result<String, MoneyError> {
        let body = self
            .sdk
            .invoke(
                "money.portal_sessions.create",
                json!({
                    "parent": self.environment_resource().await?,
                    "portal_session": {
                        "subject": {"end_user": user_id},
                        "return_url": return_url,
                    },
                }),
            )
            .await
            .map_err(|e| self.map_sdk_error(e))?;
        body.get("url")
            .and_then(Value::as_str)
            .filter(|url| !url.is_empty())
            .map(str::to_string)
            .ok_or_else(|| MoneyError::Unavailable("portal session has no url".into()))
    }

    /// End a subscription at its period end (no refund: owner#779).
    pub async fn cancel_at_period_end(&self, id: &str) -> Result<(), MoneyError> {
        let sub_id = segment(id);
        if sub_id.is_empty() {
            return Err(MoneyError::Unavailable("bad subscription name".into()));
        }
        self.sdk
            .invoke(
                "money.customer_subscriptions.cancel",
                json!({
                    "name": format!("{}/customer_subscriptions/{sub_id}", self.environment_resource().await?),
                    "at_period_end": true,
                }),
            )
            .await
            .map(|_| ())
            .map_err(|e| self.map_sdk_error(e))
    }

    /// Undo a pending cancellation.
    pub async fn resume(&self, id: &str) -> Result<(), MoneyError> {
        let sub_id = segment(id);
        if sub_id.is_empty() {
            return Err(MoneyError::Unavailable("bad subscription name".into()));
        }
        self.sdk
            .invoke(
                "money.customer_subscriptions.resume",
                json!({
                    "name": format!("{}/customer_subscriptions/{sub_id}", self.environment_resource().await?),
                }),
            )
            .await
            .map(|_| ())
            .map_err(|e| self.map_sdk_error(e))
    }

    /// Create a checkout session; returns the hosted page's URL.
    pub async fn create_checkout_session(&self, session: &Value) -> Result<String, MoneyError> {
        let body = self
            .sdk
            .invoke(
                "money.checkout_sessions.create",
                json!({
                    "parent": self.environment_resource().await?,
                    "checkout_session": session,
                }),
            )
            .await
            .map_err(|e| self.map_sdk_error(e))?;
        body.get("url")
            .and_then(Value::as_str)
            .filter(|url| !url.is_empty())
            .map(str::to_string)
            .ok_or_else(|| MoneyError::Unavailable("checkout session has no url".into()))
    }

    /// The ordinary Money create route with a retained resource identity.
    /// Both the body and this id are fixed before the first call.
    pub async fn create_retained_checkout(
        &self,
        id: &str,
        session: &Value,
    ) -> Result<Value, MoneyError> {
        let headers = [(
            "Idempotency-Key".to_string(),
            format!("puzzled-checkout-{id}"),
        )];
        sylphx::Client::new(WithHeaders {
            transport: self.sdk.transport(),
            headers: &headers,
        })
        .invoke(
            "money.checkout_sessions.create",
            json!({
                "parent": self.environment_resource().await?,
                "checkout_session_id": id,
                "checkout_session": session,
            }),
        )
        .await
        .map_err(|e| self.map_sdk_error(e))
    }

    /// Authoritative one-time session readback, reconciled by Money.
    pub async fn checkout_session(&self, id: &str) -> Result<Value, MoneyError> {
        let session_id = segment(id);
        if session_id.is_empty() {
            return Err(MoneyError::Unavailable("bad checkout session id".into()));
        }
        self.sdk
            .invoke(
                "money.checkout_sessions.get",
                json!({
                    "name": format!("{}/checkout_sessions/{session_id}", self.environment_resource().await?),
                }),
            )
            .await
            .map_err(|e| self.map_sdk_error(e))
    }
}
