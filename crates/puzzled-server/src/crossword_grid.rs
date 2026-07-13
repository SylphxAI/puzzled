//! Pure crossword grid complete check — mirrors
//! `apps/puzzled/src/games/crossword/types.ts#isGridComplete`.
//! FLEET-PRODUCTS-WAVE7 pure residual. NO authority_rust / ts_deleted.

/// Mini-crossword grid size (5x5).
pub const CROSSWORD_GRID_SIZE: usize = 5;

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
            let user_cell = user_grid
                .get(row)
                .and_then(|r| r.get(col))
                .and_then(|c| c.as_ref());
            let Some(user) = user_cell else {
                return false;
            };
            if user.to_uppercase() != sol.to_uppercase() {
                return false;
            }
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn grid(cells: [[Option<&str>; 5]; 5]) -> Vec<Vec<Option<String>>> {
        cells
            .into_iter()
            .map(|row| {
                row.into_iter()
                    .map(|c| c.map(|s| s.to_string()))
                    .collect()
            })
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
}
