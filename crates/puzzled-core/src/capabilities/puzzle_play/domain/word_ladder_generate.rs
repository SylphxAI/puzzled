//! Deterministic word-ladder generator — fallback when no content-store row exists.
//!
//! Parity with `apps/puzzled/src/games/word-ladder/generator.ts`.

use std::collections::{HashSet, VecDeque};
use std::sync::OnceLock;

use serde_json::{json, Value};

use super::random::{seeded_random, SeededRandom};
use super::word_ladder::is_one_letter_change;
use super::word_ladder_words::WORDS;

fn word_set() -> &'static HashSet<String> {
    static SET: OnceLock<HashSet<String>> = OnceLock::new();
    SET.get_or_init(|| WORDS.iter().map(|word| (*word).to_string()).collect())
}

fn words_by_length(length: usize) -> Vec<&'static str> {
    let mut words: Vec<&'static str> = WORDS
        .iter()
        .copied()
        .filter(|word| word.len() == length)
        .collect();
    words.sort_unstable();
    words
}

fn select_word<'a>(words: &[&'a str], random: &mut SeededRandom) -> &'a str {
    let index = (random.next_f64() * words.len() as f64).floor() as usize;
    words[index]
}

fn find_shortest_path(start: &str, end: &str, word_list: &HashSet<String>) -> Option<Vec<String>> {
    if start.len() != end.len() || !word_list.contains(start) || !word_list.contains(end) {
        return None;
    }
    if start == end {
        return Some(vec![start.to_string()]);
    }
    let mut queue: VecDeque<Vec<String>> = VecDeque::new();
    let mut visited = HashSet::new();
    queue.push_back(vec![start.to_string()]);
    visited.insert(start.to_string());
    while let Some(path) = queue.pop_front() {
        let current = path.last()?.clone();
        if current == end {
            return Some(path);
        }
        let chars: Vec<char> = current.chars().collect();
        for i in 0..chars.len() {
            for code in b'a'..=b'z' {
                let next = char::from(code);
                if next == chars[i] {
                    continue;
                }
                let mut neighbor_chars = chars.clone();
                neighbor_chars[i] = next;
                let neighbor: String = neighbor_chars.into_iter().collect();
                if word_list.contains(&neighbor) && visited.insert(neighbor.clone()) {
                    let mut next_path = path.clone();
                    next_path.push(neighbor);
                    queue.push_back(next_path);
                }
            }
        }
    }
    None
}

/// Generate client endpoints + server path for a seed.
#[must_use]
pub fn generate_word_ladder_puzzle(seed: i64) -> (Value, Value) {
    let word_list = word_set();
    let mut random = seeded_random(seed);
    let words3 = words_by_length(3);
    let words4 = words_by_length(4);
    for _ in 0..100 {
        let words = if random.next_f64() < 0.7 {
            &words4
        } else {
            &words3
        };
        if words.len() < 2 {
            continue;
        }
        let start = select_word(words, &mut random);
        let mut end = select_word(words, &mut random);
        let mut end_attempts = 0;
        while end == start && end_attempts < 10 {
            end = select_word(words, &mut random);
            end_attempts += 1;
        }
        if start == end {
            continue;
        }
        if let Some(path) = find_shortest_path(start, end, word_list) {
            if path.len() >= 2 && path.len() <= 8 {
                debug_assert!(path
                    .windows(2)
                    .all(|pair| is_one_letter_change(&pair[0], &pair[1])));
                return (
                    json!({
                        "startWord": start,
                        "endWord": end,
                        "wordLength": start.len(),
                        "minSteps": path.len() - 1,
                    }),
                    json!({ "path": path }),
                );
            }
        }
    }
    panic!("Word Ladder generation failed for seed {seed} after 100 attempts");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(
            generate_word_ladder_puzzle(5),
            generate_word_ladder_puzzle(5)
        );
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let cases = [
            (0, "tap", "sat", 2),
            (1, "haul", "wary", 5),
            (5, "good", "vats", 7),
            (42, "pant", "vows", 7),
            (100, "sill", "runs", 5),
        ];
        for (seed, start, end, min_steps) in cases {
            let (data, solution) = generate_word_ladder_puzzle(seed);
            assert_eq!(data["startWord"], start, "seed {seed}");
            assert_eq!(data["endWord"], end);
            assert_eq!(data["minSteps"], min_steps);
            assert!(data.get("path").is_none());
            assert_eq!(solution["path"][0], start);
            assert_eq!(
                solution["path"].as_array().map(|path| path.len() - 1),
                Some(min_steps)
            );
        }
    }
}
