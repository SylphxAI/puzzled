//! Pure tango (binary sun/moon) is_solved + score — mirrors
//! `apps/puzzled/src/games/tango/types.ts#isSolved|getConflicts` and
//! `config.ts#validateAndScore`.
//! PORTFOLIO residual pure deepen. NO authority_rust / ts_deleted.

#![allow(clippy::needless_range_loop)]

/// Base score for a win before time penalty.
pub const BASE_WIN_SCORE: u32 = 500;
/// Floor score for a win.
pub const MIN_WIN_SCORE: u32 = 100;
/// Max consecutive same symbols allowed.
pub const MAX_CONSECUTIVE: usize = 2;

/// Cell value: sun, moon, or empty.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CellValue {
    Sun,
    Moon,
    Empty,
}

impl CellValue {
    #[must_use]
    pub fn is_filled(self) -> bool {
        matches!(self, Self::Sun | Self::Moon)
    }
}

fn cell_is_filled(v: &CellValue) -> bool {
    v.is_filled()
}

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

/// Whether three-in-a-row (or more) exists around (row, col).
#[must_use]
pub fn has_consecutive_violation(grid: &[Vec<CellValue>], row: usize, col: usize) -> bool {
    let value = grid.get(row).and_then(|r| r.get(col)).copied();
    let Some(value) = value.filter(cell_is_filled) else {
        return false;
    };
    let size = grid.len();

    // horizontal: three same centered or spanning this cell
    if col >= 2 && grid[row][col - 1] == value && grid[row][col - 2] == value {
        return true;
    }
    if col >= 1 && col + 1 < size && grid[row][col - 1] == value && grid[row][col + 1] == value {
        return true;
    }
    if col + 2 < size && grid[row][col + 1] == value && grid[row][col + 2] == value {
        return true;
    }

    // vertical
    if row >= 2 && grid[row - 1][col] == value && grid[row - 2][col] == value {
        return true;
    }
    if row >= 1 && row + 1 < size && grid[row - 1][col] == value && grid[row + 1][col] == value {
        return true;
    }
    if row + 2 < size && grid[row + 1][col] == value && grid[row + 2][col] == value {
        return true;
    }

    false
}

/// Collect conflict cells (consecutive or over-count rows/cols).
#[must_use]
pub fn get_conflicts(grid: &[Vec<CellValue>]) -> Vec<(usize, usize)> {
    let size = grid.len();
    let mut conflicts: Vec<(usize, usize)> = Vec::new();
    let half = size / 2;

    for r in 0..size {
        for c in 0..size {
            if grid[r][c].is_filled() && has_consecutive_violation(grid, r, c) {
                conflicts.push((r, c));
            }
        }
    }

    for r in 0..size {
        let sun = grid[r].iter().filter(|&&v| v == CellValue::Sun).count();
        let moon = grid[r].iter().filter(|&&v| v == CellValue::Moon).count();
        if sun > half || moon > half {
            for c in 0..size {
                if grid[r][c].is_filled() && !conflicts.contains(&(r, c)) {
                    conflicts.push((r, c));
                }
            }
        }
    }

    for c in 0..size {
        let sun = (0..size).filter(|&r| grid[r][c] == CellValue::Sun).count();
        let moon = (0..size).filter(|&r| grid[r][c] == CellValue::Moon).count();
        if sun > half || moon > half {
            for r in 0..size {
                if grid[r][c].is_filled() && !conflicts.contains(&(r, c)) {
                    conflicts.push((r, c));
                }
            }
        }
    }

    conflicts
}

/// Whether the binary puzzle is fully solved under tango rules.
#[must_use]
pub fn is_solved(grid: &[Vec<CellValue>]) -> bool {
    let size = grid.len();
    if size == 0 || !size.is_multiple_of(2) {
        return false;
    }
    let half = size / 2;

    for r in 0..size {
        if grid[r].len() != size {
            return false;
        }
        for c in 0..size {
            if !grid[r][c].is_filled() {
                return false;
            }
        }
    }

    if !get_conflicts(grid).is_empty() {
        return false;
    }

    for r in 0..size {
        let sun = grid[r].iter().filter(|&&v| v == CellValue::Sun).count();
        let moon = grid[r].iter().filter(|&&v| v == CellValue::Moon).count();
        if sun != half || moon != half {
            return false;
        }
    }
    for c in 0..size {
        let sun = (0..size).filter(|&r| grid[r][c] == CellValue::Sun).count();
        let moon = (0..size).filter(|&r| grid[r][c] == CellValue::Moon).count();
        if sun != half || moon != half {
            return false;
        }
    }

    // row uniqueness
    let mut row_strings = std::collections::HashSet::new();
    for r in 0..size {
        let key: String = grid[r]
            .iter()
            .map(|v| match v {
                CellValue::Sun => 'S',
                CellValue::Moon => 'M',
                CellValue::Empty => '.',
            })
            .collect();
        if !row_strings.insert(key) {
            return false;
        }
    }

    // column uniqueness
    let mut col_strings = std::collections::HashSet::new();
    for c in 0..size {
        let key: String = (0..size)
            .map(|r| match grid[r][c] {
                CellValue::Sun => 'S',
                CellValue::Moon => 'M',
                CellValue::Empty => '.',
            })
            .collect();
        if !col_strings.insert(key) {
            return false;
        }
    }

    true
}

/// Score: `max(100, 500 - floor(seconds/2))`.
#[must_use]
pub fn tango_score(time_spent_ms: u64) -> u32 {
    let seconds = time_spent_ms / 1000;
    let time_penalty = (seconds / 2) as u32;
    BASE_WIN_SCORE
        .saturating_sub(time_penalty)
        .max(MIN_WIN_SCORE)
}

/// Validate claimed win/loss; optionally require exact solution match on win.
#[must_use]
pub fn validate_and_score(
    submitted: Option<&[Vec<CellValue>]>,
    solution: Option<&[Vec<CellValue>]>,
    time_spent_ms: u64,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(grid) = submitted else {
        return GameResult::Invalid {
            error: "Missing grid data".into(),
        };
    };

    let solved = is_solved(grid);

    if claimed == SubmissionStatus::Won && !solved {
        return GameResult::Invalid {
            error: "Puzzle not correctly solved".into(),
        };
    }

    if claimed == SubmissionStatus::Won {
        if let Some(sol) = solution {
            if grid.len() != sol.len() {
                return GameResult::Invalid {
                    error: "Solution mismatch".into(),
                };
            }
            for r in 0..grid.len() {
                if grid[r].len() != sol[r].len() {
                    return GameResult::Invalid {
                        error: "Solution mismatch".into(),
                    };
                }
                for c in 0..grid[r].len() {
                    if grid[r][c] != sol[r][c] {
                        return GameResult::Invalid {
                            error: "Solution mismatch".into(),
                        };
                    }
                }
            }
        }
    }

    if claimed == SubmissionStatus::Lost && solved {
        return GameResult::Invalid {
            error: "Invalid loss claim - puzzle is solved".into(),
        };
    }

    if !solved {
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: tango_score(time_spent_ms),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s() -> CellValue {
        CellValue::Sun
    }
    fn m() -> CellValue {
        CellValue::Moon
    }
    fn e() -> CellValue {
        CellValue::Empty
    }

    /// Known-valid 4×4 tango grid.
    fn valid_4() -> Vec<Vec<CellValue>> {
        vec![
            vec![s(), s(), m(), m()],
            vec![m(), m(), s(), s()],
            vec![s(), m(), s(), m()],
            vec![m(), s(), m(), s()],
        ]
    }

    #[test]
    fn solved_valid_4() {
        assert!(is_solved(&valid_4()));
    }

    #[test]
    fn empty_not_solved() {
        let g = vec![vec![e(); 4]; 4];
        assert!(!is_solved(&g));
    }

    #[test]
    fn consecutive_violation_detected() {
        let mut g = valid_4();
        // force SSS on row 0
        g[0] = vec![s(), s(), s(), m()];
        assert!(has_consecutive_violation(&g, 0, 1));
        assert!(!is_solved(&g));
    }

    #[test]
    fn score_table_matches_ts() {
        assert_eq!(tango_score(0), 500);
        assert_eq!(tango_score(100_000), 450); // 100s → 50
        assert_eq!(tango_score(200_000), 400);
        assert_eq!(tango_score(2_000_000), 100);
        assert_eq!(tango_score(99_000), 451); // floor(99/2)=49
    }

    #[test]
    fn validate_win_and_loss() {
        let g = valid_4();
        let win = validate_and_score(Some(&g), Some(&g), 0, SubmissionStatus::Won);
        assert_eq!(
            win,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 500
            }
        );
        let mut bad = g.clone();
        bad[0][0] = m();
        let false_win = validate_and_score(Some(&bad), Some(&g), 0, SubmissionStatus::Won);
        assert!(!false_win.is_valid());
        let lost = validate_and_score(Some(&bad), Some(&g), 60_000, SubmissionStatus::Lost);
        assert_eq!(
            lost,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
        let false_loss = validate_and_score(Some(&g), Some(&g), 0, SubmissionStatus::Lost);
        assert!(!false_loss.is_valid());
        let missing = validate_and_score(None, Some(&g), 0, SubmissionStatus::Won);
        assert!(!missing.is_valid());
    }
}
