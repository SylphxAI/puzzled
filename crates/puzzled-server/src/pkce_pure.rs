//! Pure PKCE residual —
//! dual-oracle of `packages/sdk/src/lib/pkce.ts` format/TTL/key pure halves.
//!
//! crypto RNG / sessionStorage I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle verifier length (RFC 7636 residual product choice).
pub const VERIFIER_LENGTH: usize = 64;
/// Dual-oracle unreserved charset (RFC 7636).
pub const VERIFIER_CHARSET: &str =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
/// Dual-oracle PKCE TTL ms (10 minutes).
pub const PKCE_TTL_MS: u64 = 10 * 60 * 1000;
/// Dual-oracle storage prefix residual.
pub const PKCE_STORAGE_PREFIX: &str = "sylphx_pkce_";

/// Dual-oracle: code_verifier format gate (length + charset).
#[must_use]
pub fn is_valid_code_verifier(verifier: &str) -> bool {
    if verifier.len() < 43 || verifier.len() > 128 {
        return false;
    }
    verifier
        .chars()
        .all(|c| VERIFIER_CHARSET.contains(c))
}

/// Dual-oracle product verifier length residual.
#[must_use]
pub fn product_verifier_length_ok(verifier: &str) -> bool {
    verifier.len() == VERIFIER_LENGTH && is_valid_code_verifier(verifier)
}

/// Dual-oracle storage key: prefix + appId[:nonce].
#[must_use]
pub fn pkce_storage_key(app_id: &str, nonce: Option<&str>) -> String {
    match nonce {
        Some(n) if !n.is_empty() => format!("{PKCE_STORAGE_PREFIX}{app_id}:{n}"),
        _ => format!("{PKCE_STORAGE_PREFIX}{app_id}"),
    }
}

/// Dual-oracle: entry expired when now - createdAt >= TTL.
#[must_use]
pub fn pkce_entry_expired(created_at_ms: i64, now_ms: i64) -> bool {
    now_ms.saturating_sub(created_at_ms) >= PKCE_TTL_MS as i64
}

/// Dual-oracle method residual: S256 challenge method wire token.
pub const CODE_CHALLENGE_METHOD_S256: &str = "S256";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pkce_dual_oracle() {
        assert_eq!(VERIFIER_LENGTH, 64);
        assert_eq!(PKCE_TTL_MS, 600_000);
        assert_eq!(CODE_CHALLENGE_METHOD_S256, "S256");
        let v = "A".repeat(64);
        assert!(product_verifier_length_ok(&v));
        assert!(is_valid_code_verifier(&v));
        assert!(!is_valid_code_verifier("short"));
        assert!(!is_valid_code_verifier(&("A".repeat(42) + "!")));
        assert_eq!(pkce_storage_key("app1", None), "sylphx_pkce_app1");
        assert_eq!(
            pkce_storage_key("app1", Some("n1")),
            "sylphx_pkce_app1:n1"
        );
        assert!(!pkce_entry_expired(0, 599_999));
        assert!(pkce_entry_expired(0, 600_000));
    }
}
