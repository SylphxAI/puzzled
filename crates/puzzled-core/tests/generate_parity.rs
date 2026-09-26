//! Every Rust daily generator against its TS generator's golden output
//! (`tests/fixtures/generate/<slug>.json`, exported by
//! `apps/puzzled/scripts/export-generator-fixtures.ts`).
//!
//! - Where TS produced a puzzle, the port must reproduce it exactly.
//! - Where TS gave up on a seed (`error`), the port must still produce a
//!   puzzle, and that puzzle must pass the game's own validator.

use std::path::Path;

use puzzled_core::puzzle_play::generate::{generate_seeded, self_check, served_payload};
use serde_json::Value;

fn fixtures(slug: &str) -> Vec<Value> {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/generate")
        .join(format!("{slug}.json"));
    let text =
        std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    serde_json::from_str::<Vec<Value>>(&text).unwrap_or_else(|e| panic!("parse {slug}: {e}"))
}

fn check(slug: &str) {
    for case in fixtures(slug) {
        let seed = case["seed"].as_i64().unwrap_or_default();
        let difficulty = case["difficulty"].as_str();
        let generated = generate_seeded(slug, seed, difficulty);
        let (data, solution) = match generated {
            Ok(pair) => pair,
            Err(error) => panic!("{slug} seed {seed} {difficulty:?}: {error}"),
        };
        if case.get("error").is_some() {
            self_check(slug, &data, &solution)
                .unwrap_or_else(|e| panic!("{slug} seed {seed} (TS failed): {e}"));
            continue;
        }
        if slug == "killer-sudoku" && data != case["puzzleData"] {
            // TS never checked uniqueness and some of its puzzles have two
            // solutions. The port keeps TS's cages and givens and only adds
            // givens until exactly one solution remains.
            assert_eq!(
                data["cages"], case["puzzleData"]["cages"],
                "{slug} seed {seed}: cages"
            );
            let ours = data["grid"].as_array().cloned().unwrap_or_default();
            let theirs = case["puzzleData"]["grid"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            for (r, row) in theirs.iter().enumerate() {
                for (c, cell) in row.as_array().into_iter().flatten().enumerate() {
                    if !cell.is_null() {
                        assert_eq!(
                            &ours[r][c], cell,
                            "{slug} seed {seed}: TS given at {r},{c} kept"
                        );
                    }
                }
            }
        } else {
            assert_eq!(
                data, case["puzzleData"],
                "{slug} seed {seed} {difficulty:?}: puzzle data differs from TS"
            );
        }
        assert_eq!(
            solution, case["solution"],
            "{slug} seed {seed} {difficulty:?}: solution differs from TS"
        );
        self_check(slug, &data, &solution).unwrap_or_else(|e| panic!("{slug} seed {seed}: {e}"));
    }
}

macro_rules! parity {
    ($($name:ident => $slug:literal),* $(,)?) => {
        $(#[test] fn $name() { check($slug); })*
    };
}

parity! {
    arithmo => "arithmo",
    block_slide => "block-slide",
    crowns => "crowns",
    cryptogram => "cryptogram",
    duo => "duo",
    killer_sudoku => "killer-sudoku",
    nonogram => "nonogram",
    number_path => "number-path",
    pattern_match => "pattern-match",
    pip_place => "pip-place",
    quad_words => "quad-words",
    sudoku => "sudoku",
    word_box => "word-box",
    word_guess => "word-guess",
    word_hive => "word-hive",
    word_ladder => "word-ladder",
    word_search => "word-search",
}

/// Every answer string or number list in `solution` that must not reach the player.
fn secret_values(slug: &str, solution: &Value) -> Vec<String> {
    let mut out = Vec::new();
    // Word-search's word list is shown to the player; its positions are not.
    let public: &[&str] = match slug {
        // Word-search placements repeat the public words; the secret is the
        // positions, which never appear in the served payload.
        "word-search" => &["words", "placements"],
        "pattern-match" | "block-slide" => &["totalSets", "minMoves"],
        _ => &[],
    };
    if let Some(map) = solution.as_object() {
        for (key, value) in map {
            if public.contains(&key.as_str()) {
                continue;
            }
            collect_strings(value, &mut out);
        }
    }
    out
}

fn collect_strings(value: &Value, out: &mut Vec<String>) {
    match value {
        Value::String(s) if s.len() >= 4 => out.push(s.to_uppercase()),
        Value::Array(items) => items.iter().for_each(|v| collect_strings(v, out)),
        Value::Object(map) => map.values().for_each(|v| collect_strings(v, out)),
        _ => {}
    }
}

#[test]
fn served_payloads_never_contain_an_answer_word() {
    for slug in [
        "arithmo",
        "cryptogram",
        "quad-words",
        "word-box",
        "word-guess",
        "word-hive",
        "word-ladder",
        "word-search",
    ] {
        for case in fixtures(slug) {
            let Some(data) = case.get("puzzleData") else {
                continue;
            };
            let served = served_payload(slug, data, &case["solution"])
                .to_string()
                .to_uppercase();
            for secret in secret_values(slug, &case["solution"]) {
                // The ladder's start and end words are part of the puzzle.
                if slug == "word-ladder"
                    && (data["startWord"].as_str().map(str::to_uppercase) == Some(secret.clone())
                        || data["endWord"].as_str().map(str::to_uppercase) == Some(secret.clone()))
                {
                    continue;
                }
                assert!(
                    !served.contains(&format!("\"{secret}\"")),
                    "{slug}: served payload contains the answer {secret}"
                );
            }
        }
    }
}
