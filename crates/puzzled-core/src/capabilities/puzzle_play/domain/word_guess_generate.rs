//! Deterministic word-guess (Wordle) generator (free-floor fallback).
//!
//! Mirrors `apps/puzzled/src/games/word-guess/config.ts#getWordFromSeed`.
//! Client payload is `{wordLength, maxAttempts}`; the solution word never
//! leaves the server (`client_safe_puzzle_data` strips a leaked `word`).

use std::sync::LazyLock;

use serde_json::{json, Value};

use super::wordle_eval::{MAX_GUESSES, WORD_LENGTH};

const SOLUTION_WORDS_RAW: &str = include_str!("data/word_guess_solutions.txt");

static SOLUTION_WORDS: LazyLock<Vec<&'static str>> = LazyLock::new(|| {
    SOLUTION_WORDS_RAW
        .lines()
        .filter(|line| !line.is_empty())
        .collect()
});

/// Curated daily-solution list (same order as the TypeScript `SOLUTION_WORDS`).
#[must_use]
pub fn solution_word_count() -> usize {
    SOLUTION_WORDS.len()
}

fn word_from_seed(seed: i64) -> String {
    let words = SOLUTION_WORDS.as_slice();
    if words.is_empty() {
        panic!("word-guess solution list is empty");
    }
    let idx = (seed.unsigned_abs() as usize) % words.len();
    words[idx].to_ascii_uppercase()
}

/// Deterministic daily word-guess: (client-safe puzzle_data, solution).
#[must_use]
pub fn generate_word_guess_puzzle(seed: i64) -> (Value, Value) {
    let word = word_from_seed(seed);
    let puzzle_data = json!({
        "wordLength": WORD_LENGTH,
        "maxAttempts": MAX_GUESSES,
    });
    (puzzle_data, json!({ "word": word }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capabilities::puzzle_play::crossword_generate::client_safe_puzzle_data;

    #[test]
    fn list_matches_typescript_bank() {
        assert_eq!(solution_word_count(), 2315);
        assert_eq!(SOLUTION_WORDS[0], "aback");
        assert_eq!(SOLUTION_WORDS[1], "abase");
        assert_eq!(SOLUTION_WORDS[2], "abate");
        assert_eq!(SOLUTION_WORDS[3], "abbey");
        assert_eq!(SOLUTION_WORDS[4], "abbot");
        assert_eq!(SOLUTION_WORDS[solution_word_count() - 3], "zebra");
        assert_eq!(SOLUTION_WORDS[solution_word_count() - 2], "zesty");
        assert_eq!(SOLUTION_WORDS[solution_word_count() - 1], "zonal");
    }

    #[test]
    fn seed_is_deterministic() {
        let (a, sa) = generate_word_guess_puzzle(956);
        let (b, sb) = generate_word_guess_puzzle(956);
        assert_eq!(a, b);
        assert_eq!(sa, sb);
        assert_eq!(sa["word"], "HASTE");
        assert_eq!(generate_word_guess_puzzle(0).1["word"], "ABACK");
        assert_eq!(generate_word_guess_puzzle(1).1["word"], "ABASE");
        assert_eq!(generate_word_guess_puzzle(5).1["word"], "ABHOR");
        assert_eq!(generate_word_guess_puzzle(980).1["word"], "HIPPO");
    }

    #[test]
    fn client_payload_has_no_solution_word() {
        let (pd, sol) = generate_word_guess_puzzle(956);
        assert_eq!(pd["wordLength"], WORD_LENGTH as u64);
        assert_eq!(pd["maxAttempts"], MAX_GUESSES);
        assert!(pd.get("word").is_none());
        assert!(pd.get("solution").is_none());
        let dumped = pd.to_string();
        assert!(
            !dumped.to_ascii_lowercase().contains("haste"),
            "solution must not appear in client puzzle_data: {dumped}"
        );
        assert_eq!(sol["word"], "HASTE");
    }

    #[test]
    fn client_safe_strips_leaked_word() {
        let leaked = json!({
            "wordLength": 5,
            "maxAttempts": 6,
            "word": "HASTE",
        });
        let safe = client_safe_puzzle_data(leaked);
        assert_eq!(safe.get("word"), None);
        assert_eq!(safe["wordLength"], 5);
    }
}
