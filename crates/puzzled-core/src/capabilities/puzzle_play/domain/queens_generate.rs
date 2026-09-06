//! Deterministic crowns/queens generator (free-floor fallback).
//!
//! Mirrors `apps/puzzled/src/games/queens/generator.ts#generateQueensPuzzle`.
//! Client payload is `{size, regions}`; queen coordinates stay server-only.
//!
//! The TypeScript generator throws after 10 uniqueness retries. GetDaily must
//! not stub, so this port keeps searching (same seed+attempts+1 LCG walk)
//! until a unique solution exists.
//!
//! RNG is `domain::random` (IEEE-754 / JS `ToInt32` LCG), not `random_lcg`
//! (wrapping `u32`). Queens flood-fill draws enough that the two diverge.

#![allow(clippy::needless_range_loop)]

use serde_json::{json, Value};

use super::random::{shuffle_array, SeededRandom};

/// Default board size (`generateQueensPuzzle` / medium difficulty).
pub const DEFAULT_QUEENS_SIZE: usize = 6;

/// Inner uniqueness walk matches TypeScript `maxAttempts = 10` for working
/// seeds; extra room so unlucky puzzle-numbers still densify.
const MAX_UNIQUENESS_ATTEMPTS: u32 = 256;

fn lcg(seed: i64) -> SeededRandom {
    // Same constructor as frozen TS `seededRandom(seed)` (IEEE-754 LCG).
    SeededRandom::new(seed)
}

fn can_place_queen(queens: &[(usize, usize)], row: usize, col: usize) -> bool {
    for &(r, c) in queens {
        if c == col {
            return false;
        }
        if r.abs_diff(row) <= 1 && c.abs_diff(col) <= 1 {
            return false;
        }
    }
    true
}

fn generate_queen_positions(size: usize, rng: &mut SeededRandom) -> Vec<(usize, usize)> {
    let mut queens: Vec<(usize, usize)> = Vec::with_capacity(size);

    fn solve(size: usize, rng: &mut SeededRandom, queens: &mut Vec<(usize, usize)>) -> bool {
        let row = queens.len();
        if row >= size {
            return true;
        }
        let cols: Vec<usize> = (0..size).collect();
        let shuffled = shuffle_array(&cols, rng);
        for col in shuffled {
            if can_place_queen(queens, row, col) {
                queens.push((row, col));
                if solve(size, rng, queens) {
                    return true;
                }
                queens.pop();
            }
        }
        false
    }

    let _ = solve(size, rng, &mut queens);
    queens
}

fn generate_regions(
    size: usize,
    queens: &[(usize, usize)],
    rng: &mut SeededRandom,
) -> Vec<Vec<i32>> {
    let mut regions = vec![vec![-1_i32; size]; size];
    for (index, &(row, col)) in queens.iter().enumerate() {
        if row < size && col < size {
            regions[row][col] = i32::try_from(index).unwrap_or(0);
        }
    }

    let directions: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];
    let mut unassigned = size.saturating_mul(size).saturating_sub(size);
    let mut iterations = 0_usize;
    let max_iterations = size.saturating_mul(size).saturating_mul(10);

    while unassigned > 0 && iterations < max_iterations {
        iterations += 1;
        // Match TS `Math.floor(random() * size)` — do not clamp; a draw of 1.0
        // yields `size` and expands nothing that iteration (empty regionCells).
        let region_index = (rng.next_f64() * size as f64).floor() as usize;
        let mut region_cells: Vec<(usize, usize)> = Vec::new();
        for r in 0..size {
            for c in 0..size {
                if regions[r][c] == i32::try_from(region_index).unwrap_or(-2) {
                    region_cells.push((r, c));
                }
            }
        }
        let shuffled_cells = shuffle_array(&region_cells, rng);
        for (r, c) in shuffled_cells {
            let shuffled_dirs = shuffle_array(&directions, rng);
            for (dr, dc) in shuffled_dirs {
                let nr = r as i32 + dr;
                let nc = c as i32 + dc;
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
            if regions[r][c] == -1 {
                let mut min_dist = usize::MAX;
                let mut nearest_region = 0_i32;
                for nr in 0..size {
                    for nc in 0..size {
                        if regions[nr][nc] != -1 {
                            let dist = nr.abs_diff(r) + nc.abs_diff(c);
                            if dist < min_dist {
                                min_dist = dist;
                                nearest_region = regions[nr][nc];
                            }
                        }
                    }
                }
                regions[r][c] = nearest_region;
            }
        }
    }
    regions
}

fn has_unique_solution(regions: &[Vec<i32>], size: usize) -> Option<Vec<(usize, usize)>> {
    let mut solutions: Vec<Vec<(usize, usize)>> = Vec::new();

    fn can_place(regions: &[Vec<i32>], queens: &[(usize, usize)], row: usize, col: usize) -> bool {
        for &(r, c) in queens {
            if c == col {
                return false;
            }
            if r.abs_diff(row) <= 1 && c.abs_diff(col) <= 1 {
                return false;
            }
            if regions[r][c] == regions[row][col] {
                return false;
            }
        }
        true
    }

    fn solve(
        regions: &[Vec<i32>],
        size: usize,
        row: usize,
        queens: &mut Vec<(usize, usize)>,
        solutions: &mut Vec<Vec<(usize, usize)>>,
    ) {
        if solutions.len() > 1 {
            return;
        }
        if row >= size {
            solutions.push(queens.clone());
            return;
        }
        for col in 0..size {
            if can_place(regions, queens, row, col) {
                queens.push((row, col));
                solve(regions, size, row + 1, queens, solutions);
                queens.pop();
            }
        }
    }

    let mut queens = Vec::with_capacity(size);
    solve(regions, size, 0, &mut queens, &mut solutions);
    if solutions.len() == 1 {
        solutions.pop()
    } else {
        None
    }
}

type QueensLayout = (Vec<Vec<i32>>, Vec<(usize, usize)>);

fn try_generate(seed: i64, size: usize) -> Option<QueensLayout> {
    if size == 0 {
        return None;
    }
    let mut rng = lcg(seed);
    let mut queens = generate_queen_positions(size, &mut rng);
    let mut regions = generate_regions(size, &queens, &mut rng);
    for attempts in 0..MAX_UNIQUENESS_ATTEMPTS {
        if let Some(solution) = has_unique_solution(&regions, size) {
            return Some((regions, solution));
        }
        let mut new_rng = lcg(seed + i64::from(attempts) + 1);
        queens = generate_queen_positions(size, &mut new_rng);
        regions = generate_regions(size, &queens, &mut new_rng);
    }
    None
}

/// Deterministic daily crowns: (client-safe puzzle_data, solution).
#[must_use]
pub fn generate_queens_puzzle(seed: i64) -> (Value, Value) {
    generate_queens_puzzle_with_size(seed, DEFAULT_QUEENS_SIZE)
}

/// Generate a crowns/queens puzzle of the given board size (5–8 in product).
#[must_use]
pub fn generate_queens_puzzle_with_size(seed: i64, size: usize) -> (Value, Value) {
    let size = match size {
        5..=8 => size,
        _ => DEFAULT_QUEENS_SIZE,
    };
    let Some((regions, queens)) = try_generate(seed, size) else {
        panic!(
            "Queens: Failed to generate puzzle with unique solution for seed {seed} after {MAX_UNIQUENESS_ATTEMPTS} attempts"
        );
    };
    let puzzle_data = json!({
        "size": size,
        "regions": regions,
    });
    let queens_json: Vec<Value> = queens
        .into_iter()
        .map(|(row, col)| json!([row, col]))
        .collect();
    (puzzle_data, json!({ "queens": queens_json }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capabilities::puzzle_play::crossword_generate::client_safe_puzzle_data;
    use crate::capabilities::puzzle_play::queens_conflict::is_solved;

    fn queens_to_grid(queens: &[(usize, usize)], size: usize) -> Vec<Vec<bool>> {
        let mut grid = vec![vec![false; size]; size];
        for &(row, col) in queens {
            if row < size && col < size {
                grid[row][col] = true;
            }
        }
        grid
    }

    fn parse_queens(sol: &Value) -> Vec<(usize, usize)> {
        sol.get("queens")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|pair| {
                        let cells = pair.as_array()?;
                        Some((
                            cells.first()?.as_u64()? as usize,
                            cells.get(1)?.as_u64()? as usize,
                        ))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    fn parse_regions(pd: &Value) -> Vec<Vec<i32>> {
        pd.get("regions")
            .and_then(Value::as_array)
            .map(|rows| {
                rows.iter()
                    .map(|row| {
                        row.as_array()
                            .map(|cells| {
                                cells
                                    .iter()
                                    .filter_map(Value::as_i64)
                                    .map(|v| v as i32)
                                    .collect()
                            })
                            .unwrap_or_default()
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    #[test]
    fn seed_is_deterministic() {
        let (a, sa) = generate_queens_puzzle(5);
        let (b, sb) = generate_queens_puzzle(5);
        assert_eq!(a, b);
        assert_eq!(sa, sb);
    }

    #[test]
    fn matches_typescript_seed_five_size_six() {
        let (pd, sol) = generate_queens_puzzle(5);
        assert_eq!(pd["size"], 6);
        let regions = parse_regions(&pd);
        let expected = vec![
            vec![1, 1, 1, 0, 2, 2],
            vec![1, 1, 2, 2, 2, 2],
            vec![4, 4, 2, 2, 2, 2],
            vec![4, 4, 3, 2, 2, 2],
            vec![4, 4, 2, 2, 2, 2],
            vec![4, 4, 2, 2, 2, 5],
        ];
        assert_eq!(regions, expected);
        assert_eq!(
            parse_queens(&sol),
            vec![(0, 3), (1, 1), (2, 4), (3, 2), (4, 0), (5, 5)]
        );
        // Retry walk converges: TS seeds 4 and 6 yield the same unique board.
        assert_eq!(generate_queens_puzzle(4), (pd.clone(), sol.clone()));
        assert_eq!(generate_queens_puzzle(6), (pd, sol));
    }

    #[test]
    fn matches_typescript_seed_zero_size_five() {
        let (pd, sol) = generate_queens_puzzle_with_size(0, 5);
        assert_eq!(pd["size"], 5);
        assert_eq!(
            parse_regions(&pd),
            vec![
                vec![1, 1, 1, 0, 0],
                vec![1, 1, 1, 1, 2],
                vec![1, 1, 1, 1, 2],
                vec![4, 1, 3, 1, 1],
                vec![4, 4, 4, 4, 4],
            ]
        );
        assert_eq!(
            parse_queens(&sol),
            vec![(0, 3), (1, 1), (2, 4), (3, 2), (4, 0)]
        );
    }

    #[test]
    fn matches_typescript_seed_956_size_six() {
        let (pd, sol) = generate_queens_puzzle(956);
        assert_eq!(
            parse_regions(&pd),
            vec![
                vec![0, 0, 0, 0, 0, 0],
                vec![0, 0, 0, 0, 0, 1],
                vec![0, 2, 3, 0, 5, 1],
                vec![3, 3, 3, 3, 5, 5],
                vec![4, 4, 5, 5, 5, 5],
                vec![5, 5, 5, 5, 5, 5],
            ]
        );
        assert_eq!(
            parse_queens(&sol),
            vec![(0, 2), (1, 5), (2, 1), (3, 3), (4, 0), (5, 4)]
        );
    }

    #[test]
    fn client_payload_has_no_queen_coordinates() {
        let (pd, sol) = generate_queens_puzzle(5);
        assert!(pd.get("queens").is_none());
        assert!(pd.get("solution").is_none());
        let dumped = pd.to_string();
        assert!(
            !dumped.contains("\"queens\""),
            "GetDaily payload must not leak queens: {dumped}"
        );
        assert_eq!(parse_queens(&sol).len(), 6);
    }

    #[test]
    fn unique_solution_is_solved() {
        let (pd, sol) = generate_queens_puzzle(5);
        let size = pd["size"].as_u64().unwrap_or(0) as usize;
        let regions = parse_regions(&pd);
        let queens = parse_queens(&sol);
        let grid = queens_to_grid(&queens, size);
        assert!(is_solved(&grid, &regions, size));
    }

    #[test]
    fn unlucky_seeds_still_densify() {
        // TypeScript throws for 6×6 seeds 0–3 after 10 attempts. Free floor
        // must still serve a unique puzzle. 42/249/980 are also TS-throwers
        // at nearby daily puzzle numbers.
        let seeds: Vec<i64> = (0_i64..=30).chain([42, 249, 980]).collect();
        for seed in seeds {
            let (pd, sol) = generate_queens_puzzle(seed);
            let size = pd["size"].as_u64().unwrap_or(0) as usize;
            assert_eq!(size, 6, "seed {seed}");
            let regions = parse_regions(&pd);
            let queens = parse_queens(&sol);
            assert_eq!(queens.len(), size, "seed {seed}");
            let grid = queens_to_grid(&queens, size);
            assert!(is_solved(&grid, &regions, size), "seed {seed} not solved");
        }
    }

    #[test]
    fn client_safe_strips_leaked_queens() {
        let leaked = json!({
            "size": 6,
            "regions": [[0]],
            "queens": [[0, 1]],
        });
        let safe = client_safe_puzzle_data(leaked);
        assert_eq!(safe.get("queens"), None);
        assert_eq!(safe["size"], 6);
    }
}
