//! Frozen Sudoku grid generator — parity with `apps/puzzled/src/games/sudoku/generator.ts`.

use serde::{Deserialize, Serialize};

use crate::random::{seeded_random, shuffle_array, SeededRandom};

const GRID_SIZE: usize = 9;
const BOX_SIZE: usize = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SudokuDifficulty {
    Easy,
    Medium,
    Hard,
}

impl SudokuDifficulty {
    fn as_str(self) -> &'static str {
        match self {
            Self::Easy => "easy",
            Self::Medium => "medium",
            Self::Hard => "hard",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SudokuPuzzleData {
    pub grid: Vec<Vec<Option<u8>>>,
    pub difficulty: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SudokuSolution {
    pub grid: Vec<Vec<u8>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SudokuPuzzleResult {
    #[serde(rename = "puzzleData")]
    pub puzzle_data: SudokuPuzzleData,
    pub solution: SudokuSolution,
}

fn is_valid_placement(grid: &[Vec<u8>], row: usize, col: usize, value: u8) -> bool {
    for column in 0..GRID_SIZE {
        if column != col && grid[row][column] == value {
            return false;
        }
    }
    for row_index in 0..GRID_SIZE {
        if row_index != row && grid[row_index][col] == value {
            return false;
        }
    }
    let box_row = (row / BOX_SIZE) * BOX_SIZE;
    let box_col = (col / BOX_SIZE) * BOX_SIZE;
    for row_index in box_row..box_row + BOX_SIZE {
        for column in box_col..box_col + BOX_SIZE {
            if (row_index != row || column != col) && grid[row_index][column] == value {
                return false;
            }
        }
    }
    true
}

fn generate_complete_grid(random: &mut SeededRandom) -> Vec<Vec<u8>> {
    let mut grid = vec![vec![0_u8; GRID_SIZE]; GRID_SIZE];

    fn solve(grid: &mut [Vec<u8>], row: usize, col: usize, random: &mut SeededRandom) -> bool {
        let (mut row, mut col) = (row, col);
        if col >= GRID_SIZE {
            col = 0;
            row += 1;
        }
        if row >= GRID_SIZE {
            return true;
        }

        let numbers = shuffle_array(&[1_u8, 2, 3, 4, 5, 6, 7, 8, 9], random);
        for number in numbers {
            if is_valid_placement(grid, row, col, number) {
                grid[row][col] = number;
                if solve(grid, row, col + 1, random) {
                    return true;
                }
                grid[row][col] = 0;
            }
        }
        false
    }

    solve(&mut grid, 0, 0, random);
    grid
}

fn is_valid_placement_optional(
    grid: &[Vec<Option<u8>>],
    row: usize,
    col: usize,
    value: u8,
) -> bool {
    for column in 0..GRID_SIZE {
        if column != col && grid[row][column] == Some(value) {
            return false;
        }
    }
    for row_index in 0..GRID_SIZE {
        if row_index != row && grid[row_index][col] == Some(value) {
            return false;
        }
    }
    let box_row = (row / BOX_SIZE) * BOX_SIZE;
    let box_col = (col / BOX_SIZE) * BOX_SIZE;
    for row_index in box_row..box_row + BOX_SIZE {
        for column in box_col..box_col + BOX_SIZE {
            if (row_index != row || column != col) && grid[row_index][column] == Some(value) {
                return false;
            }
        }
    }
    true
}

fn count_solutions(grid: &[Vec<Option<u8>>], max_count: usize) -> usize {
    let mut work: Vec<Vec<Option<u8>>> = grid.to_vec();
    let mut count = 0_usize;

    fn solve(
        work: &mut [Vec<Option<u8>>],
        row: usize,
        col: usize,
        count: &mut usize,
        max_count: usize,
    ) -> bool {
        let (mut row, mut col) = (row, col);
        if col >= GRID_SIZE {
            col = 0;
            row += 1;
        }
        if row >= GRID_SIZE {
            *count += 1;
            return *count >= max_count;
        }

        if work[row][col].is_some() {
            return solve(work, row, col + 1, count, max_count);
        }

        for number in 1_u8..=9 {
            if is_valid_placement_optional(work, row, col, number) {
                work[row][col] = Some(number);
                if solve(work, row, col + 1, count, max_count) {
                    work[row][col] = None;
                    return true;
                }
                work[row][col] = None;
            }
        }
        false
    }

    solve(&mut work, 0, 0, &mut count, max_count);
    count
}

fn remove_numbers(
    solution: &[Vec<u8>],
    difficulty: SudokuDifficulty,
    random: &mut SeededRandom,
) -> Vec<Vec<Option<u8>>> {
    let remove_count = match difficulty {
        SudokuDifficulty::Easy => 32 + (random.next().floor() as usize),
        SudokuDifficulty::Medium => 42 + (random.next().floor() as usize),
        SudokuDifficulty::Hard => 52 + (random.next().floor() as usize),
    };

    let mut puzzle: Vec<Vec<Option<u8>>> = solution
        .iter()
        .map(|row| row.iter().map(|&cell| Some(cell)).collect())
        .collect();

    let mut positions: Vec<(usize, usize)> = Vec::new();
    for row in 0..GRID_SIZE {
        for col in 0..GRID_SIZE {
            positions.push((row, col));
        }
    }
    let shuffled_positions = shuffle_array(&positions, random);

    let mut removed = 0_usize;
    for (row, col) in shuffled_positions {
        if removed >= remove_count {
            break;
        }
        let backup = puzzle[row][col];
        puzzle[row][col] = None;
        if difficulty == SudokuDifficulty::Easy || random.next() > 0.3 {
            removed += 1;
        } else if count_solutions(&puzzle, 2) == 1 {
            removed += 1;
        } else {
            puzzle[row][col] = backup;
        }
    }

    puzzle
}

/// Generate a Sudoku puzzle from a seed (frozen algorithm).
#[must_use]
pub fn generate_sudoku_puzzle(seed: i64, difficulty: SudokuDifficulty) -> SudokuPuzzleResult {
    let mut random = seeded_random(seed);
    let solution = generate_complete_grid(&mut random);
    let puzzle = remove_numbers(&solution, difficulty, &mut random);

    SudokuPuzzleResult {
        puzzle_data: SudokuPuzzleData {
            grid: puzzle,
            difficulty: difficulty.as_str().to_owned(),
        },
        solution: SudokuSolution { grid: solution },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        let first = generate_sudoku_puzzle(12_345, SudokuDifficulty::Medium);
        let second = generate_sudoku_puzzle(12_345, SudokuDifficulty::Medium);
        assert_eq!(first, second);
    }

    #[test]
    fn solution_rows_are_permutations_of_one_through_nine() {
        let puzzle = generate_sudoku_puzzle(42, SudokuDifficulty::Medium);
        for row in &puzzle.solution.grid {
            let mut values: Vec<u8> = row.clone();
            values.sort_unstable();
            assert_eq!(values, vec![1, 2, 3, 4, 5, 6, 7, 8, 9]);
        }
    }
}