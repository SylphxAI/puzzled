//! Daily generator for `quad-words`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/quad-words/generator.ts`,
//! `generateQuordlePuzzle`), checked against
//! `tests/fixtures/generate/quad-words.json`.
//!
//! The word list (`data/quad_words_words.txt`) is the TS `QUORDLE_WORDS` list
//! verbatim, in order, so the Fisher-Yates shuffle matches. That list holds two
//! entries that are not five letters (`LAKE`, `LIVING`) and six duplicates.
//! Where the TS pick would include one of those (an unplayable board, or two
//! identical boards), this port does not serve it: it draws again from a
//! derived seed. Every other seed matches TS exactly.

use serde_json::{json, Value};

use crate::capabilities::puzzle_play::domain::random::{shuffle_array, SeededRandom};

const WORDS: &str = include_str!("data/quad_words_words.txt");

/// Derived-seed attempts before giving up (a playable pick is near-certain).
const MAX_ATTEMPTS: i64 = 64;

fn word_list() -> Vec<&'static str> {
    WORDS
        .lines()
        .map(str::trim)
        .filter(|w| !w.is_empty())
        .collect()
}

/// TS: shuffleArray(QUORDLE_WORDS, seededRandom(seed)).slice(0, 4)
fn pick(words: &[&'static str], seed: i64) -> Vec<&'static str> {
    let mut random = SeededRandom::new(seed);
    shuffle_array(words, &mut random)
        .into_iter()
        .take(4)
        .collect()
}

fn playable(picked: &[&str]) -> bool {
    picked.len() == 4
        && picked.iter().all(|w| w.len() == 5)
        && picked
            .iter()
            .enumerate()
            .all(|(i, w)| !picked[..i].contains(w))
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let words = word_list();
    for attempt in 0..MAX_ATTEMPTS {
        let candidate_seed = seed + attempt * 1_000_003;
        let picked = pick(&words, candidate_seed);
        if playable(&picked) {
            return Ok((json!({ "words": picked }), json!({ "words": picked })));
        }
    }
    Err(format!("quad-words: no playable pick for seed {seed}"))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check: every target guessed once, all four boards solved.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    let history = solution.get("words").cloned().unwrap_or_else(|| json!([]));
    json!({
        "guessHistory": history,
        "solvedBoards": [true, true, true, true],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unplayable_picks_are_redrawn() {
        assert!(!playable(&["LAKE", "APPLE", "BEACH", "CHAIN"]));
        assert!(!playable(&["QUEEN", "QUEEN", "BEACH", "CHAIN"]));
        assert!(playable(&["APPLE", "BEACH", "CHAIN", "DANCE"]));
        let list = word_list();
        assert_eq!(list.len(), 630);
        for seed in 20_250_101..20_250_401 {
            let (data, _) = generate(seed, None).unwrap_or_default();
            let words: Vec<&str> = data["words"]
                .as_array()
                .map(|a| a.iter().filter_map(Value::as_str).collect())
                .unwrap_or_default();
            assert!(playable(&words), "seed {seed}: {words:?}");
        }
    }
}
