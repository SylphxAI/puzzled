//! Daily generator for `killer-sudoku`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/killer-sudoku/generator.ts`), checked
//! against `tests/fixtures/generate/killer-sudoku.json`.
//!
//! TS grows cages without looking at digits, so a cage often repeats a digit
//! and fails validation; TS retries only 5 times (`seed + attempts * 1000`)
//! and then throws, which leaves most days without a puzzle. This port keeps
//! the same retry sequence past 5 (identical output wherever TS succeeds)
//! until a valid cage set is found. It then proves the puzzle has exactly one
//! solution, revealing extra givens in the generator's own order until it
//! does (TS never checked uniqueness).

use serde_json::{json, Value};

use crate::capabilities::puzzle_play::domain::random::{shuffle_array, SeededRandom};

/// Retry bound past the TS limit of 5; valid cages are found within a few
/// hundred attempts in practice.
const MAX_ATTEMPTS: i64 = 100_000;

type Grid = [[u8; 9]; 9];
type Cage = (Vec<(usize, usize)>, u32);

fn is_valid_placement(grid: &Grid, row: usize, col: usize, num: u8) -> bool {
    if grid[row].contains(&num) {
        return false;
    }
    for r in grid.iter() {
        if r[col] == num {
            return false;
        }
    }
    let br = (row / 3) * 3;
    let bc = (col / 3) * 3;
    for r in grid.iter().skip(br).take(3) {
        for cell in r.iter().skip(bc).take(3) {
            if *cell == num {
                return false;
            }
        }
    }
    true
}

fn solve(grid: &mut Grid, pos: usize, random: &mut SeededRandom) -> bool {
    if pos == 81 {
        return true;
    }
    let row = pos / 9;
    let col = pos % 9;
    let numbers = shuffle_array(&[1u8, 2, 3, 4, 5, 6, 7, 8, 9], random);
    for num in numbers {
        if is_valid_placement(grid, row, col, num) {
            grid[row][col] = num;
            if solve(grid, pos + 1, random) {
                return true;
            }
            grid[row][col] = 0;
        }
    }
    false
}

fn generate_solved_grid(random: &mut SeededRandom) -> Grid {
    let mut grid = [[0u8; 9]; 9];
    solve(&mut grid, 0, random);
    grid
}

const DIRECTIONS: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

fn generate_cages(grid: &Grid, random: &mut SeededRandom) -> Vec<Cage> {
    let mut cages = Vec::new();
    let mut assigned = [[false; 9]; 9];
    for r in 0..9 {
        for c in 0..9 {
            if assigned[r][c] {
                continue;
            }
            let mut cells = vec![(r, c)];
            assigned[r][c] = true;
            let target = 2 + (random.next_f64() * 4.0).floor() as usize;
            while cells.len() < target {
                let mut candidates: Vec<(usize, usize)> = Vec::new();
                for &(cr, cc) in &cells {
                    for (dr, dc) in DIRECTIONS {
                        let nr = cr as i32 + dr;
                        let nc = cc as i32 + dc;
                        if (0..9).contains(&nr) && (0..9).contains(&nc) {
                            let (nr, nc) = (nr as usize, nc as usize);
                            if !assigned[nr][nc] && !candidates.contains(&(nr, nc)) {
                                candidates.push((nr, nc));
                            }
                        }
                    }
                }
                if candidates.is_empty() {
                    break;
                }
                let pick =
                    candidates[(random.next_f64() * candidates.len() as f64).floor() as usize];
                cells.push(pick);
                assigned[pick.0][pick.1] = true;
            }
            let sum = cells.iter().map(|&(a, b)| u32::from(grid[a][b])).sum();
            cages.push((cells, sum));
        }
    }
    cages
}

fn validate_cages(grid: &Grid, cages: &[Cage]) -> bool {
    cages.iter().all(|(cells, sum)| {
        let actual: u32 = cells.iter().map(|&(r, c)| u32::from(grid[r][c])).sum();
        let mut seen = [false; 10];
        let unique = cells.iter().all(|&(r, c)| {
            let d = grid[r][c] as usize;
            !std::mem::replace(&mut seen[d], true)
        });
        actual == *sum && unique
    })
}

fn add_given_digits(
    solution: &Grid,
    num_given: usize,
    random: &mut SeededRandom,
) -> Vec<Vec<Option<u8>>> {
    let mut grid = vec![vec![None; 9]; 9];
    if num_given == 0 {
        return grid;
    }
    let positions: Vec<(usize, usize)> = (0..9).flat_map(|r| (0..9).map(move |c| (r, c))).collect();
    let shuffled = shuffle_array(&positions, random);
    for &(r, c) in shuffled.iter().take(num_given.min(81)) {
        grid[r][c] = Some(solution[r][c]);
    }
    grid
}

/// Solver node budget for the uniqueness check; past it the puzzle is not
/// proven unique and gets another given digit.
const UNIQUENESS_BUDGET: u64 = 500_000;

/// Count solutions of the cages plus givens, stopping at 2, and where two
/// solutions differ (the first cell). `None` when the node budget runs out.
fn count_solutions(
    givens: &[Vec<Option<u8>>],
    cages: &[Cage],
) -> Option<(u32, Option<(usize, usize)>)> {
    struct CageState {
        remaining: i32,
        open: u32,
        used: u16,
    }
    let mut cage_of = [[0usize; 9]; 9];
    let mut states: Vec<CageState> = Vec::with_capacity(cages.len());
    for (i, (cells, sum)) in cages.iter().enumerate() {
        for &(r, c) in cells {
            cage_of[r][c] = i;
        }
        states.push(CageState {
            remaining: i32::try_from(*sum).unwrap_or(i32::MAX),
            open: u32::try_from(cells.len()).unwrap_or(u32::MAX),
            used: 0,
        });
    }
    let mut grid = [[0u8; 9]; 9];
    let (mut rows, mut cols, mut boxes) = ([0u16; 9], [0u16; 9], [0u16; 9]);
    for r in 0..9 {
        for c in 0..9 {
            if let Some(d) = givens[r][c] {
                let bit = 1u16 << d;
                if rows[r] & bit != 0 || cols[c] & bit != 0 || boxes[(r / 3) * 3 + c / 3] & bit != 0
                {
                    return Some((0, None));
                }
                grid[r][c] = d;
                rows[r] |= bit;
                cols[c] |= bit;
                boxes[(r / 3) * 3 + c / 3] |= bit;
                let st = &mut states[cage_of[r][c]];
                st.remaining -= i32::from(d);
                st.open -= 1;
                st.used |= bit;
            }
        }
    }
    // Can `open` more distinct digits outside `used` sum to `remaining`?
    fn feasible(remaining: i32, open: u32, used: u16) -> bool {
        if open == 0 {
            return remaining == 0;
        }
        let (mut low, mut high, mut taken_low, mut taken_high) = (0i32, 0i32, 0u32, 0u32);
        for d in 1..=9i32 {
            if taken_low < open && used & (1 << d) == 0 {
                low += d;
                taken_low += 1;
            }
            let hd = 10 - d;
            if taken_high < open && used & (1 << hd) == 0 {
                high += hd;
                taken_high += 1;
            }
        }
        taken_low == open && (low..=high).contains(&remaining)
    }
    struct Search<'a> {
        grid: [[u8; 9]; 9],
        rows: [u16; 9],
        cols: [u16; 9],
        boxes: [u16; 9],
        cage_of: [[usize; 9]; 9],
        states: Vec<CageState>,
        cages: &'a [Cage],
        found: u32,
        nodes: u64,
        first: Option<[[u8; 9]; 9]>,
        differ: Option<(usize, usize)>,
    }
    impl Search<'_> {
        fn candidates(&self, r: usize, c: usize) -> u16 {
            let st = &self.states[self.cage_of[r][c]];
            let taken = self.rows[r] | self.cols[c] | self.boxes[(r / 3) * 3 + c / 3] | st.used;
            let mut mask = 0u16;
            for d in 1..=9u8 {
                let bit = 1u16 << d;
                if taken & bit != 0 {
                    continue;
                }
                let rem = st.remaining - i32::from(d);
                if feasible(rem, st.open - 1, st.used | bit) {
                    mask |= bit;
                }
            }
            mask
        }
        fn run(&mut self) -> bool {
            self.nodes += 1;
            if self.nodes > UNIQUENESS_BUDGET {
                return false;
            }
            let mut best: Option<(usize, usize, u16)> = None;
            for r in 0..9 {
                for c in 0..9 {
                    if self.grid[r][c] != 0 {
                        continue;
                    }
                    let mask = self.candidates(r, c);
                    let n = mask.count_ones();
                    if n == 0 {
                        return true;
                    }
                    if best.is_none_or(|(_, _, m)| n < m.count_ones()) {
                        best = Some((r, c, mask));
                    }
                }
            }
            let Some((r, c, mask)) = best else {
                self.found += 1;
                match self.first {
                    None => self.first = Some(self.grid),
                    Some(first) => {
                        self.differ = (0..81)
                            .map(|i| (i / 9, i % 9))
                            .find(|&(r, c)| first[r][c] != self.grid[r][c]);
                    }
                }
                return true;
            };
            let cage = self.cage_of[r][c];
            for d in 1..=9u8 {
                let bit = 1u16 << d;
                if mask & bit == 0 {
                    continue;
                }
                self.grid[r][c] = d;
                self.rows[r] |= bit;
                self.cols[c] |= bit;
                self.boxes[(r / 3) * 3 + c / 3] |= bit;
                self.states[cage].remaining -= i32::from(d);
                self.states[cage].open -= 1;
                self.states[cage].used |= bit;
                let ok = self.run();
                self.grid[r][c] = 0;
                self.rows[r] &= !bit;
                self.cols[c] &= !bit;
                self.boxes[(r / 3) * 3 + c / 3] &= !bit;
                self.states[cage].remaining += i32::from(d);
                self.states[cage].open += 1;
                self.states[cage].used &= !bit;
                if !ok || self.found >= 2 {
                    return ok;
                }
            }
            let _ = self.cages;
            true
        }
    }
    let mut search = Search {
        grid,
        rows,
        cols,
        boxes,
        cage_of,
        states,
        cages,
        found: 0,
        nodes: 0,
        first: None,
        differ: None,
    };
    search.run().then_some((search.found, search.differ))
}

/// Reveal givens until the puzzle has exactly one solution (the validator
/// compares to the stored grid, so a second solution would refuse a correct
/// player). Each step reveals a cell where two solutions differ; if the
/// solver's budget runs out, the next cell in the generator's own shuffled
/// order.
fn make_unique(
    solution: &Grid,
    givens: &mut [Vec<Option<u8>>],
    cages: &[Cage],
    seed: i64,
) -> Result<(), String> {
    let positions: Vec<(usize, usize)> = (0..9).flat_map(|r| (0..9).map(move |c| (r, c))).collect();
    let order = shuffle_array(&positions, &mut SeededRandom::new(seed + 999));
    let mut fallback = order.into_iter();
    for _ in 0..81 {
        let cell = match count_solutions(givens, cages) {
            Some((1, _)) => return Ok(()),
            Some((_, Some(cell))) => Some(cell),
            _ => fallback.by_ref().find(|&(r, c)| givens[r][c].is_none()),
        };
        let Some((r, c)) = cell else { break };
        givens[r][c] = Some(solution[r][c]);
    }
    Err(format!(
        "killer-sudoku: seed {seed} could not be made unique"
    ))
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let num_given = match difficulty.unwrap_or("hard") {
        "easy" => 20,
        "medium" => 10,
        _ => 0,
    };
    let mut random = SeededRandom::new(seed);
    let solution = generate_solved_grid(&mut random);
    let mut cages = generate_cages(&solution, &mut random);
    let mut attempts = 0;
    while !validate_cages(&solution, &cages) {
        attempts += 1;
        if attempts > MAX_ATTEMPTS {
            return Err(format!("killer-sudoku: no valid cages for seed {seed}"));
        }
        let mut retry = SeededRandom::new(seed + attempts * 1000);
        cages = generate_cages(&solution, &mut retry);
    }
    let mut grid = add_given_digits(&solution, num_given, &mut SeededRandom::new(seed + 999));
    make_unique(&solution, &mut grid, &cages, seed)?;
    let cages_json: Vec<Value> = cages
        .iter()
        .map(|(cells, sum)| {
            json!({
                "cells": cells.iter().map(|&(r, c)| json!([r, c])).collect::<Vec<_>>(),
                "sum": sum,
            })
        })
        .collect();
    Ok((
        json!({ "grid": grid, "cages": cages_json }),
        json!({ "grid": solution }),
    ))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "finalGrid": solution.get("grid").cloned().unwrap_or(Value::Null), "mistakes": 0 })
}
