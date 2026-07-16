//! Pure SDK error-code residual —
//! dual-oracle of `packages/sdk/src/errors.ts`
//! `ERROR_CODE_STATUS` / `RETRYABLE_CODES` pure catalogs.
//!
//! Error class construction / stack capture remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: SylphxErrorCode catalog (product order).
pub const ERROR_CODES: &[&str] = &[
    "BAD_REQUEST",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "PAYLOAD_TOO_LARGE",
    "UNPROCESSABLE_ENTITY",
    "TOO_MANY_REQUESTS",
    "INTERNAL_SERVER_ERROR",
    "NOT_IMPLEMENTED",
    "BAD_GATEWAY",
    "SERVICE_UNAVAILABLE",
    "GATEWAY_TIMEOUT",
    "NETWORK_ERROR",
    "TIMEOUT",
    "ABORTED",
    "PARSE_ERROR",
    "UNKNOWN",
];

/// Dual-oracle residual: retryable codes set.
pub const RETRYABLE_CODES: &[&str] = &[
    "NETWORK_ERROR",
    "TIMEOUT",
    "BAD_GATEWAY",
    "SERVICE_UNAVAILABLE",
    "GATEWAY_TIMEOUT",
    "TOO_MANY_REQUESTS",
    "INTERNAL_SERVER_ERROR",
];

/// Dual-oracle residual: HTTP status for error code (`ERROR_CODE_STATUS`).
#[must_use]
pub fn error_code_status(code: &str) -> Option<u16> {
    Some(match code {
        "BAD_REQUEST" => 400,
        "UNAUTHORIZED" => 401,
        "FORBIDDEN" => 403,
        "NOT_FOUND" => 404,
        "CONFLICT" => 409,
        "PAYLOAD_TOO_LARGE" => 413,
        "UNPROCESSABLE_ENTITY" => 422,
        "TOO_MANY_REQUESTS" => 429,
        "INTERNAL_SERVER_ERROR" => 500,
        "NOT_IMPLEMENTED" => 501,
        "BAD_GATEWAY" => 502,
        "SERVICE_UNAVAILABLE" => 503,
        "GATEWAY_TIMEOUT" => 504,
        "NETWORK_ERROR" | "TIMEOUT" | "ABORTED" | "PARSE_ERROR" | "UNKNOWN" => 0,
        _ => return None,
    })
}

/// Dual-oracle residual: known error code membership.
#[must_use]
pub fn is_error_code(code: &str) -> bool {
    ERROR_CODES.contains(&code)
}

/// Dual-oracle residual: `RETRYABLE_CODES.has(code)`.
#[must_use]
pub fn is_retryable_code(code: &str) -> bool {
    RETRYABLE_CODES.contains(&code)
}

/// Dual-oracle residual: client 4xx (status 400–499, excluding 0).
#[must_use]
pub fn is_client_error_code(code: &str) -> bool {
    matches!(
        error_code_status(code),
        Some(s) if (400..500).contains(&s)
    )
}

/// Dual-oracle residual: server 5xx.
#[must_use]
pub fn is_server_error_code(code: &str) -> bool {
    matches!(
        error_code_status(code),
        Some(s) if (500..600).contains(&s)
    )
}

/// Dual-oracle residual: transport/SDK non-HTTP codes (status 0).
#[must_use]
pub fn is_transport_error_code(code: &str) -> bool {
    matches!(error_code_status(code), Some(0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocked21_error_codes_dual_oracle() {
        assert_eq!(ERROR_CODES.len(), 18);
        assert_eq!(RETRYABLE_CODES.len(), 7);
        assert_eq!(error_code_status("BAD_REQUEST"), Some(400));
        assert_eq!(error_code_status("UNAUTHORIZED"), Some(401));
        assert_eq!(error_code_status("NOT_FOUND"), Some(404));
        assert_eq!(error_code_status("TOO_MANY_REQUESTS"), Some(429));
        assert_eq!(error_code_status("INTERNAL_SERVER_ERROR"), Some(500));
        assert_eq!(error_code_status("GATEWAY_TIMEOUT"), Some(504));
        assert_eq!(error_code_status("NETWORK_ERROR"), Some(0));
        assert_eq!(error_code_status("TIMEOUT"), Some(0));
        assert_eq!(error_code_status("UNKNOWN"), Some(0));
        assert_eq!(error_code_status("NOPE"), None);
        assert!(is_error_code("PARSE_ERROR"));
        assert!(!is_error_code("TEAPOT"));
        assert!(is_retryable_code("BAD_GATEWAY"));
        assert!(is_retryable_code("TOO_MANY_REQUESTS"));
        assert!(!is_retryable_code("UNAUTHORIZED"));
        assert!(is_client_error_code("FORBIDDEN"));
        assert!(is_server_error_code("SERVICE_UNAVAILABLE"));
        assert!(is_transport_error_code("ABORTED"));
        assert!(!is_client_error_code("NETWORK_ERROR"));
        // every catalog code resolves
        for c in ERROR_CODES {
            assert!(error_code_status(c).is_some());
        }
        for c in RETRYABLE_CODES {
            assert!(is_error_code(c));
            assert!(is_retryable_code(c));
        }
    }
}
