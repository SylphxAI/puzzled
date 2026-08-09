//! Shared Connect identity resolution from request headers.
//!
//! Identity comes from either:
//! - `Authorization: Bearer <jwt>` (first-party / service calls), or
//! - the Platform session cookie `__sylphx_<namespace>_session` (HttpOnly JWT,
//!   5-minute access token) which the browser sends same-origin to the
//!   edge-routed api paths. This closes the browser -> Connect auth loop.

use connectrpc::{ConnectError, ErrorCode, RequestContext};

use crate::capabilities::identity_access::adapters::platform_jwt::{
    extract_bearer, verify_platform_jwt, VerifiedIdentity,
};

/// Extract the Platform session JWT from the Cookie header, if present.
fn extract_session_cookie_jwt(headers: &axum::http::HeaderMap) -> Option<String> {
    let cookie = headers.get(axum::http::header::COOKIE)?.to_str().ok()?;
    for pair in cookie.split(';') {
        let pair = pair.trim();
        let Some((name, value)) = pair.split_once('=') else {
            continue;
        };
        let name = name.trim();
        // __sylphx_<dev|stg|prod>_session
        if name.starts_with("__sylphx_") && name.ends_with("_session") {
            let value = value.trim().to_string();
            if !value.is_empty() {
                return Some(value);
            }
        }
    }
    None
}

fn verify(headers: &axum::http::HeaderMap) -> Result<VerifiedIdentity, ConnectError> {
    if let Some(token) = extract_bearer(headers) {
        return verify_platform_jwt(&token)
            .map_err(|err| ConnectError::new(ErrorCode::Unauthenticated, err.message()));
    }
    if let Some(token) = extract_session_cookie_jwt(headers) {
        return verify_platform_jwt(&token)
            .map_err(|err| ConnectError::new(ErrorCode::Unauthenticated, err.message()));
    }
    Err(ConnectError::new(ErrorCode::Unauthenticated, "identity_required"))
}

/// Verify the identity from Bearer or session cookie (fails closed when absent).
pub fn require_identity(ctx: &RequestContext) -> Result<VerifiedIdentity, ConnectError> {
    verify(ctx.headers())
}

/// Require identity with an exact admin scope claim.
pub fn require_admin(ctx: &RequestContext) -> Result<VerifiedIdentity, ConnectError> {
    let identity = require_identity(ctx)?;
    if !identity.is_admin {
        return Err(ConnectError::new(
            ErrorCode::PermissionDenied,
            "admin_scope_required",
        ));
    }
    Ok(identity)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;
    use axum::http::header::{AUTHORIZATION, COOKIE};

    #[test]
    fn session_cookie_is_extracted() {
        let mut headers = HeaderMap::new();
        headers.insert(
            COOKIE,
            "foo=bar; __sylphx_prod_session=eyJhbGciOiJSUzI1NiJ9.abc.def; other=1"
                .parse()
                .unwrap(),
        );
        let jwt = extract_session_cookie_jwt(&headers);
        assert_eq!(
            jwt.as_deref(),
            Some("eyJhbGciOiJSUzI1NiJ9.abc.def")
        );
    }

    #[test]
    fn missing_cookie_yields_none() {
        let headers = HeaderMap::new();
        assert!(extract_session_cookie_jwt(&headers).is_none());
        let mut headers = HeaderMap::new();
        headers.insert(COOKIE, "foo=bar".parse().unwrap());
        assert!(extract_session_cookie_jwt(&headers).is_none());
        let _ = AUTHORIZATION; // keep import used in compile
    }
}
