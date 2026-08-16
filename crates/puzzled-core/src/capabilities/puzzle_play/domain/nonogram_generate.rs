//! Deterministic nonogram generator — fallback when no content-store row exists.
//!
//! Parity with `apps/puzzled/src/games/nonogram/generator.ts`.

use serde_json::{json, Value};

use super::nonogram_clues::generate_clues;
use super::nonogram_patterns::PATTERNS;
use super::random::seeded_random;

const GRID_SIZE: usize = 10;

fn transform_pattern(grid: [[bool; 10]; 10], seed: i64) -> [[bool; 10]; 10] {
    let mut random = seeded_random(seed);
    let transform = (random.next_f64() * 4.0).floor() as i32;
    let mut result = grid;
    if transform == 1 || transform == 3 {
        for row in &mut result {
            row.reverse();
        }
    }
    if transform == 2 || transform == 3 {
        result.reverse();
    }
    result
}

/// Generate client clues + server picture for a seed.
#[must_use]
pub fn generate_nonogram_puzzle(seed: i64) -> (Value, Value) {
    let pattern = &PATTERNS[(seed.unsigned_abs() as usize) % PATTERNS.len()];
    let transformed = transform_pattern(pattern.grid, seed);
    let solution: Vec<Vec<bool>> = transformed.iter().map(|row| row.to_vec()).collect();
    let (row_clues, col_clues) = generate_clues(&solution);
    (
        json!({
            "width": GRID_SIZE,
            "height": GRID_SIZE,
            "rowClues": row_clues,
            "colClues": col_clues,
            "theme": pattern.theme,
        }),
        json!({ "grid": solution }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(generate_nonogram_puzzle(5), generate_nonogram_puzzle(5));
    }

    #[test]
    fn pattern_count_matches_ts() {
        assert_eq!(PATTERNS.len(), 52);
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let (data, solution) = generate_nonogram_puzzle(0);
        assert_eq!(data["theme"], "Heart");
        assert_eq!(data["rowClues"][0], json!([2, 2]));
        assert_eq!(data["colClues"][0], json!([4]));
        assert_eq!(
            solution["grid"][0],
            json!([false, true, true, false, false, false, false, true, true, false])
        );
        assert!(data.get("grid").is_none());

        let (star, star_sol) = generate_nonogram_puzzle(1);
        assert_eq!(star["theme"], "Star");
        assert_eq!(star["rowClues"][0], json!([1, 1]));
        assert_eq!(
            star_sol["grid"][0],
            json!([true, false, false, false, false, false, false, false, false, true])
        );

        let (cloud, _) = generate_nonogram_puzzle(5);
        assert_eq!(cloud["theme"], "Cloud");
        assert_eq!(cloud["rowClues"][0], json!([0]));

        let (letter_o, _) = generate_nonogram_puzzle(42);
        assert_eq!(letter_o["theme"], "O");
        assert_eq!(letter_o["rowClues"][0], json!([6]));
    }
}
