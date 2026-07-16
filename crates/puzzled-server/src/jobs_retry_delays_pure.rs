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
