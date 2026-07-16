//! Pure jobs retry-delay residual —
//! dual-oracle of `packages/sdk/src/constants.ts`
//! `DEFAULT_RETRY_DELAYS_MS` / `BASE_RETRY_DELAY_MS` / `MAX_RETRY_DELAY_MS` /
//! `JOB_DEFAULT_TIMEOUT_MS` / `JOBS_DLQ_MAX_AGE_MS` pure halves.
//!
//! Job runner / DLQ I/O remains product residual.
//! NO authority_rust / ts_deleted invent. dens ≠ flip.

/// Dual-oracle residual: base retry delay ms.
pub const BASE_RETRY_DELAY_MS: u64 = 1_000;
/// Dual-oracle residual: max retry delay ms (config cap).
pub const MAX_RETRY_DELAY_MS: u64 = 30_000;
/// Dual-oracle residual: default job timeout ms.
pub const JOB_DEFAULT_TIMEOUT_MS: u64 = 60_000;
/// Dual-oracle residual: DLQ max age ms (7 days).
pub const JOBS_DLQ_MAX_AGE_MS: u64 = 7 * 24 * 60 * 60 * 1000;
/// Dual-oracle residual: default retry delay ladder ms.
pub const DEFAULT_RETRY_DELAYS_MS: &[u64] = &[1_000, 5_000, 15_000, 30_000, 60_000];

/// Dual-oracle residual: ladder strictly increasing.
#[must_use]
pub fn retry_delays_strictly_increasing() -> bool {
    DEFAULT_RETRY_DELAYS_MS.windows(2).all(|w| w[1] > w[0])
}

/// Dual-oracle residual: delay at attempt index (0-based, clamped).
#[must_use]
pub fn retry_delay_at(attempt: usize) -> u64 {
    let last = DEFAULT_RETRY_DELAYS_MS.len() - 1;
    DEFAULT_RETRY_DELAYS_MS[attempt.min(last)]
}

/// Dual-oracle residual: base equals first ladder step.
#[must_use]
pub fn base_matches_ladder_head() -> bool {
    DEFAULT_RETRY_DELAYS_MS.first().copied() == Some(BASE_RETRY_DELAY_MS)
}

/// Dual-oracle residual: DLQ max age is 7 days.
#[must_use]
pub fn dlq_max_age_is_seven_days() -> bool {
    JOBS_DLQ_MAX_AGE_MS == 604_800_000
}

// ── wave70 pure residual dens: job poll + ladder shell dual-oracle residual ──
// Dual-oracle of JOB_POLL_INTERVAL_MS + timeout/poll shell pure half.
// Job runner / status polling I/O residual retained. dens ≠ flip.

/// Dual-oracle residual: default job status polling interval ms.
pub const JOB_POLL_INTERVAL_MS: u64 = 2_000;

/// Dual-oracle residual: job timeout / poll shell.
#[must_use]
pub fn job_timeout_poll_shell() -> (u64, u64) {
    (JOB_DEFAULT_TIMEOUT_MS, JOB_POLL_INTERVAL_MS)
}

/// Dual-oracle residual: poll interval is strictly less than default timeout.
#[must_use]
pub fn poll_faster_than_timeout() -> bool {
    JOB_POLL_INTERVAL_MS < JOB_DEFAULT_TIMEOUT_MS
}

/// Dual-oracle residual: max config delay equals ladder step 3 (30s).
#[must_use]
pub fn max_retry_matches_ladder_step() -> bool {
    DEFAULT_RETRY_DELAYS_MS.get(3).copied() == Some(MAX_RETRY_DELAY_MS)
}

/// Dual-oracle residual: ladder length + head/tail shell.
#[must_use]
pub fn retry_ladder_shell() -> (usize, u64, u64) {
    (
        DEFAULT_RETRY_DELAYS_MS.len(),
        DEFAULT_RETRY_DELAYS_MS[0],
        *DEFAULT_RETRY_DELAYS_MS.last().unwrap_or(&0),
    )
}

/// Dual-oracle residual: attempts needed to reach final ladder step (0-based last index).
#[must_use]
pub fn final_ladder_attempt_index() -> usize {
    DEFAULT_RETRY_DELAYS_MS.len().saturating_sub(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wave62_jobs_retry_delays_dual_oracle() {
        assert_eq!(BASE_RETRY_DELAY_MS, 1_000);
        assert_eq!(MAX_RETRY_DELAY_MS, 30_000);
        assert_eq!(JOB_DEFAULT_TIMEOUT_MS, 60_000);
        assert_eq!(JOBS_DLQ_MAX_AGE_MS, 604_800_000);
        assert_eq!(DEFAULT_RETRY_DELAYS_MS, &[1_000, 5_000, 15_000, 30_000, 60_000]);
        assert!(retry_delays_strictly_increasing());
        assert_eq!(retry_delay_at(0), 1_000);
        assert_eq!(retry_delay_at(2), 15_000);
        assert_eq!(retry_delay_at(99), 60_000);
        assert!(base_matches_ladder_head());
        assert!(dlq_max_age_is_seven_days());
    }
}

#[cfg(test)]
mod wave70_tests {
    use super::*;

    #[test]
    fn wave70_jobs_poll_ladder_shell_dual_oracle() {
        assert_eq!(JOB_POLL_INTERVAL_MS, 2_000);
        assert_eq!(job_timeout_poll_shell(), (60_000, 2_000));
        assert!(poll_faster_than_timeout());
        assert!(max_retry_matches_ladder_step());
        assert_eq!(retry_ladder_shell(), (5, 1_000, 60_000));
        assert_eq!(final_ladder_attempt_index(), 4);
        assert_eq!(retry_delay_at(final_ladder_attempt_index()), 60_000);
        assert!(retry_delays_strictly_increasing());
        assert!(dlq_max_age_is_seven_days());
        assert!(base_matches_ladder_head());
    }
}


// ── wave71 pure residual dens: retry delay attempt ladder dual-oracle residual ──
// Dual-oracle residual of DEFAULT_RETRY_DELAYS_MS pure half.
// Job runner / network I/O residual retained. dens ≠ flip.
// product residual dens wave71

/// Dual-oracle residual: full attempt delay ladder 0..4.
#[must_use]
pub fn retry_delay_attempt_ladder() -> [u64; 5] {
    [
        retry_delay_at(0),
        retry_delay_at(1),
        retry_delay_at(2),
        retry_delay_at(3),
        retry_delay_at(4),
    ]
}

/// Dual-oracle residual: past-end clamps to last ladder step.
#[must_use]
pub fn retry_delay_past_end_clamps() -> bool {
    retry_delay_at(5) == 60_000 && retry_delay_at(99) == 60_000
}

/// Dual-oracle residual: DLQ age days shell.
#[must_use]
pub fn dlq_age_days_shell() -> u64 {
    JOBS_DLQ_MAX_AGE_MS / (24 * 60 * 60 * 1000)
}

/// Dual-oracle residual: base/max/timeout numeric shell.
#[must_use]
pub fn jobs_timing_numeric_shell() -> (u64, u64, u64, u64) {
    (
        BASE_RETRY_DELAY_MS,
        MAX_RETRY_DELAY_MS,
        JOB_DEFAULT_TIMEOUT_MS,
        JOB_POLL_INTERVAL_MS,
    )
}

/// Dual-oracle residual: ladder matches DEFAULT_RETRY_DELAYS_MS.
#[must_use]
pub fn retry_ladder_matches_const() -> bool {
    DEFAULT_RETRY_DELAYS_MS == retry_delay_attempt_ladder()
}

#[cfg(test)]
mod wave71_tests {
    use super::*;

    #[test]
    fn wave71_retry_delay_attempt_ladder_dual_oracle() {
        assert_eq!(
            retry_delay_attempt_ladder(),
            [1_000, 5_000, 15_000, 30_000, 60_000]
        );
        assert!(retry_delay_past_end_clamps());
        assert_eq!(dlq_age_days_shell(), 7);
        assert_eq!(
            jobs_timing_numeric_shell(),
            (1_000, 30_000, 60_000, 2_000)
        );
        assert!(retry_ladder_matches_const());
        assert!(retry_delays_strictly_increasing());
        assert!(poll_faster_than_timeout());
    }
}
