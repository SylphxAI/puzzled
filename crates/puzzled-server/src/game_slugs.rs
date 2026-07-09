//! Valid game slugs — mirrors `apps/puzzled/src/games/registry.ts` GAME_CONFIGS keys.

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
}