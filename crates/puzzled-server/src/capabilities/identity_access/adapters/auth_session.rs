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

use sqlx::PgPool;

use super::auth_subjects;
use super::platform_jwt::VerifiedIdentity;
use crate::shared::pages::{FailureStreak, SIGNIN_UNAVAILABLE};

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
    /// Where the Auth subject to player map lives ([`super::auth_subjects`]).
    pool: Option<PgPool>,
    /// The sign-in page streak, shared with platform JWT verification.
    streak: &'static FailureStreak,
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
            pool: None,
            streak: &SIGNIN_UNAVAILABLE,
        }
    }

    /// Count sign-in failures on another streak (tests only).
    #[cfg(test)]
    #[must_use]
    pub(crate) fn with_streak(mut self, streak: &'static FailureStreak) -> Self {
        self.streak = streak;
        self
    }

    /// Resolve players through the database's subject map.
    #[must_use]
    pub fn with_pool(mut self, pool: Option<PgPool>) -> Self {
        self.pool = pool;
        self
    }

    /// `SYLPHX_AUTH_URL` (bound by Enable Auth), else `https://api.sylphx.com`.
    #[must_use]
    pub fn from_env() -> Self {
        let url = ["SYLPHX_AUTH_URL"]
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

    #[cfg(test)]
    pub(crate) fn streak(&self) -> &'static FailureStreak {
        self.streak
    }

    fn cached(&self, key: &[u8; 32]) -> Option<Option<VerifiedIdentity>> {
        let cache = self.cache.lock().ok()?;
        let (expires, value) = cache.get(key)?;
        (*expires > Instant::now()).then(|| value.clone())
    }

    /// Asks Auth about one session. Counts towards the sign-in page: Auth not
    /// answering (transport, timeout) or answering 5xx is a failure; any other
    /// answer, an explicit 401/403 included, means Auth is up.
    async fn fetch(&self, token: &str, user_agent: &str) -> Option<VerifiedIdentity> {
        let response = self
            .http
            .get(format!("{}/v1/sessions/current", self.auth_url))
            .bearer_auth(token)
            .header(axum::http::header::USER_AGENT, user_agent)
            .send()
            .await
            .map_err(|error| {
                tracing::warn!(%error, "auth session check failed");
                self.streak.failed("unreachable");
            })
            .ok()?;
        if response.status().is_server_error() {
            self.streak.failed("http_5xx");
            return None;
        }
        self.streak.succeeded();
        if !response.status().is_success() {
            return None;
        }
        let principal = principal_from_session(&response.json::<Value>().await.ok()?)?;
        let user_id = match &self.pool {
            Some(pool) => auth_subjects::player_for(
                pool,
                &principal.subject,
                principal.legacy_subject.as_deref(),
            )
            .await
            .map_err(|error| tracing::warn!(%error, "auth subject lookup failed"))
            .ok()?,
            // No database: nothing is stored, so only the old form maps.
            None => auth_subjects::legacy_player_id(&principal.subject)?,
        };
        Some(VerifiedIdentity {
            user_id: user_id.to_string(),
            display_name: principal.display_name,
            email: principal.email,
            is_admin: false,
        })
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

/// The principal a session read reports: the Auth subject as published and,
/// during Auth's id migration (cloud#10008, cloud#10026), the subject it
/// replaced.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionPrincipal {
    pub subject: String,
    pub legacy_subject: Option<String>,
    pub display_name: Option<String>,
    pub email: Option<String>,
}

/// Read `GetCurrentSessionResponse` (snake or camel case). An inactive
/// principal is no principal.
#[must_use]
pub fn principal_from_session(body: &Value) -> Option<SessionPrincipal> {
    let session = body.get("session").unwrap_or(body);
    let principal = session.get("principal")?;
    let text = |keys: &[&str]| {
        keys.iter()
            .find_map(|k| principal.get(*k).and_then(Value::as_str))
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_string)
    };
    let subject = text(&["principal_id", "principalId"])?;
    let state = text(&["state"]);
    if state.as_deref().is_some_and(|s| s != "active") {
        return None;
    }
    let legacy_subject = text(&[
        "legacy_principal_id",
        "legacyPrincipalId",
        "sylphx_legacy_sub",
    ])
    .filter(|legacy| *legacy != subject);
    Some(SessionPrincipal {
        subject,
        legacy_subject,
        display_name: text(&["display_name", "displayName"]),
        email: text(&["primary_email", "primaryEmail"]),
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
    fn session_response_becomes_a_principal_and_inactive_users_do_not() {
        let body = json!({"session": {"principal": {
            "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab",
            "display_name": "Ada", "primary_email": "ada@example.com", "state": "active"}}});
        let p = principal_from_session(&body).expect("principal");
        assert_eq!(p.subject, "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab");
        assert_eq!(p.legacy_subject, None);
        assert_eq!(p.email.as_deref(), Some("ada@example.com"));
        let revoked = json!({"session": {"principal": {
            "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab", "state": "revoked"}}});
        assert!(principal_from_session(&revoked).is_none());
    }

    #[test]
    fn the_new_subject_form_is_kept_verbatim_with_its_legacy_subject() {
        let body = json!({"session": {"principal": {
            "principal_id": "usr_01kmp4wyhhfgxsyrjvh8e0tkkf",
            "legacy_principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab",
            "state": "active"}}});
        let p = principal_from_session(&body).expect("principal");
        assert_eq!(p.subject, "usr_01kmp4wyhhfgxsyrjvh8e0tkkf");
        assert_eq!(
            p.legacy_subject.as_deref(),
            Some("principal-0199aa10-7b2c-7d3e-8f00-1234567890ab")
        );
        // A legacy value equal to the subject carries nothing.
        let same = json!({"principal": {"principalId": "usr_a", "sylphx_legacy_sub": "usr_a"}});
        assert_eq!(principal_from_session(&same).unwrap().legacy_subject, None);
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
