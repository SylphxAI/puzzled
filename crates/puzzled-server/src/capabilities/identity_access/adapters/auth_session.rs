//! Sylphx Auth end-user sessions.
//!
//! Puzzled's players are end users of its own Sylphx Auth organization. Their
//! sessions are opaque bearers (`identity_org_session_…`) that only Auth can
//! check, so one middleware in front of the Connect router verifies them with
//! `GET /v1/sessions/current` (cached briefly) and hands the result to the
//! synchronous identity code in [`VERIFIED_IDENTITY_HEADER`]. The header is
//! removed from every incoming request first, so a client can never set it.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::body::Body;
use axum::extract::State;
use axum::http::header::{AUTHORIZATION, COOKIE};
use axum::http::{HeaderMap, HeaderValue, Request};
use axum::middleware::Next;
use axum::response::Response;
use base64::Engine;
use serde_json::Value;

use super::platform_jwt::VerifiedIdentity;

/// Internal header carrying the verified end user (base64url JSON).
pub const VERIFIED_IDENTITY_HEADER: &str = "x-puzzled-verified-identity";
/// The web's session cookie (set by `apps/puzzled/src/lib/identity/server.ts`).
pub const SESSION_COOKIE: &str = "sylphx_identity_session";
const SESSION_PREFIX: &str = "identity_org_session_";
const DEFAULT_AUTH_URL: &str = "https://api.sylphx.com";
const POSITIVE_TTL: Duration = Duration::from_secs(60);
const NEGATIVE_TTL: Duration = Duration::from_secs(10);
const CACHE_LIMIT: usize = 10_000;

type Cache = HashMap<[u8; 32], (Instant, Option<VerifiedIdentity>)>;

/// Verifies Auth session bearers against the Auth instance.
#[derive(Clone)]
pub struct AuthSessions {
    http: reqwest::Client,
    auth_url: String,
    cache: Arc<Mutex<Cache>>,
}

impl AuthSessions {
    #[must_use]
    pub fn new(auth_url: String) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .unwrap_or_default(),
            auth_url: auth_url.trim_end_matches('/').to_string(),
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// `SYLPHX_AUTH_URL` (bound by Enable Auth), else `IDENTITY_API_ORIGIN`,
    /// else `https://api.sylphx.com`.
    #[must_use]
    pub fn from_env() -> Self {
        let url = ["SYLPHX_AUTH_URL", "IDENTITY_API_ORIGIN"]
            .iter()
            .find_map(|name| {
                std::env::var(name)
                    .ok()
                    .map(|v| v.trim().to_string())
                    .filter(|v| !v.is_empty())
            })
            .unwrap_or_else(|| DEFAULT_AUTH_URL.to_string());
        Self::new(url)
    }

    /// The end user behind a session bearer; None when Auth refuses it or is
    /// unreachable (fail closed: the request is simply not signed in).
    ///
    /// Auth binds a session to the browser's User-Agent, so it is forwarded
    /// and is part of the cache key.
    pub async fn verify(&self, token: &str, user_agent: &str) -> Option<VerifiedIdentity> {
        let key = token_key(token, user_agent);
        if let Some(hit) = self.cached(&key) {
            return hit;
        }
        let result = self.fetch(token, user_agent).await;
        let ttl = if result.is_some() {
            POSITIVE_TTL
        } else {
            NEGATIVE_TTL
        };
        if let Ok(mut cache) = self.cache.lock() {
            if cache.len() >= CACHE_LIMIT {
                cache.clear();
            }
            cache.insert(key, (Instant::now() + ttl, result.clone()));
        }
        result
    }

    fn cached(&self, key: &[u8; 32]) -> Option<Option<VerifiedIdentity>> {
        let cache = self.cache.lock().ok()?;
        let (expires, value) = cache.get(key)?;
        (*expires > Instant::now()).then(|| value.clone())
    }

    async fn fetch(&self, token: &str, user_agent: &str) -> Option<VerifiedIdentity> {
        let response = self
            .http
            .get(format!("{}/v1/sessions/current", self.auth_url))
            .bearer_auth(token)
            .header(axum::http::header::USER_AGENT, user_agent)
            .send()
            .await
            .map_err(|error| tracing::warn!(%error, "auth session check failed"))
            .ok()?;
        if !response.status().is_success() {
            return None;
        }
        identity_from_session(&response.json::<Value>().await.ok()?)
    }
}

fn token_key(token: &str, user_agent: &str) -> [u8; 32] {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(token.as_bytes());
    hasher.update([0]);
    hasher.update(user_agent.as_bytes());
    hasher.finalize().into()
}

/// Puzzled's player id for an Auth principal: `principal-<uuid>` → `<uuid>`.
#[must_use]
pub fn user_id_for_principal(principal_id: &str) -> Option<String> {
    let raw = principal_id
        .strip_prefix("principal-")
        .unwrap_or(principal_id);
    uuid::Uuid::parse_str(raw).ok().map(|id| id.to_string())
}

/// Read `GetCurrentSessionResponse` (snake or camel case).
#[must_use]
pub fn identity_from_session(body: &Value) -> Option<VerifiedIdentity> {
    let session = body.get("session").unwrap_or(body);
    let principal = session.get("principal")?;
    let text = |keys: &[&str]| {
        keys.iter()
            .find_map(|k| principal.get(*k).and_then(Value::as_str))
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_string)
    };
    let principal_id = text(&["principal_id", "principalId"])?;
    let state = text(&["state"]);
    if state.as_deref().is_some_and(|s| s != "active") {
        return None;
    }
    Some(VerifiedIdentity {
        user_id: user_id_for_principal(&principal_id)?,
        display_name: text(&["display_name", "displayName"]),
        email: text(&["primary_email", "primaryEmail"]),
        is_admin: false,
    })
}

/// The Auth session bearer on a request: `Authorization: Bearer
/// identity_org_session_…` or the web's session cookie.
#[must_use]
pub fn session_token(headers: &HeaderMap) -> Option<String> {
    if let Some(bearer) = headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|v| v.starts_with(SESSION_PREFIX))
    {
        return Some(bearer.to_string());
    }
    headers
        .get_all(COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .find_map(|pair| {
            let (name, value) = pair.trim().split_once('=')?;
            let value = value.trim();
            (name.trim() == SESSION_COOKIE && value.starts_with(SESSION_PREFIX))
                .then(|| value.to_string())
        })
}

/// Encode a verified identity for [`VERIFIED_IDENTITY_HEADER`].
#[must_use]
pub fn encode_identity(identity: &VerifiedIdentity) -> Option<HeaderValue> {
    let json = serde_json::to_vec(identity).ok()?;
    HeaderValue::from_str(&base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(json)).ok()
}

/// The identity the middleware verified on this request, if any.
#[must_use]
pub fn verified_identity(headers: &HeaderMap) -> Option<VerifiedIdentity> {
    let raw = headers.get(VERIFIED_IDENTITY_HEADER)?.to_str().ok()?;
    let json = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(raw)
        .ok()?;
    serde_json::from_slice(&json).ok()
}

/// Middleware: strip any client copy of the internal header, then attach the
/// verified end user when the request carries a valid Auth session.
pub async fn attach_auth_session(
    State(sessions): State<AuthSessions>,
    mut request: Request<Body>,
    next: Next,
) -> Response {
    request.headers_mut().remove(VERIFIED_IDENTITY_HEADER);
    if let Some(token) = session_token(request.headers()) {
        let user_agent = request
            .headers()
            .get(axum::http::header::USER_AGENT)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        if let Some(value) = sessions
            .verify(&token, &user_agent)
            .await
            .as_ref()
            .and_then(encode_identity)
        {
            request
                .headers_mut()
                .insert(VERIFIED_IDENTITY_HEADER, value);
        }
    }
    next.run(request).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn principal_ids_map_to_player_uuids() {
        assert_eq!(
            user_id_for_principal("principal-0199aa10-7b2c-7d3e-8f00-1234567890ab").as_deref(),
            Some("0199aa10-7b2c-7d3e-8f00-1234567890ab")
        );
        assert_eq!(user_id_for_principal("principal-not-a-uuid"), None);
    }

    #[test]
    fn session_response_becomes_an_identity_and_inactive_users_do_not() {
        let body = json!({"session": {"principal": {
            "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab",
            "display_name": "Ada", "primary_email": "ada@example.com", "state": "active"}}});
        let id = identity_from_session(&body).expect("identity");
        assert_eq!(id.user_id, "0199aa10-7b2c-7d3e-8f00-1234567890ab");
        assert_eq!(id.email.as_deref(), Some("ada@example.com"));
        assert!(!id.is_admin);
        let revoked = json!({"session": {"principal": {
            "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab", "state": "revoked"}}});
        assert!(identity_from_session(&revoked).is_none());
    }

    #[test]
    fn token_comes_from_bearer_or_cookie_only_when_it_is_an_auth_session() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            "a=1; sylphx_identity_session=identity_org_session_abc"
                .parse()
                .unwrap(),
        );
        assert_eq!(
            session_token(&headers).as_deref(),
            Some("identity_org_session_abc")
        );
        headers.insert(
            AUTHORIZATION,
            "Bearer identity_org_session_xyz".parse().unwrap(),
        );
        assert_eq!(
            session_token(&headers).as_deref(),
            Some("identity_org_session_xyz")
        );
        let mut jwt = HeaderMap::new();
        jwt.insert(AUTHORIZATION, "Bearer eyJhbGciOi.x.y".parse().unwrap());
        assert_eq!(session_token(&jwt), None);
    }

    #[test]
    fn header_round_trips() {
        let id = VerifiedIdentity {
            user_id: "0199aa10-7b2c-7d3e-8f00-1234567890ab".into(),
            display_name: Some("Ada".into()),
            email: None,
            is_admin: false,
        };
        let mut headers = HeaderMap::new();
        headers.insert(VERIFIED_IDENTITY_HEADER, encode_identity(&id).unwrap());
        assert_eq!(verified_identity(&headers), Some(id));
    }
}
