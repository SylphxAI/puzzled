//! Pure app-wide config constants —
//! dual-oracle residual of `apps/puzzled/src/lib/config/app.ts`.
//! Env/runtime I/O stays FE-TS. NO authority_rust / ts_deleted.

/// Application name (TS `APP_NAME`).
pub const APP_NAME: &str = "Puzzled";

/// Application domain without protocol (TS `APP_DOMAIN`).
pub const APP_DOMAIN: &str = "puzzled.gg";

/// Support email (TS `SUPPORT_EMAIL`).
pub const SUPPORT_EMAIL: &str = "support@puzzled.gg";

/// Legal email (TS `LEGAL_EMAIL`).
pub const LEGAL_EMAIL: &str = "legal@puzzled.gg";

/// Privacy email (TS `PRIVACY_EMAIL`).
pub const PRIVACY_EMAIL: &str = "privacy@puzzled.gg";

/// Default from email (TS `_DEFAULT_FROM_EMAIL`).
pub const DEFAULT_FROM_EMAIL: &str = "hello@puzzled.gg";

/// Build `name@domain` address (pure dual-oracle of template literals).
#[must_use]
pub fn email_at_domain(local: &str) -> String {
    format!("{local}@{APP_DOMAIN}")
}

/// Validate known app emails by exact match.
#[must_use]
pub fn is_known_app_email(email: &str) -> bool {
    matches!(
        email,
        SUPPORT_EMAIL | LEGAL_EMAIL | PRIVACY_EMAIL | DEFAULT_FROM_EMAIL
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_constants_dual_oracle() {
        assert_eq!(APP_NAME, "Puzzled");
        assert_eq!(APP_DOMAIN, "puzzled.gg");
        assert_eq!(SUPPORT_EMAIL, "support@puzzled.gg");
        assert_eq!(LEGAL_EMAIL, "legal@puzzled.gg");
        assert_eq!(PRIVACY_EMAIL, "privacy@puzzled.gg");
        assert_eq!(DEFAULT_FROM_EMAIL, "hello@puzzled.gg");
        assert_eq!(email_at_domain("support"), SUPPORT_EMAIL);
        assert!(is_known_app_email(SUPPORT_EMAIL));
        assert!(!is_known_app_email("other@example.com"));
    }
}
