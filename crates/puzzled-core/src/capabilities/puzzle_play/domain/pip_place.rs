//! Pure pip-place (Spots) is_solved + score — mirrors
//! `apps/puzzled/src/games/pip-place/types.ts#isSolved` and
//! `config.ts#validateAndScore`.
//! Win is any covering that uses the complete double-n set and satisfies
//! every region constraint; stored seed tiles are ignored.

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

/// Placed domino: cells `a`/`b` hold pips `pa`/`pb`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Tile {
    pub a: Cell,
    pub b: Cell,
    pub pa: i32,
    pub pb: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegionKind {
    Sum,
    Equal,
    Unequal,
    Free,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Region {
    pub id: i32,
    pub kind: RegionKind,
    pub value: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Puzzle {
    pub max_pip: i32,
    pub rows: i32,
    pub cols: i32,
    pub region_of: Vec<Vec<i32>>,
    pub regions: Vec<Region>,
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

fn in_bounds(cell: Cell, rows: i32, cols: i32) -> bool {
    cell.row >= 0 && cell.col >= 0 && cell.row < rows && cell.col < cols
}

fn is_int_pip(value: i32, max_pip: i32) -> bool {
    value >= 0 && value <= max_pip
}

fn sorted_pair(a: i32, b: i32) -> (i32, i32) {
    if a <= b {
        (a, b)
    } else {
        (b, a)
    }
}

fn double_set(max_pip: i32) -> Vec<(i32, i32)> {
    let mut out = Vec::new();
    for a in 0..=max_pip {
        for b in a..=max_pip {
            out.push((a, b));
        }
    }
    out
}

fn region_holds(region: Region, pips: &[i32]) -> bool {
    match region.kind {
        RegionKind::Free => true,
        RegionKind::Sum => {
            let Some(value) = region.value else {
                return false;
            };
            pips.iter().sum::<i32>() == value
        }
        RegionKind::Equal => {
            let Some(first) = pips.first() else {
                return false;
            };
            if !pips.iter().all(|pip| pip == first) {
                return false;
            }
            if let Some(value) = region.value {
                if value != *first {
                    return false;
                }
            }
            true
        }
        RegionKind::Unequal => {
            let mut seen = pips.to_vec();
            seen.sort_unstable();
            seen.dedup();
            seen.len() == pips.len()
        }
    }
}

/// Whether `tiles` is any covering that uses the complete double-n set
/// and satisfies every region constraint.
#[must_use]
pub fn is_solved(tiles: &[Tile], puzzle: &Puzzle) -> bool {
    let Puzzle {
        max_pip,
        rows,
        cols,
        region_of,
        regions,
    } = puzzle;
    if *max_pip < 0 || *rows <= 0 || *cols <= 0 {
        return false;
    }
    if region_of.len() != *rows as usize {
        return false;
    }
    for line in region_of {
        if line.len() != *cols as usize {
            return false;
        }
    }

    let expected = double_set(*max_pip);
    if tiles.len() != expected.len() {
        return false;
    }
    let Some(cell_count) = rows.checked_mul(*cols) else {
        return false;
    };
    if cell_count as usize != expected.len() * 2 {
        return false;
    }

    let mut grid: Vec<Vec<Option<i32>>> = vec![vec![None; *cols as usize]; *rows as usize];
    let mut actual_pairs: Vec<(i32, i32)> = Vec::with_capacity(tiles.len());
    for tile in tiles {
        if !in_bounds(tile.a, *rows, *cols) || !in_bounds(tile.b, *rows, *cols) {
            return false;
        }
        if !is_orthogonal_neighbor(tile.a, tile.b) {
            return false;
        }
        if !is_int_pip(tile.pa, *max_pip) || !is_int_pip(tile.pb, *max_pip) {
            return false;
        }
        let ar = tile.a.row as usize;
        let ac = tile.a.col as usize;
        let br = tile.b.row as usize;
        let bc = tile.b.col as usize;
        if grid[ar][ac].is_some() || grid[br][bc].is_some() {
            return false;
        }
        grid[ar][ac] = Some(tile.pa);
        grid[br][bc] = Some(tile.pb);
        actual_pairs.push(sorted_pair(tile.pa, tile.pb));
    }

    for line in &grid {
        if line.iter().any(Option::is_none) {
            return false;
        }
    }

    let mut expected_pairs: Vec<(i32, i32)> = expected;
    expected_pairs.sort_unstable();
    actual_pairs.sort_unstable();
    if expected_pairs != actual_pairs {
        return false;
    }

    let mut region_ids = std::collections::BTreeSet::new();
    for region in regions {
        if !region_ids.insert(region.id) {
            return false;
        }
    }

    for line in region_of {
        for id in line {
            if !region_ids.contains(id) {
                return false;
            }
        }
    }

    for region in regions {
        let mut pips = Vec::new();
        for (r, line) in region_of.iter().enumerate() {
            for (c, id) in line.iter().enumerate() {
                if *id != region.id {
                    continue;
                }
                let Some(pip) = grid[r][c] else {
                    return false;
                };
                pips.push(pip);
            }
        }
        if pips.is_empty() {
            return false;
        }
        if !region_holds(*region, &pips) {
            return false;
        }
    }

    true
}

/// Score: `max(100, 500 - floor(seconds/2))`.
#[must_use]
pub fn pip_place_score(time_spent_ms: u64) -> u32 {
    let seconds = time_spent_ms / 1000;
    let time_penalty = (seconds / 2) as u32;
    BASE_WIN_SCORE
        .saturating_sub(time_penalty)
        .max(MIN_WIN_SCORE)
}

/// Validate claimed win/loss against region constraints. Stored seed tiles are not used.
#[must_use]
pub fn validate_and_score(
    tiles: Option<&[Tile]>,
    puzzle: &Puzzle,
    time_spent_ms: u64,
    claimed: SubmissionStatus,
) -> GameResult {
    let Some(tiles) = tiles else {
        return GameResult::Invalid {
            error: "Missing tiles".into(),
        };
    };

    let solved = is_solved(tiles, puzzle);

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
        score: pip_place_score(time_spent_ms),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cell(row: i32, col: i32) -> Cell {
        Cell { row, col }
    }

    fn fixture_puzzle() -> Puzzle {
        Puzzle {
            max_pip: 1,
            rows: 2,
            cols: 3,
            region_of: vec![vec![1, 1, 0], vec![1, 1, 1]],
            regions: vec![
                Region {
                    id: 0,
                    kind: RegionKind::Sum,
                    value: Some(0),
                },
                Region {
                    id: 1,
                    kind: RegionKind::Free,
                    value: None,
                },
            ],
        }
    }

    fn tiles_a() -> Vec<Tile> {
        vec![
            Tile {
                a: cell(0, 0),
                b: cell(1, 0),
                pa: 0,
                pb: 0,
            },
            Tile {
                a: cell(0, 1),
                b: cell(1, 1),
                pa: 1,
                pb: 1,
            },
            Tile {
                a: cell(0, 2),
                b: cell(1, 2),
                pa: 0,
                pb: 1,
            },
        ]
    }

    fn tiles_b() -> Vec<Tile> {
        vec![
            Tile {
                a: cell(0, 0),
                b: cell(0, 1),
                pa: 0,
                pb: 0,
            },
            Tile {
                a: cell(1, 0),
                b: cell(1, 1),
                pa: 1,
                pb: 1,
            },
            Tile {
                a: cell(0, 2),
                b: cell(1, 2),
                pa: 0,
                pb: 1,
            },
        ]
    }

    #[test]
    fn both_fixture_tilings_solve() {
        let puzzle = fixture_puzzle();
        assert!(is_solved(&tiles_a(), &puzzle));
        assert!(is_solved(&tiles_b(), &puzzle));
    }

    #[test]
    fn incomplete_tiles_are_not_solved() {
        let puzzle = fixture_puzzle();
        assert!(!is_solved(&tiles_a()[..2], &puzzle));
    }

    #[test]
    fn score_table_matches_ts() {
        assert_eq!(pip_place_score(0), 500);
        assert_eq!(pip_place_score(100_000), 450);
        assert_eq!(pip_place_score(200_000), 400);
        assert_eq!(pip_place_score(2_000_000), 100);
        assert_eq!(pip_place_score(99_000), 451);
    }

    #[test]
    fn validate_alternate_tiling_and_claims() {
        let puzzle = fixture_puzzle();
        let a = tiles_a();
        let b = tiles_b();
        let win_b = validate_and_score(Some(&b), &puzzle, 0, SubmissionStatus::Won);
        assert_eq!(
            win_b,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 500
            }
        );
        let win_a = validate_and_score(Some(&a), &puzzle, 100_000, SubmissionStatus::Won);
        assert_eq!(
            win_a,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 450
            }
        );
        let incomplete = tiles_a()[..2].to_vec();
        let false_win = validate_and_score(Some(&incomplete), &puzzle, 0, SubmissionStatus::Won);
        assert!(!false_win.is_valid());
        let lost = validate_and_score(Some(&incomplete), &puzzle, 60_000, SubmissionStatus::Lost);
        assert_eq!(
            lost,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
        let false_loss = validate_and_score(Some(&b), &puzzle, 0, SubmissionStatus::Lost);
        assert!(!false_loss.is_valid());
        let missing = validate_and_score(None, &puzzle, 0, SubmissionStatus::Won);
        assert!(!missing.is_valid());
        if let GameResult::Invalid { error } = missing {
            assert!(error.contains("Missing tiles"));
        }
    }
}
