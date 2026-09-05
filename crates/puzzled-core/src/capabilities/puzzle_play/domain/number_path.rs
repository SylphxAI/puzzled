//! Pure number-path (Path) is_solved + score — mirrors
//! `apps/puzzled/src/games/number-path/types.ts#isSolved` and
//! `config.ts#validateAndScore`.
//! Win is any Hamiltonian path that respects clues; stored seed path is ignored.

/// Base score for a win before time penalty.
pub const BASE_WIN_SCORE: u32 = 500;
/// Floor score for a win.
pub const MIN_WIN_SCORE: u32 = 100;

/// Grid cell.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Cell {
    pub row: i32,
    pub col: i32,
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

fn is_orthogonal_neighbor(a: Cell, b: Cell) -> bool {
    a.row.abs_diff(b.row) + a.col.abs_diff(b.col) == 1
}

/// Whether `path` is any valid Hamiltonian path that respects `clues`.
#[must_use]
pub fn is_solved(path: &[Cell], clues: &[Vec<Option<u32>>]) -> bool {
    let size = clues.len();
    if size == 0 {
        return false;
    }
    let n = size * size;
    if path.len() != n {
        return false;
    }

    let mut seen = vec![false; n];
    for (i, cell) in path.iter().enumerate() {
        if cell.row < 0 || cell.col < 0 {
            return false;
        }
        let row = cell.row as usize;
        let col = cell.col as usize;
        if row >= size || col >= size {
            return false;
        }
        let Some(line) = clues.get(row) else {
            return false;
        };
        if line.len() != size {
            return false;
        }
        let idx = row * size + col;
        if seen[idx] {
            return false;
        }
        seen[idx] = true;
        if i > 0 && !is_orthogonal_neighbor(path[i - 1], *cell) {
            return false;
        }
    }

    for (row, line) in clues.iter().enumerate() {
        if line.len() != size {
            return false;
        }
        for (col, clue) in line.iter().enumerate() {
            let Some(value) = *clue else {
                continue;
            };
            if value < 1 {
                return false;
            }
            let step = value as usize;
            if step > n {
                return false;
            }
            let expected = path[step - 1];
            if expected.row != row as i32 || expected.col != col as i32 {
                return false;
            }
        }
    }

    true
}

/// Score: `max(100, 500 - floor(seconds/2))`.
#[must_use]
pub fn number_path_score(time_spent_ms: u64) -> u32 {
    let seconds = time_spent_ms / 1000;
    let time_penalty = (seconds / 2) as u32;
    BASE_WIN_SCORE
        .saturating_sub(time_penalty)
        .max(MIN_WIN_SCORE)
}

/// Validate claimed win/loss against clues. Stored seed path is not used.
#[must_use]
pub fn validate_and_score(
    path: Option<&[Cell]>,
    clues: &[Vec<Option<u32>>],
    time_spent_ms: u64,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(path) = path else {
        return GameResult::Invalid {
            error: "Missing path".into(),
        };
    };

    let solved = is_solved(path, clues);

    if claimed == SubmissionStatus::Won && !solved {
        return GameResult::Invalid {
            error: "Puzzle not correctly solved".into(),
        };
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
        score: number_path_score(time_spent_ms),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cell(row: i32, col: i32) -> Cell {
        Cell { row, col }
    }

    fn fixture_clues() -> Vec<Vec<Option<u32>>> {
        vec![
            vec![Some(1), None, None],
            vec![None, None, None],
            vec![None, None, Some(9)],
        ]
    }

    fn path_a() -> Vec<Cell> {
        vec![
            cell(0, 0),
            cell(0, 1),
            cell(0, 2),
            cell(1, 2),
            cell(1, 1),
            cell(1, 0),
            cell(2, 0),
            cell(2, 1),
            cell(2, 2),
        ]
    }

    fn path_b() -> Vec<Cell> {
        vec![
            cell(0, 0),
            cell(1, 0),
            cell(2, 0),
            cell(2, 1),
            cell(1, 1),
            cell(0, 1),
            cell(0, 2),
            cell(1, 2),
            cell(2, 2),
        ]
    }

    #[test]
    fn both_fixture_paths_solve() {
        let clues = fixture_clues();
        assert!(is_solved(&path_a(), &clues));
        assert!(is_solved(&path_b(), &clues));
    }

    #[test]
    fn incomplete_path_is_not_solved() {
        let clues = fixture_clues();
        assert!(!is_solved(&path_a()[..4], &clues));
    }

    #[test]
    fn score_table_matches_ts() {
        assert_eq!(number_path_score(0), 500);
        assert_eq!(number_path_score(100_000), 450);
        assert_eq!(number_path_score(200_000), 400);
        assert_eq!(number_path_score(2_000_000), 100);
        assert_eq!(number_path_score(99_000), 451);
    }

    #[test]
    fn validate_alternate_path_and_claims() {
        let clues = fixture_clues();
        let a = path_a();
        let b = path_b();
        let win_b = validate_and_score(Some(&b), &clues, 0, SubmissionStatus::Won);
        assert_eq!(
            win_b,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 500
            }
        );
        let win_a = validate_and_score(Some(&a), &clues, 100_000, SubmissionStatus::Won);
        assert_eq!(
            win_a,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 450
            }
        );
        let incomplete = path_a()[..4].to_vec();
        let false_win = validate_and_score(Some(&incomplete), &clues, 0, SubmissionStatus::Won);
        assert!(!false_win.is_valid());
        let lost = validate_and_score(Some(&incomplete), &clues, 60_000, SubmissionStatus::Lost);
        assert_eq!(
            lost,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
        let false_loss = validate_and_score(Some(&b), &clues, 0, SubmissionStatus::Lost);
        assert!(!false_loss.is_valid());
        let missing = validate_and_score(None, &clues, 0, SubmissionStatus::Won);
        assert!(!missing.is_valid());
        if let GameResult::Invalid { error } = missing {
            assert!(error.contains("Missing path"));
        }
    }
}
