//! Frozen puzzle solution validation + scoring (ADR-168 S2).
//!
//! Ports `apps/puzzled/src/games/sudoku/config.ts` `validateAndScore` for golden parity.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::capabilities::puzzle_play::sudoku::SudokuPuzzleData;

const GRID_SIZE: usize = 9;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSubmission {
    pub status: SubmissionStatus,
    pub attempts: u32,
    pub time_spent_ms: u64,
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SubmissionStatus {
    Won,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ScoringResult {
    Valid {
        valid: bool,
        status: SubmissionStatus,
        score: u32,
    },
    Invalid {
        valid: bool,
        error: String,
    },
}

impl ScoringResult {
    #[must_use]
    pub fn valid(status: SubmissionStatus, score: u32) -> Self {
        Self::Valid {
            valid: true,
            status,
            score,
        }
    }

    #[must_use]
    pub fn invalid(error: impl Into<String>) -> Self {
        Self::Invalid {
            valid: false,
            error: error.into(),
        }
    }
}

/// Validate a Sudoku submission and compute the server-authoritative score.
#[must_use]
pub fn validate_and_score_sudoku(
    puzzle: &SudokuPuzzleData,
    submission: &GameSubmission,
) -> ScoringResult {
    let data = match &submission.data {
        Some(value) => value,
        None => return ScoringResult::invalid("Missing final grid data"),
    };

    let final_grid = match data.get("finalGrid") {
        Some(value) => value,
        None => return ScoringResult::invalid("Missing final grid data"),
    };

    let rows = match final_grid.as_array() {
        Some(rows) if rows.len() == GRID_SIZE => rows,
        _ => return ScoringResult::invalid("Invalid grid dimensions"),
    };

    // Validate the frozen clues, not a canonical answer: generated and stored
    // puzzles can have multiple legitimate completions. Never regenerate here.
    if puzzle.grid.len() != GRID_SIZE
        || puzzle.grid.iter().any(|row| row.len() != GRID_SIZE)
        || puzzle
            .grid
            .iter()
            .flatten()
            .flatten()
            .any(|v| !(1..=9).contains(v))
    {
        return ScoringResult::invalid("Invalid sudoku given clues");
    }

    let mut all_correct = true;
    let mut row_masks = [0_u16; GRID_SIZE];
    let mut col_masks = [0_u16; GRID_SIZE];
    let mut box_masks = [0_u16; GRID_SIZE];
    for (row_index, row_value) in rows.iter().enumerate() {
        let cols = match row_value.as_array() {
            Some(cols) if cols.len() == GRID_SIZE => cols,
            _ => return ScoringResult::invalid(format!("Invalid row {row_index} dimensions")),
        };
        for (col_index, cell_value) in cols.iter().enumerate() {
            let Some(value) = cell_value.as_u64().filter(|v| (1..=9).contains(v)) else {
                all_correct = false;
                continue;
            };
            if puzzle.grid[row_index][col_index].is_some_and(|given| u64::from(given) != value) {
                all_correct = false;
            }
            let bit = 1_u16 << value;
            let box_index = (row_index / 3) * 3 + col_index / 3;
            if row_masks[row_index] & bit != 0
                || col_masks[col_index] & bit != 0
                || box_masks[box_index] & bit != 0
            {
                all_correct = false;
            }
            row_masks[row_index] |= bit;
            col_masks[col_index] |= bit;
            box_masks[box_index] |= bit;
        }
    }

    if submission.status == SubmissionStatus::Won && !all_correct {
        return ScoringResult::invalid(
            "Invalid win claim - grid violates Sudoku rules or given clues",
        );
    }
    if submission.status == SubmissionStatus::Lost && all_correct {
        return ScoringResult::invalid("Invalid loss claim - grid solves puzzle");
    }

    if !all_correct {
        return ScoringResult::valid(SubmissionStatus::Lost, 0);
    }

    let seconds = submission.time_spent_ms / 1000;
    let time_penalty = seconds.min(500);
    let mistakes = data.get("mistakes").and_then(Value::as_u64).unwrap_or(0);
    let mistake_penalty = mistakes.saturating_mul(50);
    let score = 1000u32
        .saturating_sub(time_penalty as u32)
        .saturating_sub(mistake_penalty as u32)
        .max(100);

    ScoringResult::valid(SubmissionStatus::Won, score)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capabilities::puzzle_play::sudoku::{generate_sudoku_puzzle, SudokuDifficulty};

    fn puzzle(seed: i64) -> crate::capabilities::puzzle_play::sudoku::SudokuPuzzleResult {
        generate_sudoku_puzzle(seed, SudokuDifficulty::Medium)
    }

    fn grid_to_json(grid: &[Vec<u8>]) -> Value {
        Value::Array(
            grid.iter()
                .map(|row| {
                    Value::Array(
                        row.iter()
                            .map(|cell| Value::Number((*cell).into()))
                            .collect(),
                    )
                })
                .collect(),
        )
    }

    fn incorrect_grid(
        solution: &crate::capabilities::puzzle_play::sudoku::SudokuSolution,
    ) -> Value {
        let mut grid = solution.grid.clone();
        grid[0][0] = (grid[0][0] % 9) + 1;
        grid_to_json(&grid)
    }

    #[test]
    fn fast_win_scores_1000() {
        let solution = puzzle(12_345);
        let submission = GameSubmission {
            status: SubmissionStatus::Won,
            attempts: 1,
            time_spent_ms: 0,
            data: Some(serde_json::json!({
                "finalGrid": grid_to_json(&solution.solution.grid),
                "mistakes": 0
            })),
        };
        let result = validate_and_score_sudoku(&solution.puzzle_data, &submission);
        assert_eq!(result, ScoringResult::valid(SubmissionStatus::Won, 1000));
    }

    #[test]
    fn loss_scores_zero() {
        let solution = puzzle(12_345);
        let submission = GameSubmission {
            status: SubmissionStatus::Lost,
            attempts: 1,
            time_spent_ms: 60_000,
            data: Some(serde_json::json!({
                "finalGrid": incorrect_grid(&solution.solution),
                "mistakes": 0
            })),
        };
        let result = validate_and_score_sudoku(&solution.puzzle_data, &submission);
        assert_eq!(result, ScoringResult::valid(SubmissionStatus::Lost, 0));
    }

    // The three cases below replaced the web's `sudoku/validation.test.ts` when
    // grading moved wholly into this core; they are the same assertions against
    // the one implementation that scores a finish.

    /// A winning submission carrying `grid`.
    fn winning(grid: Value) -> GameSubmission {
        GameSubmission {
            status: SubmissionStatus::Won,
            attempts: 1,
            time_spent_ms: 0,
            data: Some(serde_json::json!({ "finalGrid": grid, "mistakes": 0 })),
        }
    }

    #[test]
    fn an_alternate_valid_completion_scores_the_same_as_the_stored_answer() {
        // "Not the canonical answer": a served clue the solver left out of the
        // grid it proves against. The finish is a complete, rule-respecting
        // grid, so it scores exactly as the stored one does.
        let solution = puzzle(12_345);
        let mut clues = solution.puzzle_data.clone();
        let (row, col) = clues
            .grid
            .iter()
            .enumerate()
            .find_map(|(r, cells)| {
                cells
                    .iter()
                    .enumerate()
                    .find_map(|(c, cell)| cell.is_some().then_some((r, c)))
            })
            .expect("a medium puzzle serves clues");
        clues.grid[row][col] = None;

        let stored_puzzle_score = validate_and_score_sudoku(
            &solution.puzzle_data,
            &winning(grid_to_json(&solution.solution.grid)),
        );
        let alternate =
            validate_and_score_sudoku(&clues, &winning(grid_to_json(&solution.solution.grid)));
        assert_eq!(alternate, stored_puzzle_score);
        assert_eq!(alternate, ScoringResult::valid(SubmissionStatus::Won, 1000));
    }

    #[test]
    fn a_valid_grid_that_violates_a_served_clue_is_refused() {
        let solution = puzzle(12_345);
        let mut grid = solution.solution.grid.clone();
        let (row, col) = solution
            .puzzle_data
            .grid
            .iter()
            .enumerate()
            .find_map(|(r, cells)| {
                cells
                    .iter()
                    .enumerate()
                    .find_map(|(c, cell)| cell.map(|_| (r, c)))
            })
            .expect("a medium puzzle serves clues");
        grid[row][col] = (grid[row][col] % 9) + 1;
        let result =
            validate_and_score_sudoku(&solution.puzzle_data, &winning(grid_to_json(&grid)));
        assert_eq!(
            result,
            ScoringResult::invalid("Invalid win claim - grid violates Sudoku rules or given clues")
        );
    }

    #[test]
    fn fractional_cells_and_invalid_boxes_are_refused() {
        let solution = puzzle(12_345);

        let mut fractional = solution.solution.grid.clone();
        fractional[0][0] = 5;
        let mut json = grid_to_json(&fractional);
        json[0][0] = serde_json::json!(4.5);
        assert_eq!(
            validate_and_score_sudoku(&solution.puzzle_data, &winning(json)),
            ScoringResult::invalid("Invalid win claim - grid violates Sudoku rules or given clues")
        );

        // A grid whose rows and columns are each valid but whose box repeats.
        let mut boxed = solution.solution.grid.clone();
        let (r0, c0) = (0, 0);
        let (r1, c1) = (1, 1);
        boxed[r0][c0] = solution.solution.grid[r1][c1];
        boxed[r1][c1] = solution.solution.grid[r0][c0];
        assert_eq!(
            validate_and_score_sudoku(&solution.puzzle_data, &winning(grid_to_json(&boxed))),
            ScoringResult::invalid("Invalid win claim - grid violates Sudoku rules or given clues")
        );
    }
}
