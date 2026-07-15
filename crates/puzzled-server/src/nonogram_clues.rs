//! Pure nonogram clue generation / row-col correctness —
//! mirrors `apps/puzzled/src/games/nonogram/types.ts`.
//! FLEET-PRODUCTS-WAVE4 pure residual. NO authority_rust / ts_deleted.

#![allow(clippy::needless_range_loop)] // 2D run-length scans are clearer with explicit indices

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
            if solution.get(row).and_then(|r| r.get(col)).copied().unwrap_or(false) {
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
}
