//! Published identity-access contract for other capabilities.
//!
//! Other capabilities must import this module rather than private interface
//! internals (ADR-169 / engineering-standard cross-capability rule).

pub use super::adapters::platform_jwt::{
    resolve_verified_identity, verify_platform_jwt, JwtError, VerifiedIdentity,
};
