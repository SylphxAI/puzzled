//! Frozen puzzle solution validation + scoring (ADR-168 S2).
//!
//! Ports `apps/puzzled/src/games/sudoku/config.ts` `validateAndScore` for golden parity.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::sudoku::SudokuSolution;

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

fn cell_matches(submitted: Option<u64>, expected: u8) -> bool {
    match submitted {
        Some(value) => value == u64::from(expected),
        None => false,
    }
}

/// Validate a Sudoku submission and compute the server-authoritative score.
#[must_use]
pub fn validate_and_score_sudoku(
    solution: &SudokuSolution,
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

    let mut all_correct = true;
    for (row_index, row_value) in rows.iter().enumerate() {
        let cols = match row_value.as_array() {
            Some(cols) if cols.len() == GRID_SIZE => cols,
            _ => {
                return ScoringResult::invalid(format!("Invalid row {row_index} dimensions"));
            }
        };

        for (col_index, cell_value) in cols.iter().enumerate() {
            let submitted = cell_value.as_u64();
            let expected = solution.grid[row_index][col_index];
            if !cell_matches(submitted, expected) {
                all_correct = false;
                break;
            }
        }
        if !all_correct {
            break;
        }
    }

    if submission.status == SubmissionStatus::Won && !all_correct {
        return ScoringResult::invalid("Invalid win claim - grid does not match solution");
    }
    if submission.status == SubmissionStatus::Lost && all_correct {
        return ScoringResult::invalid("Invalid loss claim - grid matches solution");
    }

    if !all_correct {
        return ScoringResult::valid(SubmissionStatus::Lost, 0);
    }

    let seconds = submission.time_spent_ms / 1000;
    let time_penalty = seconds.min(500);
    let mistakes = data
        .get("mistakes")
        .and_then(Value::as_u64)
        .unwrap_or(0);
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
    use crate::sudoku::{generate_sudoku_puzzle, SudokuDifficulty};

    fn puzzle(seed: i64) -> SudokuSolution {
        generate_sudoku_puzzle(seed, SudokuDifficulty::Medium).solution
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

    fn incorrect_grid(solution: &SudokuSolution) -> Value {
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
                "finalGrid": grid_to_json(&solution.grid),
                "mistakes": 0
            })),
        };
        let result = validate_and_score_sudoku(&solution, &submission);
        assert_eq!(
            result,
            ScoringResult::valid(SubmissionStatus::Won, 1000)
        );
    }

    #[test]
    fn loss_scores_zero() {
        let solution = puzzle(12_345);
        let submission = GameSubmission {
            status: SubmissionStatus::Lost,
            attempts: 1,
            time_spent_ms: 60_000,
            data: Some(serde_json::json!({
                "finalGrid": incorrect_grid(&solution),
                "mistakes": 0
            })),
        };
        let result = validate_and_score_sudoku(&solution, &submission);
        assert_eq!(result, ScoringResult::valid(SubmissionStatus::Lost, 0));
    }
}