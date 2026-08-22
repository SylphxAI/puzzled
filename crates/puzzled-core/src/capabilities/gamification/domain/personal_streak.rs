//! Personal streak from accepted ritual product days.
//!
//! GetStreakInfo is a pure read of distinct `game_sessions` product days that
//! already qualified as ritual completions. This module does not invent days,
//! apply freeze grants, or count archive/practice/abandoned rows.

use chrono::{Days, NaiveDate};

/// Personal habit projection for one player.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PersonalStreak {
    pub current_streak: u32,
    pub max_streak: u32,
    pub has_played_today: bool,
}

/// Unparseable ritual `day_key` — fail closed, do not skip.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InvalidDayKey(pub String);

/// Parse a product day key (`YYYY-MM-DD`). Empty or malformed keys are errors.
pub fn parse_day_key(raw: &str) -> Result<NaiveDate, InvalidDayKey> {
    let trimmed = raw.trim();
    NaiveDate::parse_from_str(trimmed, "%Y-%m-%d").map_err(|_| InvalidDayKey(trimmed.to_string()))
}

/// Parse accepted ritual day keys. One bad key fails the whole payload.
pub fn parse_accepted_day_keys<I, S>(raw: I) -> Result<Vec<NaiveDate>, InvalidDayKey>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    raw.into_iter()
        .map(|value| parse_day_key(value.as_ref()))
        .collect()
}

/// Compute current/max streak and has-played-today from accepted ritual days.
///
/// `days` may include duplicates (several catalog modules on one product day).
/// A missed yesterday resets `current_streak` but leaves `max_streak`. Playing
/// today is not required to keep yesterday's run visible (at-risk).
#[must_use]
pub fn compute_personal_streak(today: NaiveDate, days: &[NaiveDate]) -> PersonalStreak {
    let mut unique = days.to_vec();
    unique.sort_unstable();
    unique.dedup();

    let has_played_today = unique.binary_search(&today).is_ok();
    let max_streak = longest_consecutive_run(&unique);
    let current_end = if has_played_today {
        today
    } else {
        match today.checked_sub_days(Days::new(1)) {
            Some(yesterday) => yesterday,
            None => {
                return PersonalStreak {
                    current_streak: 0,
                    max_streak,
                    has_played_today: false,
                };
            }
        }
    };
    let current_streak = run_ending_on(&unique, current_end);

    PersonalStreak {
        current_streak,
        max_streak,
        has_played_today,
    }
}

fn longest_consecutive_run(sorted_unique: &[NaiveDate]) -> u32 {
    let Some(first) = sorted_unique.first().copied() else {
        return 0;
    };
    let mut max_run = 1u32;
    let mut current_run = 1u32;
    let mut previous = first;
    for &day in sorted_unique.iter().skip(1) {
        if day == previous {
            continue;
        }
        if day.checked_sub_days(Days::new(1)) == Some(previous) {
            current_run = current_run.saturating_add(1);
            max_run = max_run.max(current_run);
        } else {
            current_run = 1;
        }
        previous = day;
    }
    max_run
}

fn run_ending_on(sorted_unique: &[NaiveDate], end: NaiveDate) -> u32 {
    if sorted_unique.binary_search(&end).is_err() {
        return 0;
    }
    let mut count = 0u32;
    let mut expected = end;
    for &day in sorted_unique.iter().rev() {
        if day > expected {
            continue;
        }
        if day == expected {
            count = count.saturating_add(1);
            expected = match expected.checked_sub_days(Days::new(1)) {
                Some(previous) => previous,
                None => break,
            };
            continue;
        }
        break;
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("date")
    }

    #[test]
    fn empty_history_is_honest_zeros() {
        let today = d(2026, 8, 22);
        let streak = compute_personal_streak(today, &[]);
        assert_eq!(
            streak,
            PersonalStreak {
                current_streak: 0,
                max_streak: 0,
                has_played_today: false,
            }
        );
    }

    #[test]
    fn catalog_modules_on_the_same_day_count_once() {
        let today = d(2026, 8, 22);
        let days = [
            d(2026, 8, 20),
            d(2026, 8, 21),
            d(2026, 8, 21),
            d(2026, 8, 22),
            d(2026, 8, 22),
        ];
        let streak = compute_personal_streak(today, &days);
        assert_eq!(streak.current_streak, 3);
        assert_eq!(streak.max_streak, 3);
        assert!(streak.has_played_today);
    }

    #[test]
    fn sudoku_finish_counts_when_word_guess_is_absent() {
        let today = d(2026, 8, 22);
        let days = [d(2026, 8, 21), d(2026, 8, 22)];
        let streak = compute_personal_streak(today, &days);
        assert_eq!(streak.current_streak, 2);
        assert!(streak.has_played_today);
    }

    #[test]
    fn prior_run_stays_visible_when_today_is_at_risk() {
        let today = d(2026, 8, 22);
        let days = [d(2026, 8, 20), d(2026, 8, 21)];
        let streak = compute_personal_streak(today, &days);
        assert_eq!(streak.current_streak, 2);
        assert_eq!(streak.max_streak, 2);
        assert!(!streak.has_played_today);
    }

    #[test]
    fn missed_yesterday_resets_current_and_keeps_max() {
        let today = d(2026, 8, 22);
        let days = [
            d(2026, 8, 16),
            d(2026, 8, 17),
            d(2026, 8, 18),
            d(2026, 8, 19),
        ];
        let streak = compute_personal_streak(today, &days);
        assert_eq!(streak.current_streak, 0);
        assert_eq!(streak.max_streak, 4);
        assert!(!streak.has_played_today);
    }

    #[test]
    fn today_alone_starts_a_new_run_after_a_gap() {
        let today = d(2026, 8, 22);
        let days = [d(2026, 8, 10), d(2026, 8, 11), d(2026, 8, 22)];
        let streak = compute_personal_streak(today, &days);
        assert_eq!(streak.current_streak, 1);
        assert_eq!(streak.max_streak, 2);
        assert!(streak.has_played_today);
    }

    #[test]
    fn unsorted_days_still_agree() {
        let today = d(2026, 8, 22);
        let days = [d(2026, 8, 22), d(2026, 8, 20), d(2026, 8, 21)];
        let streak = compute_personal_streak(today, &days);
        assert_eq!(streak.current_streak, 3);
        assert_eq!(streak.max_streak, 3);
    }

    #[test]
    fn malformed_day_key_fails_closed() {
        assert!(parse_day_key("").is_err());
        assert!(parse_day_key("today").is_err());
        assert!(parse_day_key("2026-13-01").is_err());
        assert_eq!(parse_day_key("2026-08-22").expect("day"), d(2026, 8, 22));
        assert!(parse_accepted_day_keys(["2026-08-21", "nope"]).is_err());
        assert_eq!(
            parse_accepted_day_keys(["2026-08-21", "2026-08-22"]).expect("days"),
            vec![d(2026, 8, 21), d(2026, 8, 22)]
        );
    }
}
