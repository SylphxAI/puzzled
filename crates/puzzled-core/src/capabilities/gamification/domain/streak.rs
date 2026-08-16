//! Server-accepted daily ritual streak semantics.
//!
//! The shell supplies distinct product-day keys from accepted ritual rows;
//! this module owns the pure consecutive-day calculation and never writes
//! completion state.

use chrono::{Duration, NaiveDate};

/// Streak values derived from server-accepted daily ritual finishes.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct StreakSummary {
    pub current_streak: u32,
    pub max_streak: u32,
    pub has_played_today: bool,
}

/// Summarize distinct accepted ritual days up to `today`.
///
/// When today is not yet played, `current_streak` preserves the consecutive
/// run through yesterday so the product can warn a player before the reset.
#[must_use]
pub fn summarize_streak(today: NaiveDate, played_days: &[NaiveDate]) -> StreakSummary {
    let mut days = played_days
        .iter()
        .copied()
        .filter(|day| *day <= today)
        .collect::<Vec<_>>();
    days.sort_unstable();
    days.dedup();

    let has_played_today = days.binary_search(&today).is_ok();
    let current_anchor = if has_played_today {
        Some(today)
    } else {
        today.checked_sub_signed(Duration::days(1))
    };
    let current_streak = current_anchor
        .map(|anchor| trailing_run(anchor, &days))
        .unwrap_or(0);

    let mut max_streak = 0_u32;
    let mut run = 0_u32;
    let mut previous = None;
    for day in days {
        if previous.is_some_and(|prior| day == prior + Duration::days(1)) {
            run = run.saturating_add(1);
        } else {
            run = 1;
        }
        max_streak = max_streak.max(run);
        previous = Some(day);
    }

    StreakSummary {
        current_streak,
        max_streak,
        has_played_today,
    }
}

fn trailing_run(anchor: NaiveDate, days: &[NaiveDate]) -> u32 {
    let mut cursor = anchor;
    let mut count = 0_u32;
    while days.binary_search(&cursor).is_ok() {
        count = count.saturating_add(1);
        let Some(previous) = cursor.checked_sub_signed(Duration::days(1)) else {
            break;
        };
        cursor = previous;
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").expect("valid day")
    }

    #[test]
    fn current_streak_includes_today_and_max_spans_history() {
        let summary = summarize_streak(
            day("2026-08-16"),
            &[
                day("2026-08-10"),
                day("2026-08-11"),
                day("2026-08-14"),
                day("2026-08-15"),
                day("2026-08-16"),
            ],
        );

        assert_eq!(summary.current_streak, 3);
        assert_eq!(summary.max_streak, 3);
        assert!(summary.has_played_today);
    }

    #[test]
    fn current_streak_preserves_yesterdays_run_before_today_is_played() {
        let summary = summarize_streak(
            day("2026-08-16"),
            &[day("2026-08-13"), day("2026-08-14"), day("2026-08-15")],
        );

        assert_eq!(summary.current_streak, 3);
        assert_eq!(summary.max_streak, 3);
        assert!(!summary.has_played_today);
    }

    #[test]
    fn duplicate_and_future_days_do_not_inflate_streaks() {
        let summary = summarize_streak(
            day("2026-08-16"),
            &[day("2026-08-16"), day("2026-08-16"), day("2026-08-17")],
        );

        assert_eq!(summary.current_streak, 1);
        assert_eq!(summary.max_streak, 1);
        assert!(summary.has_played_today);
    }
}
