//! Daily generator for `word-ladder`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/word-ladder/generator.ts` +
//! `puzzles.ts`), checked against `tests/fixtures/generate/word-ladder.json`.
//!
//! The dictionary is the TS `WORD_SET` (`data/word_ladder_words.txt`).

use std::collections::{HashSet, VecDeque};

use serde_json::{json, Value};

use crate::puzzle_play::random::{seeded_random, SeededRandom};

const WORDS: &str = include_str!("data/word_ladder_words.txt");
const MAX_ATTEMPTS: usize = 100;

fn word_set() -> HashSet<&'static str> {
    WORDS
        .lines()
        .map(str::trim)
        .filter(|w| !w.is_empty())
        .collect()
}

fn words_by_length(set: &HashSet<&'static str>, length: usize) -> Vec<&'static str> {
    let mut words: Vec<&'static str> = set.iter().copied().filter(|w| w.len() == length).collect();
    words.sort_unstable();
    words
}

fn select_word(words: &[&'static str], random: &mut SeededRandom) -> Option<&'static str> {
    let index = (random.next_f64() * words.len() as f64).floor() as usize;
    words.get(index).copied()
}

/// BFS shortest path, neighbours in TS order (position, then `a`..`z`).
fn shortest_path(start: &str, end: &str, set: &HashSet<&'static str>) -> Option<Vec<String>> {
    if start.len() != end.len() || !set.contains(start) || !set.contains(end) {
        return None;
    }
    if start == end {
        return Some(vec![start.to_string()]);
    }
    let mut queue: VecDeque<Vec<String>> = VecDeque::from([vec![start.to_string()]]);
    let mut visited: HashSet<String> = HashSet::from([start.to_string()]);
    while let Some(path) = queue.pop_front() {
        let current = path.last()?.clone();
        if current == end {
            return Some(path);
        }
        let bytes = current.as_bytes();
        for i in 0..bytes.len() {
            for c in b'a'..=b'z' {
                if c == bytes[i] {
                    continue;
                }
                let mut next = bytes.to_vec();
                next[i] = c;
                let Ok(neighbor) = String::from_utf8(next) else {
                    continue;
                };
                if set.contains(neighbor.as_str()) && !visited.contains(&neighbor) {
                    visited.insert(neighbor.clone());
                    let mut extended = path.clone();
                    extended.push(neighbor);
                    queue.push_back(extended);
                }
            }
        }
    }
    None
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let set = word_set();
    let mut random = seeded_random(seed);
    let words3 = words_by_length(&set, 3);
    let words4 = words_by_length(&set, 4);
    for _ in 0..MAX_ATTEMPTS {
        let use_four = random.next_f64() < 0.7;
        let words = if use_four { &words4 } else { &words3 };
        if words.len() < 2 {
            continue;
        }
        let Some(start) = select_word(words, &mut random) else {
            continue;
        };
        let mut end = select_word(words, &mut random);
        let mut end_attempts = 0;
        while end == Some(start) && end_attempts < 10 {
            end = select_word(words, &mut random);
            end_attempts += 1;
        }
        let Some(end) = end else {
            continue;
        };
        if start == end {
            continue;
        }
        if let Some(path) = shortest_path(start, end, &set) {
            if (2..=8).contains(&path.len()) {
                return Ok((
                    json!({
                        "startWord": start,
                        "endWord": end,
                        "wordLength": start.len(),
                        "minSteps": path.len() - 1,
                    }),
                    json!({ "path": path }),
                ));
            }
        }
    }
    Err(format!(
        "word-ladder: no puzzle for seed {seed} after {MAX_ATTEMPTS} attempts"
    ))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "path": solution.get("path").cloned().unwrap_or_else(|| json!([])) })
}
