//! Pure user-profile validation limits —
//! dual-oracle residual of `apps/puzzled/src/lib/config/user.ts` (`USER_LIMITS`).
//! Distinct from `validation_limits_pure` field bounds (USERNAME_MAX 30 / BIO 500).
//! Zod/DB I/O stays FE-TS. NO authority_rust / ts_deleted.

/// TS `USER_LIMITS.USERNAME_MIN_LENGTH`
pub const USERNAME_MIN_LENGTH: usize = 3;
/// TS `USER_LIMITS.USERNAME_MAX_LENGTH` (profile surface — 20, not validation 30).
pub const USERNAME_MAX_LENGTH: usize = 20;
/// TS `USER_LIMITS.BIO_MAX_LENGTH`
pub const BIO_MAX_LENGTH: usize = 160;
/// TS `USER_LIMITS.NAME_MAX_LENGTH`
pub const NAME_MAX_LENGTH: usize = 100;

/// Username length gate for profile form (TS USER_LIMITS).
#[must_use]
pub fn is_valid_profile_username_len(name: &str) -> bool {
    let len = name.chars().count();
    (USERNAME_MIN_LENGTH..=USERNAME_MAX_LENGTH).contains(&len)
}

/// Bio length gate.
#[must_use]
pub fn is_valid_profile_bio_len(bio: &str) -> bool {
    bio.chars().count() <= BIO_MAX_LENGTH
}

/// Display name length gate.
#[must_use]
pub fn is_valid_profile_name_len(name: &str) -> bool {
    name.chars().count() <= NAME_MAX_LENGTH
}

/// Clamp bio to max length (char-aware).
#[must_use]
pub fn clamp_bio(bio: &str) -> String {
    bio.chars().take(BIO_MAX_LENGTH).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_limits_table() {
        assert_eq!(USERNAME_MIN_LENGTH, 3);
        assert_eq!(USERNAME_MAX_LENGTH, 20);
        assert_eq!(BIO_MAX_LENGTH, 160);
        assert_eq!(NAME_MAX_LENGTH, 100);
        // Distinct from validation_limits_pure USERNAME_MAX=30 / BIO_MAX=500.
        assert!(is_valid_profile_username_len("abc"));
        assert!(is_valid_profile_username_len(&"x".repeat(20)));
        assert!(!is_valid_profile_username_len("ab"));
        assert!(!is_valid_profile_username_len(&"x".repeat(21)));
        assert!(is_valid_profile_bio_len(&"b".repeat(160)));
        assert!(!is_valid_profile_bio_len(&"b".repeat(161)));
        assert!(is_valid_profile_name_len(&"n".repeat(100)));
        assert!(!is_valid_profile_name_len(&"n".repeat(101)));
        assert_eq!(clamp_bio(&"z".repeat(200)).chars().count(), 160);
    }
}
