//! Daily generator for `word-hive`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/word-hive/generator.ts` + `config.ts`),
//! checked against `tests/fixtures/generate/word-hive.json`.
//!
//! Dictionary: the TS `SPELLING_BEE_DICTIONARY` (the `word-list` package,
//! 4+ letters A-Z, upper case). It is read from the shared
//! `data/word_box_words.txt` (3+ letters) and filtered to 4+ letters; words
//! with more than 7 distinct letters are skipped, since they can never be
//! formed from a 7-letter set.
//!
//! Instead of filtering the whole dictionary for every letter set (as TS
//! does), words are grouped by their letter mask and each set's words are the
//! union over its 127 subsets, which gives the same lists.

use std::collections::{BTreeMap, HashMap};
use std::sync::OnceLock;

use serde_json::{json, Value};

use crate::puzzle_play::random::{seeded_random, shuffle_array};

const WORDS: &str = include_str!("data/word_box_words.txt");
const MIN_WORDS: usize = 15;

fn mask_of(word: &str) -> u32 {
    word.bytes()
        .filter(u8::is_ascii_uppercase)
        .fold(0u32, |m, b| m | (1 << (b - b'A')))
}

fn letters_of(mask: u32) -> String {
    (0..26u8)
        .filter(|i| mask & (1 << i) != 0)
        .map(|i| char::from(b'A' + i))
        .collect()
}

/// Every non-empty subset of `mask` (bit-subset enumeration).
fn subsets(mask: u32) -> impl Iterator<Item = u32> {
    let mut sub = mask;
    let mut done = false;
    std::iter::from_fn(move || {
        if done || sub == 0 {
            return None;
        }
        let current = sub;
        sub = (sub - 1) & mask;
        if sub == 0 {
            done = true;
        }
        Some(current)
    })
}

struct Dictionary {
    by_mask: HashMap<u32, Vec<&'static str>>,
    /// Pangram letter masks (7 distinct letters) → their pangrams.
    pangram_sets: BTreeMap<String, (u32, Vec<&'static str>)>,
}

fn dictionary() -> Dictionary {
    let mut by_mask: HashMap<u32, Vec<&'static str>> = HashMap::new();
    let mut pangram_sets: BTreeMap<String, (u32, Vec<&'static str>)> = BTreeMap::new();
    for word in WORDS.lines().map(str::trim).filter(|w| w.len() >= 4) {
        let mask = mask_of(word);
        if mask.count_ones() > 7 {
            continue;
        }
        by_mask.entry(mask).or_default().push(word);
        if mask.count_ones() == 7 {
            pangram_sets
                .entry(letters_of(mask))
                .or_insert_with(|| (mask, Vec::new()))
                .1
                .push(word);
        }
    }
    Dictionary {
        by_mask,
        pangram_sets,
    }
}

/// A valid configuration: letter set + centre with at least 15 words.
struct Config {
    letters: String,
    mask: u32,
    center_index: usize,
}

/// Dictionary and valid configurations, computed once per process.
fn cached() -> &'static (Dictionary, Vec<Config>) {
    static CACHE: OnceLock<(Dictionary, Vec<Config>)> = OnceLock::new();
    CACHE.get_or_init(|| {
        let dict = dictionary();
        // Valid configurations in TS order: letters (sorted set), then centre.
        let mut configs = Vec::new();
        for (letters, (mask, _)) in &dict.pangram_sets {
            for (center_index, center) in letters.bytes().enumerate() {
                let bit = 1u32 << (center - b'A');
                if count_with_center(&dict, *mask, bit) >= MIN_WORDS {
                    configs.push(Config {
                        letters: letters.clone(),
                        mask: *mask,
                        center_index,
                    });
                }
            }
        }
        (dict, configs)
    })
}

fn words_with_center(dict: &Dictionary, mask: u32, center_bit: u32) -> Vec<&'static str> {
    let mut words: Vec<&'static str> = subsets(mask)
        .filter(|s| s & center_bit != 0)
        .filter_map(|s| dict.by_mask.get(&s))
        .flatten()
        .copied()
        .collect();
    words.sort_unstable();
    words
}

fn count_with_center(dict: &Dictionary, mask: u32, center_bit: u32) -> usize {
    subsets(mask)
        .filter(|s| s & center_bit != 0)
        .filter_map(|s| dict.by_mask.get(&s))
        .map(Vec::len)
        .sum()
}

fn word_score(word: &str, is_pangram: bool) -> usize {
    if word.len() == 4 {
        return 1;
    }
    word.len() + if is_pangram { 7 } else { 0 }
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let (dict, configs) = cached();
    if configs.is_empty() {
        return Err("word-hive: no valid letter sets".to_string());
    }
    let len = i64::try_from(configs.len()).map_err(|e| e.to_string())?;
    let index = usize::try_from(seed.abs() % len).map_err(|e| e.to_string())?;
    let config = configs
        .get(index)
        .ok_or_else(|| "word-hive: index out of range".to_string())?;

    let letters: Vec<char> = config.letters.chars().collect();
    let center = *letters
        .get(config.center_index)
        .ok_or_else(|| "word-hive: bad centre".to_string())?;
    let center_bit = 1u32 << (center as u8 - b'A');
    let outer: Vec<String> = letters
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != config.center_index)
        .map(|(_, c)| c.to_string())
        .collect();
    let outer = shuffle_array(&outer, &mut seeded_random(seed));

    let valid_words = words_with_center(dict, config.mask, center_bit);
    let mut pangrams: Vec<&'static str> = dict
        .pangram_sets
        .get(config.letters.as_str())
        .map(|(_, p)| p.iter().copied().filter(|p| p.contains(center)).collect())
        .unwrap_or_default();
    pangrams.sort_unstable();
    let max_score: usize = valid_words
        .iter()
        .map(|w| word_score(w, pangrams.contains(w)))
        .sum();

    Ok((
        json!({
            "centerLetter": center.to_string(),
            "outerLetters": outer,
            "maxScore": max_score,
            "validWords": valid_words,
            "pangrams": pangrams,
        }),
        json!({ "validWords": valid_words, "pangrams": pangrams }),
    ))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "foundWords": solution.get("validWords").cloned().unwrap_or_else(|| json!([])) })
}
