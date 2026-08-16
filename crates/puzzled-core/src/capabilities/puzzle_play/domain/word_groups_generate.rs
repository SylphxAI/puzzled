//! Deterministic word-groups generator — free-floor fallback.
//!
//! Parity with `apps/puzzled/src/games/word-groups/config.ts#generatePuzzle`.

use serde_json::{json, Value};

use super::random::{seeded_random, shuffle_array};
use super::word_groups::{MAX_MISTAKES, TOTAL_CATEGORIES, WORDS_PER_CATEGORY};
use super::word_groups_puzzles::PUZZLES;

/// Generate client word list + server categories for a seed.
#[must_use]
pub fn generate_word_groups_puzzle(seed: i64) -> (Value, Value) {
    let puzzle = &PUZZLES[(seed.unsigned_abs() as usize) % PUZZLES.len()];
    let mut words = Vec::with_capacity(16);
    let mut categories = Vec::with_capacity(4);
    for category in &puzzle.categories {
        words.extend(category.words.iter().map(|word| (*word).to_string()));
        categories.push(json!({
            "name": category.name,
            "words": category.words,
            "level": category.level,
        }));
    }
    let mut random = seeded_random(seed);
    let shuffled = shuffle_array(&words, &mut random);
    (
        json!({
            "words": shuffled,
            "maxMistakes": MAX_MISTAKES,
            "wordsPerCategory": WORDS_PER_CATEGORY,
            "totalCategories": TOTAL_CATEGORIES,
        }),
        json!({ "categories": categories }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(
            generate_word_groups_puzzle(5),
            generate_word_groups_puzzle(5)
        );
    }

    #[test]
    fn seed_five_does_not_leak_categories() {
        let (data, solution) = generate_word_groups_puzzle(5);
        assert_eq!(data["words"].as_array().map(Vec::len), Some(16));
        assert!(data.get("categories").is_none());
        assert_eq!(solution["categories"][0]["name"], "COUNTRIES");
    }
}
