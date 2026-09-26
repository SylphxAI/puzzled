//! Daily generator for `word-box`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/word-box/generator.ts`), checked against
//! `tests/fixtures/generate/word-box.json`.
//!
//! Dictionary: the `word-list` package filtered to `^[a-z]{3,}$`, upper case,
//! in the TS `Set` iteration order (first occurrence in file order), in
//! `data/word_box_words.txt`. Word order matters: it decides which chain the
//! depth-first search finds first.

use std::collections::HashMap;
use std::sync::OnceLock;

use serde_json::{json, Value};

use crate::puzzle_play::random::{seeded_random, shuffle_array};

const WORDS: &str = include_str!("data/word_box_words.txt");
const COMMON_LETTERS: &str = "ETAOINSHRDLCUMWFGYPBVKJXQZ";
const ATTEMPTS: usize = 50;
const MAX_WORDS: usize = 5;

fn dictionary() -> &'static [&'static str] {
    static DICT: OnceLock<Vec<&'static str>> = OnceLock::new();
    DICT.get_or_init(|| {
        WORDS
            .lines()
            .map(str::trim)
            .filter(|w| w.len() >= 3)
            .collect()
    })
}

fn is_vowel(c: char) -> bool {
    "AEIOU".contains(c)
}

fn bit(c: u8) -> u32 {
    1u32 << (c - b'A')
}

/// Side index (0..4) of each letter in the box, by letter.
fn sides(letters: &[char]) -> HashMap<u8, usize> {
    letters
        .iter()
        .enumerate()
        .map(|(i, c)| (*c as u8, i / 3))
        .collect()
}

fn valid_for_box(word: &str, side: &HashMap<u8, usize>) -> bool {
    let bytes = word.as_bytes();
    if !bytes.iter().all(|b| side.contains_key(b)) {
        return false;
    }
    bytes.windows(2).all(|w| side.get(&w[0]) != side.get(&w[1]))
}

struct Search<'a> {
    by_first: HashMap<u8, Vec<&'a str>>,
    roots: Vec<&'a str>,
    all_mask: u32,
}

impl<'a> Search<'a> {
    fn dfs(&self, chain: &mut Vec<&'a str>, used: u32, last: Option<u8>) -> bool {
        if used.count_ones() == self.all_mask.count_ones() {
            return true;
        }
        if chain.len() >= MAX_WORDS {
            return false;
        }
        let empty = Vec::new();
        let candidates: &[&'a str] = match last {
            Some(letter) => self.by_first.get(&letter).unwrap_or(&empty),
            None => &self.roots,
        };
        for &word in candidates {
            let word_mask = word.bytes().fold(0u32, |m, b| m | bit(b));
            if word_mask & !used == 0 && !chain.is_empty() {
                continue;
            }
            chain.push(word);
            if self.dfs(chain, used | word_mask, word.bytes().last()) {
                return true;
            }
            chain.pop();
        }
        false
    }
}

fn find_chain<'a>(words: &[&'a str], all_mask: u32) -> Option<Vec<&'a str>> {
    let mut by_first: HashMap<u8, Vec<&'a str>> = HashMap::new();
    for &w in words {
        if let Some(first) = w.bytes().next() {
            by_first.entry(first).or_default().push(w);
        }
    }
    let mut sorted: Vec<&'a str> = words.to_vec();
    // JS sort is stable; so is `sort_by_key`.
    sorted.sort_by_key(|w| std::cmp::Reverse(w.len()));
    sorted.truncate(50);
    let search = Search {
        by_first,
        roots: sorted,
        all_mask,
    };
    let mut chain = Vec::new();
    search.dfs(&mut chain, 0, None).then_some(chain)
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let mut random = seeded_random(seed);
    let common: Vec<char> = COMMON_LETTERS.chars().collect();
    for _ in 0..ATTEMPTS {
        let shuffled = shuffle_array(&common, &mut random);
        let vowels: Vec<char> = shuffled
            .iter()
            .copied()
            .filter(|c| is_vowel(*c))
            .take(3)
            .collect();
        let consonants: Vec<char> = shuffled
            .iter()
            .copied()
            .filter(|c| !is_vowel(*c))
            .take(9)
            .collect();
        if vowels.len() < 2 || consonants.len() < 8 {
            continue;
        }
        let mut pool = vowels.clone();
        pool.extend(consonants.iter().take(12 - vowels.len()));
        let letters = shuffle_array(&pool, &mut random);
        if letters.len() != 12 {
            continue;
        }
        let side = sides(&letters);
        let valid: Vec<&str> = dictionary()
            .iter()
            .copied()
            .filter(|w| valid_for_box(w, &side))
            .collect();
        if valid.len() < 10 {
            continue;
        }
        let all_mask = letters.iter().fold(0u32, |m, c| m | bit(*c as u8));
        if let Some(chain) = find_chain(&valid, all_mask) {
            let s = |from: usize| -> Vec<String> {
                letters[from..from + 3]
                    .iter()
                    .map(char::to_string)
                    .collect()
            };
            let all: Vec<String> = letters.iter().map(char::to_string).collect();
            return Ok((
                json!({ "box": { "top": s(0), "right": s(3), "bottom": s(6), "left": s(9) } }),
                json!({ "words": chain, "allLetters": all }),
            ));
        }
    }
    Err(format!("word-box: no solvable puzzle for seed {seed}"))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "words": solution.get("words").cloned().unwrap_or_else(|| json!([])) })
}
