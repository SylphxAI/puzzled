//! Pure Sudoku validateAndScore — mirrors `apps/puzzled/src/games/sudoku/config.ts`.
//!
//! PORTFOLIO-PRODUCTS-A-TICK offline pure residual. HTTP submit route remains TS.
//! NO authority_rust / ts_deleted claim.

use crate::capabilities::puzzle_play::placement::GRID_SIZE;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SubmissionStatus {
    Won,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SudokuSubmissionData {
    pub final_grid: Option<Vec<Vec<Option<u8>>>>,
    pub mistakes: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSubmission {
    pub status: SubmissionStatus,
    pub attempts: u32,
    pub time_spent_ms: u64,
    pub data: Option<SudokuSubmissionData>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum GameResult {
    #[serde(rename_all = "camelCase")]
    Invalid { error: String },
    #[serde(rename_all = "camelCase")]
    Valid {
        status: SubmissionStatus,
        score: u32,
    },
}

impl GameResult {
    #[must_use]
    pub fn is_valid(&self) -> bool {
        matches!(self, Self::Valid { .. })
    }
}

/// Validate final grid vs solution and compute score (pure, no I/O).
///
/// Scoring:
/// - Base 1000
/// - Time penalty: -1 per second (cap 500)
/// - Mistake penalty: -50 per mistake
/// - Min score 100 for wins; losses score 0
#[must_use]
pub fn validate_and_score(solution_grid: &[Vec<u8>], submission: &GameSubmission) -> GameResult {
    let Some(data) = submission.data.as_ref() else {
        return GameResult::Invalid {
            error: "Missing final grid data".into(),
        };
    };
    let Some(final_grid) = data.final_grid.as_ref() else {
        return GameResult::Invalid {
            error: "Missing final grid data".into(),
        };
    };

    if final_grid.len() != GRID_SIZE {
        return GameResult::Invalid {
            error: "Invalid grid dimensions".into(),
        };
    }
    if solution_grid.len() != GRID_SIZE {
        return GameResult::Invalid {
            error: "Invalid solution dimensions".into(),
        };
    }

    let mut all_correct = true;
    for row in 0..GRID_SIZE {
        let Some(final_row) = final_grid.get(row) else {
            return GameResult::Invalid {
                error: format!("Invalid row {row} dimensions"),
            };
        };
        if final_row.len() != GRID_SIZE {
            return GameResult::Invalid {
                error: format!("Invalid row {row} dimensions"),
            };
        }
        let Some(sol_row) = solution_grid.get(row) else {
            return GameResult::Invalid {
                error: "Invalid solution dimensions".into(),
            };
        };
        if sol_row.len() != GRID_SIZE {
            return GameResult::Invalid {
                error: "Invalid solution dimensions".into(),
            };
        }
        for col in 0..GRID_SIZE {
            let submitted = final_row[col];
            let expected = sol_row[col];
            if submitted != Some(expected) {
                all_correct = false;
                break;
            }
        }
        if !all_correct {
            break;
        }
    }

    if submission.status == SubmissionStatus::Won && !all_correct {
        return GameResult::Invalid {
            error: "Invalid win claim - grid does not match solution".into(),
        };
    }
    if submission.status == SubmissionStatus::Lost && all_correct {
        return GameResult::Invalid {
            error: "Invalid loss claim - grid matches solution".into(),
        };
    }

    if !all_correct {
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    let seconds = submission.time_spent_ms / 1000;
    let time_penalty = seconds.min(500) as u32;
    let mistakes = data.mistakes.unwrap_or(0);
    let mistake_penalty = mistakes.saturating_mul(50);
    let score = 1000u32
        .saturating_sub(time_penalty)
        .saturating_sub(mistake_penalty)
        .max(100);

    GameResult::Valid {
        status: SubmissionStatus::Won,
        score,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_solution() -> Vec<Vec<u8>> {
        // Valid complete sudoku (fixed fixture — not generated).
        vec![
            vec![5, 3, 4, 6, 7, 8, 9, 1, 2],
            vec![6, 7, 2, 1, 9, 5, 3, 4, 8],
            vec![1, 9, 8, 3, 4, 2, 5, 6, 7],
            vec![8, 5, 9, 7, 6, 1, 4, 2, 3],
            vec![4, 2, 6, 8, 5, 3, 7, 9, 1],
            vec![7, 1, 3, 9, 2, 4, 8, 5, 6],
            vec![9, 6, 1, 5, 3, 7, 2, 8, 4],
            vec![2, 8, 7, 4, 1, 9, 6, 3, 5],
            vec![3, 4, 5, 2, 8, 6, 1, 7, 9],
        ]
    }

    fn grid_opts(sol: &[Vec<u8>]) -> Vec<Vec<Option<u8>>> {
        sol.iter()
            .map(|row| row.iter().copied().map(Some).collect())
            .collect()
    }

    fn submission(
        status: SubmissionStatus,
        final_grid: Vec<Vec<Option<u8>>>,
        mistakes: u32,
        time_spent_ms: u64,
    ) -> GameSubmission {
        GameSubmission {
            status,
            attempts: 1,
            time_spent_ms,
            data: Some(SudokuSubmissionData {
                final_grid: Some(final_grid),
                mistakes: Some(mistakes),
            }),
        }
    }

    #[test]
    fn fast_solve_no_mistakes_scores_1000() {
        let sol = sample_solution();
        let sub = submission(SubmissionStatus::Won, grid_opts(&sol), 0, 0);
        let r = validate_and_score(&sol, &sub);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 1000
            }
        );
    }

    #[test]
    fn hundred_seconds_scores_900() {
        let sol = sample_solution();
        let sub = submission(SubmissionStatus::Won, grid_opts(&sol), 0, 100_000);
        let r = validate_and_score(&sol, &sub);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 900
            }
        );
    }

    #[test]
    fn five_hundred_plus_seconds_scores_500() {
        let sol = sample_solution();
        let sub = submission(SubmissionStatus::Won, grid_opts(&sol), 0, 600_000);
        let r = validate_and_score(&sol, &sub);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 500
            }
        );
    }

    #[test]
    fn five_mistakes_scores_750() {
        let sol = sample_solution();
        let sub = submission(SubmissionStatus::Won, grid_opts(&sol), 5, 0);
        let r = validate_and_score(&sol, &sub);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 750
            }
        );
    }

    #[test]
    fn two_hundred_seconds_three_mistakes_scores_650() {
        let sol = sample_solution();
        let sub = submission(SubmissionStatus::Won, grid_opts(&sol), 3, 200_000);
        let r = validate_and_score(&sol, &sub);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 650
            }
        );
    }

    #[test]
    fn minimum_win_score_is_100() {
        let sol = sample_solution();
        let sub = submission(SubmissionStatus::Won, grid_opts(&sol), 20, 700_000);
        let r = validate_and_score(&sol, &sub);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 100
            }
        );
    }

    #[test]
    fn loss_scores_zero() {
        let sol = sample_solution();
        let mut bad = grid_opts(&sol);
        bad[0][0] = Some((sol[0][0] % 9) + 1);
        let sub = submission(SubmissionStatus::Lost, bad, 0, 60_000);
        let r = validate_and_score(&sol, &sub);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
    }

    #[test]
    fn rejects_missing_final_grid() {
        let sol = sample_solution();
        let sub = GameSubmission {
            status: SubmissionStatus::Won,
            attempts: 1,
            time_spent_ms: 0,
            data: None,
        };
        let r = validate_and_score(&sol, &sub);
        assert!(!r.is_valid());
    }

    #[test]
    fn rejects_false_win_claim() {
        let sol = sample_solution();
        let mut bad = grid_opts(&sol);
        bad[0][0] = Some((sol[0][0] % 9) + 1);
        let sub = submission(SubmissionStatus::Won, bad, 0, 0);
        let r = validate_and_score(&sol, &sub);
        assert!(!r.is_valid());
    }
}
