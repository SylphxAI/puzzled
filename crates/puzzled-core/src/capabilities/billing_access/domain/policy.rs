//! Pure billing / free-game access policy —
//! dual-oracle residual of `apps/puzzled/src/lib/billing/server.ts`
//! (plan slugs + FREE_GAME_ROTATION + day-of-year free game + access gate).
//! Platform SDK subscription I/O stays FE-TS residual.
//! NO authority_rust / ts_deleted.

/// Premium plan slugs (TS `PREMIUM_PLANS`).
pub const PREMIUM_PLANS: &[&str] = &["premium", "lifetime", "pro"];

/// Free-tier daily rotation (TS `FREE_GAME_ROTATION` order).
pub const FREE_GAME_ROTATION: &[&str] =
    &["word-guess", "word-groups", "queens", "sudoku", "crossword"];

const DAY_MS: i64 = 86_400_000;

/// True when plan slug is a paid premium plan (TS `_isPremiumPlan`).
#[must_use]
pub fn is_premium_plan(plan_slug: Option<&str>) -> bool {
    match plan_slug {
        Some(s) if !s.is_empty() => PREMIUM_PLANS.contains(&s),
        _ => false,
    }
}

/// True when plan is free / unset (TS `_isFreePlan`).
#[must_use]
pub fn is_free_plan(plan_slug: Option<&str>) -> bool {
    match plan_slug {
        None => true,
        Some(s) if s.is_empty() || s == "free" => true,
        _ => false,
    }
}

/// Day-of-year dual-oracle of TS
/// `Math.floor((now - new Date(utcYear, 0, 0)) / DAY_MS)` under UTC host TZ
/// (`new Date(y, 0, 0)` ≡ Dec 31 of previous year 00:00).
///
/// `utc_year` must match `Date.UTC` year of `now_ms` (injectable for tests).
#[must_use]
pub fn day_of_year_ts_utc(now_ms: i64, utc_year: i32) -> i64 {
    // Date(y, 0, 0) under UTC = y-1-12-31T00:00:00.000Z
    // Construct via civil date → Unix ms without chrono dependency here.
    let jan0_ms = utc_year_start_minus_one_day_ms(utc_year);
    (now_ms - jan0_ms).div_euclid(DAY_MS)
}

/// Midnight UTC of Dec 31 of `utc_year - 1` (TS `new Date(y, 0, 0)` under UTC).
#[must_use]
pub fn utc_year_start_minus_one_day_ms(utc_year: i32) -> i64 {
    // days from 1970-01-01 to (utc_year-1)-12-31 = days to utc_year-01-01 minus 1
    let days_to_year_start = days_from_unix_epoch_to_jan1(utc_year);
    (days_to_year_start - 1) * DAY_MS
}

/// Days from 1970-01-01 to Jan 1 of `year` (UTC, proleptic Gregorian).
#[must_use]
pub fn days_from_unix_epoch_to_jan1(year: i32) -> i64 {
    // Algorithm: cumulative Gregorian days from year 1970 to year.
    let mut days: i64 = 0;
    if year >= 1970 {
        for y in 1970..year {
            days += if is_leap_year(y) { 366 } else { 365 };
        }
    } else {
        for y in year..1970 {
            days -= if is_leap_year(y) { 366 } else { 365 };
        }
    }
    days
}

#[must_use]
pub fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

/// Today's free game from injectable day-of-year (TS `getTodaysFreeGame` mod rotation).
#[must_use]
pub fn free_game_for_day_of_year(day_of_year: i64) -> &'static str {
    let n = FREE_GAME_ROTATION.len() as i64;
    let idx = day_of_year.rem_euclid(n) as usize;
    FREE_GAME_ROTATION[idx]
}

/// Free game for epoch ms + UTC year (full dual-oracle of getTodaysFreeGame under UTC).
#[must_use]
pub fn todays_free_game(now_ms: i64, utc_year: i32) -> &'static str {
    free_game_for_day_of_year(day_of_year_ts_utc(now_ms, utc_year))
}

/// True when game is today's free rotation entry (TS `isGameFreeToday`).
#[must_use]
pub fn is_game_free_today(game_slug: &str, free_today: &str) -> bool {
    game_slug == free_today
}

/// Pure access gate dual-oracle of TS `canAccessGame` product half
/// (SDK premium resolution injected as `is_premium`).
///
/// - premium → all games
/// - free / anonymous → only today's free game
#[must_use]
pub fn can_access_game(is_premium: bool, game_slug: &str, free_today: &str) -> bool {
    if is_premium {
        return true;
    }
    is_game_free_today(game_slug, free_today)
}

/// Active+premium subscription gate (TS `hasPremiumAccess` pure half).
/// `status` is subscription status wire; `plan_slug` is plan.
#[must_use]
pub fn has_premium_access(status: Option<&str>, plan_slug: Option<&str>) -> bool {
    let active = matches!(status, Some("active") | Some("trialing"));
    active && is_premium_plan(plan_slug)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plan_tables() {
        assert!(is_premium_plan(Some("premium")));
        assert!(is_premium_plan(Some("lifetime")));
        assert!(is_premium_plan(Some("pro")));
        assert!(!is_premium_plan(Some("free")));
        assert!(!is_premium_plan(None));
        assert!(is_free_plan(None));
        assert!(is_free_plan(Some("free")));
        assert!(is_free_plan(Some("")));
        assert!(!is_free_plan(Some("premium")));
    }

    #[test]
    fn free_rotation_order() {
        assert_eq!(FREE_GAME_ROTATION.len(), 5);
        assert_eq!(FREE_GAME_ROTATION[0], "word-guess");
        assert_eq!(FREE_GAME_ROTATION[1], "word-groups");
        assert_eq!(FREE_GAME_ROTATION[2], "queens");
        assert_eq!(FREE_GAME_ROTATION[3], "sudoku");
        assert_eq!(FREE_GAME_ROTATION[4], "crossword");
    }

    #[test]
    fn day_of_year_utc_oracle_table() {
        // Fixtures from TZ=UTC node dual-oracle of billing/server.ts
        // 2024-01-01T00:00:00Z → doy 1
        assert_eq!(day_of_year_ts_utc(1_704_067_200_000, 2024), 1);
        // 2024-01-02T00:00:00Z → doy 2
        assert_eq!(day_of_year_ts_utc(1_704_153_600_000, 2024), 2);
        // 2024-07-15T21:00:00Z → doy 197
        assert_eq!(day_of_year_ts_utc(1_721_077_200_000, 2024), 197);
        // 2024-12-31T12:00:00Z → doy 366 (leap)
        assert_eq!(day_of_year_ts_utc(1_735_646_400_000, 2024), 366);
        // 2025-01-01T00:00:00Z → doy 1
        assert_eq!(day_of_year_ts_utc(1_735_689_600_000, 2025), 1);
        // 2025-12-31T23:00:00Z → doy 365
        assert_eq!(day_of_year_ts_utc(1_767_222_000_000, 2025), 365);
    }

    #[test]
    fn free_game_for_doy_mod() {
        assert_eq!(free_game_for_day_of_year(1), "word-groups");
        assert_eq!(free_game_for_day_of_year(2), "queens");
        assert_eq!(free_game_for_day_of_year(197), "queens"); // 197 % 5 = 2
        assert_eq!(free_game_for_day_of_year(365), "word-guess"); // 365 % 5 = 0
        assert_eq!(free_game_for_day_of_year(0), "word-guess");
        // Full path: 2024-01-01T00:00Z → word-groups
        assert_eq!(todays_free_game(1_704_067_200_000, 2024), "word-groups");
        // 2025-12-31T23:00Z → word-guess
        assert_eq!(todays_free_game(1_767_222_000_000, 2025), "word-guess");
    }

    #[test]
    fn access_policy() {
        assert!(can_access_game(true, "sudoku", "word-guess"));
        assert!(can_access_game(false, "word-guess", "word-guess"));
        assert!(!can_access_game(false, "sudoku", "word-guess"));
        assert!(has_premium_access(Some("active"), Some("premium")));
        assert!(has_premium_access(Some("trialing"), Some("pro")));
        assert!(!has_premium_access(Some("canceled"), Some("premium")));
        assert!(!has_premium_access(Some("active"), Some("free")));
        assert!(!has_premium_access(None, Some("premium")));
    }

    #[test]
    fn leap_year_helper() {
        assert!(is_leap_year(2024));
        assert!(!is_leap_year(2025));
        assert!(is_leap_year(2000));
        assert!(!is_leap_year(1900));
    }
}
