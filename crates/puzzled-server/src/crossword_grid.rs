//! Pure crossword grid complete check + score — mirrors
//! `apps/puzzled/src/games/crossword/types.ts#isGridComplete` and
//! `apps/puzzled/src/games/crossword/config.ts#validateAndScore`.
//! FLEET residual pure deepen. NO authority_rust / ts_deleted.

/// Mini-crossword grid size (5x5).
pub const CROSSWORD_GRID_SIZE: usize = 5;
/// Base win score.
pub const BASE_WIN_SCORE: u32 = 500;
/// Floor win score.
pub const MIN_WIN_SCORE: u32 = 100;

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

/// Check if user grid matches solution, skipping black squares (None in solution).
/// Case-insensitive letter compare.
#[must_use]
pub fn is_crossword_grid_complete(
    user_grid: &[Vec<Option<String>>],
    solution: &[Vec<Option<String>>],
) -> bool {
    for row in 0..CROSSWORD_GRID_SIZE {
        for col in 0..CROSSWORD_GRID_SIZE {
            let solution_cell = solution
                .get(row)
                .and_then(|r| r.get(col))
                .and_then(|c| c.as_ref());
            // Skip black squares (null/None in solution)
            let Some(sol) = solution_cell else {
                continue;
            };
            // Empty string also treated as black (generatePuzzle maps null → "")
            if sol.is_empty() {
                continue;
            }
            let user_cell = user_grid
                .get(row)
                .and_then(|r| r.get(col))
                .and_then(|c| c.as_ref());
            let Some(user) = user_cell else {
                return false;
            };
            if user.is_empty() || user.to_uppercase() != sol.to_uppercase() {
                return false;
            }
        }
    }
    true
}

/// String-grid complete check used by `validateAndScore` (TS CrosswordSolution.grid is string[][]).
#[must_use]
pub fn is_grid_complete_str(user_grid: &[Vec<Option<String>>], solution: &[Vec<String>]) -> bool {
    for row in 0..CROSSWORD_GRID_SIZE {
        for col in 0..CROSSWORD_GRID_SIZE {
            let sol = solution
                .get(row)
                .and_then(|r| r.get(col))
                .map(String::as_str)
                .unwrap_or("");
            // Black squares: empty or missing in solution (TS generate maps null → "")
            if sol.is_empty() {
                continue;
            }
            let user = user_grid
                .get(row)
                .and_then(|r| r.get(col))
                .and_then(|c| c.as_ref());
            let Some(u) = user else {
                return false;
            };
            if u.is_empty() || u.to_uppercase() != sol.to_uppercase() {
                return false;
            }
        }
    }
    true
}

/// Score: `max(100, 500 - floor(seconds / 2))`.
#[must_use]
pub fn crossword_score(time_spent_ms: u64) -> u32 {
    let seconds = time_spent_ms / 1000;
    let time_penalty = (seconds / 2) as u32;
    BASE_WIN_SCORE
        .saturating_sub(time_penalty)
        .max(MIN_WIN_SCORE)
}

/// Single-cell guess: letter must match solution cell (case-insensitive).
#[must_use]
pub fn validate_guess(solution: &[Vec<String>], row: usize, col: usize, letter: &str) -> bool {
    let Some(correct) = solution.get(row).and_then(|r| r.get(col)) else {
        return false;
    };
    if correct.is_empty() {
        return false;
    }
    letter.to_uppercase() == correct.to_uppercase()
}

/// Clue number assignments for letter cells that start an across and/or down word.
/// Mirrors `apps/puzzled/src/games/crossword/types.ts#getClueNumbers`.
/// Grid cells: `None` = black square.
#[must_use]
pub fn get_clue_numbers(grid: &[Vec<Option<String>>]) -> Vec<((usize, usize), u32)> {
    let mut numbers = Vec::new();
    let mut num = 1u32;

    for row in 0..CROSSWORD_GRID_SIZE {
        for col in 0..CROSSWORD_GRID_SIZE {
            let cell = grid.get(row).and_then(|r| r.get(col));
            // black square
            if cell.map(|c| c.is_none()).unwrap_or(true) {
                continue;
            }

            let left_black = col == 0
                || grid
                    .get(row)
                    .and_then(|r| r.get(col - 1))
                    .map(|c| c.is_none())
                    .unwrap_or(true);
            let right_letter = col < CROSSWORD_GRID_SIZE - 1
                && grid
                    .get(row)
                    .and_then(|r| r.get(col + 1))
                    .map(|c| c.is_some())
                    .unwrap_or(false);
            let needs_across = left_black && right_letter;

            let above_black = row == 0
                || grid
                    .get(row - 1)
                    .and_then(|r| r.get(col))
                    .map(|c| c.is_none())
                    .unwrap_or(true);
            let below_letter = row < CROSSWORD_GRID_SIZE - 1
                && grid
                    .get(row + 1)
                    .and_then(|r| r.get(col))
                    .map(|c| c.is_some())
                    .unwrap_or(false);
            let needs_down = above_black && below_letter;

            if needs_across || needs_down {
                numbers.push(((row, col), num));
                num += 1;
            }
        }
    }
    numbers
}

/// Validate win/loss claim against grid match; score wins.
#[must_use]
pub fn validate_and_score(
    solution: &[Vec<String>],
    final_grid: Option<&[Vec<Option<String>>]>,
    time_spent_ms: u64,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(grid) = final_grid else {
        return GameResult::Invalid {
            error: "Missing final grid data".into(),
        };
    };

    let is_complete = is_grid_complete_str(grid, solution);

    if claimed == SubmissionStatus::Won && !is_complete {
        return GameResult::Invalid {
            error: "Invalid win claim - grid does not match solution".into(),
        };
    }
    if claimed == SubmissionStatus::Lost && is_complete {
        return GameResult::Invalid {
            error: "Invalid loss claim - grid matches solution".into(),
        };
    }

    if !is_complete {
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: crossword_score(time_spent_ms),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn grid(cells: [[Option<&str>; 5]; 5]) -> Vec<Vec<Option<String>>> {
        cells
            .into_iter()
            .map(|row| row.into_iter().map(|c| c.map(|s| s.to_string())).collect())
            .collect()
    }

    fn sol_str(cells: [[&str; 5]; 5]) -> Vec<Vec<String>> {
        cells
            .into_iter()
            .map(|row| row.into_iter().map(str::to_string).collect())
            .collect()
    }

    fn full_word_square() -> Vec<Vec<String>> {
        sol_str([
            ["C", "A", "P", "E", "R"],
            ["A", "L", "I", "V", "E"],
            ["P", "I", "P", "E", "R"],
            ["E", "V", "E", "R", "Y"],
            ["R", "E", "Y", "E", "S"],
        ])
    }

    fn as_optional(sol: &[Vec<String>]) -> Vec<Vec<Option<String>>> {
        sol.iter()
            .map(|row| row.iter().map(|s| Some(s.clone())).collect())
            .collect()
    }

    #[test]
    fn complete_match() {
        let sol = grid([
            [Some("A"), Some("B"), None, Some("C"), Some("D")],
            [Some("E"), Some("F"), None, Some("G"), Some("H")],
            [None, None, None, None, None],
            [Some("I"), Some("J"), None, Some("K"), Some("L")],
            [Some("M"), Some("N"), None, Some("O"), Some("P")],
        ]);
        let user = sol.clone();
        assert!(is_crossword_grid_complete(&user, &sol));
    }

    #[test]
    fn case_insensitive() {
        let sol = grid([
            [Some("A"), None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
        ]);
        let user = grid([
            [Some("a"), None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
        ]);
        assert!(is_crossword_grid_complete(&user, &sol));
    }

    #[test]
    fn incomplete_or_wrong() {
        let sol = grid([
            [Some("A"), Some("B"), None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
        ]);
        let incomplete = grid([
            [Some("A"), None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
        ]);
        assert!(!is_crossword_grid_complete(&incomplete, &sol));
        let wrong = grid([
            [Some("A"), Some("Z"), None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
        ]);
        assert!(!is_crossword_grid_complete(&wrong, &sol));
    }

    #[test]
    fn score_table_matches_ts() {
        assert_eq!(crossword_score(0), 500);
        assert_eq!(crossword_score(100_000), 450);
        assert_eq!(crossword_score(200_000), 400);
        assert_eq!(crossword_score(2_000_000), 100);
        assert_eq!(crossword_score(99_000), 451); // floor(99/2)=49
    }

    #[test]
    fn validate_match_and_claims() {
        let sol = full_word_square();
        let good = as_optional(&sol);
        let win = validate_and_score(&sol, Some(&good), 0, SubmissionStatus::Won);
        assert_eq!(
            win,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 500
            }
        );
        let mut bad = good.clone();
        bad[0][0] = Some("Z".into());
        let false_win = validate_and_score(&sol, Some(&bad), 0, SubmissionStatus::Won);
        assert!(!false_win.is_valid());
        let lost = validate_and_score(&sol, Some(&bad), 60_000, SubmissionStatus::Lost);
        assert_eq!(
            lost,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
        let false_loss = validate_and_score(&sol, Some(&good), 0, SubmissionStatus::Lost);
        assert!(!false_loss.is_valid());
        let missing = validate_and_score(&sol, None, 0, SubmissionStatus::Won);
        assert!(!missing.is_valid());
        let mid = validate_and_score(&sol, Some(&good), 100_000, SubmissionStatus::Won);
        assert_eq!(
            mid,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 450
            }
        );
    }

    #[test]
    fn validate_guess_cell() {
        let sol = full_word_square();
        assert!(validate_guess(&sol, 0, 0, "c"));
        assert!(validate_guess(&sol, 0, 0, "C"));
        assert!(!validate_guess(&sol, 0, 0, "X"));
        assert!(!validate_guess(&sol, 9, 9, "C"));
    }

    #[test]
    fn clue_numbers_full_square() {
        // Full 5x5 letter grid: clue at (0,0) only for across+down start of first row/col
        let g = as_optional(&full_word_square());
        let nums = get_clue_numbers(&g);
        // Every cell is a letter; starts of across: col0 each row; starts of down: row0 each col
        // (0,0) counted once; each other row-start and col-start
        assert!(!nums.is_empty());
        assert_eq!(nums[0], ((0, 0), 1));
        // number sequence is contiguous
        for (i, (_, n)) in nums.iter().enumerate() {
            assert_eq!(*n, (i as u32) + 1);
        }
    }

    #[test]
    fn clue_numbers_with_black() {
        // Row0: letter letter black letter letter — across starts at (0,0) and (0,3)
        let g = grid([
            [Some(""), Some(""), None, Some(""), Some("")],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
            [None, None, None, None, None],
        ]);
        let nums = get_clue_numbers(&g);
        let positions: Vec<_> = nums.iter().map(|(p, _)| *p).collect();
        assert!(positions.contains(&(0, 0)));
        assert!(positions.contains(&(0, 3)));
    }
}
