//! Deterministic Letter Box generator — fallback when no content-store row exists.
//!
//! Uses the already-embedded common-word lexicon, not the npm word-list.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use serde_json::{json, Value};

use super::random::{seeded_random, shuffle_array, SeededRandom};
use super::word_box::{all_letters, has_valid_side_transitions, uses_valid_letters, LetterBox};
use super::word_box_words::WORDS;

const COMMON_LETTERS: &[char] = &[
    'E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R', 'D', 'L', 'C', 'U', 'M', 'W', 'F', 'G', 'Y', 'P',
    'B', 'V', 'K', 'J', 'X', 'Q', 'Z',
];
const VOWELS: &[char] = &['A', 'E', 'I', 'O', 'U'];

fn word_list() -> &'static [String] {
    static LIST: OnceLock<Vec<String>> = OnceLock::new();
    LIST.get_or_init(|| WORDS.iter().map(|word| word.to_ascii_uppercase()).collect())
}

fn is_vowel(letter: char) -> bool {
    VOWELS.contains(&letter)
}

fn valid_for_box(box_: &LetterBox, word: &str) -> bool {
    word.len() >= 3 && uses_valid_letters(box_, word) && has_valid_side_transitions(box_, word)
}

fn find_valid_words(box_: &LetterBox) -> Vec<String> {
    word_list()
        .iter()
        .filter(|word| valid_for_box(box_, word))
        .cloned()
        .collect()
}

fn find_word_chain(words: &[String], all: &HashSet<char>, max_words: usize) -> Option<Vec<String>> {
    let mut by_first: HashMap<char, Vec<&str>> = HashMap::new();
    for word in words {
        if let Some(first) = word.chars().next() {
            by_first.entry(first).or_default().push(word.as_str());
        }
    }
    let mut sorted: Vec<&str> = words.iter().map(String::as_str).collect();
    sorted.sort_by_key(|word| std::cmp::Reverse(word.len()));

    fn dfs(
        chain: &mut Vec<String>,
        used: &mut HashSet<char>,
        last: Option<char>,
        all_size: usize,
        max_words: usize,
        by_first: &HashMap<char, Vec<&str>>,
        sorted: &[&str],
    ) -> Option<Vec<String>> {
        if used.len() == all_size {
            return Some(chain.clone());
        }
        if chain.len() >= max_words {
            return None;
        }
        let candidates: Vec<&str> = if let Some(letter) = last {
            by_first.get(&letter).cloned().unwrap_or_default()
        } else {
            sorted.iter().copied().take(50).collect()
        };
        for word in candidates {
            let new_letters: Vec<char> = word.chars().filter(|ch| !used.contains(ch)).collect();
            if new_letters.is_empty() && !chain.is_empty() {
                continue;
            }
            for ch in &new_letters {
                used.insert(*ch);
            }
            chain.push(word.to_string());
            let next_last = word.chars().last();
            if let Some(result) = dfs(
                chain, used, next_last, all_size, max_words, by_first, sorted,
            ) {
                return Some(result);
            }
            chain.pop();
            for ch in new_letters {
                used.remove(&ch);
            }
        }
        None
    }

    dfs(
        &mut Vec::new(),
        &mut HashSet::new(),
        None,
        all.len(),
        max_words,
        &by_first,
        &sorted,
    )
}

fn try_one(random: &mut SeededRandom) -> Option<(LetterBox, Vec<String>, Vec<char>)> {
    let shuffled = shuffle_array(COMMON_LETTERS, random);
    let vowels: Vec<char> = shuffled
        .iter()
        .copied()
        .filter(|ch| is_vowel(*ch))
        .take(3)
        .collect();
    let consonants: Vec<char> = shuffled
        .iter()
        .copied()
        .filter(|ch| !is_vowel(*ch))
        .take(9)
        .collect();
    if vowels.len() < 2 || consonants.len() < 8 {
        return None;
    }
    let mut mixed = vowels.clone();
    mixed.extend(consonants.iter().copied().take(12 - vowels.len()));
    if mixed.len() != 12 {
        return None;
    }
    let letters = shuffle_array(&mixed, random);
    if letters.len() != 12 {
        return None;
    }
    let box_ = LetterBox {
        top: [letters[0], letters[1], letters[2]],
        right: [letters[3], letters[4], letters[5]],
        bottom: [letters[6], letters[7], letters[8]],
        left: [letters[9], letters[10], letters[11]],
    };
    let valid = find_valid_words(&box_);
    if valid.len() < 10 {
        return None;
    }
    let all: HashSet<char> = all_letters(&box_).into_iter().collect();
    let chain = find_word_chain(&valid, &all, 5)?;
    Some((box_, chain, letters))
}

fn box_json(box_: &LetterBox) -> Value {
    json!({
        "top": box_.top.iter().map(char::to_string).collect::<Vec<_>>(),
        "right": box_.right.iter().map(char::to_string).collect::<Vec<_>>(),
        "bottom": box_.bottom.iter().map(char::to_string).collect::<Vec<_>>(),
        "left": box_.left.iter().map(char::to_string).collect::<Vec<_>>(),
    })
}

/// Generate client box + server witness chain for a seed.
#[must_use]
pub fn generate_word_box_puzzle(seed: i64) -> (Value, Value) {
    let mut random = seeded_random(seed);
    for _ in 0..200 {
        if let Some((box_, chain, letters)) = try_one(&mut random) {
            return (
                json!({ "box": box_json(&box_) }),
                json!({
                    "words": chain,
                    "allLetters": letters.iter().map(char::to_string).collect::<Vec<_>>(),
                }),
            );
        }
    }
    panic!("LetterBoxed: Failed to generate solvable puzzle for seed {seed}");
}

#[cfg(test)]
mod tests {
    use super::super::word_box::{all_letters_used, get_used_letters};
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(generate_word_box_puzzle(5), generate_word_box_puzzle(5));
    }

    #[test]
    fn generated_chain_covers_the_box() {
        for seed in [0_i64, 1, 5, 42] {
            let (data, solution) = generate_word_box_puzzle(seed);
            assert!(data.get("allLetters").is_none());
            let words = solution["words"]
                .as_array()
                .expect("words")
                .iter()
                .filter_map(Value::as_str)
                .collect::<Vec<_>>();
            assert!(!words.is_empty());
            assert!(words.len() <= 5);
            let letters = solution["allLetters"]
                .as_array()
                .expect("letters")
                .iter()
                .filter_map(Value::as_str)
                .map(|s| s.chars().next().expect("ch"))
                .collect::<Vec<_>>();
            assert_eq!(letters.len(), 12);
            let box_ = LetterBox {
                top: [letters[0], letters[1], letters[2]],
                right: [letters[3], letters[4], letters[5]],
                bottom: [letters[6], letters[7], letters[8]],
                left: [letters[9], letters[10], letters[11]],
            };
            let used = get_used_letters(&words);
            assert!(
                all_letters_used(&box_, &used),
                "seed {seed} chain {words:?}"
            );
            assert_eq!(data["box"]["top"][0], letters[0].to_string());
        }
    }
}
