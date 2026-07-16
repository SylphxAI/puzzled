//! Pure SDK resilience / cache / UI residual —
//! dual-oracle of `packages/sdk/src/constants.ts` pure halves not yet densed in
//! jobs/session-replay/analytics/web-vitals modules:
//! FLAGS_CACHE_* / STALE_TIME_* / UI_* / STORAGE_* / CIRCUIT_BREAKER_* /
//! API_KEY_EXPIRY_* / MIN_PASSWORD_LENGTH / DEFAULT_CONTEXT_WINDOW /
//! JWK_CACHE_TTL / CLICK_ID_EXPIRY / analytics track caps.
//!
//! Network / storage I/O remains product residual.
//! NO authority_rust / ts_deleted invent. dens ≠ flip.

// ── wave70 pure residual dens: sdk resilience + cache/UI ladder dual-oracle ──

/// Dual-oracle residual: feature flags cache TTL ms (5 minutes).
pub const FLAGS_CACHE_TTL_MS: u64 = 5 * 60 * 1000;
/// Dual-oracle residual: flags stale-while-revalidate window ms (1 minute).
pub const FLAGS_STALE_WHILE_REVALIDATE_MS: u64 = 60 * 1000;

/// Dual-oracle residual: React Query staleTime frequent (1 minute).
pub const STALE_TIME_FREQUENT_MS: u64 = 60 * 1_000;
/// Dual-oracle residual: React Query staleTime moderate (2 minutes).
pub const STALE_TIME_MODERATE_MS: u64 = 2 * 60 * 1_000;
/// Dual-oracle residual: React Query staleTime stable (5 minutes).
pub const STALE_TIME_STABLE_MS: u64 = 5 * 60 * 1_000;
/// Dual-oracle residual: React Query staleTime stats (30 seconds).
pub const STALE_TIME_STATS_MS: u64 = 30 * 1_000;

/// Dual-oracle residual: click ID attribution window ms (90 days).
pub const CLICK_ID_EXPIRY_MS: u64 = 90 * 24 * 60 * 60 * 1000;

/// Dual-oracle residual: JWK cache TTL ms (1 hour).
pub const JWK_CACHE_TTL_MS: u64 = 60 * 60 * 1000;

/// Dual-oracle residual: UI feedback durations ms.
pub const UI_COPY_FEEDBACK_MS: u64 = 2_000;
pub const UI_FORM_SUCCESS_MS: u64 = 3_000;
pub const UI_NOTIFICATION_MS: u64 = 5_000;
pub const UI_PROMPT_DELAY_MS: u64 = 3_000;
pub const UI_REDIRECT_DELAY_MS: u64 = 3_000;
pub const UI_ANIMATION_OUT_MS: u64 = 200;
pub const UI_ANIMATION_IN_MS: u64 = 300;
pub const UI_SUCCESS_REDIRECT_MS: u64 = 1_500;

/// Dual-oracle residual: storage size thresholds (bytes).
pub const STORAGE_MULTIPART_THRESHOLD_BYTES: u64 = 5 * 1024 * 1024;
pub const STORAGE_DEFAULT_MAX_SIZE_BYTES: u64 = 5 * 1024 * 1024;
pub const STORAGE_AVATAR_MAX_SIZE_BYTES: u64 = 2 * 1024 * 1024;
pub const STORAGE_LARGE_MAX_SIZE_BYTES: u64 = 10 * 1024 * 1024;

/// Dual-oracle residual: circuit breaker shell.
pub const CIRCUIT_BREAKER_FAILURE_THRESHOLD: u32 = 5;
pub const CIRCUIT_BREAKER_WINDOW_MS: u64 = 10_000;
pub const CIRCUIT_BREAKER_OPEN_DURATION_MS: u64 = 30_000;

/// Dual-oracle residual: API key expiry ladder (seconds).
pub const API_KEY_EXPIRY_1_DAY: u64 = 86_400;
pub const API_KEY_EXPIRY_7_DAYS: u64 = 604_800;
pub const API_KEY_EXPIRY_30_DAYS: u64 = 2_592_000;
pub const API_KEY_EXPIRY_90_DAYS: u64 = 7_776_000;
pub const API_KEY_EXPIRY_1_YEAR: u64 = 31_536_000;

/// Dual-oracle residual: security / AI pure halves.
pub const MIN_PASSWORD_LENGTH: usize = 12;
pub const DEFAULT_CONTEXT_WINDOW: u32 = 4_096;

/// Dual-oracle residual: analytics track caps.
pub const ANALYTICS_MAX_TRACKED_EVENT_IDS: u32 = 1_000;
pub const ANALYTICS_TRACKED_IDS_KEEP: u32 = 500;
pub const ANALYTICS_QUEUE_LIMIT: u32 = 100;

/// Dual-oracle residual: truncation / consent wait.
pub const LOG_MESSAGE_MAX_LENGTH: usize = 1_000;
pub const STACK_TRACE_MAX_LENGTH: usize = 500;
pub const CONSENT_WAIT_FOR_UPDATE_MS: u64 = 500;

/// Dual-oracle residual: ETag cache max entries.
pub const ETAG_CACHE_MAX_ENTRIES: u32 = 100;

/// Dual-oracle residual: flags cache shell (ttl, swr).
#[must_use]
pub fn flags_cache_shell() -> (u64, u64) {
    (FLAGS_CACHE_TTL_MS, FLAGS_STALE_WHILE_REVALIDATE_MS)
}

/// Dual-oracle residual: stale-time ladder ascending (stats < frequent < moderate < stable).
#[must_use]
pub fn stale_time_ladder_ms() -> [u64; 4] {
    [
        STALE_TIME_STATS_MS,
        STALE_TIME_FREQUENT_MS,
        STALE_TIME_MODERATE_MS,
        STALE_TIME_STABLE_MS,
    ]
}

/// Dual-oracle residual: stale-time ladder strictly increasing.
#[must_use]
pub fn stale_time_ladder_strictly_increasing() -> bool {
    let ladder = stale_time_ladder_ms();
    ladder.windows(2).all(|w| w[1] > w[0])
}

/// Dual-oracle residual: UI feedback shell (copy/form/notification).
#[must_use]
pub fn ui_feedback_shell_ms() -> [u64; 3] {
    [UI_COPY_FEEDBACK_MS, UI_FORM_SUCCESS_MS, UI_NOTIFICATION_MS]
}

/// Dual-oracle residual: UI animation shell (out < in).
#[must_use]
pub fn ui_animation_shell_ms() -> (u64, u64) {
    (UI_ANIMATION_OUT_MS, UI_ANIMATION_IN_MS)
}

/// Dual-oracle residual: storage size ladder (avatar < default == multipart < large).
#[must_use]
pub fn storage_size_ladder_bytes() -> [u64; 4] {
    [
        STORAGE_AVATAR_MAX_SIZE_BYTES,
        STORAGE_DEFAULT_MAX_SIZE_BYTES,
        STORAGE_MULTIPART_THRESHOLD_BYTES,
        STORAGE_LARGE_MAX_SIZE_BYTES,
    ]
}

/// Dual-oracle residual: storage ladder ordering holds.
#[must_use]
pub fn storage_size_ladder_sane() -> bool {
    STORAGE_AVATAR_MAX_SIZE_BYTES < STORAGE_DEFAULT_MAX_SIZE_BYTES
        && STORAGE_DEFAULT_MAX_SIZE_BYTES == STORAGE_MULTIPART_THRESHOLD_BYTES
        && STORAGE_MULTIPART_THRESHOLD_BYTES < STORAGE_LARGE_MAX_SIZE_BYTES
}

/// Dual-oracle residual: circuit breaker shell.
#[must_use]
pub fn circuit_breaker_shell() -> (u32, u64, u64) {
    (
        CIRCUIT_BREAKER_FAILURE_THRESHOLD,
        CIRCUIT_BREAKER_WINDOW_MS,
        CIRCUIT_BREAKER_OPEN_DURATION_MS,
    )
}

/// Dual-oracle residual: open duration > failure window.
#[must_use]
pub fn circuit_breaker_open_longer_than_window() -> bool {
    CIRCUIT_BREAKER_OPEN_DURATION_MS > CIRCUIT_BREAKER_WINDOW_MS
}

/// Dual-oracle residual: API key expiry ladder (seconds).
#[must_use]
pub fn api_key_expiry_ladder_secs() -> [u64; 5] {
    [
        API_KEY_EXPIRY_1_DAY,
        API_KEY_EXPIRY_7_DAYS,
        API_KEY_EXPIRY_30_DAYS,
        API_KEY_EXPIRY_90_DAYS,
        API_KEY_EXPIRY_1_YEAR,
    ]
}

/// Dual-oracle residual: API key expiry ladder strictly increasing.
#[must_use]
pub fn api_key_expiry_strictly_increasing() -> bool {
    api_key_expiry_ladder_secs()
        .windows(2)
        .all(|w| w[1] > w[0])
}

/// Dual-oracle residual: security + AI shell.
#[must_use]
pub fn security_ai_shell() -> (usize, u32) {
    (MIN_PASSWORD_LENGTH, DEFAULT_CONTEXT_WINDOW)
}

/// Dual-oracle residual: analytics track cap shell.
#[must_use]
pub fn analytics_track_cap_shell() -> (u32, u32, u32) {
    (
        ANALYTICS_MAX_TRACKED_EVENT_IDS,
        ANALYTICS_TRACKED_IDS_KEEP,
        ANALYTICS_QUEUE_LIMIT,
    )
}

/// Dual-oracle residual: keep ≤ max tracked event IDs.
#[must_use]
pub fn analytics_track_caps_sane() -> bool {
    ANALYTICS_TRACKED_IDS_KEEP < ANALYTICS_MAX_TRACKED_EVENT_IDS
        && ANALYTICS_QUEUE_LIMIT < ANALYTICS_TRACKED_IDS_KEEP
}

/// Dual-oracle residual: click-id window is 90 days.
#[must_use]
pub fn click_id_is_ninety_days() -> bool {
    CLICK_ID_EXPIRY_MS == 90 * 86_400 * 1000
}

/// Dual-oracle residual: flags SWR strictly less than cache TTL.
#[must_use]
pub fn flags_swr_shorter_than_ttl() -> bool {
    FLAGS_STALE_WHILE_REVALIDATE_MS < FLAGS_CACHE_TTL_MS
}

#[cfg(test)]
mod wave70_tests {
    use super::*;

    #[test]
    fn wave70_sdk_resilience_cache_ui_dual_oracle() {
        assert_eq!(flags_cache_shell(), (300_000, 60_000));
        assert!(flags_swr_shorter_than_ttl());
        assert_eq!(
            stale_time_ladder_ms(),
            [30_000, 60_000, 120_000, 300_000]
        );
        assert!(stale_time_ladder_strictly_increasing());
        assert!(click_id_is_ninety_days());
        assert_eq!(JWK_CACHE_TTL_MS, 3_600_000);

        assert_eq!(ui_feedback_shell_ms(), [2_000, 3_000, 5_000]);
        assert_eq!(ui_animation_shell_ms(), (200, 300));
        assert!(UI_ANIMATION_OUT_MS < UI_ANIMATION_IN_MS);
        assert_eq!(UI_PROMPT_DELAY_MS, UI_REDIRECT_DELAY_MS);
        assert_eq!(UI_SUCCESS_REDIRECT_MS, 1_500);

        assert_eq!(
            storage_size_ladder_bytes(),
            [2_097_152, 5_242_880, 5_242_880, 10_485_760]
        );
        assert!(storage_size_ladder_sane());

        assert_eq!(circuit_breaker_shell(), (5, 10_000, 30_000));
        assert!(circuit_breaker_open_longer_than_window());

        assert_eq!(
            api_key_expiry_ladder_secs(),
            [86_400, 604_800, 2_592_000, 7_776_000, 31_536_000]
        );
        assert!(api_key_expiry_strictly_increasing());
        assert_eq!(security_ai_shell(), (12, 4_096));
        assert_eq!(analytics_track_cap_shell(), (1_000, 500, 100));
        assert!(analytics_track_caps_sane());
        assert_eq!(LOG_MESSAGE_MAX_LENGTH, 1_000);
        assert_eq!(STACK_TRACE_MAX_LENGTH, 500);
        assert_eq!(CONSENT_WAIT_FOR_UPDATE_MS, 500);
        assert_eq!(ETAG_CACHE_MAX_ENTRIES, 100);
    }
}
