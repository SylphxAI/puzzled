//! Product auth session gate for puzzled-server (dens path for `auth-sessions`).
//!
//! Ports the Hono auth middleware contract from
//! `apps/puzzled/src/server/api/middleware/auth.ts` without calling the Platform
//! SDK. Session identity is supplied by the edge / gateway; this module validates
//! shape and required-vs-optional policy. FE UI / OAuth flows remain TS.

use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;

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

/// Extract bearer token from `Authorization: Bearer …` header.
#[must_use]
pub fn extract_bearer(headers: &HeaderMap) -> Option<String> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let rest = value.strip_prefix("Bearer ").or_else(|| value.strip_prefix("bearer "))?;
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

/// Validate a pre-resolved session (from trusted gateway / Platform SDK edge).
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

/// Required auth: fail closed without a valid session.
///
/// # Errors
///
/// Returns [`AuthError`] when credentials are missing or empty.
pub fn require_auth(
    user_id: Option<&str>,
    session_token: Option<&str>,
    display_name: Option<&str>,
) -> Result<SessionContext, AuthError> {
    validate_session(user_id, session_token, display_name)
}

/// Optional auth: returns `None` when unauthenticated (never errors).
#[must_use]
pub fn optional_auth(
    user_id: Option<&str>,
    session_token: Option<&str>,
    display_name: Option<&str>,
) -> Option<SessionContext> {
    validate_session(user_id, session_token, display_name).ok()
}

/// HTTP: POST /api/v1/auth/session/validate — product auth gate.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateSessionBody {
    pub user_id: Option<String>,
    pub session_token: Option<String>,
    pub display_name: Option<String>,
    /// When true (default), missing credentials → 401. When false, returns `{authenticated:false}`.
    pub required: Option<bool>,
}

pub async fn validate_session_http(Json(body): Json<ValidateSessionBody>) -> Response {
    let required = body.required.unwrap_or(true);
    let uid = body.user_id.as_deref();
    let tok = body.session_token.as_deref();
    let name = body.display_name.as_deref();

    if required {
        match require_auth(uid, tok, name) {
            Ok(session) => (
                StatusCode::OK,
                Json(json!({
                    "authenticated": true,
                    "session": session,
                    "slice": "auth-sessions",
                })),
            )
                .into_response(),
            Err(err) => (
                err.status(),
                Json(json!({
                    "authenticated": false,
                    "error": err.message(),
                    "code": format!("{:?}", err).to_ascii_lowercase(),
                    "slice": "auth-sessions",
                })),
            )
                .into_response(),
        }
    } else {
        match optional_auth(uid, tok, name) {
            Some(session) => (
                StatusCode::OK,
                Json(json!({
                    "authenticated": true,
                    "session": session,
                    "slice": "auth-sessions",
                })),
            )
                .into_response(),
            None => (
                StatusCode::OK,
                Json(json!({
                    "authenticated": false,
                    "session": null,
                    "slice": "auth-sessions",
                })),
            )
                .into_response(),
        }
    }
}

/// Extract trusted edge identity headers (`x-user-id`, `x-user-name` / `x-display-name`).
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
    let token = resolve_session_token(&headers);
    let (edge_user, edge_name) = extract_edge_user(&headers);
    match optional_auth(edge_user.as_deref(), token.as_deref(), edge_name.as_deref()) {
        Some(session) => (
            StatusCode::OK,
            Json(json!({
                "authenticated": true,
                "session": session,
                "slice": "auth-sessions",
            })),
        )
            .into_response(),
        None => (
            StatusCode::OK,
            Json(json!({
                "authenticated": false,
                "session": null,
                "slice": "auth-sessions",
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
