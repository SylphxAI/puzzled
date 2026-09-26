//! Every Rust daily generator against its TS generator's golden output
//! (`tests/fixtures/generate/<slug>.json`, exported by
//! `apps/puzzled/scripts/export-generator-fixtures.ts`).
//!
//! - Where TS produced a puzzle, the port must reproduce it exactly.
//! - Where TS gave up on a seed (`error`), the port must still produce a
//!   puzzle, and that puzzle must pass the game's own validator.

use std::path::Path;

use puzzled_core::puzzle_play::generate::{generate_seeded, self_check};
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
