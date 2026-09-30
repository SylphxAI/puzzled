//! Personal streak from accepted ritual product days, bridged by freezes.
//!
//! The streak is a pure projection of distinct `game_sessions` product days that
//! already qualified as ritual completions (archive, practice and abandoned rows
//! never count) plus the days a streak freeze covered. A covered day keeps the
//! run alive but adds nothing to its length.
//!
//! Freezes are earned by play: one for every [`FREEZE_EVERY_DAYS`] played days of
//! a run, at most [`FREEZE_CAP`] held. [`settle_freezes`] decides, from the same
//! days, which milestones are newly earned and which missed days a held freeze
//! covers; the shell only persists its answer.

use chrono::{Days, NaiveDate};

/// Played days of one run that earn a freeze.
pub const FREEZE_EVERY_DAYS: u32 = 7;
/// Most freezes a player can hold at once.
pub const FREEZE_CAP: u32 = 2;
/// Most consecutive missed days one return can cover.
pub const MAX_BRIDGE_DAYS: u32 = 3;
/// A run must have at least this many played days to be worth a freeze.
pub const MIN_RUN_TO_PROTECT: u32 = 2;

/// Personal habit projection for one player.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PersonalStreak {
    pub current_streak: u32,
    pub max_streak: u32,
    pub has_played_today: bool,
    /// Played days still needed to earn the next freeze (1..=7).
    pub days_until_next_freeze: u32,
    /// Yesterday was missed and a freeze kept the run alive.
    pub freeze_used_yesterday: bool,
}

/// Unparseable ritual `day_key` - fail closed, do not skip.
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

fn sorted_unique(days: &[NaiveDate]) -> Vec<NaiveDate> {
    let mut unique = days.to_vec();
    unique.sort_unstable();
    unique.dedup();
    unique
}

fn union(played: &[NaiveDate], frozen: &[NaiveDate]) -> Vec<NaiveDate> {
    let mut all = played.to_vec();
    all.extend_from_slice(frozen);
    sorted_unique(&all)
}

fn previous(day: NaiveDate) -> Option<NaiveDate> {
    day.checked_sub_days(Days::new(1))
}

/// Compute current/max streak and has-played-today from accepted ritual days
/// and the days a freeze covered.
///
/// `days` may include duplicates (several catalog modules on one product day).
/// A missed, uncovered yesterday resets `current_streak` but leaves
/// `max_streak`. Playing today is not required to keep yesterday's run visible
/// (at-risk). A covered day bridges a gap but is not counted.
#[must_use]
pub fn compute_personal_streak(
    today: NaiveDate,
    days: &[NaiveDate],
    frozen: &[NaiveDate],
) -> PersonalStreak {
    let played = sorted_unique(days);
    let covered = union(&played, frozen);

    let has_played_today = played.binary_search(&today).is_ok();
    let max_streak = longest_run(&covered, &played);
    let yesterday = previous(today);
    let current_end = if has_played_today {
        Some(today)
    } else {
        yesterday
    };
    let current_streak = current_end.map_or(0, |end| run_ending_on(&covered, &played, end));
    let freeze_used_yesterday = yesterday.is_some_and(|y| {
        played.binary_search(&y).is_err() && frozen.contains(&y) && current_streak > 0
    });

    PersonalStreak {
        current_streak,
        max_streak,
        has_played_today,
        days_until_next_freeze: FREEZE_EVERY_DAYS - current_streak % FREEZE_EVERY_DAYS,
        freeze_used_yesterday,
    }
}

/// What to persist so the streak reflects earned and used freezes.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Settlement {
    /// Milestone days newly recorded as earned (each is recorded once, ever).
    pub award_days: Vec<NaiveDate>,
    /// Freezes actually added to the held count (the cap can absorb some).
    pub granted: u32,
    /// Missed days a held freeze now covers.
    pub cover_days: Vec<NaiveDate>,
    /// Held freezes after this settlement.
    pub available_after: u32,
}

impl Settlement {
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.award_days.is_empty() && self.cover_days.is_empty()
    }
}

/// Decide the freeze changes for a player as of `today`.
///
/// `played` and `frozen` are the recorded days; `awarded` the milestone days
/// already recorded; `available` the freezes held now. Only the run that ends
/// at the player's last covered day is considered, and only while it can still
/// be saved (at most [`MAX_BRIDGE_DAYS`] missed days since). Covering needs
/// `auto_enabled`, a run of at least [`MIN_RUN_TO_PROTECT`] played days, and a
/// held freeze for every missed day.
#[must_use]
pub fn settle_freezes(
    today: NaiveDate,
    played: &[NaiveDate],
    frozen: &[NaiveDate],
    awarded: &[NaiveDate],
    available: u32,
    auto_enabled: bool,
) -> Settlement {
    let played = sorted_unique(played);
    let covered: Vec<NaiveDate> = union(&played, frozen)
        .into_iter()
        .filter(|day| *day <= today)
        .collect();
    let idle = Settlement {
        available_after: available,
        ..Settlement::default()
    };
    let Some(last) = covered.last().copied() else {
        return idle;
    };
    let missed = u32::try_from(((today - last).num_days() - 1).max(0)).unwrap_or(u32::MAX);
    if missed > MAX_BRIDGE_DAYS {
        return idle;
    }

    // The run ending at `last`, oldest played day first.
    let mut run_played = Vec::new();
    let mut expected = last;
    for day in covered.iter().rev() {
        if *day != expected {
            break;
        }
        if played.binary_search(day).is_ok() {
            run_played.push(*day);
        }
        match previous(expected) {
            Some(before) => expected = before,
            None => break,
        }
    }
    run_played.reverse();

    let award_days: Vec<NaiveDate> = run_played
        .iter()
        .enumerate()
        .filter(|(index, day)| {
            (index + 1) % FREEZE_EVERY_DAYS as usize == 0 && !awarded.contains(day)
        })
        .map(|(_, day)| *day)
        .collect();
    let room = FREEZE_CAP.saturating_sub(available);
    let granted = u32::try_from(award_days.len())
        .unwrap_or(u32::MAX)
        .min(room);
    let mut available_after = available + granted;

    let mut cover_days = Vec::new();
    let run_length = u32::try_from(run_played.len()).unwrap_or(u32::MAX);
    if missed > 0 && auto_enabled && run_length >= MIN_RUN_TO_PROTECT && missed <= available_after {
        let mut day = last;
        for _ in 0..missed {
            day = day.checked_add_days(Days::new(1)).unwrap_or(day);
            cover_days.push(day);
        }
        available_after -= missed;
    }

    Settlement {
        award_days,
        granted,
        cover_days,
        available_after,
    }
}

fn longest_run(covered: &[NaiveDate], played: &[NaiveDate]) -> u32 {
    let mut best = 0u32;
    let mut current = 0u32;
    let mut before: Option<NaiveDate> = None;
    for &day in covered {
        if !before.is_some_and(|b| previous(day) == Some(b)) {
            current = 0;
        }
        if played.binary_search(&day).is_ok() {
            current = current.saturating_add(1);
        }
        best = best.max(current);
        before = Some(day);
    }
    best
}

fn run_ending_on(covered: &[NaiveDate], played: &[NaiveDate], end: NaiveDate) -> u32 {
    if covered.binary_search(&end).is_err() {
        return 0;
    }
    let mut count = 0u32;
    let mut expected = end;
    for &day in covered.iter().rev() {
        if day > expected {
            continue;
        }
        if day != expected {
            break;
        }
        if played.binary_search(&day).is_ok() {
            count = count.saturating_add(1);
        }
        match previous(expected) {
            Some(before) => expected = before,
            None => break,
        }
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
        let streak = compute_personal_streak(today, &[], &[]);
        assert_eq!(
            streak,
            PersonalStreak {
                current_streak: 0,
                max_streak: 0,
                has_played_today: false,
                days_until_next_freeze: 7,
                freeze_used_yesterday: false,
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
        let streak = compute_personal_streak(today, &days, &[]);
        assert_eq!(streak.current_streak, 3);
        assert_eq!(streak.max_streak, 3);
        assert!(streak.has_played_today);
    }

    #[test]
    fn sudoku_finish_counts_when_word_guess_is_absent() {
        let today = d(2026, 8, 22);
        let days = [d(2026, 8, 21), d(2026, 8, 22)];
        let streak = compute_personal_streak(today, &days, &[]);
        assert_eq!(streak.current_streak, 2);
        assert!(streak.has_played_today);
    }

    #[test]
    fn prior_run_stays_visible_when_today_is_at_risk() {
        let today = d(2026, 8, 22);
        let days = [d(2026, 8, 20), d(2026, 8, 21)];
        let streak = compute_personal_streak(today, &days, &[]);
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
        let streak = compute_personal_streak(today, &days, &[]);
        assert_eq!(streak.current_streak, 0);
        assert_eq!(streak.max_streak, 4);
        assert!(!streak.has_played_today);
    }

    #[test]
    fn today_alone_starts_a_new_run_after_a_gap() {
        let today = d(2026, 8, 22);
        let days = [d(2026, 8, 10), d(2026, 8, 11), d(2026, 8, 22)];
        let streak = compute_personal_streak(today, &days, &[]);
        assert_eq!(streak.current_streak, 1);
        assert_eq!(streak.max_streak, 2);
        assert!(streak.has_played_today);
    }

    #[test]
    fn unsorted_days_still_agree() {
        let today = d(2026, 8, 22);
        let days = [d(2026, 8, 22), d(2026, 8, 20), d(2026, 8, 21)];
        let streak = compute_personal_streak(today, &days, &[]);
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

    fn days(list: &[(u32, u32)]) -> Vec<NaiveDate> {
        list.iter().map(|(m, day)| d(2026, *m, *day)).collect()
    }

    fn run(from: u32, to: u32) -> Vec<NaiveDate> {
        (from..=to).map(|day| d(2026, 8, day)).collect()
    }

    #[test]
    fn a_covered_day_bridges_the_run_but_is_not_counted() {
        let today = d(2026, 8, 22);
        let played = days(&[(8, 18), (8, 19), (8, 21), (8, 22)]);
        let frozen = days(&[(8, 20)]);
        let streak = compute_personal_streak(today, &played, &frozen);
        assert_eq!(streak.current_streak, 4);
        assert_eq!(streak.max_streak, 4);
        let bare = compute_personal_streak(today, &played, &[]);
        assert_eq!(bare.current_streak, 2);
    }

    #[test]
    fn yesterday_covered_keeps_the_run_alive_and_says_so() {
        let today = d(2026, 8, 22);
        let played = days(&[(8, 19), (8, 20)]);
        let frozen = days(&[(8, 21)]);
        let streak = compute_personal_streak(today, &played, &frozen);
        assert_eq!(streak.current_streak, 2);
        assert!(streak.freeze_used_yesterday);
        assert!(!streak.has_played_today);
    }

    #[test]
    fn days_until_next_freeze_counts_down_and_restarts() {
        let today = d(2026, 8, 22);
        let three = days(&[(8, 20), (8, 21), (8, 22)]);
        assert_eq!(
            compute_personal_streak(today, &three, &[]).days_until_next_freeze,
            4
        );
        let seven = run(16, 22);
        assert_eq!(
            compute_personal_streak(today, &seven, &[]).days_until_next_freeze,
            7
        );
    }

    #[test]
    fn the_seventh_played_day_earns_a_freeze_once() {
        let today = d(2026, 8, 7);
        let played = run(1, 7);
        let first = settle_freezes(today, &played, &[], &[], 0, true);
        assert_eq!(first.award_days, vec![d(2026, 8, 7)]);
        assert_eq!(first.granted, 1);
        assert_eq!(first.available_after, 1);
        assert!(first.cover_days.is_empty());
        let again = settle_freezes(today, &played, &[], &first.award_days, 1, true);
        assert!(again.is_empty());
        assert_eq!(again.granted, 0);
    }

    #[test]
    fn six_days_earn_nothing_and_fourteen_earn_two() {
        assert!(settle_freezes(d(2026, 8, 6), &run(1, 6), &[], &[], 0, true).is_empty());
        let fourteen = settle_freezes(d(2026, 8, 14), &run(1, 14), &[], &[], 0, true);
        assert_eq!(fourteen.award_days, vec![d(2026, 8, 7), d(2026, 8, 14)]);
        assert_eq!(fourteen.granted, 2);
    }

    #[test]
    fn holding_the_cap_records_the_milestone_but_grants_nothing() {
        let settled = settle_freezes(d(2026, 8, 7), &run(1, 7), &[], &[], FREEZE_CAP, true);
        assert_eq!(settled.award_days, vec![d(2026, 8, 7)]);
        assert_eq!(settled.granted, 0);
        assert_eq!(settled.available_after, FREEZE_CAP);
    }

    #[test]
    fn a_covered_day_does_not_count_toward_the_next_freeze() {
        let mut played = run(1, 5);
        played.push(d(2026, 8, 7));
        let frozen = vec![d(2026, 8, 6)];
        let settled = settle_freezes(d(2026, 8, 7), &played, &frozen, &[], 0, true);
        assert!(settled.award_days.is_empty(), "7 run days, only 6 played");
        played.push(d(2026, 8, 8));
        let settled = settle_freezes(d(2026, 8, 8), &played, &frozen, &[], 0, true);
        assert_eq!(settled.award_days, vec![d(2026, 8, 8)]);
    }

    #[test]
    fn a_held_freeze_covers_one_missed_day() {
        let today = d(2026, 8, 9);
        let settled = settle_freezes(today, &run(5, 7), &[], &[], 1, true);
        assert_eq!(settled.cover_days, vec![d(2026, 8, 8)]);
        assert_eq!(settled.available_after, 0);
        let streak = compute_personal_streak(today, &run(5, 7), &settled.cover_days);
        assert_eq!(streak.current_streak, 3);
        assert!(streak.freeze_used_yesterday);
    }

    #[test]
    fn covering_needs_a_freeze_the_setting_and_a_real_run() {
        let today = d(2026, 8, 9);
        assert!(settle_freezes(today, &run(5, 7), &[], &[], 0, true)
            .cover_days
            .is_empty());
        assert!(settle_freezes(today, &run(5, 7), &[], &[], 2, false)
            .cover_days
            .is_empty());
        assert!(settle_freezes(today, &run(7, 7), &[], &[], 2, true)
            .cover_days
            .is_empty());
    }

    #[test]
    fn two_missed_days_need_two_freezes_and_four_are_too_many() {
        let today = d(2026, 8, 10);
        let two = settle_freezes(today, &run(5, 7), &[], &[], 2, true);
        assert_eq!(two.cover_days, vec![d(2026, 8, 8), d(2026, 8, 9)]);
        assert_eq!(two.available_after, 0);
        assert!(settle_freezes(today, &run(5, 7), &[], &[], 1, true)
            .cover_days
            .is_empty());
        let late = settle_freezes(d(2026, 8, 12), &run(5, 7), &[], &[], 2, true);
        assert!(late.cover_days.is_empty(), "four missed days lose the run");
    }

    #[test]
    fn nothing_is_covered_when_no_day_was_missed() {
        let settled = settle_freezes(d(2026, 8, 8), &run(5, 7), &[], &[], 2, true);
        assert!(settled.cover_days.is_empty());
        assert_eq!(settled.available_after, 2);
    }

    #[test]
    fn a_return_can_earn_and_use_in_one_settlement() {
        let settled = settle_freezes(d(2026, 8, 9), &run(1, 7), &[], &[], 0, true);
        assert_eq!(settled.granted, 1);
        assert_eq!(settled.cover_days, vec![d(2026, 8, 8)]);
        assert_eq!(settled.available_after, 0);
    }

    #[test]
    fn empty_history_settles_to_nothing() {
        let settled = settle_freezes(d(2026, 8, 9), &[], &[], &[], 1, true);
        assert!(settled.is_empty());
        assert_eq!(settled.available_after, 1);
    }
}
