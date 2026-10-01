//! Shared Connect identity resolution from request headers.
//!
//! Identity comes from either:
//! - `Authorization: Bearer <jwt>` (customer credentials this product verifies), or
//! - the Platform session cookie `__sylphx_<namespace>_session` (HttpOnly JWT,
//!   5-minute access token) which the browser sends same-origin to the
//!   edge-routed api paths. This closes the browser -> Connect auth loop.
//! - Guest free-ritual path: `X-Puzzled-Guest-Id` (UUID) or cookie
//!   `puzzled_guest_id` — stable day identity for viral / unauthenticated
//!   finishes (North Star protocol; counts toward daily puzzle completers as distinct user key).

use connectrpc::{ConnectError, ErrorCode, RequestContext};

use crate::capabilities::identity_access::adapters::platform_jwt::{
    extract_bearer, verify_platform_jwt, VerifiedIdentity,
};

/// Request header for client-stable guest day id (UUID).
pub const GUEST_ID_HEADER: &str = "x-puzzled-guest-id";
/// Cookie name for the same guest id (browser same-origin).
pub const GUEST_ID_COOKIE: &str = "puzzled_guest_id";

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

/// Resolve guest-day identity from header or cookie (UUID → `guest_<uuid>`).
fn resolve_guest(_headers: &axum::http::HeaderMap) -> Option<VerifiedIdentity> {
    // Only asynchronous database admission resolves the internal hash.
    None
}

fn verify(headers: &axum::http::HeaderMap) -> Result<VerifiedIdentity, ConnectError> {
    // A Sylphx Auth end-user session, already checked by the router middleware.
    if let Some(identity) =
        crate::capabilities::identity_access::adapters::auth_session::verified_identity(headers)
    {
        return Ok(identity);
    }
    if let Some(token) = extract_bearer(headers) {
        return verify_platform_jwt(&token)
            .map_err(|err| ConnectError::new(ErrorCode::Unauthenticated, err.message()));
    }
    if let Some(token) = extract_session_cookie_jwt(headers) {
        return verify_platform_jwt(&token)
            .map_err(|err| ConnectError::new(ErrorCode::Unauthenticated, err.message()));
    }
    Err(ConnectError::new(
        ErrorCode::Unauthenticated,
        "identity_required",
    ))
}

/// Verify the identity from Bearer or session cookie (fails closed when absent).
///
/// Does **not** accept guest headers — use [`require_admitted_identity_or_guest`] for
/// free-ritual SubmitGuess.
pub fn require_identity(ctx: &RequestContext) -> Result<VerifiedIdentity, ConnectError> {
    verify(ctx.headers())
}

/// Platform and guest identities present on one request.
///
/// Platform still wins as the write identity. The guest id is retained so
/// accepted `guest_<uuid>` rows can be adopted onto the account without a
/// second finish for the same module/day.
#[derive(Debug, Clone, Default)]
pub struct RequestIdentities {
    pub platform: Option<VerifiedIdentity>,
    pub guest: Option<VerifiedIdentity>,
}

impl RequestIdentities {
    /// Platform identity when present, otherwise the guest day id.
    #[must_use]
    pub fn primary(&self) -> Option<&VerifiedIdentity> {
        self.platform.as_ref().or(self.guest.as_ref())
    }

    /// Account/guest pair that must be merged. None when adoption is a no-op.
    #[must_use]
    pub fn adoption_pair(&self) -> Option<(&str, &str)> {
        match (&self.platform, &self.guest) {
            (Some(platform), Some(guest)) if platform.user_id != guest.user_id => {
                Some((platform.user_id.as_str(), guest.user_id.as_str()))
            }
            _ => None,
        }
    }
}

/// Resolve both request identities without dropping the guest cookie when a
/// Platform JWT is also present.
#[must_use]
pub fn resolve_request_identities(ctx: &RequestContext) -> RequestIdentities {
    RequestIdentities {
        platform: verify(ctx.headers()).ok(),
        guest: resolve_guest(ctx.headers()),
    }
}

/// Every guest access revalidates live browser possession and account class.
pub async fn admitted_request_identities(
    ctx: &RequestContext,
    pool: Option<&sqlx::PgPool>,
) -> Result<RequestIdentities, ConnectError> {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    use puzzled_core::identity_policy::guest_day_id::user_id_to_storage_uuid;
    let internal = || ConnectError::new(ErrorCode::Internal, "identity_store_failed");
    let mut identities = resolve_request_identities(ctx);
    if let Some(hash) = guest_credential_hash(ctx) {
        let pool = pool.ok_or_else(internal)?;
        let candidate = guest_credentials::lookup_hash(pool, hash).await.map_err(|_| internal())?;
        if let Some(player) = candidate {
            let mut tx = pool.begin().await.map_err(|_| internal())?;
            guest_credentials::lock_players(&mut tx, vec![player]).await.map_err(|_| internal())?;
            let valid = guest_credentials::validate_locked(&mut tx, player, hash).await.map_err(|_| internal())?;
            tx.commit().await.map_err(|_| internal())?;
            if valid && !identities.platform.as_ref().is_some_and(|account| account.user_id == player.to_string()) {
                identities.guest = Some(VerifiedIdentity {
                    user_id: format!("guest_{player}"), display_name: Some("Guest".into()),
                    email: None, is_admin: false, actor: None,
                });
            }
        }
    }
    if let Some(account) = &identities.platform {
        if let Some(player) = user_id_to_storage_uuid(&account.user_id) {
            if let Some(pool) = pool {
                let guest_collision: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM guest_credentials WHERE user_id = $1)")
                    .bind(player).fetch_one(pool).await.map_err(|_| internal())?;
                if guest_collision { identities.platform = None; }
            }
        }
    }
    // Invalid or absent guest credentials never prevent signed-in own access.
    Ok(identities)
}

pub fn guest_credential_hash(ctx: &RequestContext) -> Option<&str> {
    use crate::capabilities::identity_access::adapters::guest_credentials::VERIFIED_GUEST_HEADER;
    ctx.headers().get(VERIFIED_GUEST_HEADER)?.to_str().ok()
}

pub async fn require_admitted_identity_or_guest(
    ctx: &RequestContext,
    pool: Option<&sqlx::PgPool>,
) -> Result<VerifiedIdentity, ConnectError> {
    admitted_request_identities(ctx, pool).await?.primary().cloned()
        .ok_or_else(|| ConnectError::new(ErrorCode::Unauthenticated, "identity_required_for_submit"))
}

/// The one guard for every authenticated purchase or spend (checkout, billing
/// portal, and any future wallet spend): a delegated agent credential (an `act`
/// or `actor` claim) is refused with 403 until delegated purchasing exists.
/// Call it on the identity a purchase acts for, before any money call.
pub fn require_purchase_allowed(identity: &VerifiedIdentity) -> Result<(), ConnectError> {
    if identity.is_delegated() {
        return Err(ConnectError::new(
            ErrorCode::PermissionDenied,
            "purchases by delegated agents are not available yet",
        ));
    }
    Ok(())
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
    use axum::http::header::{AUTHORIZATION, COOKIE};
    use axum::http::HeaderMap;

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
        assert_eq!(jwt.as_deref(), Some("eyJhbGciOiJSUzI1NiJ9.abc.def"));
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

    #[test]
    fn raw_guest_header_and_cookie_are_not_credentials() {
        let mut headers = HeaderMap::new();
        headers.insert(GUEST_ID_HEADER, "a1b2c3d4-e5f6-7890-abcd-ef1234567890".parse().unwrap());
        headers.insert(COOKIE, "puzzled_guest_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890".parse().unwrap());
        assert!(resolve_guest(&headers).is_none());
    }

    #[test]
    fn invalid_guest_rejected() {
        let mut headers = HeaderMap::new();
        headers.insert(GUEST_ID_HEADER, "not-a-uuid".parse().unwrap());
        assert!(resolve_guest(&headers).is_none());
    }

    #[test]
    fn adoption_pair_keeps_guest_when_platform_wins() {
        let identities = RequestIdentities {
            platform: Some(VerifiedIdentity {
                user_id: "f715210b-9df3-4945-b5bd-94fc4609bc30".to_string(),
                display_name: Some("Ada".to_string()),
                email: None,
                is_admin: false,
                actor: None,
            }),
            guest: Some(VerifiedIdentity {
                user_id: "guest_a1b2c3d4-e5f6-7890-abcd-ef1234567890".to_string(),
                display_name: Some("Guest".to_string()),
                email: None,
                is_admin: false,
                actor: None,
            }),
        };
        assert_eq!(
            identities
                .primary()
                .map(|identity| identity.user_id.as_str()),
            Some("f715210b-9df3-4945-b5bd-94fc4609bc30")
        );
        assert_eq!(
            identities.adoption_pair(),
            Some((
                "f715210b-9df3-4945-b5bd-94fc4609bc30",
                "guest_a1b2c3d4-e5f6-7890-abcd-ef1234567890"
            ))
        );
    }
}
