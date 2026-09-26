//! Daily generator for `nonogram`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/nonogram/generator.ts`,
//! `generateNonogramPuzzle`), checked against
//! `tests/fixtures/generate/nonogram.json`.
//!
//! The seed picks one of the pixel-art patterns (`data/nonogram_patterns.json`,
//! extracted verbatim from the TS pool, same order) and one of four
//! transforms (none, horizontal flip, vertical flip, both). Every difficulty
//! uses the 10x10 pool, as in TS.

use serde::Deserialize;
use serde_json::{json, Value};

use crate::capabilities::puzzle_play::domain::nonogram_clues::generate_clues;
use crate::capabilities::puzzle_play::domain::random::SeededRandom;

const PATTERNS_JSON: &str = include_str!("data/nonogram_patterns.json");

#[derive(Deserialize)]
struct Pattern {
    theme: String,
    rows: Vec<String>,
}

fn patterns() -> Result<Vec<Pattern>, String> {
    serde_json::from_str(PATTERNS_JSON).map_err(|e| format!("nonogram patterns: {e}"))
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let pool = patterns()?;
    if pool.is_empty() {
        return Err("nonogram pattern pool is empty".to_string());
    }
    // TS: Math.abs(seed) % PATTERNS.length
    let index =
        usize::try_from(seed.unsigned_abs() % pool.len() as u64).map_err(|e| e.to_string())?;
    let pattern = &pool[index];

    let mut grid: Vec<Vec<bool>> = pattern
        .rows
        .iter()
        .map(|row| row.chars().map(|c| c == '1').collect())
        .collect();

    // TS transformPattern: Math.floor(random() * 4)
    let mut random = SeededRandom::new(seed);
    let transform = (random.next_f64() * 4.0).floor() as u32;
    match transform {
        1 => grid.iter_mut().for_each(|row| row.reverse()),
        2 => grid.reverse(),
        3 => {
            grid.reverse();
            grid.iter_mut().for_each(|row| row.reverse());
        }
        _ => {}
    }

    let (row_clues, col_clues) = generate_clues(&grid);
    let puzzle_data = json!({
        "width": 10,
        "height": 10,
        "rowClues": row_clues,
        "colClues": col_clues,
        "theme": pattern.theme,
    });
    let solution = json!({ "grid": grid });
    Ok((puzzle_data, solution))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check: `{finalGrid: boolean[][]}`.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({
        "finalGrid": solution.get("grid").cloned().unwrap_or(Value::Null),
        "errors": 0,
    })
}
