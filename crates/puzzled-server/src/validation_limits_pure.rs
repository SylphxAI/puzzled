//! Pure validation limits + pagination/referral helpers —
//! dual-oracle residual of `apps/puzzled/src/lib/config/validation.ts`.
//! Zod/runtime I/O stays FE-TS. NO authority_rust / ts_deleted.

/// User-facing pagination defaults (TS `PAGINATION`).
pub const DEFAULT_LIMIT: u32 = 10;
pub const MAX_LIMIT: u32 = 50;
pub const ADMIN_MAX_LIMIT: u32 = 100;
pub const ADMIN_DEFAULT_LIMIT: u32 = 50;

/// Referral code bounds (TS `REFERRAL_CONFIG`).
pub const REFERRAL_CODE_MIN: usize = 5;
pub const REFERRAL_CODE_MAX: usize = 20;

/// Field size limits (TS `_FIELD_LIMITS`).
pub const NAME_MAX: usize = 100;
pub const DESCRIPTION_MAX: usize = 500;
pub const TITLE_MAX: usize = 200;
pub const CONTENT_MAX: usize = 2000;
pub const USERNAME_MIN: usize = 3;
pub const USERNAME_MAX: usize = 30;
pub const BIO_MAX: usize = 500;

/// OTP / avatar / batch (TS `_OTP_CONFIG` / `_FILE_LIMITS` / `_BATCH_LIMITS`).
pub const OTP_CODE_LENGTH: usize = 6;
pub const OTP_EXPIRY_MINUTES: u32 = 10;
pub const AVATAR_MAX_SIZE: u64 = 5 * 1024 * 1024;
pub const MAX_BATCH_SIZE: u32 = 100;

/// Currency (TS `CURRENCY_CONFIG`).
pub const DEFAULT_CURRENCY: &str = "usd";
pub const CURRENCY_CODE_LENGTH: usize = 3;

/// Clamp user-facing limit to `[1, MAX_LIMIT]` with default when None.
#[must_use]
pub fn clamp_user_limit(limit: Option<u32>) -> u32 {
    let v = limit.unwrap_or(DEFAULT_LIMIT);
    v.clamp(1, MAX_LIMIT)
}

/// Clamp admin limit to `[1, ADMIN_MAX_LIMIT]` with admin default when None.
#[must_use]
pub fn clamp_admin_limit(limit: Option<u32>) -> u32 {
    let v = limit.unwrap_or(ADMIN_DEFAULT_LIMIT);
    v.clamp(1, ADMIN_MAX_LIMIT)
}

/// Clamp offset to ≥ 0 (u32 already non-negative; None → 0).
#[must_use]
pub fn clamp_offset(offset: Option<u32>) -> u32 {
    offset.unwrap_or(0)
}

/// Referral code charset: A–Z / a–z / 0–9 (TS `/^[A-Z0-9]+$/i`).
#[must_use]
pub fn is_referral_char(c: char) -> bool {
    c.is_ascii_alphanumeric()
}

/// Validate referral code length + charset (TS schema pure checks).
#[must_use]
pub fn is_valid_referral_code(code: &str) -> bool {
    let len = code.len();
    if !(REFERRAL_CODE_MIN..=REFERRAL_CODE_MAX).contains(&len) {
        return false;
    }
    code.chars().all(is_referral_char)
}

/// Validate username length bounds (TS USERNAME_MIN/MAX).
#[must_use]
pub fn is_valid_username_len(name: &str) -> bool {
    let len = name.chars().count();
    (USERNAME_MIN..=USERNAME_MAX).contains(&len)
}

/// Validate currency code length + defaulting pure shape.
#[must_use]
pub fn normalize_currency(code: Option<&str>) -> String {
    match code {
        Some(c) if c.len() == CURRENCY_CODE_LENGTH => c.to_ascii_lowercase(),
        _ => DEFAULT_CURRENCY.to_string(),
    }
}

/// Avatar MIME allowlist (TS `AVATAR_ALLOWED_TYPES`).
#[must_use]
pub fn is_allowed_avatar_mime(mime: &str) -> bool {
    matches!(
        mime,
        "image/jpeg" | "image/png" | "image/webp" | "image/gif"
    )
}

/// Avatar size gate.
#[must_use]
pub fn is_avatar_size_ok(bytes: u64) -> bool {
    bytes > 0 && bytes <= AVATAR_MAX_SIZE
}

/// Batch size gate.
#[must_use]
pub fn is_batch_size_ok(n: u32) -> bool {
    n > 0 && n <= MAX_BATCH_SIZE
}

/// Field length ≤ max (char count).
#[must_use]
pub fn field_len_ok(s: &str, max: usize) -> bool {
    s.chars().count() <= max
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pagination_clamps() {
        assert_eq!(clamp_user_limit(None), 10);
        assert_eq!(clamp_user_limit(Some(0)), 1);
        assert_eq!(clamp_user_limit(Some(25)), 25);
        assert_eq!(clamp_user_limit(Some(999)), 50);
        assert_eq!(clamp_admin_limit(None), 50);
        assert_eq!(clamp_admin_limit(Some(0)), 1);
        assert_eq!(clamp_admin_limit(Some(80)), 80);
        assert_eq!(clamp_admin_limit(Some(500)), 100);
        assert_eq!(clamp_offset(None), 0);
        assert_eq!(clamp_offset(Some(3)), 3);
    }

    #[test]
    fn referral_and_username() {
        assert!(!is_valid_referral_code("ab")); // too short
        assert!(is_valid_referral_code("ABCDE"));
        assert!(is_valid_referral_code("abc123XYZ"));
        assert!(!is_valid_referral_code("bad-code"));
        assert!(!is_valid_referral_code(&"A".repeat(21)));
        assert!(!is_valid_username_len("ab"));
        assert!(is_valid_username_len("abc"));
        assert!(is_valid_username_len(&"a".repeat(30)));
        assert!(!is_valid_username_len(&"a".repeat(31)));
    }

    #[test]
    fn currency_avatar_batch_fields() {
        assert_eq!(normalize_currency(None), "usd");
        assert_eq!(normalize_currency(Some("USD")), "usd");
        assert_eq!(normalize_currency(Some("eu")), "usd"); // wrong length → default
        assert!(is_allowed_avatar_mime("image/png"));
        assert!(!is_allowed_avatar_mime("image/svg+xml"));
        assert!(is_avatar_size_ok(1024));
        assert!(!is_avatar_size_ok(0));
        assert!(!is_avatar_size_ok(AVATAR_MAX_SIZE + 1));
        assert!(is_batch_size_ok(100));
        assert!(!is_batch_size_ok(0));
        assert!(!is_batch_size_ok(101));
        assert!(field_len_ok("hi", NAME_MAX));
        assert!(!field_len_ok(&"x".repeat(NAME_MAX + 1), NAME_MAX));
        assert_eq!(OTP_CODE_LENGTH, 6);
        assert_eq!(OTP_EXPIRY_MINUTES, 10);
        assert_eq!(DESCRIPTION_MAX, 500);
        assert_eq!(TITLE_MAX, 200);
        assert_eq!(CONTENT_MAX, 2000);
        assert_eq!(BIO_MAX, 500);
    }
}
