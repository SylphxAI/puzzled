//! Deterministic Killer Sudoku generator — fallback when no content-store row exists.
//!
//! Solved grid reuses the frozen Sudoku kernel. Cages match
//! `apps/puzzled/src/games/killer-sudoku/generator.ts`.

use std::collections::BTreeSet;

use serde_json::{json, Value};

use super::random::{seeded_random, shuffle_array, SeededRandom};
use super::sudoku::generate_complete_grid;

const GRID_SIZE: usize = 9;
const DIRECTIONS: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

fn given_digits(difficulty: Option<&str>) -> usize {
    match difficulty
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("easy") => 20,
        Some("medium") => 10,
        _ => 0,
    }
}

fn neighbors(assigned: &[Vec<bool>], row: usize, col: usize) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    for (delta_row, delta_col) in DIRECTIONS {
        let next_row = row as i32 + delta_row;
        let next_col = col as i32 + delta_col;
        if next_row < 0 || next_col < 0 {
            continue;
        }
        let next_row = next_row as usize;
        let next_col = next_col as usize;
        if next_row < GRID_SIZE && next_col < GRID_SIZE && !assigned[next_row][next_col] {
            out.push((next_row, next_col));
        }
    }
    out
}

fn generate_cages(grid: &[Vec<u8>], random: &mut SeededRandom) -> Vec<(Vec<(usize, usize)>, u32)> {
    let mut cages = Vec::new();
    let mut assigned = vec![vec![false; GRID_SIZE]; GRID_SIZE];

    for row in 0..GRID_SIZE {
        for col in 0..GRID_SIZE {
            if assigned[row][col] {
                continue;
            }
            let mut cells = vec![(row, col)];
            assigned[row][col] = true;
            let target_size = 2 + (random.next_f64() * 4.0).floor() as usize;
            while cells.len() < target_size {
                let mut candidates = Vec::new();
                for (cell_row, cell_col) in &cells {
                    for neighbor in neighbors(&assigned, *cell_row, *cell_col) {
                        if !candidates.contains(&neighbor) {
                            candidates.push(neighbor);
                        }
                    }
                }
                if candidates.is_empty() {
                    break;
                }
                let pick = (random.next_f64() * candidates.len() as f64).floor() as usize;
                let (next_row, next_col) = candidates[pick];
                cells.push((next_row, next_col));
                assigned[next_row][next_col] = true;
            }
            let sum = cells
                .iter()
                .map(|(cell_row, cell_col)| u32::from(grid[*cell_row][*cell_col]))
                .sum();
            cages.push((cells, sum));
        }
    }
    cages
}

fn cages_valid(grid: &[Vec<u8>], cages: &[(Vec<(usize, usize)>, u32)]) -> bool {
    for (cells, sum) in cages {
        let actual: u32 = cells
            .iter()
            .map(|(row, col)| u32::from(grid[*row][*col]))
            .sum();
        if actual != *sum {
            return false;
        }
        let mut digits = BTreeSet::new();
        for (row, col) in cells {
            if !digits.insert(grid[*row][*col]) {
                return false;
            }
        }
    }
    true
}

fn add_given_digits(solution: &[Vec<u8>], num_given: usize, seed: i64) -> Vec<Vec<Option<u8>>> {
    let mut grid = vec![vec![None; GRID_SIZE]; GRID_SIZE];
    if num_given == 0 {
        return grid;
    }
    let mut random = seeded_random(seed);
    let mut positions = Vec::with_capacity(GRID_SIZE * GRID_SIZE);
    for row in 0..GRID_SIZE {
        for col in 0..GRID_SIZE {
            positions.push((row, col));
        }
    }
    let shuffled = shuffle_array(&positions, &mut random);
    for (row, col) in shuffled.into_iter().take(num_given.min(81)) {
        grid[row][col] = Some(solution[row][col]);
    }
    grid
}

/// Generate client cages + server solution for a seed.
#[must_use]
pub fn generate_killer_sudoku_puzzle(seed: i64, difficulty: Option<&str>) -> (Value, Value) {
    let mut random = seeded_random(seed);
    let solution = generate_complete_grid(&mut random);
    let mut cages = generate_cages(&solution, &mut random);
    let mut attempts = 0;
    while !cages_valid(&solution, &cages) && attempts < 5 {
        attempts += 1;
        let mut retry = seeded_random(seed + i64::from(attempts) * 1000);
        cages = generate_cages(&solution, &mut retry);
    }
    assert!(
        cages_valid(&solution, &cages),
        "KillerSudoku: Failed to generate valid cages for seed {seed}"
    );
    let given = add_given_digits(&solution, given_digits(difficulty), seed + 999);
    let cages_json: Vec<Value> = cages
        .iter()
        .map(|(cells, sum)| {
            json!({
                "cells": cells,
                "sum": sum,
            })
        })
        .collect();
    (
        json!({
            "grid": given,
            "cages": cages_json,
        }),
        json!({ "grid": solution }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(
            generate_killer_sudoku_puzzle(1, Some("hard")),
            generate_killer_sudoku_puzzle(1, Some("hard"))
        );
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let (data, solution) = generate_killer_sudoku_puzzle(1, Some("hard"));
        assert_eq!(solution["grid"][0], json!([3, 7, 8, 9, 1, 4, 5, 2, 6]));
        assert_eq!(data["cages"].as_array().map(Vec::len), Some(27));
        assert_eq!(data["cages"][0], json!({"cells":[[0,0],[0,1]],"sum":10}));
        assert!(data["grid"][0]
            .as_array()
            .unwrap()
            .iter()
            .all(Value::is_null));

        let (easy, _) = generate_killer_sudoku_puzzle(1, Some("easy"));
        assert_eq!(
            easy["grid"][0],
            json!([null, null, 8, 9, null, null, null, 2, null])
        );

        let (medium, solution5) = generate_killer_sudoku_puzzle(5, Some("medium"));
        assert_eq!(solution5["grid"][0], json!([8, 6, 3, 2, 1, 5, 7, 4, 9]));
        assert_eq!(
            medium["grid"][0],
            json!([null, null, null, null, null, 5, 7, null, null])
        );
        assert_eq!(medium["cages"][0], json!({"cells":[[0,0],[0,1]],"sum":14}));

        let (_, solution42) = generate_killer_sudoku_puzzle(42, None);
        assert_eq!(solution42["grid"][0], json!([9, 5, 4, 3, 6, 1, 2, 7, 8]));
        let (hard42, _) = generate_killer_sudoku_puzzle(42, Some("hard"));
        assert_eq!(
            hard42["cages"][0],
            json!({"cells":[[0,0],[0,1],[1,0]],"sum":22})
        );
    }
}
