//! Pure redirect-security residual —
//! dual-oracle of `packages/sdk/src/react/security-utils.ts` pure halves.
//!
//! `window.location` / browser redirect I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: dangerous URL protocols blocked for redirects.
pub const DANGEROUS_REDIRECT_PROTOCOLS: &[&str] = &["javascript:", "data:", "vbscript:", "file:"];

/// Dual-oracle residual: safe redirect fallback path.
pub const SAFE_REDIRECT_FALLBACK: &str = "/";

/// Dual-oracle residual: default allowRelative flag.
#[must_use]
pub fn redirect_allow_relative_default() -> bool {
    true
}

/// Dual-oracle residual: control characters (ASCII 0-31 + DEL 127).
#[must_use]
pub fn has_control_characters(url: &str) -> bool {
    url.chars().any(|c| {
        let u = c as u32;
        u <= 0x1f || u == 0x7f
    })
}

/// Dual-oracle residual: dangerous protocol prefix (case-insensitive start).
#[must_use]
pub fn has_dangerous_protocol(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    DANGEROUS_REDIRECT_PROTOCOLS
        .iter()
        .any(|p| lower.starts_with(p))
}

/// Dual-oracle residual: relative path safe form (`/` but not `//`).
#[must_use]
pub fn is_safe_relative_path(url: &str) -> bool {
    url.starts_with('/') && !url.starts_with("//")
}

/// Dual-oracle residual pure gate used by isValidRedirectUrl before URL parse.
///
/// Returns `Some(true/false)` when pure rules decide; `None` means host must
/// parse absolute URL + same-origin / allowlist (product residual).
#[must_use]
pub fn redirect_pure_decision(url: &str, allow_relative: bool) -> Option<bool> {
    if url.trim().is_empty() {
        return Some(false);
    }
    let trimmed = url.trim();
    if has_control_characters(trimmed) {
        return Some(false);
    }
    if has_dangerous_protocol(trimmed) {
        return Some(false);
    }
    if allow_relative && is_safe_relative_path(trimmed) {
        return Some(true);
    }
    None
}

/// Dual-oracle residual: sanitizeUrl early rejects.
///
/// Returns `Some(Ok(path))` for safe relative, `Some(Err(()))` for hard reject,
/// `None` when absolute URL parse is required (host residual).
#[must_use]
pub fn sanitize_url_pure_decision(url: &str) -> Option<Result<String, ()>> {
    if url.trim().is_empty() {
        return Some(Err(()));
    }
    let trimmed = url.trim();
    if has_control_characters(trimmed) {
        return Some(Err(()));
    }
    if has_dangerous_protocol(trimmed) {
        return Some(Err(()));
    }
    if is_safe_relative_path(trimmed) {
        return Some(Ok(trimmed.to_string()));
    }
    // Relative without leading `/` and no scheme → prefix `/` (TS sanitizeUrl).
    if !trimmed.contains(':') {
        return Some(Ok(format!("/{trimmed}")));
    }
    None
}

/// Dual-oracle residual: only http/https protocols allowed for absolute URLs.
#[must_use]
pub fn is_allowed_absolute_protocol(protocol: &str) -> bool {
    matches!(protocol, "http:" | "https:")
}

/// Dual-oracle residual: same-origin OR allowlist membership.
#[must_use]
pub fn origin_allowed(parsed_origin: &str, current_origin: &str, allowed: &[&str]) -> bool {
    if parsed_origin == current_origin {
        return true;
    }
    allowed.contains(&parsed_origin)
}

/// Dual-oracle residual: resolve redirect target or fallback.
#[must_use]
pub fn resolve_safe_redirect_target(valid: bool, url: &str, fallback: &str) -> String {
    if valid {
        url.to_string()
    } else {
        fallback.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocked16_redirect_security_dual_oracle() {
        assert_eq!(DANGEROUS_REDIRECT_PROTOCOLS.len(), 4);
        assert!(has_dangerous_protocol("javascript:alert(1)"));
        assert!(has_dangerous_protocol("DATA:text/html,hi"));
        assert!(has_dangerous_protocol("vbscript:msg"));
        assert!(has_dangerous_protocol("file:///etc/passwd"));
        assert!(!has_dangerous_protocol("https://example.com"));

        assert!(has_control_characters("jav\u{0000}ascript:"));
        assert!(has_control_characters("a\u{007f}b"));
        assert!(!has_control_characters("/safe"));

        assert!(is_safe_relative_path("/dashboard"));
        assert!(!is_safe_relative_path("//evil.com"));
        assert!(!is_safe_relative_path("https://x"));

        assert_eq!(redirect_pure_decision("", true), Some(false));
        assert_eq!(redirect_pure_decision("   ", true), Some(false));
        assert_eq!(redirect_pure_decision("javascript:x", true), Some(false));
        assert_eq!(redirect_pure_decision("/ok", true), Some(true));
        assert_eq!(redirect_pure_decision("/ok", false), None);
        assert_eq!(redirect_pure_decision("https://a.com", true), None);

        assert_eq!(
            sanitize_url_pure_decision("/settings"),
            Some(Ok("/settings".into()))
        );
        assert_eq!(sanitize_url_pure_decision("javascript:x"), Some(Err(())));
        assert_eq!(sanitize_url_pure_decision(""), Some(Err(())));
        assert_eq!(
            sanitize_url_pure_decision("relative-page"),
            Some(Ok("/relative-page".into()))
        );
        assert_eq!(sanitize_url_pure_decision("https://ok.example"), None);

        assert!(is_allowed_absolute_protocol("https:"));
        assert!(is_allowed_absolute_protocol("http:"));
        assert!(!is_allowed_absolute_protocol("ftp:"));

        assert!(origin_allowed("https://a.com", "https://a.com", &[]));
        assert!(origin_allowed(
            "https://oauth.com",
            "https://a.com",
            &["https://oauth.com"]
        ));
        assert!(!origin_allowed("https://evil.com", "https://a.com", &[]));

        assert_eq!(
            resolve_safe_redirect_target(true, "/x", SAFE_REDIRECT_FALLBACK),
            "/x"
        );
        assert_eq!(
            resolve_safe_redirect_target(false, "javascript:x", SAFE_REDIRECT_FALLBACK),
            "/"
        );
        assert!(redirect_allow_relative_default());
    }
}
