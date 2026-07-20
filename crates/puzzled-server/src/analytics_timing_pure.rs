//! Pure analytics + auth timing residual —
//! dual-oracle of `packages/sdk/src/constants.ts`
//! ANALYTICS_* / DEFAULT_TIMEOUT_MS / TOKEN_* / FLAGS_STREAM_* pure halves
//! beyond jobs retry + session-replay modules already migrated.
//!
//! Tracker / network flush I/O remains product residual.
//! NO authority_rust / ts_deleted invent. pure residual ≠ authority flip. PreferRust OFF.

/// Dual-oracle residual: default request timeout ms.
pub const DEFAULT_TIMEOUT_MS: u64 = 30_000;
/// Dual-oracle residual: token expiry buffer ms.
pub const TOKEN_EXPIRY_BUFFER_MS: u64 = 30_000;
/// Dual-oracle residual: session token lifetime seconds (5 minutes).
pub const SESSION_TOKEN_LIFETIME_SECONDS: u64 = 5 * 60;
/// Dual-oracle residual: session token lifetime ms.
pub const SESSION_TOKEN_LIFETIME_MS: u64 = SESSION_TOKEN_LIFETIME_SECONDS * 1000;
/// Dual-oracle residual: refresh token lifetime seconds (30 days).
pub const REFRESH_TOKEN_LIFETIME_SECONDS: u64 = 30 * 24 * 60 * 60;

/// Dual-oracle residual: max retries for network requests.
pub const MAX_RETRIES: u32 = 3;

/// Dual-oracle residual: analytics session timeout ms (30 minutes).
pub const ANALYTICS_SESSION_TIMEOUT_MS: u64 = 30 * 60 * 1000;
/// Dual-oracle residual: analytics flush interval ms.
pub const ANALYTICS_FLUSH_INTERVAL_MS: u64 = 5_000;
/// Dual-oracle residual: analytics max text length.
pub const ANALYTICS_MAX_TEXT_LENGTH: u32 = 100;
/// Dual-oracle residual: analytics flush timeout ms.
pub const ANALYTICS_FLUSH_TIMEOUT_MS: u64 = 1_000;
/// Dual-oracle residual: analytics interval check ms.
pub const ANALYTICS_INTERVAL_CHECK_MS: u64 = 1_000;
/// Dual-oracle residual: analytics retry base delay ms.
pub const ANALYTICS_RETRY_BASE_DELAY_MS: u64 = 1_000;
/// Dual-oracle residual: analytics retry max delay ms.
pub const ANALYTICS_RETRY_MAX_DELAY_MS: u64 = 30_000;
/// Dual-oracle residual: analytics retry jitter factor.
pub const ANALYTICS_RETRY_JITTER: f64 = 0.2;
/// Dual-oracle residual: analytics max retries before drop.
pub const ANALYTICS_MAX_RETRIES: u32 = 10;

/// Dual-oracle residual: flags stream initial reconnect ms.
pub const FLAGS_STREAM_INITIAL_RECONNECT_MS: u64 = 1_000;
/// Dual-oracle residual: flags stream max reconnect ms.
pub const FLAGS_STREAM_MAX_RECONNECT_MS: u64 = 30_000;
/// Dual-oracle residual: flags stream heartbeat timeout ms.
pub const FLAGS_STREAM_HEARTBEAT_TIMEOUT_MS: u64 = 45_000;
/// Dual-oracle residual: flags HTTP polling interval ms.
pub const FLAGS_HTTP_POLLING_INTERVAL_MS: u64 = 60_000;
/// Dual-oracle residual: flags exposure dedupe window ms (1 hour).
pub const FLAGS_EXPOSURE_DEDUPE_WINDOW_MS: u64 = 60 * 60 * 1000;

/// Dual-oracle residual: webhook max age ms.
pub const WEBHOOK_MAX_AGE_MS: u64 = 5 * 60 * 1000;
/// Dual-oracle residual: webhook clock skew ms.
pub const WEBHOOK_CLOCK_SKEW_MS: u64 = 30 * 1000;
/// Dual-oracle residual: PKCE code TTL ms.
pub const PKCE_CODE_TTL_MS: u64 = 10 * 60 * 1000;

/// Dual-oracle residual: session token lifetime is 5 minutes.
#[must_use]
pub fn session_token_is_five_minutes() -> bool {
    SESSION_TOKEN_LIFETIME_SECONDS == 300 && SESSION_TOKEN_LIFETIME_MS == 300_000
}

/// Dual-oracle residual: analytics retry base ≤ max delay.
#[must_use]
pub fn analytics_retry_bounds_sane() -> bool {
    ANALYTICS_RETRY_BASE_DELAY_MS <= ANALYTICS_RETRY_MAX_DELAY_MS
}

/// Dual-oracle residual: flags stream initial < max reconnect.
#[must_use]
pub fn flags_stream_reconnect_sane() -> bool {
    FLAGS_STREAM_INITIAL_RECONNECT_MS < FLAGS_STREAM_MAX_RECONNECT_MS
}

/// Dual-oracle residual: analytics flush interval equals session-replay upload (5s).
#[must_use]
pub fn analytics_flush_is_five_seconds() -> bool {
    ANALYTICS_FLUSH_INTERVAL_MS == 5_000
}

/// Dual-oracle residual: known analytics timing constant membership helper.
#[must_use]
pub fn is_positive_analytics_ms(ms: u64) -> bool {
    ms > 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocked24_analytics_timing_dual_oracle() {
        assert_eq!(DEFAULT_TIMEOUT_MS, 30_000);
        assert_eq!(TOKEN_EXPIRY_BUFFER_MS, 30_000);
        assert_eq!(SESSION_TOKEN_LIFETIME_SECONDS, 300);
        assert_eq!(SESSION_TOKEN_LIFETIME_MS, 300_000);
        assert_eq!(REFRESH_TOKEN_LIFETIME_SECONDS, 2_592_000);
        assert_eq!(MAX_RETRIES, 3);

        assert_eq!(ANALYTICS_SESSION_TIMEOUT_MS, 1_800_000);
        assert_eq!(ANALYTICS_FLUSH_INTERVAL_MS, 5_000);
        assert_eq!(ANALYTICS_MAX_TEXT_LENGTH, 100);
        assert_eq!(ANALYTICS_FLUSH_TIMEOUT_MS, 1_000);
        assert_eq!(ANALYTICS_INTERVAL_CHECK_MS, 1_000);
        assert_eq!(ANALYTICS_RETRY_BASE_DELAY_MS, 1_000);
        assert_eq!(ANALYTICS_RETRY_MAX_DELAY_MS, 30_000);
        assert!((ANALYTICS_RETRY_JITTER - 0.2).abs() < 1e-12);
        assert_eq!(ANALYTICS_MAX_RETRIES, 10);

        assert_eq!(FLAGS_STREAM_INITIAL_RECONNECT_MS, 1_000);
        assert_eq!(FLAGS_STREAM_MAX_RECONNECT_MS, 30_000);
        assert_eq!(FLAGS_STREAM_HEARTBEAT_TIMEOUT_MS, 45_000);
        assert_eq!(FLAGS_HTTP_POLLING_INTERVAL_MS, 60_000);
        assert_eq!(FLAGS_EXPOSURE_DEDUPE_WINDOW_MS, 3_600_000);

        assert_eq!(WEBHOOK_MAX_AGE_MS, 300_000);
        assert_eq!(WEBHOOK_CLOCK_SKEW_MS, 30_000);
        assert_eq!(PKCE_CODE_TTL_MS, 600_000);

        assert!(session_token_is_five_minutes());
        assert!(analytics_retry_bounds_sane());
        assert!(flags_stream_reconnect_sane());
        assert!(analytics_flush_is_five_seconds());
        assert!(is_positive_analytics_ms(ANALYTICS_FLUSH_INTERVAL_MS));
        assert!(!is_positive_analytics_ms(0));
    }
}

// ── wave66 pure residual unit: auth/analytics/flags timing ladder dual-oracle residual ──
// Dual-oracle residual of packages/sdk constants.ts timing pure halves.
// Tracker / network flush I/O residual retained. pure residual ≠ authority flip.

/// Dual-oracle residual: session token lifetime shell (seconds, ms).
#[must_use]
pub fn session_token_lifetime_shell() -> (u64, u64) {
    (SESSION_TOKEN_LIFETIME_SECONDS, SESSION_TOKEN_LIFETIME_MS)
}

/// Dual-oracle residual: refresh token is 30 days.
#[must_use]
pub fn refresh_token_is_thirty_days() -> bool {
    REFRESH_TOKEN_LIFETIME_SECONDS == 30 * 24 * 60 * 60
}

/// Dual-oracle residual: analytics timing ladder (flush, timeout, check, retry base/max).
#[must_use]
pub fn analytics_timing_ladder() -> [u64; 5] {
    [
        ANALYTICS_FLUSH_INTERVAL_MS,
        ANALYTICS_FLUSH_TIMEOUT_MS,
        ANALYTICS_INTERVAL_CHECK_MS,
        ANALYTICS_RETRY_BASE_DELAY_MS,
        ANALYTICS_RETRY_MAX_DELAY_MS,
    ]
}

/// Dual-oracle residual: flags stream reconnect ladder (initial, max, heartbeat).
#[must_use]
pub fn flags_stream_timing_ladder() -> [u64; 3] {
    [
        FLAGS_STREAM_INITIAL_RECONNECT_MS,
        FLAGS_STREAM_MAX_RECONNECT_MS,
        FLAGS_STREAM_HEARTBEAT_TIMEOUT_MS,
    ]
}

/// Dual-oracle residual: webhook age/skew + PKCE TTL shell.
#[must_use]
pub fn webhook_pkce_timing_shell() -> (u64, u64, u64) {
    (WEBHOOK_MAX_AGE_MS, WEBHOOK_CLOCK_SKEW_MS, PKCE_CODE_TTL_MS)
}

/// Dual-oracle residual: default timeout equals token expiry buffer (30s).
#[must_use]
pub fn default_timeout_equals_token_buffer() -> bool {
    DEFAULT_TIMEOUT_MS == TOKEN_EXPIRY_BUFFER_MS && DEFAULT_TIMEOUT_MS == 30_000
}

#[cfg(test)]
mod wave66_tests {
    use super::*;

    #[test]
    fn wave66_auth_analytics_flags_timing_dual_oracle() {
        assert_eq!(session_token_lifetime_shell(), (300, 300_000));
        assert!(session_token_is_five_minutes());
        assert!(refresh_token_is_thirty_days());
        assert_eq!(
            analytics_timing_ladder(),
            [5_000, 1_000, 1_000, 1_000, ANALYTICS_RETRY_MAX_DELAY_MS]
        );
        assert!(analytics_retry_bounds_sane());
        assert!(analytics_flush_is_five_seconds());
        assert!(flags_stream_reconnect_sane());
        let (init, max, _hb) = (
            FLAGS_STREAM_INITIAL_RECONNECT_MS,
            FLAGS_STREAM_MAX_RECONNECT_MS,
            FLAGS_STREAM_HEARTBEAT_TIMEOUT_MS,
        );
        assert!(init < max);
        assert_eq!(webhook_pkce_timing_shell(), (300_000, 30_000, 600_000));
        assert!(default_timeout_equals_token_buffer());
        assert_eq!(MAX_RETRIES, 3);
        assert_eq!(ANALYTICS_MAX_TEXT_LENGTH, 100);
        assert_eq!(FLAGS_HTTP_POLLING_INTERVAL_MS, 60_000);
    }
}
