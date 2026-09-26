//! Daily generator for `number-path`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/number-path/generator.ts`), checked
//! against `tests/fixtures/generate/number-path.json`.
//!
//! A Hamiltonian path from a serpentine plus random backbites, then clues
//! (turns first) until a bounded solver proves the grid has one solution.

use serde_json::{json, Value};

use crate::capabilities::puzzle_play::domain::random::{shuffle_array, SeededRandom};

const GRID_SIZE: usize = 6;
const MIN_CLUES: usize = 8;
const BACKBITE_MIN: usize = 200;
const BACKBITE_SPAN: f64 = 301.0;
const NODE_BUDGET: u64 = 100_000;
const MAX_SOLUTIONS: u32 = 2;
const DIRS: [(i32, i32); 4] = [(-1, 0), (1, 0), (0, -1), (0, 1)];

type Cell = (usize, usize);

fn serpentine(size: usize) -> Vec<Cell> {
    let mut path = Vec::with_capacity(size * size);
    for r in 0..size {
        if r % 2 == 0 {
            path.extend((0..size).map(|c| (r, c)));
        } else {
            path.extend((0..size).rev().map(|c| (r, c)));
        }
    }
    path
}

fn neighbors(cell: Cell, size: usize) -> Vec<Cell> {
    DIRS.iter()
        .filter_map(|&(dr, dc)| {
            let r = cell.0 as i32 + dr;
            let c = cell.1 as i32 + dc;
            (r >= 0 && c >= 0 && (r as usize) < size && (c as usize) < size)
                .then_some((r as usize, c as usize))
        })
        .collect()
}

fn backbite(path: &mut Vec<Cell>, size: usize, random: &mut SeededRandom) {
    if random.next_f64() < 0.5 {
        path.reverse();
    }
    let n = path.len();
    if n < 3 {
        return;
    }
    let mut index = vec![usize::MAX; size * size];
    for (i, &(r, c)) in path.iter().enumerate() {
        index[r * size + c] = i;
    }
    let end = path[n - 1];
    let candidates: Vec<usize> = neighbors(end, size)
        .into_iter()
        .map(|(r, c)| index[r * size + c])
        .filter(|&i| i != usize::MAX && i < n - 2)
        .collect();
    if candidates.is_empty() {
        return;
    }
    let pick = candidates[(random.next_f64() * candidates.len() as f64).floor() as usize];
    let mut suffix: Vec<Cell> = path[pick + 1..].to_vec();
    suffix.reverse();
    path.truncate(pick + 1);
    path.extend(suffix);
}

fn is_turn(path: &[Cell], i: usize) -> bool {
    if i == 0 || i >= path.len() - 1 {
        return false;
    }
    let (p, c, n) = (path[i - 1], path[i], path[i + 1]);
    let d1 = (c.0 as i32 - p.0 as i32, c.1 as i32 - p.1 as i32);
    let d2 = (n.0 as i32 - c.0 as i32, n.1 as i32 - c.1 as i32);
    d1 != d2
}

struct Counter<'a> {
    clues: &'a [Vec<Option<u32>>],
    clue_pos: Vec<(u32, Cell)>,
    size: usize,
    visited: Vec<Vec<bool>>,
    solutions: u32,
    nodes: u64,
    exhausted: bool,
}

impl Counter<'_> {
    fn manhattan_ok(&self, cell: Cell, next: u32) -> bool {
        self.clue_pos.iter().all(|&(k, pos)| {
            if k < next {
                return true;
            }
            let dist = (cell.0 as i64 - pos.0 as i64).abs() + (cell.1 as i64 - pos.1 as i64).abs();
            let steps = i64::from(k) - i64::from(next);
            dist <= steps && (steps - dist) % 2 == 0
        })
    }

    fn dfs(&mut self, row: usize, col: usize, len: usize) {
        if self.exhausted || self.solutions >= MAX_SOLUTIONS {
            return;
        }
        self.nodes += 1;
        if self.nodes >= NODE_BUDGET {
            self.exhausted = true;
            return;
        }
        let n = self.size * self.size;
        if len == n {
            self.solutions += 1;
            return;
        }
        let next = (len + 1) as u32;
        for (dr, dc) in DIRS {
            let nr = row as i32 + dr;
            let nc = col as i32 + dc;
            if nr < 0 || nc < 0 || nr as usize >= self.size || nc as usize >= self.size {
                continue;
            }
            let (nr, nc) = (nr as usize, nc as usize);
            if self.visited[nr][nc] {
                continue;
            }
            if let Some(clue) = self.clues[nr][nc] {
                if clue != next {
                    continue;
                }
            }
            if !self.manhattan_ok((nr, nc), next) {
                continue;
            }
            self.visited[nr][nc] = true;
            self.dfs(nr, nc, len + 1);
            self.visited[nr][nc] = false;
            if self.exhausted || self.solutions >= MAX_SOLUTIONS {
                return;
            }
        }
    }
}

/// True when the clues admit exactly one path and the search finished.
fn proven_unique(clues: &[Vec<Option<u32>>]) -> bool {
    let size = clues.len();
    let mut clue_pos: Vec<(u32, Cell)> = Vec::new();
    for (r, row) in clues.iter().enumerate() {
        for (c, clue) in row.iter().enumerate() {
            if let Some(k) = clue {
                // Map semantics: a later cell with the same number replaces it.
                if let Some(entry) = clue_pos.iter_mut().find(|(n, _)| n == k) {
                    entry.1 = (r, c);
                } else {
                    clue_pos.push((*k, (r, c)));
                }
            }
        }
    }
    let Some(&(_, start)) = clue_pos.iter().find(|(k, _)| *k == 1) else {
        return false;
    };
    let mut counter = Counter {
        clues,
        clue_pos,
        size,
        visited: vec![vec![false; size]; size],
        solutions: 0,
        nodes: 0,
        exhausted: false,
    };
    counter.visited[start.0][start.1] = true;
    if !counter.manhattan_ok(start, 1) {
        return false;
    }
    counter.dfs(start.0, start.1, 1);
    counter.solutions == 1 && !counter.exhausted
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, _difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let size = GRID_SIZE;
    let mut random = SeededRandom::new(seed);
    let mut path = serpentine(size);
    let bites = BACKBITE_MIN + (random.next_f64() * BACKBITE_SPAN).floor() as usize;
    for _ in 0..bites {
        backbite(&mut path, size, &mut random);
    }
    let n = size * size;
    let mut clues = vec![vec![None::<u32>; size]; size];
    clues[path[0].0][path[0].1] = Some(1);
    clues[path[n - 1].0][path[n - 1].1] = Some(n as u32);
    let mut turns = Vec::new();
    let mut straights = Vec::new();
    for i in 1..n - 1 {
        let item = (path[i], (i + 1) as u32);
        if is_turn(&path, i) {
            turns.push(item);
        } else {
            straights.push(item);
        }
    }
    let turns = shuffle_array(&turns, &mut random);
    let straights = shuffle_array(&straights, &mut random);
    let mut unique = proven_unique(&clues);
    for (added, ((r, c), number)) in turns.into_iter().chain(straights).enumerate() {
        // Clues so far: the two endpoints plus `added`.
        if unique && 2 + added >= MIN_CLUES {
            break;
        }
        clues[r][c] = Some(number);
        unique = proven_unique(&clues);
    }
    let path_json: Vec<Value> = path
        .iter()
        .map(|&(r, c)| json!({ "row": r, "col": c }))
        .collect();
    Ok((
        json!({ "size": size, "clues": clues }),
        json!({ "path": path_json }),
    ))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "path": solution.get("path").cloned().unwrap_or(Value::Null) })
}
