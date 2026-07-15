//! Golden fixture parity: Rust puzzle grid generation vs TS baseline corpus.

use std::fs;
use std::path::PathBuf;

use puzzled_core::{generate_sudoku_puzzle, seeded_random, shuffle_array, SudokuDifficulty};
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
struct GoldenFile {
    #[serde(rename = "randomCases")]
    random_cases: Vec<RandomCase>,
    #[serde(rename = "sudokuCases")]
    sudoku_cases: Vec<SudokuCase>,
    /// Present in golden corpus; HTTP parity lives in puzzled-server tests.
    #[serde(rename = "httpCases")]
    #[allow(dead_code)]
    http_cases: Vec<HttpCase>,
}

#[derive(Debug, Deserialize)]
struct RandomCase {
    id: String,
    seed: i64,
    values: Vec<f64>,
    input: Option<Value>,
    output: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct SudokuCase {
    id: String,
    seed: i64,
    difficulty: String,
    #[serde(rename = "puzzleData")]
    puzzle_data: Option<Value>,
    solution: Option<Value>,
}

/// Deserialized for corpus shape only (HTTP exercised in puzzled-server).
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct HttpCase {
    id: String,
    path: String,
    query: String,
    #[serde(rename = "httpStatus")]
    http_status: u16,
    body: Value,
}

fn golden_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/puzzle-grid/golden.json")
}

fn load_golden() -> GoldenFile {
    let path = golden_path();
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("read golden corpus {}: {error}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("parse golden corpus {}: {error}", path.display()))
}

fn parse_difficulty(raw: &str) -> SudokuDifficulty {
    match raw.to_ascii_lowercase().as_str() {
        "easy" => SudokuDifficulty::Easy,
        "hard" => SudokuDifficulty::Hard,
        _ => SudokuDifficulty::Medium,
    }
}

fn assert_f64_close(actual: f64, expected: f64, case_id: &str, index: usize) {
    let delta = (actual - expected).abs();
    assert!(
        delta < 1e-5,
        "case {case_id} value[{index}]: actual {actual} expected {expected} delta {delta}"
    );
}

#[test]
fn random_lcg_matches_golden_baseline() {
    let golden = load_golden();
    for case in &golden.random_cases {
        let mut rng = seeded_random(case.seed);
        for (index, expected) in case.values.iter().enumerate() {
            let actual = rng.next_f64();
            assert_f64_close(actual, *expected, &case.id, index);
        }
    }
}

#[test]
fn sudoku_seed_cases_are_deterministic_and_valid() {
    let golden = load_golden();
    for case in &golden.sudoku_cases {
        let difficulty = parse_difficulty(&case.difficulty);
        let first = generate_sudoku_puzzle(case.seed, difficulty);
        let second = generate_sudoku_puzzle(case.seed, difficulty);
        assert_eq!(first, second, "case {} not deterministic", case.id);

        for row in &first.solution.grid {
            let mut values: Vec<u8> = row.clone();
            values.sort_unstable();
            assert_eq!(values, vec![1, 2, 3, 4, 5, 6, 7, 8, 9], "case {}", case.id);
        }

        if let (Some(expected_puzzle), Some(expected_solution)) =
            (&case.puzzle_data, &case.solution)
        {
            let actual = serde_json::to_value(&first).unwrap_or_else(|error| {
                panic!("serialize sudoku result {}: {error}", case.id)
            });
            assert_eq!(
                actual.get("puzzleData"),
                Some(expected_puzzle),
                "case {} puzzleData",
                case.id
            );
            assert_eq!(
                actual.get("solution"),
                Some(expected_solution),
                "case {} solution",
                case.id
            );
        }
    }
}

#[test]
fn shuffle_matches_golden_when_present() {
    let golden = load_golden();
    for case in golden.random_cases {
        let Some(input) = case.input else { continue };
        let Some(expected) = case.output else { continue };
        let items: Vec<String> = serde_json::from_value(input)
            .unwrap_or_else(|error| panic!("parse shuffle input {}: {error}", case.id));
        let mut rng = seeded_random(case.seed);
        let actual = shuffle_array(&items, &mut rng);
        let actual_json = serde_json::to_value(actual).unwrap_or_else(|error| {
            panic!("serialize shuffle {}: {error}", case.id)
        });
        assert_eq!(actual_json, expected, "shuffle case {}", case.id);
    }
}