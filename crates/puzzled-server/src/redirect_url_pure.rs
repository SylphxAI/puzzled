//! Pure redirect URL residual —
//! dual-oracle of `packages/sdk/src/react/security-utils.ts` isValidRedirectUrl pure halves.
//!
//! window.location / browser I/O remain product residual.
//! NO authority_rust / ts_deleted invent.

/// Dual-oracle residual: dangerous URL protocols.
pub const DANGEROUS_PROTOCOLS: &[&str] = &["javascript:", "data:", "vbscript:", "file:"];

/// Dual-oracle residual: allowed absolute protocols.
pub const SAFE_ABSOLUTE_PROTOCOLS: &[&str] = &["http:", "https:"];

/// Dual-oracle residual: default platform URL (SDK constants).
pub const DEFAULT_PLATFORM_URL: &str = "https://sylphx.com";

/// Dual-oracle residual: env var names for platform URL.
pub const ENV_PLATFORM_URL: &str = "SYLPHX_PLATFORM_URL";
pub const ENV_PLATFORM_URL_LEGACY: &str = "SYLPHX_URL";
pub const ENV_SECRET_KEY: &str = "SYLPHX_SECRET_KEY";

/// Dual-oracle residual: control characters present (ASCII 0-31, DEL).
#[must_use]
pub fn has_control_characters(url: &str) -> bool {
    url.chars().any(|c| {
        let code = c as u32;
        code <= 31 || code == 127
    })
}

/// Dual-oracle residual: dangerous protocol prefix (case-insensitive).
#[must_use]
pub fn has_dangerous_protocol(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    DANGEROUS_PROTOCOLS.iter().any(|p| lower.starts_with(p))
}

/// Dual-oracle residual: relative path safe (`/` but not `//`).
#[must_use]
pub fn is_safe_relative_path(url: &str) -> bool {
    let t = url.trim();
    t.starts_with('/') && !t.starts_with("//")
}

/// Dual-oracle residual: empty/whitespace invalid.
#[must_use]
pub fn is_non_empty_url(url: &str) -> bool {
    !url.trim().is_empty()
}

/// Dual-oracle residual pure gate (relative + protocol halves; origin match residual separate).
#[must_use]
pub fn redirect_url_pure_gate(url: &str, allow_relative: bool) -> bool {
    if !is_non_empty_url(url) {
        return false;
    }
    let trimmed = url.trim();
    if has_control_characters(trimmed) {
        return false;
    }
    if has_dangerous_protocol(trimmed) {
        return false;
    }
    if allow_relative && is_safe_relative_path(trimmed) {
        return true;
    }
    // Absolute http(s) scheme presence pure half (full URL parse residual separate).
    let lower = trimmed.to_ascii_lowercase();
    SAFE_ABSOLUTE_PROTOCOLS.iter().any(|p| lower.starts_with(p))
}

/// Dual-oracle residual: resolve platform URL precedence (explicit > env > legacy > default).
#[must_use]
pub fn resolve_platform_url(
    explicit: Option<&str>,
    env_platform: Option<&str>,
    env_legacy: Option<&str>,
) -> String {
    explicit
        .or(env_platform)
        .or(env_legacy)
        .unwrap_or(DEFAULT_PLATFORM_URL)
        .trim()
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redirect_url_dual_oracle() {
        assert!(has_dangerous_protocol("javascript:alert(1)"));
        assert!(has_dangerous_protocol("DATA:text/html,x"));
        assert!(!has_dangerous_protocol("https://example.com"));
        assert!(has_control_characters("jav\0ascript:"));
        assert!(!has_control_characters("https://ok"));
        assert!(is_safe_relative_path("/dashboard"));
        assert!(!is_safe_relative_path("//evil.com"));
        assert!(!is_safe_relative_path("https://x"));
        assert!(redirect_url_pure_gate("/ok", true));
        assert!(!redirect_url_pure_gate("javascript:x", true));
        assert!(redirect_url_pure_gate("https://sylphx.com", false));
        assert!(!redirect_url_pure_gate("", true));
        assert_eq!(DEFAULT_PLATFORM_URL, "https://sylphx.com");
        assert_eq!(ENV_PLATFORM_URL, "SYLPHX_PLATFORM_URL");
        assert_eq!(
            resolve_platform_url(None, None, None),
            "https://sylphx.com"
        );
        assert_eq!(
            resolve_platform_url(Some(" https://a "), None, None),
            "https://a"
        );
        assert_eq!(
            resolve_platform_url(None, Some("https://b"), Some("https://c")),
            "https://b"
        );
    }
}
