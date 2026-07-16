//! Pure session-replay timing residual —
//! dual-oracle of `packages/sdk/src/constants.ts` SESSION_REPLAY_* pure halves.
//!
//! Recorder / upload I/O remains product residual.
//! NO authority_rust / ts_deleted invent. dens ≠ flip.

/// Dual-oracle residual: max session replay duration ms (60 minutes).
pub const SESSION_REPLAY_MAX_DURATION_MS: u64 = 60 * 60 * 1000;
/// Dual-oracle residual: upload interval ms.
pub const SESSION_REPLAY_UPLOAD_INTERVAL_MS: u64 = 5_000;
/// Dual-oracle residual: scroll throttle ms.
pub const SESSION_REPLAY_SCROLL_THROTTLE_MS: u64 = 150;
/// Dual-oracle residual: media throttle ms.
pub const SESSION_REPLAY_MEDIA_THROTTLE_MS: u64 = 800;
/// Dual-oracle residual: rage click window ms.
pub const SESSION_REPLAY_RAGE_CLICK_WINDOW_MS: u64 = 1_000;
/// Dual-oracle residual: dead click timeout ms.
pub const SESSION_REPLAY_DEAD_CLICK_TIMEOUT_MS: u64 = 500;
/// Dual-oracle residual: scroll heat window ms.
pub const SESSION_REPLAY_SCROLL_HEAT_WINDOW_MS: u64 = 2_000;
/// Dual-oracle residual: status check interval ms.
pub const SESSION_REPLAY_STATUS_CHECK_MS: u64 = 5_000;

/// Dual-oracle residual: max duration is exactly 60 minutes.
#[must_use]
pub fn max_duration_is_sixty_minutes() -> bool {
    SESSION_REPLAY_MAX_DURATION_MS == 60 * 60 * 1000
}

/// Dual-oracle residual: upload interval equals status check interval.
#[must_use]
pub fn upload_matches_status_check() -> bool {
    SESSION_REPLAY_UPLOAD_INTERVAL_MS == SESSION_REPLAY_STATUS_CHECK_MS
}

/// Dual-oracle residual: dead click timeout < rage click window.
#[must_use]
pub fn dead_click_faster_than_rage_window() -> bool {
    SESSION_REPLAY_DEAD_CLICK_TIMEOUT_MS < SESSION_REPLAY_RAGE_CLICK_WINDOW_MS
}

/// Dual-oracle residual: scroll throttle < media throttle.
#[must_use]
pub fn scroll_throttle_faster_than_media() -> bool {
    SESSION_REPLAY_SCROLL_THROTTLE_MS < SESSION_REPLAY_MEDIA_THROTTLE_MS
}

/// Dual-oracle residual: positive timing catalog membership helper.
#[must_use]
pub fn is_positive_timing_ms(ms: u64) -> bool {
    ms > 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wave63_session_replay_timing_dual_oracle() {
        assert_eq!(SESSION_REPLAY_MAX_DURATION_MS, 3_600_000);
        assert_eq!(SESSION_REPLAY_UPLOAD_INTERVAL_MS, 5_000);
        assert_eq!(SESSION_REPLAY_SCROLL_THROTTLE_MS, 150);
        assert_eq!(SESSION_REPLAY_MEDIA_THROTTLE_MS, 800);
        assert_eq!(SESSION_REPLAY_RAGE_CLICK_WINDOW_MS, 1_000);
        assert_eq!(SESSION_REPLAY_DEAD_CLICK_TIMEOUT_MS, 500);
        assert_eq!(SESSION_REPLAY_SCROLL_HEAT_WINDOW_MS, 2_000);
        assert_eq!(SESSION_REPLAY_STATUS_CHECK_MS, 5_000);
        assert!(max_duration_is_sixty_minutes());
        assert!(upload_matches_status_check());
        assert!(dead_click_faster_than_rage_window());
        assert!(scroll_throttle_faster_than_media());
        assert!(is_positive_timing_ms(SESSION_REPLAY_UPLOAD_INTERVAL_MS));
    }
}
