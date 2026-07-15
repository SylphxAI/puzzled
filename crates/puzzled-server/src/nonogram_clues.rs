//! Pure nonogram clue generation / grid match / score —
//! mirrors `apps/puzzled/src/games/nonogram/types.ts` and
//! `apps/puzzled/src/games/nonogram/config.ts#validateAndScore`.
//! FLEET residual pure deepen. NO authority_rust / ts_deleted.

#![allow(clippy::needless_range_loop)] // 2D run-length scans are clearer with explicit indices

/// Base win score.
pub const BASE_WIN_SCORE: u32 = 500;
/// Floor win score.
pub const MIN_WIN_SCORE: u32 = 100;
/// Penalty per error.
pub const ERROR_PENALTY: u32 = 25;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubmissionStatus {
    Won,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GameResult {
    Invalid { error: String },
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

/// Generate row/col run-length clues from a boolean solution grid.
#[must_use]
pub fn generate_clues(solution: &[Vec<bool>]) -> (Vec<Vec<u32>>, Vec<Vec<u32>>) {
    let height = solution.len();
    let width = solution.first().map(|r| r.len()).unwrap_or(0);

    let mut row_clues = Vec::with_capacity(height);
    for row in 0..height {
        let mut clue = Vec::new();
        let mut count = 0u32;
        for col in 0..width {
            if solution[row].get(col).copied().unwrap_or(false) {
                count += 1;
            } else if count > 0 {
                clue.push(count);
                count = 0;
            }
        }
        if count > 0 {
            clue.push(count);
        }
        row_clues.push(if clue.is_empty() { vec![0] } else { clue });
    }

    let mut col_clues = Vec::with_capacity(width);
    for col in 0..width {
        let mut clue = Vec::new();
        let mut count = 0u32;
        for row in 0..height {
            if solution
                .get(row)
                .and_then(|r| r.get(col))
                .copied()
                .unwrap_or(false)
            {
                count += 1;
            } else if count > 0 {
                clue.push(count);
                count = 0;
            }
        }
        if count > 0 {
            clue.push(count);
        }
        col_clues.push(if clue.is_empty() { vec![0] } else { clue });
    }

    (row_clues, col_clues)
}

/// Check filled cells of `user_filled` match `solution` (filled == true).
#[must_use]
pub fn is_grid_complete(user_filled: &[Vec<bool>], solution: &[Vec<bool>]) -> bool {
    if user_filled.len() != solution.len() {
        return false;
    }
    for (ur, sr) in user_filled.iter().zip(solution.iter()) {
        if ur.len() != sr.len() {
            return false;
        }
        for (u, s) in ur.iter().zip(sr.iter()) {
            if u != s {
                return false;
            }
        }
    }
    true
}

/// Score: `max(100, 500 - floor(seconds/2) - errors*25)`.
#[must_use]
pub fn nonogram_score(time_spent_ms: u64, errors: u32) -> u32 {
    let seconds = time_spent_ms / 1000;
    let time_penalty = (seconds / 2) as u32;
    let error_penalty = errors.saturating_mul(ERROR_PENALTY);
    BASE_WIN_SCORE
        .saturating_sub(time_penalty)
        .saturating_sub(error_penalty)
        .max(MIN_WIN_SCORE)
}

/// Single-cell guess: filled must match solution; empty/marked always "correct" for UX.
#[must_use]
pub fn validate_guess(solution: &[Vec<bool>], row: usize, col: usize, filled: bool) -> bool {
    if !filled {
        return true;
    }
    solution
        .get(row)
        .and_then(|r| r.get(col))
        .copied()
        .unwrap_or(false)
}

/// Validate win/loss claim against grid match; score wins with time+error penalties.
#[must_use]
pub fn validate_and_score(
    solution: &[Vec<bool>],
    final_grid: Option<&[Vec<bool>]>,
    errors: u32,
    time_spent_ms: u64,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(grid) = final_grid else {
        return GameResult::Invalid {
            error: "Missing final grid data".into(),
        };
    };

    let grid_size = solution.len();
    if grid.len() != grid_size {
        return GameResult::Invalid {
            error: "Invalid grid dimensions".into(),
        };
    }

    let mut all_correct = true;
    for (row_idx, row) in grid.iter().enumerate() {
        if row.len() != grid_size {
            return GameResult::Invalid {
                error: format!("Invalid row {row_idx} dimensions"),
            };
        }
        for (col_idx, &submitted) in row.iter().enumerate() {
            let expected = solution
                .get(row_idx)
                .and_then(|r| r.get(col_idx))
                .copied()
                .unwrap_or(false);
            if submitted != expected {
                all_correct = false;
            }
        }
    }

    if claimed == SubmissionStatus::Won && !all_correct {
        return GameResult::Invalid {
            error: "Invalid win claim - grid does not match solution".into(),
        };
    }
    if claimed == SubmissionStatus::Lost && all_correct {
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

    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: nonogram_score(time_spent_ms, errors),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_clues() {
        // 3x3: row0 all filled, row1 empty, row2 mid filled
        let sol = vec![
            vec![true, true, true],
            vec![false, false, false],
            vec![false, true, false],
        ];
        let (rows, cols) = generate_clues(&sol);
        assert_eq!(rows[0], vec![3]);
        assert_eq!(rows[1], vec![0]);
        assert_eq!(rows[2], vec![1]);
        assert_eq!(cols[0], vec![1]);
        assert_eq!(cols[1], vec![1, 1]);
        assert_eq!(cols[2], vec![1]);
    }

    #[test]
    fn complete() {
        let sol = vec![vec![true, false], vec![false, true]];
        assert!(is_grid_complete(&sol, &sol));
        let bad = vec![vec![true, true], vec![false, true]];
        assert!(!is_grid_complete(&bad, &sol));
    }

    #[test]
    fn score_table_matches_ts() {
        assert_eq!(nonogram_score(0, 0), 500);
        assert_eq!(nonogram_score(100_000, 0), 450);
        assert_eq!(nonogram_score(0, 4), 400); // 4*25
        assert_eq!(nonogram_score(120_000, 2), 390); // 60 + 50
        assert_eq!(nonogram_score(2_000_000, 20), 100);
    }

    #[test]
    fn validate_match_and_claims() {
        let sol = vec![
            vec![true, false, true],
            vec![false, true, false],
            vec![true, true, false],
        ];
        let good = sol.clone();
        let win = validate_and_score(&sol, Some(&good), 0, 0, SubmissionStatus::Won);
        assert_eq!(
            win,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 500
            }
        );
        let with_errors = validate_and_score(&sol, Some(&good), 4, 0, SubmissionStatus::Won);
        assert_eq!(
            with_errors,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 400
            }
        );
        let mut bad = good.clone();
        bad[0][0] = false;
        let false_win = validate_and_score(&sol, Some(&bad), 0, 0, SubmissionStatus::Won);
        assert!(!false_win.is_valid());
        let lost = validate_and_score(&sol, Some(&bad), 0, 60_000, SubmissionStatus::Lost);
        assert_eq!(
            lost,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
        let false_loss = validate_and_score(&sol, Some(&good), 0, 0, SubmissionStatus::Lost);
        assert!(!false_loss.is_valid());
        let missing = validate_and_score(&sol, None, 0, 0, SubmissionStatus::Won);
        assert!(!missing.is_valid());
        let short = vec![vec![true, false]];
        let dim = validate_and_score(&sol, Some(&short), 0, 0, SubmissionStatus::Won);
        assert!(!dim.is_valid());
    }

    #[test]
    fn validate_guess_filled_only() {
        let sol = vec![vec![true, false], vec![false, true]];
        assert!(validate_guess(&sol, 0, 0, true));
        assert!(!validate_guess(&sol, 0, 1, true));
        assert!(validate_guess(&sol, 0, 1, false)); // empty always ok
    }
}
