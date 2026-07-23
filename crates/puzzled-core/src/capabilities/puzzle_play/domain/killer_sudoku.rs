//! Pure killer-sudoku grid match + score — mirrors
//! `apps/puzzled/src/games/killer-sudoku/config.ts#validateAndScore`.
//! Same scoring formula as classic sudoku (base 1000 / time / mistakes).
//! PORTFOLIO residual pure deepen. NO authority_rust / ts_deleted.

/// Grid size.
pub const GRID_SIZE: usize = 9;
/// Base win score.
pub const BASE_WIN_SCORE: u32 = 1000;
/// Min win score.
pub const MIN_WIN_SCORE: u32 = 100;
/// Max time penalty points.
pub const MAX_TIME_PENALTY: u32 = 500;
/// Penalty per mistake.
pub const MISTAKE_PENALTY: u32 = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubmissionStatus {
    Won,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GameResult {
    Invalid {
        error: String,
    },
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

/// Score: `max(100, 1000 - min(500, seconds) - mistakes*50)`.
#[must_use]
pub fn killer_sudoku_score(time_spent_ms: u64, mistakes: u32) -> u32 {
    let seconds = (time_spent_ms / 1000) as u32;
    let time_penalty = seconds.min(MAX_TIME_PENALTY);
    let mistake_penalty = mistakes.saturating_mul(MISTAKE_PENALTY);
    BASE_WIN_SCORE
        .saturating_sub(time_penalty)
        .saturating_sub(mistake_penalty)
        .max(MIN_WIN_SCORE)
}

/// Whether submitted grid fully matches solution (9×9 digits).
#[must_use]
pub fn grid_matches_solution(submitted: &[Vec<Option<u8>>], solution: &[Vec<u8>]) -> bool {
    if submitted.len() != GRID_SIZE || solution.len() != GRID_SIZE {
        return false;
    }
    for r in 0..GRID_SIZE {
        if submitted[r].len() != GRID_SIZE || solution[r].len() != GRID_SIZE {
            return false;
        }
        for c in 0..GRID_SIZE {
            match submitted[r][c] {
                Some(v) if v == solution[r][c] => {}
                _ => return false,
            }
        }
    }
    true
}

/// Validate win/loss claim against grid match; score wins.
#[must_use]
pub fn validate_and_score(
    solution: &[Vec<u8>],
    submitted: Option<&[Vec<Option<u8>>]>,
    mistakes: u32,
    time_spent_ms: u64,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(grid) = submitted else {
        return GameResult::Invalid {
            error: "Missing grid data".into(),
        };
    };

    let all_correct = grid_matches_solution(grid, solution);

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
        score: killer_sudoku_score(time_spent_ms, mistakes),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_solution() -> Vec<Vec<u8>> {
        // Valid sudoku solution (not unique to killer; only match matters for score)
        vec![
            vec![1, 2, 3, 4, 5, 6, 7, 8, 9],
            vec![4, 5, 6, 7, 8, 9, 1, 2, 3],
            vec![7, 8, 9, 1, 2, 3, 4, 5, 6],
            vec![2, 3, 4, 5, 6, 7, 8, 9, 1],
            vec![5, 6, 7, 8, 9, 1, 2, 3, 4],
            vec![8, 9, 1, 2, 3, 4, 5, 6, 7],
            vec![3, 4, 5, 6, 7, 8, 9, 1, 2],
            vec![6, 7, 8, 9, 1, 2, 3, 4, 5],
            vec![9, 1, 2, 3, 4, 5, 6, 7, 8],
        ]
    }

    fn as_optional(sol: &[Vec<u8>]) -> Vec<Vec<Option<u8>>> {
        sol.iter()
            .map(|row| row.iter().map(|&v| Some(v)).collect())
            .collect()
    }

    #[test]
    fn score_table_matches_ts() {
        assert_eq!(killer_sudoku_score(0, 0), 1000);
        assert_eq!(killer_sudoku_score(100_000, 0), 900);
        assert_eq!(killer_sudoku_score(600_000, 0), 500); // time cap
        assert_eq!(killer_sudoku_score(0, 5), 750); // 5*50
        assert_eq!(killer_sudoku_score(200_000, 3), 650); // 1000-200-150
        assert_eq!(killer_sudoku_score(1_000_000, 20), 100); // floor
    }

    #[test]
    fn validate_match_and_claims() {
        let sol = sample_solution();
        let good = as_optional(&sol);
        let win = validate_and_score(&sol, Some(&good), 0, 0, SubmissionStatus::Won);
        assert_eq!(
            win,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 1000
            }
        );
        let mut bad = good.clone();
        bad[0][0] = Some(9);
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
    }
}
