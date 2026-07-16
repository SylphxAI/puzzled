//! Pure session-replay privacy residual —
//! dual-oracle of `packages/sdk/src/lib/monitoring/session-replay/privacy.ts`
//! sensitive-param / input-type pure halves.
//!
//! DOM / rrweb I/O remains product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle of sensitive URL query param names redacted by `sanitizeUrl`.
pub const SENSITIVE_URL_PARAMS: &[&str] = &[
    "token", "key", "password", "secret", "auth", "api_key", "apikey",
];

/// Dual-oracle of `SENSITIVE_INPUT_TYPES`.
pub const SENSITIVE_INPUT_TYPES: &[&str] = &["password", "tel", "email"];

/// Dual-oracle residual: sensitive autocomplete tokens (subset used for pure gate).
pub const SENSITIVE_AUTOCOMPLETE: &[&str] = &[
    "cc-name",
    "cc-number",
    "cc-exp",
    "cc-exp-month",
    "cc-exp-year",
    "cc-csc",
    "cc-type",
    "new-password",
    "current-password",
    "one-time-code",
    "tel",
    "tel-country-code",
    "tel-national",
    "email",
];

/// Dual-oracle residual: sensitivity categories closed set.
pub const SENSITIVITY_CATEGORIES: &[&str] = &[
    "password",
    "financial",
    "identity",
    "personal",
    "health",
    "authentication",
];

/// Dual-oracle: URL query key is sensitive (case-sensitive match as product).
#[must_use]
pub fn is_sensitive_url_param(name: &str) -> bool {
    SENSITIVE_URL_PARAMS.contains(&name)
}

/// Dual-oracle: HTML input type always masked.
#[must_use]
pub fn is_sensitive_input_type(ty: &str) -> bool {
    SENSITIVE_INPUT_TYPES.contains(&ty)
}

/// Dual-oracle: autocomplete value indicates sensitive data.
#[must_use]
pub fn is_sensitive_autocomplete(value: &str) -> bool {
    SENSITIVE_AUTOCOMPLETE.contains(&value)
}

/// Dual-oracle residual: redact sensitive query params from a query string map.
/// Returns list of (key, value) with sensitive values replaced by `[REDACTED]`.
#[must_use]
pub fn redact_query_params(params: &[(&str, &str)]) -> Vec<(String, String)> {
    params
        .iter()
        .map(|(k, v)| {
            if is_sensitive_url_param(k) {
                ((*k).to_string(), "[REDACTED]".to_string())
            } else {
                ((*k).to_string(), (*v).to_string())
            }
        })
        .collect()
}

/// Dual-oracle residual honesty: email redaction label used by sanitizeForLogging.
pub const EMAIL_REDACTED: &str = "[EMAIL_REDACTED]";
/// Dual-oracle residual honesty: phone redaction label.
pub const PHONE_REDACTED: &str = "[PHONE_REDACTED]";
/// Dual-oracle residual honesty: card redaction label.
pub const CARD_REDACTED: &str = "[CARD_REDACTED]";
/// Dual-oracle residual honesty: SSN redaction label.
pub const SSN_REDACTED: &str = "[SSN_REDACTED]";
/// Dual-oracle residual honesty: IP redaction label.
pub const IP_REDACTED: &str = "[IP_REDACTED]";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn privacy_sanitize_dual_oracle() {
        assert!(is_sensitive_url_param("token"));
        assert!(is_sensitive_url_param("api_key"));
        assert!(!is_sensitive_url_param("utm_source"));
        assert!(is_sensitive_input_type("password"));
        assert!(is_sensitive_input_type("email"));
        assert!(!is_sensitive_input_type("text"));
        assert!(is_sensitive_autocomplete("cc-number"));
        assert!(!is_sensitive_autocomplete("username"));
        assert_eq!(SENSITIVITY_CATEGORIES.len(), 6);
        let redacted = redact_query_params(&[("token", "abc"), ("q", "x")]);
        assert_eq!(redacted[0].1, "[REDACTED]");
        assert_eq!(redacted[1].1, "x");
        assert_eq!(EMAIL_REDACTED, "[EMAIL_REDACTED]");
        assert_eq!(CARD_REDACTED, "[CARD_REDACTED]");
    }
}
