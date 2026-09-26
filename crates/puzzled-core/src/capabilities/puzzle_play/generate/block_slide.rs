//! Daily generator for `block-slide`: a port with byte parity of the TS
//! generator (`apps/puzzled/src/games/block-slide/generator.ts` + `solver.ts`),
//! checked against `tests/fixtures/generate/block-slide.json`.
//!
//! TS moves to the next seed with `seed * 2 + 1`, which leaves the integer
//! range after ~30 retries and becomes a large JS double. The LCG here keeps
//! the seed as an `f64` and applies exact JS `ToInt32` semantics so those
//! retries match TS too.

use std::collections::{HashSet, VecDeque};

use serde_json::{json, Value};

const GRID_WIDTH: i32 = 4;
const GRID_HEIGHT: i32 = 5;
const EXIT_X: i32 = 1;
const EXIT_Y: i32 = 3;
const TS_ATTEMPTS: usize = 100;
/// Past the TS limit, keep following the same seed sequence.
const MAX_ATTEMPTS: usize = 2_000;

/// JS `seededRandom` over a double seed (exact `ToInt32` for any magnitude).
struct JsLcg {
    state: f64,
}

fn to_int32(value: f64) -> u32 {
    if !value.is_finite() {
        return 0;
    }
    let modulus = 4_294_967_296.0_f64;
    value.trunc().rem_euclid(modulus) as u32
}

impl JsLcg {
    fn next_f64(&mut self) -> f64 {
        let product = self.state * 1_103_515_245.0 + 12_345.0;
        let masked = to_int32(product) & 0x7fff_ffff;
        self.state = f64::from(masked);
        self.state / 2_147_483_647.0
    }
}

#[derive(Clone, Copy)]
struct Template {
    width: i32,
    height: i32,
}

const TEMPLATES: [Template; 5] = [
    Template {
        width: 1,
        height: 2,
    },
    Template {
        width: 1,
        height: 2,
    },
    Template {
        width: 2,
        height: 1,
    },
    Template {
        width: 2,
        height: 1,
    },
    Template {
        width: 1,
        height: 1,
    },
];

#[derive(Clone, Debug)]
struct Block {
    id: String,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    is_target: bool,
}

fn try_place(occupied: &mut [[bool; 4]; 5], t: Template, x: i32, y: i32) -> bool {
    if x + t.width > GRID_WIDTH || y + t.height > GRID_HEIGHT {
        return false;
    }
    for yy in y..y + t.height {
        for xx in x..x + t.width {
            if occupied[yy as usize][xx as usize] {
                return false;
            }
        }
    }
    for yy in y..y + t.height {
        for xx in x..x + t.width {
            occupied[yy as usize][xx as usize] = true;
        }
    }
    true
}

fn block_id(n: u32) -> String {
    char::from_u32(97 + n).map(String::from).unwrap_or_default()
}

fn generate_configuration(random: &mut JsLcg) -> Option<Vec<Block>> {
    let mut occupied = [[false; 4]; 5];
    let targets = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)];
    let (tx, ty) = targets[(random.next_f64() * targets.len() as f64).floor() as usize];
    for y in ty..ty + 2 {
        for x in tx..tx + 2 {
            occupied[y as usize][x as usize] = true;
        }
    }
    let mut blocks = vec![Block {
        id: "target".to_string(),
        x: tx,
        y: ty,
        width: 2,
        height: 2,
        is_target: true,
    }];
    let num_blocks = 5 + (random.next_f64() * 4.0).floor() as usize;
    let mut next_id = 0u32;
    for _ in 0..num_blocks {
        let template = TEMPLATES[(random.next_f64() * TEMPLATES.len() as f64).floor() as usize];
        let mut placed = false;
        for _ in 0..20 {
            let x = (random.next_f64() * f64::from(GRID_WIDTH)).floor() as i32;
            let y = (random.next_f64() * f64::from(GRID_HEIGHT)).floor() as i32;
            if try_place(&mut occupied, template, x, y) {
                blocks.push(Block {
                    id: block_id(next_id),
                    x,
                    y,
                    width: template.width,
                    height: template.height,
                    is_target: false,
                });
                next_id += 1;
                placed = true;
                break;
            }
        }
        if !placed && (template.width > 1 || template.height > 1) {
            let small = Template {
                width: 1,
                height: 1,
            };
            for _ in 0..20 {
                let x = (random.next_f64() * f64::from(GRID_WIDTH)).floor() as i32;
                let y = (random.next_f64() * f64::from(GRID_HEIGHT)).floor() as i32;
                if try_place(&mut occupied, small, x, y) {
                    blocks.push(Block {
                        id: block_id(next_id),
                        x,
                        y,
                        width: 1,
                        height: 1,
                        is_target: false,
                    });
                    next_id += 1;
                    break;
                }
            }
        }
    }
    if blocks.len() < 5 {
        return None;
    }
    let empty = occupied.iter().flatten().filter(|c| !**c).count();
    if empty < 2 {
        return None;
    }
    Some(blocks)
}

fn overlap(a: (i32, i32, i32, i32), b: (i32, i32, i32, i32)) -> bool {
    !(a.0 + a.2 <= b.0 || b.0 + b.2 <= a.0 || a.1 + a.3 <= b.1 || b.1 + b.3 <= a.1)
}

fn is_valid_configuration(blocks: &[Block]) -> bool {
    if !blocks.iter().any(|b| b.is_target) {
        return false;
    }
    for b in blocks {
        if b.x < 0 || b.y < 0 || b.x + b.width > GRID_WIDTH || b.y + b.height > GRID_HEIGHT {
            return false;
        }
    }
    for i in 0..blocks.len() {
        for j in i + 1..blocks.len() {
            let a = &blocks[i];
            let b = &blocks[j];
            if overlap((a.x, a.y, a.width, a.height), (b.x, b.y, b.width, b.height)) {
                return false;
            }
        }
    }
    true
}

/// Pack block positions (x: 2 bits, y: 3 bits each; at most 9 blocks).
fn pack(pos: &[(i32, i32)]) -> u64 {
    pos.iter().enumerate().fold(0u64, |acc, (i, &(x, y))| {
        acc | ((((x as u64) << 3) | y as u64) << (5 * i))
    })
}

fn unpack(key: u64, n: usize) -> Vec<(i32, i32)> {
    (0..n)
        .map(|i| {
            let v = (key >> (5 * i)) & 0x1f;
            ((v >> 3) as i32, (v & 0x7) as i32)
        })
        .collect()
}

/// BFS minimum moves (any block, one cell, four directions), within `max_moves`.
/// BFS depth is order-independent, so this equals the TS solver's answer.
fn solve(blocks: &[Block], max_moves: u32) -> Option<u32> {
    let target = blocks.iter().position(|b| b.is_target)?;
    let n = blocks.len();
    let sizes: Vec<(i32, i32)> = blocks.iter().map(|b| (b.width, b.height)).collect();
    let start: Vec<(i32, i32)> = blocks.iter().map(|b| (b.x, b.y)).collect();
    if start[target] == (EXIT_X, EXIT_Y) {
        return Some(0);
    }
    let start_key = pack(&start);
    let mut visited: HashSet<u64> = HashSet::new();
    visited.insert(start_key);
    let mut queue = VecDeque::from([(start_key, 0u32)]);
    let dirs = [(0, -1), (0, 1), (-1, 0), (1, 0)];
    while let Some((key, moves)) = queue.pop_front() {
        if moves >= max_moves {
            continue;
        }
        let pos = unpack(key, n);
        let mut grid = [[usize::MAX; 4]; 5];
        for (j, &(x, y)) in pos.iter().enumerate() {
            for yy in y..y + sizes[j].1 {
                for xx in x..x + sizes[j].0 {
                    grid[yy as usize][xx as usize] = j;
                }
            }
        }
        for i in 0..n {
            for (dx, dy) in dirs {
                let (nx, ny) = (pos[i].0 + dx, pos[i].1 + dy);
                let (w, h) = sizes[i];
                if nx < 0 || ny < 0 || nx + w > GRID_WIDTH || ny + h > GRID_HEIGHT {
                    continue;
                }
                let free = (ny..ny + h).all(|yy| {
                    (nx..nx + w).all(|xx| {
                        let owner = grid[yy as usize][xx as usize];
                        owner == usize::MAX || owner == i
                    })
                });
                if !free {
                    continue;
                }
                let mut next = pos.clone();
                next[i] = (nx, ny);
                let next_key = pack(&next);
                if !visited.insert(next_key) {
                    continue;
                }
                if next[target] == (EXIT_X, EXIT_Y) {
                    return Some(moves + 1);
                }
                queue.push_back((next_key, moves + 1));
            }
        }
    }
    None
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, difficulty: Option<&str>) -> Result<(Value, Value), String> {
    let (min, max) = match difficulty.unwrap_or("medium") {
        "easy" => (4, 15),
        "hard" => (36, 80),
        _ => (16, 35),
    };
    let mut current = seed as f64;
    for attempt in 0..MAX_ATTEMPTS {
        // Past the TS limit the doubled seed overflows to infinity; restart
        // from a derived seed so the sequence keeps producing puzzles.
        if attempt == TS_ATTEMPTS || !current.is_finite() {
            current = (seed + (attempt as i64) * 1_000_003) as f64;
        }
        let mut random = JsLcg { state: current };
        let next = current * 2.0 + 1.0;
        let Some(blocks) = generate_configuration(&mut random) else {
            current = next;
            continue;
        };
        if !is_valid_configuration(&blocks) {
            current = next;
            continue;
        }
        match solve(&blocks, 120) {
            Some(moves) if (min..=max).contains(&moves) => {
                let blocks_json: Vec<Value> = blocks
                    .iter()
                    .map(|b| {
                        json!({
                            "id": b.id, "x": b.x, "y": b.y,
                            "width": b.width, "height": b.height, "isTarget": b.is_target,
                        })
                    })
                    .collect();
                return Ok((
                    json!({
                        "blocks": blocks_json,
                        "gridWidth": GRID_WIDTH, "gridHeight": GRID_HEIGHT,
                        "exitX": EXIT_X, "exitY": EXIT_Y, "minMoves": moves,
                    }),
                    json!({ "minMoves": moves }),
                ));
            }
            _ => current = next,
        }
    }
    Err(format!(
        "block-slide: no puzzle for seed {seed} within {MAX_ATTEMPTS} attempts"
    ))
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "moveCount": solution.get("minMoves").cloned().unwrap_or(Value::Null) })
}
