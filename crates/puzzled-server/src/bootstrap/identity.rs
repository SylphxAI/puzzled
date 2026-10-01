//! Shared Connect identity resolution from request headers.
//!
//! Identity comes from either:
//! - `Authorization: Bearer <jwt>` (customer credentials this product verifies), or
//! - the Platform session cookie `__sylphx_<namespace>_session` (HttpOnly JWT,
//!   5-minute access token) which the browser sends same-origin to the
//!   edge-routed api paths. This closes the browser -> Connect auth loop.
//! - Guest free ritual: the server-issued host-only browser credential. Raw
//!   client UUIDs do not establish identity and never authorize adoption.

use connectrpc::{ConnectError, ErrorCode, RequestContext};

use crate::capabilities::identity_access::adapters::platform_jwt::{
    extract_bearer, verify_platform_jwt, VerifiedIdentity,
};

/// Legacy header exercised by denial tests; it supplies no authority.
#[cfg(test)]
pub const GUEST_ID_HEADER: &str = "x-puzzled-guest-id";

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

/// Synchronous resolution does not admit browser guests; database admission does.
fn resolve_guest(_headers: &axum::http::HeaderMap) -> Option<VerifiedIdentity> {
    // Only asynchronous database admission resolves the internal hash.
    None
}

pub(crate) fn verify(headers: &axum::http::HeaderMap) -> Result<VerifiedIdentity, ConnectError> {
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
/// Does **not** accept guest headers — use [`admitted_request_identities`] for
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

    /// Account/guest pair inspected by identity precedence tests.
    #[cfg(test)]
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

pub struct RequestAccess {
    identities: RequestIdentities,
    transaction: Option<sqlx::Transaction<'static, sqlx::Postgres>>,
}

impl std::ops::Deref for RequestAccess {
    type Target = RequestIdentities;
    fn deref(&self) -> &Self::Target {
        &self.identities
    }
}

impl RequestAccess {
    pub fn connection(&mut self) -> Option<&mut sqlx::PgConnection> {
        self.transaction.as_mut().map(|tx| &mut **tx)
    }
    pub async fn commit(self) -> Result<(), ConnectError> {
        if let Some(tx) = self.transaction {
            tx.commit()
                .await
                .map_err(|_| ConnectError::new(ErrorCode::Internal, "identity_store_failed"))?;
        }
        Ok(())
    }
}

/// Admission and all player SQL retain this same transaction and lock lease.
pub async fn admitted_request_identities(
    ctx: &RequestContext,
    pool: Option<&sqlx::PgPool>,
    guest_write: bool,
) -> Result<RequestAccess, ConnectError> {
    use crate::capabilities::identity_access::adapters::guest_credentials;
    use puzzled_core::identity_policy::guest_day_id::user_id_to_storage_uuid;
    let internal = || ConnectError::new(ErrorCode::Internal, "identity_store_failed");
    let mut identities = resolve_request_identities(ctx);
    if guest_credential_hash(ctx).is_none() && identities.platform.is_none() {
        return Ok(RequestAccess {
            identities,
            transaction: None,
        });
    }
    let Some(pool) = pool else {
        return Ok(RequestAccess {
            identities,
            transaction: None,
        });
    };
    let hash = guest_credential_hash(ctx);
    let account = identities
        .platform
        .as_ref()
        .and_then(|identity| user_id_to_storage_uuid(&identity.user_id));
    let (mut tx, candidate) = loop {
        let mut tx = pool.begin().await.map_err(|_| internal())?;
        // Serialize token allocation BEFORE common player locks. A loser
        // never holds an unused candidate lock while acquiring the winner.
        if let Some(hash) = hash {
            sqlx::query(
                "SELECT pg_advisory_xact_lock(hashtextextended('puzzled:guest-token:' || $1, 0))",
            )
            .bind(hash)
            .execute(&mut *tx)
            .await
            .map_err(|_| internal())?;
        }
        let mut candidate: Option<uuid::Uuid> = match hash {
            Some(hash) => {
                sqlx::query_scalar("SELECT user_id FROM guest_credentials WHERE token_hash = $1")
                    .bind(hash)
                    .fetch_optional(&mut *tx)
                    .await
                    .map_err(|_| internal())?
            }
            None => None,
        };
        let allocate =
            candidate.is_none() && hash.is_some() && guest_write && identities.platform.is_none();
        if allocate {
            candidate = Some(uuid::Uuid::now_v7());
        }
        guest_credentials::lock_players(&mut tx, candidate.into_iter().chain(account).collect())
            .await
            .map_err(|_| internal())?;
        if allocate {
            let player = candidate.ok_or_else(internal)?;
            if !guest_credentials::unused_player(&mut tx, player)
                .await
                .map_err(|_| internal())?
            {
                tx.rollback().await.map_err(|_| internal())?;
                continue;
            }
            let winner: uuid::Uuid = sqlx::query_scalar("INSERT INTO guest_credentials (token_hash, user_id, provenance) VALUES ($1, $2, 'server_issued') ON CONFLICT (token_hash) DO UPDATE SET token_hash = guest_credentials.token_hash RETURNING user_id")
                .bind(hash.ok_or_else(internal)?).bind(player).fetch_one(&mut *tx).await.map_err(|_| internal())?;
            if winner != player {
                // All app allocation takes the token lock. A separately
                // inserted winner is retried without the unused player lock.
                tx.rollback().await.map_err(|_| internal())?;
                continue;
            }
        }
        break (tx, candidate);
    };
    if let Some(player) = account {
        let collision: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM guest_credentials WHERE user_id = $1)",
        )
        .bind(player)
        .fetch_one(&mut *tx)
        .await
        .map_err(|_| internal())?;
        if collision {
            identities.platform = None;
        }
    }
    if let (Some(player), Some(hash)) = (candidate, hash) {
        let live: Option<uuid::Uuid> = sqlx::query_scalar("SELECT user_id FROM guest_credentials WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL AND adopted_user_id IS NULL FOR SHARE")
            .bind(player).bind(hash).fetch_optional(&mut *tx).await.map_err(|_| internal())?;
        if live == Some(player)
            && account != Some(player)
            && !guest_credentials::account_backed(&mut tx, player)
                .await
                .map_err(|_| internal())?
        {
            identities.guest = Some(VerifiedIdentity {
                user_id: format!("guest_{player}"),
                display_name: Some("Guest".into()),
                email: None,
                is_admin: false,
                actor: None,
            });
        }
    }
    if let (Some(verified), Some(guest), Some(hash)) =
        (&identities.platform, &identities.guest, hash)
    {
        crate::capabilities::puzzle_play::adapters::game_sessions_db::adopt_guest_sessions_on_connection(
            &mut tx, verified, &guest.user_id, hash,
        ).await.map_err(|_| internal())?;
        identities.guest = None;
    }
    Ok(RequestAccess {
        identities,
        transaction: Some(tx),
    })
}

pub fn guest_credential_hash(ctx: &RequestContext) -> Option<&str> {
    use crate::capabilities::identity_access::adapters::guest_credentials::VERIFIED_GUEST_HEADER;
    ctx.headers().get(VERIFIED_GUEST_HEADER)?.to_str().ok()
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
        headers.insert(
            GUEST_ID_HEADER,
            "a1b2c3d4-e5f6-7890-abcd-ef1234567890".parse().unwrap(),
        );
        headers.insert(
            COOKIE,
            "puzzled_guest_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                .parse()
                .unwrap(),
        );
        assert!(resolve_guest(&headers).is_none());
    }

    #[test]
    fn delegated_identity_cannot_purchase_and_a_normal_one_can() {
        let mut identity = VerifiedIdentity {
            user_id: "f715210b-9df3-4945-b5bd-94fc4609bc30".to_string(),
            display_name: None,
            email: None,
            is_admin: false,
            actor: None,
        };
        assert!(require_purchase_allowed(&identity).is_ok());
        identity.actor = Some("agent_1".to_string());
        let denied = require_purchase_allowed(&identity).unwrap_err();
        assert_eq!(denied.code, ErrorCode::PermissionDenied);
        assert_eq!(
            denied.message.as_deref(),
            Some("purchases by delegated agents are not available yet")
        );
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
