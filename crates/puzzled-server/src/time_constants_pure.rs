//! Pure time unit constants + forward offsets + alphabet —
//! dual-oracle residual deepen of `apps/puzzled/src/lib/constants/time.ts`
//! and `constants/strings.ts` beyond the ms-ago helpers already migrated in
//! `backoff_pure` (days/hours/minutes_ago_ms). NO authority_rust / ts_deleted.

/// Base second in ms (TS `SECOND_MS`).
pub const SECOND_MS: i64 = 1_000;
/// Week in ms (TS `WEEK_MS`).
pub const WEEK_MS: i64 = 7 * 24 * 60 * 60 * 1_000;

/// Seconds units (TS Redis TTL helpers).
pub const MINUTE_SECONDS: i64 = 60;
pub const HOUR_SECONDS: i64 = 60 * MINUTE_SECONDS;
pub const DAY_SECONDS: i64 = 24 * HOUR_SECONDS;
pub const WEEK_SECONDS: i64 = 7 * DAY_SECONDS;

/// Epoch ms N days after `from_ms` (TS `_daysFromNow`).
#[must_use]
pub fn days_from_now_ms(days: i64, from_ms: i64) -> i64 {
    from_ms.saturating_add(days.saturating_mul(24 * 60 * 60 * 1_000))
}

/// Epoch ms N hours after `from_ms` (TS `_hoursFromNow`).
#[must_use]
pub fn hours_from_now_ms(hours: i64, from_ms: i64) -> i64 {
    from_ms.saturating_add(hours.saturating_mul(60 * 60 * 1_000))
}

/// Days → seconds (TS `_daysToSeconds`).
#[must_use]
pub fn days_to_seconds(days: i64) -> i64 {
    days.saturating_mul(DAY_SECONDS)
}

/// Hours → seconds (TS `_hoursToSeconds`).
#[must_use]
pub fn hours_to_seconds(hours: i64) -> i64 {
    hours.saturating_mul(HOUR_SECONDS)
}

/// Minutes → seconds (TS `_minutesToSeconds`).
#[must_use]
pub fn minutes_to_seconds(minutes: i64) -> i64 {
    minutes.saturating_mul(MINUTE_SECONDS)
}

/// Seconds → ms (TS `SECOND_MS` scale).
#[must_use]
pub fn seconds_to_ms(seconds: i64) -> i64 {
    seconds.saturating_mul(SECOND_MS)
}

/// Weeks → ms (TS `WEEK_MS` scale).
#[must_use]
pub fn weeks_to_ms(weeks: i64) -> i64 {
    weeks.saturating_mul(WEEK_MS)
}

/// Alphabet constant residual of `constants/strings.ts` (SSOT).
pub const ALPHABET: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// Index of letter in alphabet (A=0 … Z=25); non A–Z → None.
#[must_use]
pub fn alphabet_index(c: char) -> Option<usize> {
    let u = c.to_ascii_uppercase();
    if u.is_ascii_uppercase() {
        Some((u as u8 - b'A') as usize)
    } else {
        None
    }
}

/// Char at alphabet index (0..25); OOB → None.
#[must_use]
pub fn alphabet_char(idx: usize) -> Option<char> {
    ALPHABET.chars().nth(idx)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn units_and_forward_offsets() {
        assert_eq!(SECOND_MS, 1_000);
        assert_eq!(WEEK_MS, 604_800_000);
        assert_eq!(MINUTE_SECONDS, 60);
        assert_eq!(HOUR_SECONDS, 3_600);
        assert_eq!(DAY_SECONDS, 86_400);
        assert_eq!(WEEK_SECONDS, 604_800);
        let now = 1_700_000_000_000_i64;
        assert_eq!(days_from_now_ms(1, now), now + 86_400_000);
        assert_eq!(hours_from_now_ms(2, now), now + 7_200_000);
        assert_eq!(days_to_seconds(2), 172_800);
        assert_eq!(hours_to_seconds(1), 3_600);
        assert_eq!(minutes_to_seconds(5), 300);
        assert_eq!(seconds_to_ms(3), 3_000);
        assert_eq!(weeks_to_ms(1), WEEK_MS);
    }

    #[test]
    fn alphabet_helpers() {
        assert_eq!(ALPHABET.len(), 26);
        assert_eq!(alphabet_index('A'), Some(0));
        assert_eq!(alphabet_index('z'), Some(25));
        assert_eq!(alphabet_index('1'), None);
        assert_eq!(alphabet_char(0), Some('A'));
        assert_eq!(alphabet_char(25), Some('Z'));
        assert_eq!(alphabet_char(26), None);
    }
}

// ── wave64 pure residual unit: time unit ladder dual-oracle residual ──
// Dual-oracle residual of time constants SECOND/MINUTE/HOUR/DAY/WEEK pure halves.
// Clock / DB I/O residual retained. pure residual ≠ authority flip.

/// Dual-oracle residual: seconds ladder minute → hour → day → week.
#[must_use]
pub fn seconds_unit_ladder() -> [i64; 4] {
    [MINUTE_SECONDS, HOUR_SECONDS, DAY_SECONDS, WEEK_SECONDS]
}

/// Dual-oracle residual: unit ladder strictly increasing.
#[must_use]
pub fn seconds_unit_ladder_strictly_increasing() -> bool {
    let l = seconds_unit_ladder();
    l[0] < l[1] && l[1] < l[2] && l[2] < l[3]
}

/// Dual-oracle residual: week ms equals week_seconds * SECOND_MS.
#[must_use]
pub fn week_ms_matches_seconds() -> bool {
    WEEK_MS == WEEK_SECONDS * SECOND_MS
}

/// Dual-oracle residual: day has 24 hours.
#[must_use]
pub fn day_has_twenty_four_hours() -> bool {
    DAY_SECONDS == 24 * HOUR_SECONDS
}

/// Dual-oracle residual: alphabet length is 26.
#[must_use]
pub fn alphabet_len_is_twenty_six() -> bool {
    ALPHABET.len() == 26
}

#[cfg(test)]
mod wave64_tests {
    use super::*;

    #[test]
    fn wave64_time_unit_ladder_dual_oracle() {
        assert_eq!(seconds_unit_ladder(), [60, 3_600, 86_400, 604_800]);
        assert!(seconds_unit_ladder_strictly_increasing());
        assert!(week_ms_matches_seconds());
        assert!(day_has_twenty_four_hours());
        assert!(alphabet_len_is_twenty_six());
        assert_eq!(SECOND_MS, 1_000);
        assert_eq!(weeks_to_ms(2), WEEK_MS * 2);
        assert_eq!(days_to_seconds(7), WEEK_SECONDS);
    }
}
