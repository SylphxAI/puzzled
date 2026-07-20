//! UTC daily puzzle time helpers — parity with
//! `apps/puzzled/src/features/daily/lib/puzzle-utils.ts`.
//!
//! Pure product kernel used by games/stats/gamification residual paths.
//! Launch date default matches TS `DEFAULT_LAUNCH_DATE` (2024-01-01).

use chrono::{Datelike, Duration, NaiveDate, Utc};

/// Default launch date for games without an explicit override (UTC).
pub const DEFAULT_LAUNCH_DATE: NaiveDate = match NaiveDate::from_ymd_opt(2024, 1, 1) {
    Some(d) => d,
    None => unreachable!(),
};

/// Today's calendar date at midnight UTC.
#[must_use]
pub fn get_today_utc() -> NaiveDate {
    Utc::now().date_naive()
}

/// Yesterday at midnight UTC.
#[must_use]
pub fn get_yesterday_utc() -> NaiveDate {
    get_today_utc() - Duration::days(1)
}

/// Format a date as `YYYY-MM-DD` (parity: `getPuzzleDateStringUTC`).
#[must_use]
pub fn puzzle_date_string_utc(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

/// Parse `YYYY-MM-DD` into a [`NaiveDate`].
///
/// # Errors
///
/// Returns an error string when the format is invalid.
pub fn parse_date_yyyy_mm_dd(date: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(date.trim(), "%Y-%m-%d").map_err(|_| format!("invalid date: {date}"))
}

/// Puzzle number for a game on a given date.
///
/// Puzzle #1 = launch date; increments by 1 each UTC day.
/// Uses `DEFAULT_LAUNCH_DATE` unless `launch` is provided.
#[must_use]
pub fn get_puzzle_number(date: NaiveDate, launch: Option<NaiveDate>) -> u32 {
    let launch = launch.unwrap_or(DEFAULT_LAUNCH_DATE);
    let diff = (date - launch).num_days();
    if diff < 0 {
        1
    } else {
        u32::try_from(diff + 1).unwrap_or(1).max(1)
    }
}

/// True when `archive_date` is strictly before today UTC (not future/today).
#[must_use]
pub fn is_valid_archive_date(archive_date: NaiveDate, today: NaiveDate) -> bool {
    archive_date < today
}

/// Expand inclusive `[start, end]` calendar dates that are strictly before `today`.
#[must_use]
pub fn expand_archive_dates(start: NaiveDate, end: NaiveDate, today: NaiveDate) -> Vec<NaiveDate> {
    if start > end {
        return Vec::new();
    }
    let mut out = Vec::new();
    let mut current = start;
    while current <= end && current < today {
        out.push(current);
        current += Duration::days(1);
    }
    out
}

/// Year/month/day components for seed helpers that still take integer parts.
#[must_use]
#[allow(dead_code)] // used by generation seed bridges / future residual
pub fn ymd(date: NaiveDate) -> (i32, u32, u32) {
    (date.year(), date.month(), date.day())
}

/// Next UTC midnight after the given calendar day (TS `getNextMidnightUTC`).
/// For `today` = calendar date, returns `today + 1 day` (release boundary).
#[must_use]
pub fn next_midnight_utc_date(today: NaiveDate) -> NaiveDate {
    today + Duration::days(1)
}

/// Milliseconds until next UTC midnight from an injectable now.
/// `now_ms` is Unix epoch ms; `today` is the UTC calendar day of `now`
/// (caller injects to avoid clock drift in tests).
/// Parity: TS `getMsUntilNextUTCMidnight`.
#[must_use]
pub fn ms_until_next_utc_midnight(now_ms: i64, today: NaiveDate) -> i64 {
    let next = next_midnight_utc_date(today);
    let next_midnight_ms = match next.and_hms_opt(0, 0, 0) {
        Some(ndt) => ndt.and_utc().timestamp_millis(),
        None => now_ms, // unreachable for midnight; fail closed to zero wait
    };
    next_midnight_ms - now_ms
}

/// Breakdown of ms-until-midnight into h/m/s (TS `_getTimeUntilNextUTCMidnight`).
#[must_use]
pub fn time_until_next_utc_midnight(ms_until: i64) -> (u64, u64, u64) {
    let ms = ms_until.max(0) as u64;
    let hours = ms / (1000 * 60 * 60);
    let minutes = (ms % (1000 * 60 * 60)) / (1000 * 60);
    let seconds = (ms % (1000 * 60)) / 1000;
    (hours, minutes, seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn puzzle_number_day_one() {
        assert_eq!(get_puzzle_number(DEFAULT_LAUNCH_DATE, None), 1);
    }

    #[test]
    fn puzzle_number_increments() {
        let d = DEFAULT_LAUNCH_DATE + Duration::days(9);
        assert_eq!(get_puzzle_number(d, None), 10);
    }

    #[test]
    fn puzzle_number_before_launch_clamps() {
        let d = DEFAULT_LAUNCH_DATE - Duration::days(5);
        assert_eq!(get_puzzle_number(d, None), 1);
    }

    #[test]
    fn date_string_format() {
        assert_eq!(
            puzzle_date_string_utc(NaiveDate::from_ymd_opt(2024, 12, 25).expect("d")),
            "2024-12-25"
        );
    }

    #[test]
    fn archive_dates_exclude_today_and_future() {
        let today = NaiveDate::from_ymd_opt(2024, 1, 10).expect("d");
        let start = NaiveDate::from_ymd_opt(2024, 1, 8).expect("d");
        let end = NaiveDate::from_ymd_opt(2024, 1, 15).expect("d");
        let dates = expand_archive_dates(start, end, today);
        assert_eq!(
            dates,
            vec![
                NaiveDate::from_ymd_opt(2024, 1, 8).expect("d"),
                NaiveDate::from_ymd_opt(2024, 1, 9).expect("d"),
            ]
        );
    }

    #[test]
    fn archive_date_must_be_past() {
        let today = NaiveDate::from_ymd_opt(2024, 6, 1).expect("d");
        assert!(is_valid_archive_date(
            NaiveDate::from_ymd_opt(2024, 5, 31).expect("d"),
            today
        ));
        assert!(!is_valid_archive_date(today, today));
        assert!(!is_valid_archive_date(
            NaiveDate::from_ymd_opt(2024, 6, 2).expect("d"),
            today
        ));
    }

    #[test]
    fn next_midnight_and_countdown() {
        let today = NaiveDate::from_ymd_opt(2024, 7, 15).expect("d");
        assert_eq!(
            next_midnight_utc_date(today),
            NaiveDate::from_ymd_opt(2024, 7, 16).expect("d")
        );
        // 2024-07-15T21:00:00Z → 3h to midnight
        let now_ms = 1_721_077_200_000_i64;
        let ms = ms_until_next_utc_midnight(now_ms, today);
        assert_eq!(ms, 3 * 60 * 60 * 1000);
        assert_eq!(time_until_next_utc_midnight(ms), (3, 0, 0));
        assert_eq!(time_until_next_utc_midnight(3_661_000), (1, 1, 1));
    }
}
