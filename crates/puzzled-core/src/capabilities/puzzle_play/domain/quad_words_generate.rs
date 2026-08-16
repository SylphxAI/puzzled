//! Deterministic Quad Words generator — fallback when no content-store row exists.
//!
//! Parity with `apps/puzzled/src/games/quad-words/generator.ts`.

use serde_json::{json, Value};

use super::quad_words::MAX_GUESSES;
use super::quad_words_words::QUAD_WORDS;
use super::random::{seeded_random, shuffle_array};
use super::wordle_eval::WORD_LENGTH;

/// Generate client puzzle data + server target words for a seed.
#[must_use]
pub fn generate_quad_words_puzzle(seed: i64) -> (Value, Value) {
    let mut random = seeded_random(seed);
    let shuffled = shuffle_array(QUAD_WORDS, &mut random);
    let words = &shuffled[..4];
    (
        json!({
            "wordLength": WORD_LENGTH,
            "maxGuesses": MAX_GUESSES,
        }),
        json!({ "words": words }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(generate_quad_words_puzzle(5), generate_quad_words_puzzle(5));
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let cases: &[(i64, [&str; 4])] = &[
            (0, ["WOUND", "WHERE", "DELAY", "BRUSH"]),
            (1, ["CLIMB", "GRAVE", "QUEEN", "TRACK"]),
            (5, ["FAITH", "RIVER", "AGREE", "FEAST"]),
            (42, ["STEAM", "VIDEO", "JELLY", "TOPIC"]),
            (100, ["TWICE", "VALID", "TOKEN", "PATCH"]),
            (20_240_101, ["MAYOR", "FLOOD", "GUEST", "QUEST"]),
            (-12_345, ["QUIET", "SLICE", "OFFER", "STAGE"]),
        ];
        for (seed, words) in cases {
            let (data, solution) = generate_quad_words_puzzle(*seed);
            assert_eq!(data["wordLength"], WORD_LENGTH);
            assert_eq!(data["maxGuesses"], MAX_GUESSES);
            assert!(data.get("words").is_none());
            assert_eq!(
                solution["words"]
                    .as_array()
                    .expect("words")
                    .iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>(),
                words,
                "seed {seed}"
            );
        }
    }
}
