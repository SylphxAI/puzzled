//! Deterministic Crowns (queens) generator — free-floor fallback.
//!
//! Parity with `apps/puzzled/src/games/queens/generator.ts`. Used when the
//! content store has no row for the day (same pattern as sudoku / crossword).

use serde::{Deserialize, Serialize};

use super::random::{seeded_random, shuffle_array, SeededRandom};

const MIN_SIZE: usize = 5;
const MAX_SIZE: usize = 9;
const DEFAULT_SIZE: usize = 6;
const MAX_UNIQUE_ATTEMPTS: usize = 10;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueensPuzzleData {
    pub size: usize,
    pub regions: Vec<Vec<i32>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueensSolution {
    pub queens: Vec<[usize; 2]>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueensPuzzleResult {
    #[serde(rename = "puzzleData")]
    pub puzzle_data: QueensPuzzleData,
    pub solution: QueensSolution,
}

fn clamp_size(size: usize) -> usize {
    if (MIN_SIZE..=MAX_SIZE).contains(&size) {
        size
    } else {
        DEFAULT_SIZE
    }
}

fn can_place_adjacent(queens: &[[usize; 2]], row: usize, col: usize) -> bool {
    for &[r, c] in queens {
        if c == col {
            return false;
        }
        if r.abs_diff(row) <= 1 && c.abs_diff(col) <= 1 {
            return false;
        }
    }
    true
}

fn generate_queen_positions(size: usize, random: &mut SeededRandom) -> Vec<[usize; 2]> {
    let mut queens: Vec<[usize; 2]> = Vec::with_capacity(size);

    fn solve(size: usize, queens: &mut Vec<[usize; 2]>, random: &mut SeededRandom) -> bool {
        if queens.len() >= size {
            return true;
        }
        let row = queens.len();
        let cols: Vec<usize> = (0..size).collect();
        let shuffled = shuffle_array(&cols, random);
        for col in shuffled {
            if can_place_adjacent(queens, row, col) {
                queens.push([row, col]);
                if solve(size, queens, random) {
                    return true;
                }
                queens.pop();
            }
        }
        false
    }

    let _ = solve(size, &mut queens, random);
    queens
}

fn generate_regions(
    size: usize,
    queens: &[[usize; 2]],
    random: &mut SeededRandom,
) -> Vec<Vec<i32>> {
    let mut regions = vec![vec![-1_i32; size]; size];
    for (index, &[row, col]) in queens.iter().enumerate() {
        if row < size && col < size {
            regions[row][col] = i32::try_from(index).unwrap_or(0);
        }
    }

    let mut unassigned = size.saturating_mul(size).saturating_sub(queens.len());
    let mut iterations = 0_usize;
    let max_iterations = size.saturating_mul(size).saturating_mul(10);
    let directions: [(isize, isize); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

    while unassigned > 0 && iterations < max_iterations {
        iterations += 1;
        let region_index = (random.next_f64() * size as f64).floor() as usize;
        if region_index >= size {
            continue;
        }

        let mut region_cells = Vec::new();
        for (r, row) in regions.iter().enumerate() {
            for (c, &value) in row.iter().enumerate() {
                if value == i32::try_from(region_index).unwrap_or(-1) {
                    region_cells.push([r, c]);
                }
            }
        }
        let shuffled_cells = shuffle_array(&region_cells, random);
        for [r, c] in shuffled_cells {
            let shuffled_dirs = shuffle_array(&directions, random);
            for (dr, dc) in shuffled_dirs {
                let nr = r as isize + dr;
                let nc = c as isize + dc;
                if nr >= 0 && nc >= 0 {
                    let nr = nr as usize;
                    let nc = nc as usize;
                    if nr < size && nc < size && regions[nr][nc] == -1 {
                        regions[nr][nc] = i32::try_from(region_index).unwrap_or(0);
                        unassigned = unassigned.saturating_sub(1);
                        break;
                    }
                }
            }
            if unassigned == 0 {
                break;
            }
        }
    }

    for r in 0..size {
        for c in 0..size {
            if regions[r][c] != -1 {
                continue;
            }
            let mut min_dist = usize::MAX;
            let mut nearest = 0_i32;
            for (nr, row) in regions.iter().enumerate() {
                for (nc, &value) in row.iter().enumerate() {
                    if value == -1 {
                        continue;
                    }
                    let dist = nr.abs_diff(r) + nc.abs_diff(c);
                    if dist < min_dist {
                        min_dist = dist;
                        nearest = value;
                    }
                }
            }
            regions[r][c] = nearest;
        }
    }

    regions
}

fn has_unique_solution(regions: &[Vec<i32>], size: usize) -> Option<Vec<[usize; 2]>> {
    let mut solutions: Vec<Vec<[usize; 2]>> = Vec::new();

    fn can_place(queens: &[[usize; 2]], regions: &[Vec<i32>], row: usize, col: usize) -> bool {
        let my_region = regions.get(row).and_then(|r| r.get(col)).copied();
        for &[r, c] in queens {
            if c == col {
                return false;
            }
            if r.abs_diff(row) <= 1 && c.abs_diff(col) <= 1 {
                return false;
            }
            if regions.get(r).and_then(|rowv| rowv.get(c)).copied() == my_region {
                return false;
            }
        }
        true
    }

    fn solve(
        size: usize,
        regions: &[Vec<i32>],
        row: usize,
        queens: &mut Vec<[usize; 2]>,
        solutions: &mut Vec<Vec<[usize; 2]>>,
    ) {
        if solutions.len() > 1 {
            return;
        }
        if row >= size {
            solutions.push(queens.clone());
            return;
        }
        for col in 0..size {
            if can_place(queens, regions, row, col) {
                queens.push([row, col]);
                solve(size, regions, row + 1, queens, solutions);
                queens.pop();
            }
        }
    }

    let mut queens = Vec::with_capacity(size);
    solve(size, regions, 0, &mut queens, &mut solutions);
    if solutions.len() == 1 {
        solutions.pop()
    } else {
        None
    }
}

/// Generate a Crowns puzzle from a seed. Always returns a playable board.
#[must_use]
pub fn generate_queens_puzzle(seed: i64, size: usize) -> QueensPuzzleResult {
    let size = clamp_size(size);
    let mut random = seeded_random(seed);
    let mut queens = generate_queen_positions(size, &mut random);
    let mut regions = generate_regions(size, &queens, &mut random);

    let mut attempts = 0_usize;
    while attempts < MAX_UNIQUE_ATTEMPTS {
        if let Some(unique) = has_unique_solution(&regions, size) {
            queens = unique;
            break;
        }
        let mut retry = seeded_random(seed + i64::try_from(attempts).unwrap_or(0) + 1);
        queens = generate_queen_positions(size, &mut retry);
        regions = generate_regions(size, &queens, &mut retry);
        attempts += 1;
    }

    QueensPuzzleResult {
        puzzle_data: QueensPuzzleData { size, regions },
        solution: QueensSolution { queens },
    }
}

/// Board size for the product difficulty labels (mirrors TS `queensConfig`).
#[must_use]
pub fn queens_board_size(difficulty: Option<&str>) -> usize {
    match difficulty
        .unwrap_or("medium")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "easy" => 5,
        "hard" => 8,
        _ => 6,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capabilities::puzzle_play::domain::queens_conflict;

    fn solution_grid(queens: &[[usize; 2]], size: usize) -> Vec<Vec<bool>> {
        let mut grid = vec![vec![false; size]; size];
        for &[row, col] in queens {
            if row < size && col < size {
                grid[row][col] = true;
            }
        }
        grid
    }

    #[test]
    fn same_seed_is_deterministic() {
        let first = generate_queens_puzzle(5, 6);
        let second = generate_queens_puzzle(5, 6);
        assert_eq!(first, second);
    }

    #[test]
    fn seed_five_medium_matches_ts_oracle() {
        let puzzle = generate_queens_puzzle(5, 6);
        assert_eq!(puzzle.puzzle_data.size, 6);
        assert_eq!(
            puzzle.puzzle_data.regions,
            vec![
                vec![1, 1, 1, 0, 2, 2],
                vec![1, 1, 2, 2, 2, 2],
                vec![4, 4, 2, 2, 2, 2],
                vec![4, 4, 3, 2, 2, 2],
                vec![4, 4, 2, 2, 2, 2],
                vec![4, 4, 2, 2, 2, 5],
            ]
        );
        assert_eq!(
            puzzle.solution.queens,
            vec![[0, 3], [1, 1], [2, 4], [3, 2], [4, 0], [5, 5]]
        );
    }

    #[test]
    fn generated_solution_solves_its_regions() {
        for seed in [0_i64, 1, 4, 5, 12_345] {
            for size in [5_usize, 6, 8] {
                let puzzle = generate_queens_puzzle(seed, size);
                let grid = solution_grid(&puzzle.solution.queens, puzzle.puzzle_data.size);
                assert!(
                    queens_conflict::is_solved(
                        &grid,
                        &puzzle.puzzle_data.regions,
                        puzzle.puzzle_data.size
                    ),
                    "seed {seed} size {size} must be solvable"
                );
            }
        }
    }

    #[test]
    fn difficulty_sizes() {
        assert_eq!(queens_board_size(Some("easy")), 5);
        assert_eq!(queens_board_size(Some("medium")), 6);
        assert_eq!(queens_board_size(Some("hard")), 8);
        assert_eq!(queens_board_size(None), 6);
    }
}
