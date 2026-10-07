//! Crossword golden: every crossword generator version against its committed
//! output (`tests/fixtures/generate/crossword.json`).
//!
//! The crossword never had a seeded TS generator to export, so this golden is
//! written by the Rust generators themselves. Each stored crossword row names
//! the generator that made it, and that generator must reproduce the row byte
//! for byte forever; this test is the record that it does.
//!
//! Regenerate only when adding a generator version or seeds, never to absorb a
//! change to an existing version (that would change stored rows):
//!
//! ```sh
//! UPDATE_GOLDEN=1 cargo test -p puzzled-core --test crossword_golden
//! bunx biome format --write crates/puzzled-core/tests/fixtures/generate/crossword.json
//! ```
//!
//! The comparison is on parsed JSON, so formatting never fails the test; the
//! biome step only keeps the committed file in the repository's format.

use std::path::PathBuf;

use puzzled_core::puzzle_play::crossword_v2::generate_crossword_puzzle_v2;
use puzzled_core::puzzle_play::generate::{
    generate_seeded, self_check, GENERATOR_CROSSWORD_V2, GENERATOR_V1,
};
use serde_json::{json, Value};

/// Content-pipeline seeds (`YYYYMMDD`), the same days as the other goldens.
const SEEDS: [i64; 5] = [20_250_101, 20_260_226, 20_260_926, 20_261_001, 20_261_231];

/// Newest first: the TS unit tests take the first case as their puzzle.
const VERSIONS: [&str; 2] = [GENERATOR_CROSSWORD_V2, GENERATOR_V1];

fn generate(version: &str, seed: i64) -> (Value, Value) {
    match version {
        GENERATOR_CROSSWORD_V2 => generate_crossword_puzzle_v2(seed),
        GENERATOR_V1 => generate_seeded("crossword", seed, None)
            .unwrap_or_else(|e| panic!("crossword {version} seed {seed}: {e}")),
        other => panic!("no crossword generator {other}"),
    }
}

fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/generate/crossword.json")
}

fn generated_cases() -> Vec<Value> {
    VERSIONS
        .iter()
        .flat_map(|version| {
            SEEDS.iter().map(move |&seed| {
                let (puzzle_data, solution) = generate(version, seed);
                json!({
                    "seed": seed,
                    "difficulty": null,
                    "generatorVersion": version,
                    "puzzleData": puzzle_data,
                    "solution": solution,
                })
            })
        })
        .collect()
}

#[test]
fn crossword_generators_reproduce_the_golden() {
    let cases = generated_cases();
    let path = golden_path();
    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        let text = serde_json::to_string_pretty(&cases)
            .unwrap_or_else(|e| panic!("serialize crossword golden: {e}"));
        std::fs::write(&path, format!("{text}\n"))
            .unwrap_or_else(|e| panic!("write {}: {e}", path.display()));
    }
    let text =
        std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
    let golden: Vec<Value> =
        serde_json::from_str(&text).unwrap_or_else(|e| panic!("parse {}: {e}", path.display()));
    assert_eq!(
        golden.len(),
        cases.len(),
        "crossword golden has {} cases, the generators make {}",
        golden.len(),
        cases.len()
    );
    for (want, got) in golden.iter().zip(&cases) {
        assert_eq!(
            got, want,
            "crossword {} seed {}: generator output differs from the golden",
            want["generatorVersion"], want["seed"]
        );
        self_check("crossword", &got["puzzleData"], &got["solution"]).unwrap_or_else(|e| {
            panic!(
                "crossword {} seed {}: {e}",
                want["generatorVersion"], want["seed"]
            )
        });
    }
}
