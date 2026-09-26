//! Daily generator for `duo` (TS `tango`): a port with byte parity of
//! `apps/puzzled/src/games/tango/generator.ts` + `puzzles.ts`, checked against
//! `tests/fixtures/generate/duo.json`.
//!
//! A backtracked sun/moon solution (balanced rows and columns, at most two
//! alike in a line, no repeated row or column), then clues removed one at a
//! time while the puzzle keeps exactly one solution.

use std::collections::HashSet;

use serde_json::{json, Value};

use crate::capabilities::puzzle_play::domain::random::SeededRandom;

const MAX_CONSECUTIVE: usize = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Sym {
    Sun,
    Moon,
}

type Grid = Vec<Vec<Option<Sym>>>;

fn sym_json(cell: Option<Sym>) -> Value {
    match cell {
        Some(Sym::Sun) => json!("sun"),
        Some(Sym::Moon) => json!("moon"),
        None => Value::Null,
    }
}

/// TS `isValidPlacement` / `isValidAtPosition` (identical rules).
fn is_valid(grid: &mut Grid, row: usize, col: usize, value: Sym) -> bool {
    let size = grid.len();
    let half = size / 2;
    let saved = grid[row][col];
    grid[row][col] = Some(value);
    let ok = (|| {
        let mut h = 1;
        let mut c = col;
        while c > 0 && grid[row][c - 1] == Some(value) {
            h += 1;
            c -= 1;
        }
        let mut c = col + 1;
        while c < size && grid[row][c] == Some(value) {
            h += 1;
            c += 1;
        }
        if h > MAX_CONSECUTIVE {
            return false;
        }
        let mut v = 1;
        let mut r = row;
        while r > 0 && grid[r - 1][col] == Some(value) {
            v += 1;
            r -= 1;
        }
        let mut r = row + 1;
        while r < size && grid[r][col] == Some(value) {
            v += 1;
            r += 1;
        }
        if v > MAX_CONSECUTIVE {
            return false;
        }
        let count_row = |s: Sym| grid[row].iter().filter(|x| **x == Some(s)).count();
        if count_row(Sym::Sun) > half || count_row(Sym::Moon) > half {
            return false;
        }
        let count_col = |s: Sym| grid.iter().filter(|r| r[col] == Some(s)).count();
        if count_col(Sym::Sun) > half || count_col(Sym::Moon) > half {
            return false;
        }
        true
    })();
    // TS resets the cell to null after the check; it is only called on empty cells.
    grid[row][col] = saved;
    ok
}

/// Rows and columns are pairwise distinct.
fn lines_unique(grid: &Grid) -> bool {
    let size = grid.len();
    let mut rows = HashSet::new();
    for row in grid {
        if !rows.insert(row.clone()) {
            return false;
        }
    }
    let mut cols = HashSet::new();
    for c in 0..size {
        let col: Vec<Option<Sym>> = grid.iter().map(|r| r[c]).collect();
        if !cols.insert(col) {
            return false;
        }
    }
    true
}

fn solve_fill(grid: &mut Grid, pos: usize, size: usize, random: &mut SeededRandom) -> bool {
    if pos == size * size {
        return lines_unique(grid);
    }
    let (row, col) = (pos / size, pos % size);
    let values = if random.next_f64() < 0.5 {
        [Sym::Sun, Sym::Moon]
    } else {
        [Sym::Moon, Sym::Sun]
    };
    for value in values {
        if is_valid(grid, row, col, value) {
            grid[row][col] = Some(value);
            if solve_fill(grid, pos + 1, size, random) {
                return true;
            }
            grid[row][col] = None;
        }
    }
    false
}

fn generate_solution(random: &mut SeededRandom, size: usize) -> Option<Grid> {
    let mut grid: Grid = vec![vec![None; size]; size];
    solve_fill(&mut grid, 0, size, random).then_some(grid)
}

fn count_solutions(puzzle: &Grid, max_solutions: usize) -> usize {
    fn solve(grid: &mut Grid, pos: usize, size: usize, max: usize, solutions: &mut usize) {
        if *solutions >= max {
            return;
        }
        if pos == size * size {
            if lines_unique(grid) {
                *solutions += 1;
            }
            return;
        }
        let (row, col) = (pos / size, pos % size);
        if grid[row][col].is_some() {
            solve(grid, pos + 1, size, max, solutions);
            return;
        }
        for value in [Sym::Sun, Sym::Moon] {
            if is_valid(grid, row, col, value) {
                grid[row][col] = Some(value);
                solve(grid, pos + 1, size, max, solutions);
                grid[row][col] = None;
                if *solutions >= max {
                    return;
                }
            }
        }
    }
    let size = puzzle.len();
    let mut grid = puzzle.clone();
    let mut solutions = 0;
    solve(&mut grid, 0, size, max_solutions, &mut solutions);
    solutions
}

fn create_puzzle(solution: &Grid, random: &mut SeededRandom, target_clues: usize) -> Grid {
    let size = solution.len();
    let mut puzzle = solution.clone();
    let mut positions: Vec<(usize, usize)> = Vec::new();
    for r in 0..size {
        for c in 0..size {
            positions.push((r, c));
        }
    }
    for i in (1..positions.len()).rev() {
        let j = (random.next_f64() * (i as f64 + 1.0)).floor() as usize;
        positions.swap(i, j);
    }
    let mut clues_remaining = size * size;
    for (r, c) in positions {
        if clues_remaining <= target_clues {
            break;
        }
        let saved = puzzle[r][c];
        puzzle[r][c] = None;
        if count_solutions(&puzzle, 2) == 1 {
            clues_remaining -= 1;
        } else {
            puzzle[r][c] = saved;
        }
    }
    puzzle
}

/// TS `getSizeFromSeed`: 8×8 on two of every seven seeds, else 6×6.
fn size_from_seed(seed: i64) -> usize {
    if seed.abs() % 7 >= 5 {
        8
    } else {
        6
    }
}

fn grid_json(grid: &Grid) -> Value {
    Value::Array(
        grid.iter()
            .map(|row| Value::Array(row.iter().map(|c| sym_json(*c)).collect()))
            .collect(),
    )
}

/// `(puzzle_data, solution)` for a seed. Difficulty is not used by this game.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let size = size_from_seed(seed);
    let mut random = SeededRandom::new(seed);
    let solution = generate_solution(&mut random, size)
        .ok_or_else(|| format!("Tango: no valid {size}x{size} solution for seed {seed}"))?;
    let target_clues = ((size * size) as f64 * 0.35).floor() as usize;
    let initial = create_puzzle(&solution, &mut random, target_clues);
    Ok((
        json!({ "size": size, "initialGrid": grid_json(&initial) }),
        json!({ "grid": grid_json(&solution) }),
    ))
}

/// The validator grades `{ grid }`, the same shape as the solution.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "grid": solution.get("grid").cloned().unwrap_or(Value::Null) })
}
