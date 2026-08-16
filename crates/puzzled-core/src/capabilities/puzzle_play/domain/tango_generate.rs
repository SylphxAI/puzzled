//! Deterministic Duo (Tango) generator — fallback when no content-store row exists.
//!
//! Parity with `apps/puzzled/src/games/tango/generator.ts`.

use serde_json::{json, Value};

use super::random::SeededRandom;
use super::tango::{CellValue, MAX_CONSECUTIVE};

fn cell_str(value: CellValue) -> Option<&'static str> {
    match value {
        CellValue::Sun => Some("sun"),
        CellValue::Moon => Some("moon"),
        CellValue::Empty => None,
    }
}

fn opposite(value: CellValue) -> CellValue {
    match value {
        CellValue::Sun => CellValue::Moon,
        CellValue::Moon => CellValue::Sun,
        CellValue::Empty => CellValue::Empty,
    }
}

fn is_valid_placement(
    grid: &mut [Vec<CellValue>],
    row: usize,
    col: usize,
    value: CellValue,
) -> bool {
    let size = grid.len();
    let half = size / 2;
    grid[row][col] = value;

    let mut h_count = 1usize;
    let mut c = col;
    while c > 0 && grid[row][c - 1] == value {
        h_count += 1;
        c -= 1;
    }
    c = col + 1;
    while c < size && grid[row][c] == value {
        h_count += 1;
        c += 1;
    }
    if h_count > MAX_CONSECUTIVE {
        grid[row][col] = CellValue::Empty;
        return false;
    }

    let mut v_count = 1usize;
    let mut r = row;
    while r > 0 && grid[r - 1][col] == value {
        v_count += 1;
        r -= 1;
    }
    r = row + 1;
    while r < size && grid[r][col] == value {
        v_count += 1;
        r += 1;
    }
    if v_count > MAX_CONSECUTIVE {
        grid[row][col] = CellValue::Empty;
        return false;
    }

    let row_suns = grid[row]
        .iter()
        .filter(|cell| **cell == CellValue::Sun)
        .count();
    let row_moons = grid[row]
        .iter()
        .filter(|cell| **cell == CellValue::Moon)
        .count();
    if row_suns > half || row_moons > half {
        grid[row][col] = CellValue::Empty;
        return false;
    }

    let col_suns = grid
        .iter()
        .filter(|line| line[col] == CellValue::Sun)
        .count();
    let col_moons = grid
        .iter()
        .filter(|line| line[col] == CellValue::Moon)
        .count();
    if col_suns > half || col_moons > half {
        grid[row][col] = CellValue::Empty;
        return false;
    }

    grid[row][col] = CellValue::Empty;
    true
}

fn rows_and_cols_unique(grid: &[Vec<CellValue>]) -> bool {
    let size = grid.len();
    let mut row_strings = std::collections::BTreeSet::new();
    for row in grid {
        let key: String = row.iter().filter_map(|cell| cell_str(*cell)).collect();
        if !row_strings.insert(key) {
            return false;
        }
    }
    let mut col_strings = std::collections::BTreeSet::new();
    for col in 0..size {
        let key: String = grid.iter().filter_map(|row| cell_str(row[col])).collect();
        if !col_strings.insert(key) {
            return false;
        }
    }
    true
}

fn generate_solution(random: &mut SeededRandom, size: usize) -> Option<Vec<Vec<CellValue>>> {
    let mut grid = vec![vec![CellValue::Empty; size]; size];

    fn solve(
        grid: &mut [Vec<CellValue>],
        random: &mut SeededRandom,
        pos: usize,
        size: usize,
    ) -> bool {
        if pos == size * size {
            return rows_and_cols_unique(grid);
        }
        let row = pos / size;
        let col = pos % size;
        let first = if random.next_f64() < 0.5 {
            CellValue::Sun
        } else {
            CellValue::Moon
        };
        for value in [first, opposite(first)] {
            if is_valid_placement(grid, row, col, value) {
                grid[row][col] = value;
                if solve(grid, random, pos + 1, size) {
                    return true;
                }
                grid[row][col] = CellValue::Empty;
            }
        }
        false
    }

    if solve(&mut grid, random, 0, size) {
        Some(grid)
    } else {
        None
    }
}

fn count_solutions(puzzle: &[Vec<CellValue>], max_solutions: u32) -> u32 {
    let size = puzzle.len();
    let mut grid = puzzle.to_vec();
    let mut solutions = 0u32;

    fn solve(
        grid: &mut [Vec<CellValue>],
        pos: usize,
        size: usize,
        solutions: &mut u32,
        max_solutions: u32,
    ) {
        if *solutions >= max_solutions {
            return;
        }
        if pos == size * size {
            if rows_and_cols_unique(grid) {
                *solutions += 1;
            }
            return;
        }
        let row = pos / size;
        let col = pos % size;
        if grid[row][col] != CellValue::Empty {
            solve(grid, pos + 1, size, solutions, max_solutions);
            return;
        }
        for value in [CellValue::Sun, CellValue::Moon] {
            if is_valid_placement(grid, row, col, value) {
                grid[row][col] = value;
                solve(grid, pos + 1, size, solutions, max_solutions);
                grid[row][col] = CellValue::Empty;
                if *solutions >= max_solutions {
                    return;
                }
            }
        }
    }

    solve(&mut grid, 0, size, &mut solutions, max_solutions);
    solutions
}

fn create_puzzle(
    solution: &[Vec<CellValue>],
    random: &mut SeededRandom,
    target_clues: usize,
) -> Vec<Vec<CellValue>> {
    let size = solution.len();
    let mut puzzle = solution.to_vec();
    let mut positions: Vec<(usize, usize)> = (0..size)
        .flat_map(|row| (0..size).map(move |col| (row, col)))
        .collect();
    for index in (1..positions.len()).rev() {
        let swap_index = (random.next_f64() * (index as f64 + 1.0)).floor() as usize;
        positions.swap(index, swap_index);
    }
    let mut clues_remaining = size * size;
    for (row, col) in positions {
        if clues_remaining <= target_clues {
            break;
        }
        let saved = puzzle[row][col];
        puzzle[row][col] = CellValue::Empty;
        if count_solutions(&puzzle, 2) == 1 {
            clues_remaining -= 1;
        } else {
            puzzle[row][col] = saved;
        }
    }
    puzzle
}

#[must_use]
pub fn get_size_from_seed(seed: i64) -> usize {
    let variant = seed.unsigned_abs() % 7;
    if variant >= 5 {
        8
    } else {
        6
    }
}

fn grid_json(grid: &[Vec<CellValue>]) -> Value {
    Value::Array(
        grid.iter()
            .map(|row| {
                Value::Array(
                    row.iter()
                        .map(|cell| match cell_str(*cell) {
                            Some(label) => Value::String(label.to_string()),
                            None => Value::Null,
                        })
                        .collect(),
                )
            })
            .collect(),
    )
}

/// Generate client initial grid + server solution for a seed.
#[must_use]
pub fn generate_duo_puzzle(seed: i64) -> (Value, Value) {
    let size = get_size_from_seed(seed);
    let mut random = SeededRandom::new(seed);
    let solution = generate_solution(&mut random, size).unwrap_or_else(|| {
        panic!("Tango: Failed to generate valid {size}x{size} solution for seed {seed}")
    });
    let target_clues = ((size * size) as f64 * 0.35).floor() as usize;
    let initial = create_puzzle(&solution, &mut random, target_clues);
    (
        json!({
            "size": size,
            "initialGrid": grid_json(&initial),
        }),
        json!({ "grid": grid_json(&solution) }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn size_from_seed_matches_ts() {
        assert_eq!(get_size_from_seed(0), 6);
        assert_eq!(get_size_from_seed(4), 6);
        assert_eq!(get_size_from_seed(5), 8);
        assert_eq!(get_size_from_seed(6), 8);
        assert_eq!(get_size_from_seed(7), 6);
        assert_eq!(get_size_from_seed(-5), 8);
    }

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(generate_duo_puzzle(1), generate_duo_puzzle(1));
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let (data, solution) = generate_duo_puzzle(1);
        assert_eq!(data["size"], 6);
        assert_eq!(
            data["initialGrid"][0],
            json!([null, null, null, null, null, "moon"])
        );
        assert_eq!(
            solution["grid"][0],
            json!(["moon", "sun", "sun", "moon", "sun", "moon"])
        );

        let (data2, solution2) = generate_duo_puzzle(2);
        assert_eq!(
            data2["initialGrid"][0],
            json!([null, "moon", null, "moon", null, null])
        );
        assert_eq!(
            solution2["grid"][0],
            json!(["sun", "moon", "sun", "moon", "sun", "moon"])
        );

        let (data42, solution42) = generate_duo_puzzle(42);
        assert_eq!(
            data42["initialGrid"][0],
            json!(["moon", null, null, null, null, null])
        );
        assert_eq!(
            solution42["grid"][0],
            json!(["moon", "moon", "sun", "moon", "sun", "sun"])
        );
    }
}
