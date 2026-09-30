//! Sylphx Auth end-user sessions.
//!
//! Puzzled's players are end users of its own Sylphx Auth organization. Their
//! sessions are opaque bearers (`identity_org_session_…`) that only Auth can
//! check, so one middleware in front of the Connect router verifies them with
//! `GET /v1/sessions/current` (cached briefly) and hands the result to the
//! synchronous identity code in [`VERIFIED_IDENTITY_HEADER`]. The header is
//! removed from every incoming request first, so a client can never set it.
//!
//! Auth answers `/v1/sessions/current` for a session of ANY Auth instance, so
//! a session counts only when its principal belongs to Puzzled's own instance
//! (`principal.project_id` equals `SYLPHX_AUTH_ORGANIZATION_ID`). Without that
//! id configured, no session is accepted. The two ids are compared as the
//! 128-bit value they carry ([`auth_id_value`]), so `organization-<uuid>` and
//! the TypeID of the same uuid are the same instance.

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

/// Internal header carrying the verified end user (base64url JSON).
pub const VERIFIED_IDENTITY_HEADER: &str = "x-puzzled-verified-identity";
/// The web's session cookie (set by `apps/puzzled/src/lib/identity/session-cookie.ts`).
pub const SESSION_COOKIE: &str = "puzzled_session";
/// The cookie's previous name, still read so the rename signs nobody out.
// TODO(2026-10-31): drop LEGACY_SESSION_COOKIE and its read in `session_token`.
pub const LEGACY_SESSION_COOKIE: &str = "sylphx_identity_session";
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
    /// Puzzled's own Auth instance; empty means no session is accepted.
    organization_id: String,
    cache: Arc<Mutex<Cache>>,
    /// Where the Auth subject to player map lives ([`super::auth_subjects`]).
    pool: Option<PgPool>,
}

impl AuthSessions {
    #[must_use]
    pub fn new(auth_url: String, organization_id: String) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .unwrap_or_default(),
            auth_url: auth_url.trim_end_matches('/').to_string(),
            organization_id: organization_id.trim().to_string(),
            cache: Arc::new(Mutex::new(HashMap::new())),
            pool: None,
        }
    }

    /// Resolve players through the database's subject map.
    #[must_use]
    pub fn with_pool(mut self, pool: Option<PgPool>) -> Self {
        self.pool = pool;
        self
    }

    /// `SYLPHX_AUTH_URL` (bound by Enable Auth), else `https://api.sylphx.com`,
    /// and the instance's own id, `SYLPHX_AUTH_ORGANIZATION_ID`.
    #[must_use]
    pub fn from_env() -> Self {
        let read = |name: &str| {
            std::env::var(name)
                .ok()
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty())
        };
        let url = read("SYLPHX_AUTH_URL").unwrap_or_else(|| DEFAULT_AUTH_URL.to_string());
        let organization_id = read("SYLPHX_AUTH_ORGANIZATION_ID").unwrap_or_else(|| {
            tracing::warn!("SYLPHX_AUTH_ORGANIZATION_ID is unset: no Auth session is accepted");
            String::new()
        });
        Self::new(url, organization_id)
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
        let principal =
            principal_from_session(&response.json::<Value>().await.ok()?, &self.organization_id)?;
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
/// principal is no principal, and neither is one from any Auth instance but
/// `expected_organization` (Puzzled's own): a missing, empty or different
/// `project_id`, or an empty `expected_organization`, is refused.
#[must_use]
pub fn principal_from_session(
    body: &Value,
    expected_organization: &str,
) -> Option<SessionPrincipal> {
    let session = body.get("session").unwrap_or(body);
    let principal = session.get("principal")?;
    let text = |keys: &[&str]| {
        keys.iter()
            .find_map(|k| principal.get(*k).and_then(Value::as_str))
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_string)
    };
    let expected = auth_id_value(expected_organization)?;
    let project = text(&["project_id", "projectId"]);
    if project.as_deref().and_then(auth_id_value) != Some(expected) {
        tracing::warn!(
            project_id = project.as_deref().unwrap_or(""),
            "auth session from another Auth instance refused"
        );
        return None;
    }
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

/// The 128-bit value an Auth id carries, in any of its forms:
/// `organization-<uuid>`, a TypeID (`<prefix>_<26 base32 chars>`, spec v0.3)
/// or a bare uuid (canonical 8-4-4-4-12 hex, any case). Anything else is None.
#[must_use]
pub fn auth_id_value(raw: &str) -> Option<u128> {
    let raw = raw.trim();
    let uuid = |s: &str| {
        let canonical = s.len() == 36
            && s.char_indices().all(|(i, c)| match i {
                8 | 13 | 18 | 23 => c == '-',
                _ => c.is_ascii_hexdigit(),
            });
        canonical
            .then(|| u128::from_str_radix(&s.replace('-', ""), 16).ok())
            .flatten()
    };
    if let Some(value) = raw.strip_prefix("organization-").and_then(uuid) {
        return Some(value);
    }
    if let Some((prefix, suffix)) = raw.split_once('_') {
        const ALPHABET: &[u8] = b"0123456789abcdefghjkmnpqrstvwxyz";
        let prefix_ok =
            (2..=5).contains(&prefix.len()) && prefix.bytes().all(|b| b.is_ascii_lowercase());
        if !prefix_ok || suffix.len() != 26 || !matches!(suffix.as_bytes()[0], b'0'..=b'7') {
            return None;
        }
        // 26 digits of 5 bits; a first digit of at most 7 keeps it in 128.
        return suffix.bytes().try_fold(0u128, |value, byte| {
            let digit = ALPHABET.iter().position(|&a| a == byte)?;
            Some((value << 5) | digit as u128)
        });
    }
    uuid(raw)
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
    // The new name first, then the old one.
    [SESSION_COOKIE, LEGACY_SESSION_COOKIE]
        .into_iter()
        .find_map(|wanted| {
            headers
                .get_all(COOKIE)
                .iter()
                .filter_map(|v| v.to_str().ok())
                .flat_map(|v| v.split(';'))
                .find_map(|pair| {
                    let (name, value) = pair.trim().split_once('=')?;
                    let value = value.trim();
                    (name.trim() == wanted && value.starts_with(SESSION_PREFIX))
                        .then(|| value.to_string())
                })
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

    const ORG: &str = "organization-0199aa10-7b2c-7d3e-8f00-00000000c0de";

    #[test]
    fn session_response_becomes_a_principal_and_inactive_users_do_not() {
        let body = json!({"session": {"principal": {
            "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab", "project_id": ORG,
            "display_name": "Ada", "primary_email": "ada@example.com", "state": "active"}}});
        let p = principal_from_session(&body, ORG).expect("principal");
        assert_eq!(p.subject, "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab");
        assert_eq!(p.legacy_subject, None);
        assert_eq!(p.email.as_deref(), Some("ada@example.com"));
        let revoked = json!({"session": {"principal": {
            "principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab",
            "project_id": ORG, "state": "revoked"}}});
        assert!(principal_from_session(&revoked, ORG).is_none());
    }

    #[test]
    fn only_sessions_of_our_own_auth_instance_count() {
        let from = |project: Value| {
            let mut principal = json!({"principal_id": "usr_a", "primary_email": "ada@example.com",
                "state": "active"});
            if !project.is_null() {
                principal["project_id"] = project;
            }
            json!({"session": {"principal": principal}})
        };
        // (a) Our own instance, in either case form.
        assert!(principal_from_session(&from(json!(ORG)), ORG).is_some());
        let camel = json!({"session": {"principal": {"principalId": "usr_a", "projectId": ORG}}});
        assert!(principal_from_session(&camel, ORG).is_some());
        // (b) Another tenant's instance, even with a matching email.
        assert!(principal_from_session(
            &from(json!("organization-0199aa10-7b2c-7d3e-8f00-00000000bad0")),
            ORG
        )
        .is_none());
        // (c) No or empty project id.
        assert!(principal_from_session(&from(Value::Null), ORG).is_none());
        assert!(principal_from_session(&from(json!("")), ORG).is_none());
        // (d) Our own id unset.
        assert!(principal_from_session(&from(json!(ORG)), "").is_none());
        assert!(principal_from_session(&from(json!("")), " ").is_none());
    }

    #[test]
    fn the_new_subject_form_is_kept_verbatim_with_its_legacy_subject() {
        let body = json!({"session": {"principal": {
            "principal_id": "usr_01kmp4wyhhfgxsyrjvh8e0tkkf",
            "legacy_principal_id": "principal-0199aa10-7b2c-7d3e-8f00-1234567890ab",
            "project_id": ORG, "state": "active"}}});
        let p = principal_from_session(&body, ORG).expect("principal");
        assert_eq!(p.subject, "usr_01kmp4wyhhfgxsyrjvh8e0tkkf");
        assert_eq!(
            p.legacy_subject.as_deref(),
            Some("principal-0199aa10-7b2c-7d3e-8f00-1234567890ab")
        );
        // A legacy value equal to the subject carries nothing.
        let same = json!({"principal": {"principalId": "usr_a", "sylphx_legacy_sub": "usr_a",
            "projectId": ORG}});
        assert_eq!(
            principal_from_session(&same, ORG).unwrap().legacy_subject,
            None
        );
    }

    #[test]
    fn auth_ids_compare_by_value_across_forms() {
        // TypeID spec v0.3 vectors.
        assert_eq!(auth_id_value("org_00000000000000000000000000"), Some(0));
        assert_eq!(
            auth_id_value("org_01h455vb4pex5vsknk084sn02q"),
            Some(0x0189_0a5d_ac96_774b_bcce_b302_099a_8057)
        );
        assert_eq!(
            auth_id_value("organization-01890A5D-AC96-774B-BCCE-B302099A8057"),
            auth_id_value("org_01h455vb4pex5vsknk084sn02q")
        );
        assert_eq!(
            auth_id_value("01890a5d-ac96-774b-bcce-b302099a8057"),
            Some(0x0189_0a5d_ac96_774b_bcce_b302_099a_8057)
        );
        for malformed in [
            "",
            "org_puzzled",
            "org_81h455vb4pex5vsknk084sn02q", // first digit above 7
            "org_01h455vb4pex5vsknk084sn02",  // 25 digits
            "org_01h455vb4pex5vsknk084sn02u", // 'u' is not Crockford
            "org_01H455VB4PEX5VSKNK084SN02Q", // upper case
            "o_01h455vb4pex5vsknk084sn02q",   // prefix too short
            "organization_01h455vb4pex5vsknk084sn02q", // prefix too long
            "organization-01890a5dac96774bbcceb302099a8057", // not canonical
            "organization-01890a5d-ac96-774b-bcce-b302099a805g",
        ] {
            assert_eq!(auth_id_value(malformed), None, "{malformed}");
        }

        let session = |project: &str| json!({"session": {"principal": {"principal_id": "usr_a", "project_id": project}}});
        const LEGACY: &str = "organization-01890a5d-ac96-774b-bcce-b302099a8057";
        const TYPEID: &str = "org_01h455vb4pex5vsknk084sn02q";
        // Same uuid, either form on either side.
        assert!(principal_from_session(&session(TYPEID), LEGACY).is_some());
        assert!(principal_from_session(&session(LEGACY), TYPEID).is_some());
        // A different uuid, in either form.
        let other = "organization-01890a5d-ac96-774b-bcce-b302099a8058";
        assert!(principal_from_session(&session(other), TYPEID).is_none());
        assert!(
            principal_from_session(&session("org_01h455vb4pex5vsknk084sn02r"), LEGACY).is_none()
        );
        // Malformed on either side.
        assert!(principal_from_session(&session("org_puzzled"), LEGACY).is_none());
        assert!(principal_from_session(&session(LEGACY), "org_puzzled").is_none());
    }

    #[test]
    fn token_comes_from_bearer_or_cookie_only_when_it_is_an_auth_session() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            "a=1; puzzled_session=identity_org_session_abc"
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
    fn old_cookie_name_still_signs_in_and_the_new_name_wins() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            "sylphx_identity_session=identity_org_session_old"
                .parse()
                .unwrap(),
        );
        assert_eq!(
            session_token(&headers).as_deref(),
            Some("identity_org_session_old")
        );
        headers.insert(
            COOKIE,
            "sylphx_identity_session=identity_org_session_old; puzzled_session=identity_org_session_new"
                .parse()
                .unwrap(),
        );
        assert_eq!(
            session_token(&headers).as_deref(),
            Some("identity_org_session_new")
        );
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
