//! Pure Sudoku placement validity — mirrors `apps/puzzled/src/games/sudoku/types.ts`.

pub const GRID_SIZE: usize = 9;
pub const BOX_SIZE: usize = 3;

/// Check if `value` is valid at `(row, col)` with no row/col/box conflicts.
/// Empty cells are represented as `None` (TS `null`).
#[must_use]
pub fn is_valid_placement(grid: &[Vec<Option<u8>>], row: usize, col: usize, value: u8) -> bool {
    if row >= GRID_SIZE || col >= GRID_SIZE || !(1..=9).contains(&value) {
        return false;
    }

    for c in 0..GRID_SIZE {
        if c != col && grid.get(row).and_then(|r| r.get(c)).copied().flatten() == Some(value) {
            return false;
        }
    }
    for r in 0..GRID_SIZE {
        if r != row && grid.get(r).and_then(|rowv| rowv.get(col)).copied().flatten() == Some(value) {
            return false;
        }
    }

    let box_row = (row / BOX_SIZE) * BOX_SIZE;
    let box_col = (col / BOX_SIZE) * BOX_SIZE;
    for r in box_row..box_row + BOX_SIZE {
        for c in box_col..box_col + BOX_SIZE {
            if (r != row || c != col)
                && grid.get(r).and_then(|rowv| rowv.get(c)).copied().flatten() == Some(value)
            {
                return false;
            }
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_grid() -> Vec<Vec<Option<u8>>> {
        vec![vec![None; GRID_SIZE]; GRID_SIZE]
    }

    #[test]
    fn allows_first_placement() {
        let g = empty_grid();
        assert!(is_valid_placement(&g, 0, 0, 5));
    }

    #[test]
    fn rejects_row_conflict() {
        let mut g = empty_grid();
        g[0][1] = Some(5);
        assert!(!is_valid_placement(&g, 0, 0, 5));
    }

    #[test]
    fn rejects_col_conflict() {
        let mut g = empty_grid();
        g[1][0] = Some(5);
        assert!(!is_valid_placement(&g, 0, 0, 5));
    }

    #[test]
    fn rejects_box_conflict() {
        let mut g = empty_grid();
        g[1][1] = Some(5);
        assert!(!is_valid_placement(&g, 0, 0, 5));
    }
}
