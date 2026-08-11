//! Valid game slugs — mirrors `apps/puzzled/src/games/registry.ts` GAME_CONFIGS keys.

use chrono::Datelike;

const VALID_SLUGS: &[&str] = &[
    "word-guess",
    "word-groups",
    "word-hive",
    "crossword",
    "sudoku",
    "nonogram",
    "word-ladder",
    "arithmo",
    "pattern-match",
    "block-slide",
    "queens",
    "tango",
    "word-box",
    "quad-words",
    "killer-sudoku",
    "cryptogram",
    "word-search",
];

/// Returns true when `slug` is a registered game identifier.
#[must_use]
pub fn is_valid_game_slug(slug: &str) -> bool {
    VALID_SLUGS.contains(&slug)
}

/// Frozen catalog of registered game slugs (order matches registry keys).
#[must_use]
pub fn all_game_slugs() -> &'static [&'static str] {
    VALID_SLUGS
}

/// Premium-free daily rotation (mirrors apps/puzzled/src/lib/billing/server.ts).
const FREE_GAME_ROTATION: [&str; 5] =
    ["word-guess", "word-groups", "queens", "sudoku", "crossword"];

/// Today's free game for a UTC date (day-of-year rotation).
#[must_use]
pub fn todays_free_game(date: chrono::NaiveDate) -> &'static str {
    let day_of_year = date.ordinal0() as usize;
    FREE_GAME_ROTATION[day_of_year % FREE_GAME_ROTATION.len()]
}

/// True when a game is playable by free users on the given UTC date.
#[must_use]
pub fn is_game_free_today(game_slug: &str, date: chrono::NaiveDate) -> bool {
    game_slug == todays_free_game(date)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_known_slugs() {
        assert!(is_valid_game_slug("sudoku"));
        assert!(is_valid_game_slug("word-guess"));
    }

    #[test]
    fn rejects_unknown_slugs() {
        assert!(!is_valid_game_slug(""));
        assert!(!is_valid_game_slug("not-a-game"));
    }

    #[test]
    fn rotation_is_stable_per_day() {
        let date = chrono::NaiveDate::from_ymd_opt(2026, 8, 9).expect("date");
        let a = todays_free_game(date);
        let b = todays_free_game(date);
        assert_eq!(a, b);
        assert!(FREE_GAME_ROTATION.contains(&a));
        assert!(is_game_free_today(a, date));
        assert!(!is_game_free_today("arithmo", date));
    }
}
