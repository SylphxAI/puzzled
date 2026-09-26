//! Daily generator for `word-box`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/*/generator.ts`), checked against
//! `tests/fixtures/generate/word-box.json`.

use serde_json::Value;

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(_seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    Err("not ported yet".to_string())
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    solution.clone()
}
