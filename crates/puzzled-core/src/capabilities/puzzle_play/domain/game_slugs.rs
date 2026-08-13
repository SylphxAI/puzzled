//! Valid game slugs — mirrors `apps/puzzled/src/games/registry.ts` GAME_CONFIGS keys.
//!
//! Module class and free-rotation use the **product day key** calendar date
//! (see `daily_time::product_day_key`), not client local clocks.

use chrono::Datelike;
use serde::{Deserialize, Serialize};

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
    "crowns",
    "duo",
    "word-box",
    "quad-words",
    "killer-sudoku",
    "cryptogram",
    "word-search",
];

/// Retired public slugs. Inbound only; writes persist [`canonicalize_game_slug`].
const SLUG_ALIASES: &[(&str, &str)] = &[("queens", "crowns"), ("tango", "duo")];

/// Map inbound alias → canonical catalog slug. Unknown strings pass through.
#[must_use]
pub fn canonicalize_game_slug(slug: &str) -> &str {
    let trimmed = slug.trim();
    for (from, to) in SLUG_ALIASES {
        if trimmed == *from {
            return to;
        }
    }
    trimmed
}

/// North Star module class (daily puzzle completers vs daily entertainment completers).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleClass {
    /// Contributes to daily puzzle completers.
    PuzzleRitual,
    /// Contributes only to daily entertainment completers; never daily puzzle completers.
    EntertainmentOracle,
}

impl ModuleClass {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::PuzzleRitual => "puzzle_ritual",
            Self::EntertainmentOracle => "entertainment_oracle",
        }
    }

    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim() {
            "puzzle_ritual" => Some(Self::PuzzleRitual),
            "entertainment_oracle" => Some(Self::EntertainmentOracle),
            _ => None,
        }
    }
}

/// Returns true when `slug` is a registered game identifier (or a retired alias).
#[must_use]
pub fn is_valid_game_slug(slug: &str) -> bool {
    let canonical = canonicalize_game_slug(slug);
    VALID_SLUGS.contains(&canonical)
}

/// Frozen catalog of registered game slugs (order matches registry keys).
#[must_use]
pub fn all_game_slugs() -> &'static [&'static str] {
    VALID_SLUGS
}

/// Module class for a registered slug.
///
/// All current catalog games are `puzzle_ritual`. Entertainment oracles are
/// registered here when shipped; unknown slugs return `None`.
#[must_use]
pub fn module_class_for(slug: &str) -> Option<ModuleClass> {
    if is_valid_game_slug(slug) {
        Some(ModuleClass::PuzzleRitual)
    } else {
        None
    }
}

/// Premium-free daily rotation (canonical slugs; mirrors TS `FREE_GAME_ROTATION`).
pub const FREE_GAME_ROTATION: [&str; 5] =
    ["word-guess", "word-groups", "crowns", "sudoku", "crossword"];

/// Today's free game for a **product day-key** calendar date (day-of-year rotation).
///
/// Callers must pass [`crate::puzzle_play::daily_time::product_day_key`], not a
/// client-local date.
#[must_use]
pub fn todays_free_game(date: chrono::NaiveDate) -> &'static str {
    let day_of_year = date.ordinal0() as usize;
    FREE_GAME_ROTATION[day_of_year % FREE_GAME_ROTATION.len()]
}

/// True when a game is playable by free users on the given product day-key date.
#[must_use]
pub fn is_game_free_today(game_slug: &str, date: chrono::NaiveDate) -> bool {
    canonicalize_game_slug(game_slug) == todays_free_game(date)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_known_slugs() {
        assert!(is_valid_game_slug("sudoku"));
        assert!(is_valid_game_slug("word-guess"));
        assert!(is_valid_game_slug("crowns"));
        assert!(is_valid_game_slug("queens"));
        assert_eq!(canonicalize_game_slug("queens"), "crowns");
        assert_eq!(canonicalize_game_slug("tango"), "duo");
        assert_eq!(canonicalize_game_slug("crowns"), "crowns");
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

    #[test]
    fn catalog_is_puzzle_ritual() {
        for slug in VALID_SLUGS {
            assert_eq!(module_class_for(slug), Some(ModuleClass::PuzzleRitual));
        }
        assert_eq!(module_class_for("not-a-game"), None);
        assert_eq!(ModuleClass::PuzzleRitual.as_str(), "puzzle_ritual");
    }
}
