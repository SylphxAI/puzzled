//! Product auth session gate for puzzled-server (residual path for `auth-sessions`).
//!
//! Product auth for puzzled-server.
//!
//! Identity is verified via Platform RS256 JWT (`Authorization: Bearer …`) using
//! JWKS (see [`crate::capabilities::identity_access::adapters::platform_jwt`]). Caller-supplied `x-user-id` is **never**
//! trusted as identity. Empty-token or header-only "sessions" fail closed.

use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::capabilities::identity_access::adapters::platform_jwt::{self, JwtError, VerifiedIdentity};

/// Authenticated session context (mirrors Hono `PuzzledAuthEnv` user fields).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionContext {
    pub user_id: String,
    pub session_token: String,
    pub display_name: Option<String>,
}

/// Failure modes for required auth.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthError {
    MissingCredentials,
    EmptyUserId,
    EmptySessionToken,
}

impl AuthError {
    #[must_use]
    pub fn message(&self) -> &'static str {
        match self {
            Self::MissingCredentials => "You must be logged in to perform this action",
            Self::EmptyUserId => "Invalid session: empty user id",
            Self::EmptySessionToken => "Invalid session: empty session token",
        }
    }

    #[must_use]
    pub fn status(&self) -> StatusCode {
        StatusCode::UNAUTHORIZED
    }
}

/// Require cryptographically verified Platform JWT identity.
pub fn require_verified_identity(headers: &HeaderMap) -> Result<VerifiedIdentity, JwtError> {
    platform_jwt::resolve_verified_identity(headers)
}

/// Extract bearer token from `Authorization: Bearer …` header.
#[must_use]
pub fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let rest = value
        .strip_prefix("Bearer ")
        .or_else(|| value.strip_prefix("bearer "))?;
    let token = rest.trim();
    if token.is_empty() {
        None
    } else {
        Some(token.to_string())
    }
}

/// Extract session token from cookie named `session_token` or `sylphx_session`.
#[must_use]
pub fn extract_session_cookie(headers: &HeaderMap) -> Option<String> {
    let cookie = headers.get(header::COOKIE)?.to_str().ok()?;
    for part in cookie.split(';') {
        let part = part.trim();
        if let Some(v) = part.strip_prefix("session_token=") {
            let v = v.trim();
            if !v.is_empty() {
                return Some(v.to_string());
            }
        }
        if let Some(v) = part.strip_prefix("sylphx_session=") {
            let v = v.trim();
            if !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }
    None
}

/// Resolve raw session token from Authorization or cookie (product gate inputs).
#[must_use]
pub fn resolve_session_token(headers: &HeaderMap) -> Option<String> {
    extract_bearer(headers).or_else(|| extract_session_cookie(headers))
}

/// Shape-only session check (non-empty user id + token).
///
/// **Not cryptographic identity.** Product HTTP handlers must use
/// [`require_verified_identity`] so `sub` comes from a verified Platform JWT.
///
/// # Errors
///
/// Returns [`AuthError`] when credentials are missing or empty.
pub fn validate_session(
    user_id: Option<&str>,
    session_token: Option<&str>,
    display_name: Option<&str>,
) -> Result<SessionContext, AuthError> {
    let user_id = user_id.map(str::trim).filter(|s| !s.is_empty());
    let session_token = session_token.map(str::trim).filter(|s| !s.is_empty());
    match (user_id, session_token) {
        (None, _) | (_, None) => Err(AuthError::MissingCredentials),
        (Some(""), _) => Err(AuthError::EmptyUserId),
        (_, Some("")) => Err(AuthError::EmptySessionToken),
        (Some(uid), Some(tok)) => Ok(SessionContext {
            user_id: uid.to_string(),
            session_token: tok.to_string(),
            display_name: display_name
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string),
        }),
    }
}

/// Legacy non-cryptographic session shape check.
///
/// **Not product identity.** Caller-supplied `user_id` is never accepted as
/// identity on HTTP routes — use [`require_verified_identity`] /
/// [`platform_jwt::resolve_verified_identity`] only.
///
/// Kept private for unit tests of the shape validator; do not re-export.
#[cfg(test)]
fn require_auth(
    user_id: Option<&str>,
    session_token: Option<&str>,
    display_name: Option<&str>,
) -> Result<SessionContext, AuthError> {
    validate_session(user_id, session_token, display_name)
}

/// Optional shape check — same non-identity caveat as [`require_auth`].
#[cfg(test)]
#[must_use]
fn optional_auth(
    user_id: Option<&str>,
    session_token: Option<&str>,
    display_name: Option<&str>,
) -> Option<SessionContext> {
    validate_session(user_id, session_token, display_name).ok()
}

/// HTTP: POST /api/v1/auth/session/validate — cryptographic JWT gate.
///
/// Body may carry `sessionToken` (Bearer JWT). `userId` in the body is ignored
/// for identity; only verified JWT `sub` is accepted.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateSessionBody {
    /// Ignored for identity (compatibility field only).
    pub user_id: Option<String>,
    pub session_token: Option<String>,
    pub display_name: Option<String>,
    /// When true (default), missing/invalid credentials → 401.
    pub required: Option<bool>,
}

pub async fn validate_session_http(
    headers: HeaderMap,
    Json(body): Json<ValidateSessionBody>,
) -> Response {
    let required = body.required.unwrap_or(true);
    // Prefer Authorization header; fall back to body sessionToken as JWT.
    let token = platform_jwt::extract_bearer(&headers).or_else(|| {
        body.session_token
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    });

    let verified = match token {
        Some(t) => platform_jwt::verify_platform_jwt(&t),
        None => Err(JwtError::MissingBearer),
    };

    match (required, verified) {
        (_, Ok(id)) => (
            StatusCode::OK,
            Json(json!({
                "authenticated": true,
                "session": {
                    "userId": id.user_id,
                    "displayName": id.display_name.or(body.display_name),
                    "email": id.email,
                    "isAdmin": id.is_admin,
                },
                "slice": "auth-sessions",
                "auth": "platform_jwt_rs256",
            })),
        )
            .into_response(),
        (false, Err(JwtError::MissingBearer)) => (
            StatusCode::OK,
            Json(json!({
                "authenticated": false,
                "session": null,
                "slice": "auth-sessions",
                "auth": "platform_jwt_rs256",
            })),
        )
            .into_response(),
        (true, Err(err)) | (false, Err(err)) => (
            if required {
                err.status()
            } else {
                StatusCode::OK
            },
            Json(json!({
                "authenticated": false,
                "session": null,
                "error": err.message(),
                "code": err.code(),
                "slice": "auth-sessions",
                "auth": "platform_jwt_rs256",
            })),
        )
            .into_response(),
    }
}

/// Extract **untrusted** edge identity headers. Never use as auth principal.
#[must_use]
pub fn extract_edge_user(headers: &HeaderMap) -> (Option<String>, Option<String>) {
    let user_id = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    let display_name = headers
        .get("x-display-name")
        .or_else(|| headers.get("x-user-name"))
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    (user_id, display_name)
}

/// HTTP: GET /api/v1/auth/session — resolve optional session from cookies / bearer / edge headers.
///
/// Prod sole-process probes hit this path (not only `/validate`). Missing credentials
/// return 200 with `authenticated: false` (optional session read — not a hard gate).
pub async fn get_session_http(headers: HeaderMap) -> Response {
    match platform_jwt::resolve_verified_identity(&headers) {
        Ok(id) => (
            StatusCode::OK,
            Json(json!({
                "authenticated": true,
                "session": {
                    "userId": id.user_id,
                    "displayName": id.display_name,
                    "email": id.email,
                    "isAdmin": id.is_admin,
                },
                "slice": "auth-sessions",
                "auth": "platform_jwt_rs256",
            })),
        )
            .into_response(),
        Err(JwtError::MissingBearer) => (
            StatusCode::OK,
            Json(json!({
                "authenticated": false,
                "session": null,
                "slice": "auth-sessions",
                "auth": "platform_jwt_rs256",
            })),
        )
            .into_response(),
        Err(err) => (
            err.status(),
            Json(json!({
                "authenticated": false,
                "session": null,
                "error": err.message(),
                "code": err.code(),
                "slice": "auth-sessions",
                "auth": "platform_jwt_rs256",
            })),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    #[test]
    fn require_auth_accepts_valid() {
        let s = require_auth(Some("u1"), Some("tok"), Some("Ada")).expect("ok");
        assert_eq!(s.user_id, "u1");
        assert_eq!(s.session_token, "tok");
        assert_eq!(s.display_name.as_deref(), Some("Ada"));
    }

    #[test]
    fn require_auth_rejects_missing() {
        assert_eq!(
            require_auth(None, Some("tok"), None),
            Err(AuthError::MissingCredentials)
        );
        assert_eq!(
            require_auth(Some("u1"), None, None),
            Err(AuthError::MissingCredentials)
        );
        assert_eq!(
            require_auth(Some("  "), Some("tok"), None),
            Err(AuthError::MissingCredentials)
        );
    }

    #[test]
    fn optional_auth_none_when_missing() {
        assert!(optional_auth(None, None, None).is_none());
        assert!(optional_auth(Some("u"), Some("t"), None).is_some());
    }

    #[test]
    fn extract_bearer_and_cookie() {
        let mut h = HeaderMap::new();
        h.insert(
            header::AUTHORIZATION,
            HeaderValue::from_static("Bearer abc123"),
        );
        assert_eq!(extract_bearer(&h).as_deref(), Some("abc123"));

        let mut h2 = HeaderMap::new();
        h2.insert(
            header::COOKIE,
            HeaderValue::from_static("foo=1; session_token=xyz; bar=2"),
        );
        assert_eq!(extract_session_cookie(&h2).as_deref(), Some("xyz"));
    }
}
