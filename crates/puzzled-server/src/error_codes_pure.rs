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

// ── wave69 pure residual dens: error code status ladder dual-oracle residual ──
// Dual-oracle residual of ERROR_CODES status/http pure half.
// Tracker / network flush I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: catalog sizes (all, retryable).
#[must_use]
pub fn error_catalog_size_shell() -> (usize, usize) {
    (ERROR_CODES.len(), RETRYABLE_CODES.len())
}

/// Dual-oracle residual: client 4xx status ladder.
#[must_use]
pub fn client_error_status_ladder() -> [u16; 6] {
    [
        error_code_status("BAD_REQUEST").unwrap_or(0),
        error_code_status("UNAUTHORIZED").unwrap_or(0),
        error_code_status("FORBIDDEN").unwrap_or(0),
        error_code_status("NOT_FOUND").unwrap_or(0),
        error_code_status("CONFLICT").unwrap_or(0),
        error_code_status("TOO_MANY_REQUESTS").unwrap_or(0),
    ]
}

/// Dual-oracle residual: server 5xx status ladder.
#[must_use]
pub fn server_error_status_ladder() -> [u16; 5] {
    [
        error_code_status("INTERNAL_SERVER_ERROR").unwrap_or(0),
        error_code_status("NOT_IMPLEMENTED").unwrap_or(0),
        error_code_status("BAD_GATEWAY").unwrap_or(0),
        error_code_status("SERVICE_UNAVAILABLE").unwrap_or(0),
        error_code_status("GATEWAY_TIMEOUT").unwrap_or(0),
    ]
}

/// Dual-oracle residual: transport codes all map to 0.
#[must_use]
pub fn transport_codes_status_zero() -> bool {
    ["NETWORK_ERROR", "TIMEOUT", "ABORTED", "PARSE_ERROR", "UNKNOWN"]
        .iter()
        .all(|c| error_code_status(c) == Some(0) && is_transport_error_code(c))
}

/// Dual-oracle residual: every retryable is known and subset of catalog.
#[must_use]
pub fn retryable_subset_of_catalog() -> bool {
    RETRYABLE_CODES.iter().all(|c| is_error_code(c) && is_retryable_code(c))
}

/// Dual-oracle residual: class probes.
#[must_use]
pub fn error_class_probes_ok() -> bool {
    is_client_error_code("FORBIDDEN")
        && is_server_error_code("SERVICE_UNAVAILABLE")
        && is_transport_error_code("ABORTED")
        && !is_client_error_code("NETWORK_ERROR")
        && !is_retryable_code("UNAUTHORIZED")
}

#[cfg(test)]
mod wave69_tests {
    use super::*;

    #[test]
    fn wave69_error_code_status_ladder_dual_oracle() {
        assert_eq!(error_catalog_size_shell(), (18, 7));
        assert_eq!(
            client_error_status_ladder(),
            [400, 401, 403, 404, 409, 429]
        );
        assert_eq!(
            server_error_status_ladder(),
            [500, 501, 502, 503, 504]
        );
        assert!(transport_codes_status_zero());
        assert!(retryable_subset_of_catalog());
        assert!(error_class_probes_ok());
        assert_eq!(error_code_status("NOPE"), None);
        assert!(!is_error_code("TEAPOT"));
    }
}



// ── wave70 pure residual dens: error class partition dual-oracle residual ──
// Dual-oracle residual of ERROR_CODES client/server/transport partition pure half.
// Tracker / network flush I/O residual retained. dens ≠ flip.
// product residual dens wave70

/// Dual-oracle residual: extra client statuses (413/422).
#[must_use]
pub fn extra_client_status_ladder() -> [u16; 2] {
    [
        error_code_status("PAYLOAD_TOO_LARGE").unwrap_or(0),
        error_code_status("UNPROCESSABLE_ENTITY").unwrap_or(0),
    ]
}

/// Dual-oracle residual: retryable includes transport + 5xx subset.
#[must_use]
pub fn retryable_includes_transport_and_gateway() -> bool {
    is_retryable_code("NETWORK_ERROR")
        && is_retryable_code("TIMEOUT")
        && is_retryable_code("BAD_GATEWAY")
        && is_retryable_code("GATEWAY_TIMEOUT")
        && !is_retryable_code("NOT_FOUND")
}

/// Dual-oracle residual: client count among catalog (status 400-499).
#[must_use]
pub fn client_error_code_count() -> usize {
    ERROR_CODES.iter().filter(|c| is_client_error_code(c)).count()
}

/// Dual-oracle residual: server count among catalog.
#[must_use]
pub fn server_error_code_count() -> usize {
    ERROR_CODES.iter().filter(|c| is_server_error_code(c)).count()
}

/// Dual-oracle residual: transport count among catalog.
#[must_use]
pub fn transport_error_code_count() -> usize {
    ERROR_CODES.iter().filter(|c| is_transport_error_code(c)).count()
}

/// Dual-oracle residual: partition covers full catalog.
#[must_use]
pub fn partition_covers_catalog() -> bool {
    client_error_code_count() + server_error_code_count() + transport_error_code_count()
        == ERROR_CODES.len()
}

#[cfg(test)]
mod wave70_tests {
    use super::*;

    #[test]
    fn wave70_error_class_partition_dual_oracle() {
        assert_eq!(extra_client_status_ladder(), [413, 422]);
        assert!(retryable_includes_transport_and_gateway());
        assert_eq!(client_error_code_count(), 8);
        assert_eq!(server_error_code_count(), 5);
        assert_eq!(transport_error_code_count(), 5);
        assert!(partition_covers_catalog());
        assert_eq!(error_catalog_size_shell(), (18, 7));
        assert!(transport_codes_status_zero());
        assert!(retryable_subset_of_catalog());
        assert!(error_class_probes_ok());
    }
}
