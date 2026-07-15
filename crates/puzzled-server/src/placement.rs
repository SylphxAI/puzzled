//! Pure Sudoku placement validity — mirrors `apps/puzzled/src/games/sudoku/types.ts`.

#![allow(clippy::needless_range_loop)] // 2D grid scans are clearer with explicit indices

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


/// Check if every cell of `user_values` matches `solution`.
/// Mirrors `isGridComplete(userGrid, solution)` using plain Option/u8 values
/// (caller maps SudokuCell.value → Option<u8>).
#[must_use]
pub fn is_grid_complete(user_values: &[Vec<Option<u8>>], solution: &[Vec<u8>]) -> bool {
    if solution.len() != GRID_SIZE {
        return false;
    }
    for row in 0..GRID_SIZE {
        let sol_row = match solution.get(row) {
            Some(r) if r.len() == GRID_SIZE => r,
            _ => return false,
        };
        let user_row = match user_values.get(row) {
            Some(r) => r,
            None => return false,
        };
        for col in 0..GRID_SIZE {
            let sol = sol_row[col];
            let user = user_row.get(col).copied().flatten();
            if user != Some(sol) {
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

    #[test]
    fn grid_complete_matches_solution() {
        let sol: Vec<Vec<u8>> = (0..9)
            .map(|r| (0..9).map(|c| (((r * 3 + r / 3 + c) % 9) + 1) as u8).collect())
            .collect();
        let user: Vec<Vec<Option<u8>>> = sol
            .iter()
            .map(|row| row.iter().map(|v| Some(*v)).collect())
            .collect();
        assert!(is_grid_complete(&user, &sol));
        let mut incomplete = user.clone();
        incomplete[0][0] = None;
        assert!(!is_grid_complete(&incomplete, &sol));
        let mut wrong = user;
        wrong[0][0] = Some(9);
        // may or may not equal sol[0][0]; force mismatch
        if wrong[0][0] == Some(sol[0][0]) {
            wrong[0][0] = Some(if sol[0][0] == 1 { 2 } else { 1 });
        }
        assert!(!is_grid_complete(&wrong, &sol));
    }
}
