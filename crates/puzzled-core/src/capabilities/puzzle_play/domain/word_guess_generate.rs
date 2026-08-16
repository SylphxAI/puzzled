//! Deterministic word-guess generator — free-floor fallback.
//!
//! Parity with `apps/puzzled/src/games/word-guess/config.ts#generatePuzzle`.

use serde_json::{json, Value};

use super::word_guess_words::word_from_seed;
use super::wordle_eval::{MAX_GUESSES, WORD_LENGTH};

/// Generate client puzzle data + server solution for a seed.
#[must_use]
pub fn generate_word_guess_puzzle(seed: i64) -> (Value, Value) {
    let word = word_from_seed(seed).to_ascii_uppercase();
    (
        json!({
            "wordLength": WORD_LENGTH,
            "maxAttempts": MAX_GUESSES,
        }),
        json!({ "word": word }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(generate_word_guess_puzzle(5), generate_word_guess_puzzle(5));
    }

    #[test]
    fn seed_five_matches_ts_oracle() {
        let (data, solution) = generate_word_guess_puzzle(5);
        assert_eq!(data["wordLength"], WORD_LENGTH);
        assert_eq!(data["maxAttempts"], MAX_GUESSES);
        assert_eq!(solution["word"], "ABHOR");
        assert!(data.get("word").is_none());
    }
}
