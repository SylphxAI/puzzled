//! The transport for the platform's user-deletion fan-out: the ONE place that
//! knows how a delivery is verified and parsed and how evidence goes back.
//! Built to the contract in cloud#11120 (frozen 2026-10-02, live 2026-10-12);
//! wire-up waits on cloud#11120 going live, and only this file knows the wire.
//!
//! From the contract:
//! - the delivery is event `auth.user.deletion_requested` with data `org_id`,
//!   `project_id`, `env_id`, `user_id`, `request_id`, `respond_by`, sent as a
//!   Standard Webhooks signed `POST`: headers `webhook-id`,
//!   `webhook-timestamp`, `webhook-signature` (`v1,<base64>`, space separated
//!   when several), HMAC-SHA256 over `id.timestamp.body` keyed by the
//!   base64 part of the `whsec_...` secret; a timestamp outside the tolerance
//!   is refused;
//! - the answer is `POST /v1/privacy-requests/{request_id}/evidence` with the
//!   environment's secret key (scope `auth:privacy:evidence`) and body
//!   `{handler, stores: [{store, deleted, anonymised, kept: [{reason, count}]}],
//!   completed_at}`;
//! - Auth re-announces every 24 hours until evidence arrives.
//!
//! Still to be confirmed (cloud#11120): the webhook secret's env name. It is
//! read in [`webhook_secret`] and nowhere else. The event body is read as
//! `{"type","data":{...}}` (the fields may also sit at the top level). The
//! environment is checked when `SYLPHX_AUTH_ENVIRONMENT_ID` is set.

use std::time::Duration;

use axum::http::HeaderMap;
use serde::Serialize;
use serde_json::Value;
use base64::Engine as _;

use super::auth_session::auth_id_value;
use crate::capabilities::billing::adapters::stripe::{
    constant_time_eq, hmac_sha256, WEBHOOK_TOLERANCE_SECS,
};

const DEFAULT_AUTH_URL: &str = "https://api.sylphx.com";
const EVENT_TYPE: &str = "auth.user.deletion_requested";
/// `<product>/<service>` named in every evidence body.
const HANDLER: &str = "puzzled/api";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// One announcement that a user was deleted.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeletionRequested {
    pub org_id: String,
    pub project_id: String,
    pub env_id: String,
    pub user_id: String,
    pub request_id: String,
    /// When Auth needs the evidence by (RFC 3339); Auth warns admins as it nears.
    pub respond_by: Option<String>,
}

/// What a delivery is refused for. `Unverified` maps to 401, `Foreign` to
/// 403, `Malformed` to 400; nothing is touched in any of them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryError {
    Unconfigured,
    Unverified,
    Malformed,
    Foreign,
}

/// The evidence Auth expects: per store, rows deleted, rows anonymised, and
/// what was kept and why.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, serde::Deserialize)]
pub struct Evidence {
    pub handler: String,
    pub stores: Vec<Store>,
    pub completed_at: String,
}

impl Evidence {
    /// An empty evidence body for this service, completed now.
    #[must_use]
    pub fn new(stores: Vec<Store>, completed_at: chrono::DateTime<chrono::Utc>) -> Self {
        Self {
            handler: HANDLER.to_string(),
            stores,
            completed_at: completed_at.to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, serde::Deserialize)]
pub struct Store {
    pub store: String,
    pub deleted: u64,
    pub anonymised: u64,
    pub kept: Vec<Kept>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, serde::Deserialize)]
pub struct Kept {
    pub reason: String,
    pub count: u64,
}

/// The webhook signing secret (`whsec_...`) of this handler's registration.
/// The one read of its env name, which cloud#11120 still has to confirm.
fn webhook_secret() -> Option<String> {
    std::env::var("SYLPHX_PRIVACY_WEBHOOK_SECRET")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

/// The HMAC key of a Standard Webhooks secret: the base64 after `whsec_`.
fn signing_key(secret: &str) -> Vec<u8> {
    let encoded = secret.strip_prefix("whsec_").unwrap_or(secret);
    base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .unwrap_or_else(|_| secret.as_bytes().to_vec())
}

/// Sign a delivery the way Auth does (tests, and local replay).
#[must_use]
pub fn sign_delivery(secret: &str, id: &str, timestamp: i64, body: &[u8]) -> String {
    let mut signed = format!("{id}.{timestamp}.").into_bytes();
    signed.extend_from_slice(body);
    format!(
        "v1,{}",
        base64::engine::general_purpose::STANDARD.encode(hmac_sha256(&signing_key(secret), &signed))
    )
}

fn signature_valid(
    secret: &str,
    headers: &HeaderMap,
    body: &[u8],
    now_secs: i64,
) -> bool {
    let header = |name: &str| headers.get(name).and_then(|value| value.to_str().ok());
    let (Some(id), Some(timestamp), Some(signatures)) = (
        header("webhook-id"),
        header("webhook-timestamp"),
        header("webhook-signature"),
    ) else {
        return false;
    };
    let Ok(timestamp) = timestamp.parse::<i64>() else {
        return false;
    };
    if (now_secs - timestamp).abs() > WEBHOOK_TOLERANCE_SECS || secret.is_empty() {
        return false;
    }
    let expected = sign_delivery(secret, id, timestamp, body);
    signatures
        .split(' ')
        .any(|candidate| constant_time_eq(candidate.as_bytes(), expected.as_bytes()))
}

/// Verify + parse a delivery, and post evidence back.
#[derive(Clone)]
pub struct ErasureTransport {
    http: reqwest::Client,
    auth_url: String,
    /// Puzzled's own Auth instance (`SYLPHX_AUTH_ORGANIZATION_ID`).
    organization_id: String,
    environment_id: Option<String>,
    secret_key: String,
    webhook_secret: String,
}

impl ErasureTransport {
    #[must_use]
    pub fn new(
        auth_url: String,
        organization_id: String,
        environment_id: Option<String>,
        secret_key: String,
        webhook_secret: String,
    ) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(REQUEST_TIMEOUT)
                .build()
                .unwrap_or_default(),
            auth_url: auth_url.trim_end_matches('/').to_string(),
            organization_id,
            environment_id,
            secret_key,
            webhook_secret,
        }
    }

    /// From the Enable Auth binding plus the delivery secret; `None` until
    /// all of them are set, and the endpoint then answers 503 (fail closed).
    #[must_use]
    pub fn from_env() -> Option<Self> {
        let read = |name: &str| {
            std::env::var(name)
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        };
        Some(Self::new(
            read("SYLPHX_AUTH_URL").unwrap_or_else(|| DEFAULT_AUTH_URL.to_string()),
            read("SYLPHX_AUTH_ORGANIZATION_ID")?,
            read("SYLPHX_AUTH_ENVIRONMENT_ID"),
            read("SYLPHX_AUTH_SECRET_KEY")?,
            webhook_secret()?,
        ))
    }

    /// Check the signature, parse the event, and refuse any delivery that is
    /// not for this Auth instance (and environment, when configured).
    pub fn verify_and_parse(
        &self,
        headers: &HeaderMap,
        body: &[u8],
        now_secs: i64,
    ) -> Result<DeletionRequested, DeliveryError> {
        if !signature_valid(&self.webhook_secret, headers, body, now_secs) {
            return Err(DeliveryError::Unverified);
        }
        let event: Value = serde_json::from_slice(body).map_err(|_| DeliveryError::Malformed)?;
        if event.get("type").and_then(Value::as_str) != Some(EVENT_TYPE) {
            return Err(DeliveryError::Malformed);
        }
        let data = event.get("data").unwrap_or(&event);
        let field = |name: &str| {
            data.get(name)
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        };
        let request = DeletionRequested {
            org_id: field("org_id").ok_or(DeliveryError::Malformed)?,
            project_id: field("project_id").ok_or(DeliveryError::Malformed)?,
            env_id: field("env_id").ok_or(DeliveryError::Malformed)?,
            user_id: field("user_id").ok_or(DeliveryError::Malformed)?,
            request_id: field("request_id").ok_or(DeliveryError::Malformed)?,
            respond_by: field("respond_by"),
        };
        // Same guard as the session check: the id, in any of its forms.
        let own = auth_id_value(&self.organization_id).ok_or(DeliveryError::Unconfigured)?;
        if auth_id_value(&request.project_id) != Some(own) {
            tracing::warn!(project_id = %request.project_id, "erasure delivery for another project refused");
            return Err(DeliveryError::Foreign);
        }
        if let Some(env) = &self.environment_id {
            if request.env_id != *env {
                tracing::warn!(env_id = %request.env_id, "erasure delivery for another environment refused");
                return Err(DeliveryError::Foreign);
            }
        }
        // The request id becomes a path segment and a primary key.
        if request.request_id.len() > 128
            || !request
                .request_id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.'))
        {
            return Err(DeliveryError::Malformed);
        }
        Ok(request)
    }

    /// Report the evidence for one request with the product's own key.
    pub async fn post_evidence(&self, request_id: &str, evidence: &Evidence) -> Result<(), String> {
        let response = self
            .http
            .post(format!(
                "{}/v1/privacy-requests/{request_id}/evidence",
                self.auth_url
            ))
            .bearer_auth(&self.secret_key)
            .json(evidence)
            .send()
            .await
            .map_err(|error| format!("evidence post failed: {error}"))?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!(
                "evidence refused ({})",
                response.status().as_u16()
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-erasure-signing-fixture";
    const PROJECT: &str = "proj_01kmp4wyhhfgxsyrjvh8e0tkkf";

    fn transport(environment: Option<&str>) -> ErasureTransport {
        ErasureTransport::new(
            "http://auth.invalid".into(),
            PROJECT.into(),
            environment.map(str::to_string),
            "sk".into(),
            SECRET.into(),
        )
    }

    fn body(project: &str, env: &str) -> Vec<u8> {
        serde_json::json!({"type": EVENT_TYPE, "data": {
            "org_id": "o", "project_id": project, "env_id": env,
            "user_id": "usr_x", "request_id": "pr_1", "respond_by": "2026-11-01T00:00:00Z"}})
        .to_string()
        .into_bytes()
    }

    fn headers(secret: &str, now: i64, body: &[u8]) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("webhook-id", "msg_1".parse().unwrap());
        headers.insert("webhook-timestamp", now.to_string().parse().unwrap());
        headers.insert(
            "webhook-signature",
            sign_delivery(secret, "msg_1", now, body).parse().unwrap(),
        );
        headers
    }

    #[test]
    fn a_signed_delivery_parses_and_a_tampered_or_stale_one_does_not() {
        let now = 1_800_000_000;
        let body = body(PROJECT, "env_prod");
        let parsed = transport(None)
            .verify_and_parse(&headers(SECRET, now, &body), &body, now + 10)
            .unwrap();
        assert_eq!(parsed.request_id, "pr_1");
        assert_eq!(parsed.respond_by.as_deref(), Some("2026-11-01T00:00:00Z"));

        let mut tampered = body.clone();
        tampered.push(b' ');
        assert_eq!(
            transport(None).verify_and_parse(&headers(SECRET, now, &body), &tampered, now),
            Err(DeliveryError::Unverified)
        );
        assert_eq!(
            transport(None).verify_and_parse(&headers(SECRET, now, &body), &body, now + 3600),
            Err(DeliveryError::Unverified)
        );
        assert_eq!(
            transport(None).verify_and_parse(&HeaderMap::new(), &body, now),
            Err(DeliveryError::Unverified)
        );
    }

    #[test]
    fn a_second_signature_in_the_header_may_carry_the_match() {
        let now = 1_800_000_000;
        let body = body(PROJECT, "env_prod");
        let mut h = headers(SECRET, now, &body);
        let good = h.get("webhook-signature").unwrap().to_str().unwrap().to_string();
        h.insert("webhook-signature", format!("v1,AAAA {good}").parse().unwrap());
        assert!(transport(None).verify_and_parse(&h, &body, now).is_ok());
    }

    #[test]
    fn another_project_or_environment_is_foreign() {
        let now = 1_800_000_000;
        let other = body("proj_01kmp4wyhhfgxsyrjvh8e0tkkg", "env_prod");
        assert_eq!(
            transport(None).verify_and_parse(&headers(SECRET, now, &other), &other, now),
            Err(DeliveryError::Foreign)
        );
        let own = body(PROJECT, "env_staging");
        assert_eq!(
            transport(Some("env_prod")).verify_and_parse(&headers(SECRET, now, &own), &own, now),
            Err(DeliveryError::Foreign)
        );
    }

    #[test]
    fn another_event_type_is_malformed() {
        let now = 1_800_000_000;
        let other = br#"{"type":"user.created","data":{}}"#.to_vec();
        assert_eq!(
            transport(None).verify_and_parse(&headers(SECRET, now, &other), &other, now),
            Err(DeliveryError::Malformed)
        );
    }
}
