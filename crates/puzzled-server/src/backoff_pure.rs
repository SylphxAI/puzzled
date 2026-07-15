//! Pure exponential backoff helpers —
//! dual-oracle residual of `apps/puzzled/src/lib/dlq/index.ts#calculateBackoffDelay`
//! with injectable jitter (RNG stays FE/TS residual).
//! NO authority_rust / ts_deleted.

/// 1 minute in ms (TS baseDelay).
pub const BASE_DELAY_MS: u64 = 60_000;
/// 1 hour in ms (TS maxDelay).
pub const MAX_DELAY_MS: u64 = 3_600_000;

/// Base exponential delay without jitter: `min(base * 2^retryCount, max)`.
/// TS: `Math.min(baseDelay * 2 ** retryCount, maxDelay)`.
#[must_use]
pub fn backoff_base_ms(retry_count: u32) -> u64 {
    let exp = 2u64.saturating_pow(retry_count);
    let delay = BASE_DELAY_MS.saturating_mul(exp);
    delay.min(MAX_DELAY_MS)
}

/// Full delay with injectable jitter fraction in `[0.0, 0.1]` (TS: 0–10% of delay).
/// `jitter_unit` in `[0.0, 1.0]` multiplies the 10% band.
#[must_use]
pub fn calculate_backoff_delay_ms(retry_count: u32, jitter_unit: f64) -> u64 {
    let delay = backoff_base_ms(retry_count) as f64;
    let unit = jitter_unit.clamp(0.0, 1.0);
    let jitter = delay * unit * 0.1;
    (delay + jitter).floor() as u64
}

/// Whether a pending DLQ item is ready for retry given last_retry_at + backoff.
/// `last_retry_at_ms = None` → ready immediately (TS: never retried).
#[must_use]
pub fn is_ready_for_retry(
    now_ms: i64,
    last_retry_at_ms: Option<i64>,
    retry_count: u32,
    max_retries: u32,
    jitter_unit: f64,
) -> bool {
    if retry_count > max_retries {
        return false;
    }
    let Some(last) = last_retry_at_ms else {
        return true;
    };
    let wait = calculate_backoff_delay_ms(retry_count, jitter_unit) as i64;
    now_ms.saturating_sub(last) >= wait
}

/// Time helpers dual-oracle of `apps/puzzled/src/lib/constants/time.ts`.
#[must_use]
pub fn days_to_ms(days: u64) -> u64 {
    days.saturating_mul(24 * 60 * 60 * 1000)
}

#[must_use]
pub fn hours_to_ms(hours: u64) -> u64 {
    hours.saturating_mul(60 * 60 * 1000)
}

#[must_use]
pub fn minutes_to_ms(minutes: u64) -> u64 {
    minutes.saturating_mul(60 * 1000)
}

/// Epoch offset helpers (injectable `from_ms`).
#[must_use]
pub fn days_ago_ms(days: u64, from_ms: i64) -> i64 {
    from_ms.saturating_sub(days_to_ms(days) as i64)
}

#[must_use]
pub fn hours_ago_ms(hours: u64, from_ms: i64) -> i64 {
    from_ms.saturating_sub(hours_to_ms(hours) as i64)
}

#[must_use]
pub fn minutes_ago_ms(minutes: u64, from_ms: i64) -> i64 {
    from_ms.saturating_sub(minutes_to_ms(minutes) as i64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exponential_base_table() {
        assert_eq!(backoff_base_ms(0), 60_000); // 1m
        assert_eq!(backoff_base_ms(1), 120_000); // 2m
        assert_eq!(backoff_base_ms(2), 240_000); // 4m
        assert_eq!(backoff_base_ms(3), 480_000); // 8m
        assert_eq!(backoff_base_ms(6), 3_600_000); // clamped to 1h (60m * 64 would exceed)
        assert_eq!(backoff_base_ms(10), MAX_DELAY_MS);
    }

    #[test]
    fn jitter_injectable() {
        // unit=0 → exact base
        assert_eq!(calculate_backoff_delay_ms(0, 0.0), 60_000);
        // unit=1 → +10%
        assert_eq!(calculate_backoff_delay_ms(0, 1.0), 66_000);
        // unit=0.5 → +5%
        assert_eq!(calculate_backoff_delay_ms(0, 0.5), 63_000);
    }

    #[test]
    fn ready_for_retry() {
        let now = 1_000_000_i64;
        assert!(is_ready_for_retry(now, None, 0, 5, 0.0));
        assert!(!is_ready_for_retry(now, Some(now - 1_000), 0, 5, 0.0)); // 1s < 60s
        assert!(is_ready_for_retry(now, Some(now - 60_000), 0, 5, 0.0));
        assert!(!is_ready_for_retry(now, Some(now - 60_000), 6, 5, 0.0)); // over max
    }

    #[test]
    fn time_offsets() {
        assert_eq!(days_to_ms(1), 86_400_000);
        assert_eq!(hours_to_ms(1), 3_600_000);
        assert_eq!(minutes_to_ms(1), 60_000);
        let from = 10_000_000_i64;
        assert_eq!(days_ago_ms(1, from), from - 86_400_000);
        assert_eq!(hours_ago_ms(2, from), from - 7_200_000);
        assert_eq!(minutes_ago_ms(5, from), from - 300_000);
    }
}
