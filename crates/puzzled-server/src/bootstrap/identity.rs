//! Shared Connect identity resolution from request headers.

use connectrpc::{ConnectError, ErrorCode, RequestContext};

use crate::capabilities::identity_access::adapters::platform_jwt::{
    extract_bearer, verify_platform_jwt, VerifiedIdentity,
};

/// Verify the Bearer JWT if present; absent/invalid fails closed with an error.
pub fn require_identity(ctx: &RequestContext) -> Result<VerifiedIdentity, ConnectError> {
    let headers = ctx.headers();
    let Some(token) = extract_bearer(headers) else {
        return Err(ConnectError::new(
            ErrorCode::Unauthenticated,
            "identity_required",
        ));
    };
    verify_platform_jwt(&token)
        .map_err(|err| ConnectError::new(ErrorCode::Unauthenticated, err.message()))
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
