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

/// Most states one solve may hold. Keyed by board layout, a solve visits at
/// most 964,656 states (the biggest block mix the generator makes: one 1x2,
/// one 2x1 and six 1x1 blocks around the target, two cells empty), so this
/// never changes an answer; it keeps the solver's memory under about 50 MiB
/// even if the generator changes.
const MAX_STATES: usize = 1 << 20;

/// BFS minimum moves (any block, one cell, four directions), within
/// `max_moves`, and the number of states visited. BFS depth is
/// order-independent, so this equals the TS solver's answer.
///
/// A state is the board layout: the target, then each group of same-sized
/// blocks as a sorted set of positions. Swapping two same-sized blocks gives
/// the same layout and the same distance to the exit, so the answer is
/// unchanged, but the visited set no longer holds every ordering of
/// interchangeable blocks (20.5 million states, about 500 MiB, for the
/// 2026-09-17 hard puzzle).
fn solve(blocks: &[Block], max_moves: u32) -> (Option<u32>, usize) {
    let Some(target) = blocks.iter().position(|b| b.is_target) else {
        return (None, 0);
    };
    // The target first, then the other blocks grouped by size.
    let mut order: Vec<usize> = (0..blocks.len()).filter(|&i| i != target).collect();
    order.sort_by_key(|&i| (blocks[i].width, blocks[i].height));
    order.insert(0, target);
    let n = order.len();
    let sizes: Vec<(i32, i32)> = order
        .iter()
        .map(|&i| (blocks[i].width, blocks[i].height))
        .collect();
    let mut groups = Vec::new();
    let mut at = 1;
    for run in sizes[1..].chunk_by(|a, b| a == b) {
        if run.len() > 1 {
            groups.push(at..at + run.len());
        }
        at += run.len();
    }
    let canonical = |pos: &mut [(i32, i32)]| {
        for group in &groups {
            pos[group.clone()].sort_unstable();
        }
    };
    let mut start: Vec<(i32, i32)> = order.iter().map(|&i| (blocks[i].x, blocks[i].y)).collect();
    if start[0] == (EXIT_X, EXIT_Y) {
        return (Some(0), 1);
    }
    canonical(&mut start);
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
                canonical(&mut next);
                let next_key = pack(&next);
                if !visited.insert(next_key) {
                    continue;
                }
                if next[0] == (EXIT_X, EXIT_Y) {
                    return (Some(moves + 1), visited.len());
                }
                if visited.len() >= MAX_STATES {
                    return (None, visited.len());
                }
                queue.push_back((next_key, moves + 1));
            }
        }
    }
    (None, visited.len())
}

/// `(puzzle_data, solution)` for a seed, or why none could be made.
pub fn generate(seed: i64, difficulty: Option<&str>) -> Result<(Value, Value), String> {
    generate_counted(seed, difficulty).0
}

/// [`generate`] plus the most states a single solve visited on the way.
fn generate_counted(
    seed: i64,
    difficulty: Option<&str>,
) -> (Result<(Value, Value), String>, usize) {
    let (min, max) = match difficulty.unwrap_or("medium") {
        "easy" => (4, 15),
        "hard" => (36, 80),
        _ => (16, 35),
    };
    let mut most_states = 0;
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
        let (solved, states) = solve(&blocks, 120);
        most_states = most_states.max(states);
        match solved {
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
                return (
                    Ok((
                        json!({
                            "blocks": blocks_json,
                            "gridWidth": GRID_WIDTH, "gridHeight": GRID_HEIGHT,
                            "exitX": EXIT_X, "exitY": EXIT_Y, "minMoves": moves,
                        }),
                        json!({ "minMoves": moves }),
                    )),
                    most_states,
                );
            }
            _ => current = next,
        }
    }
    (
        Err(format!(
            "block-slide: no puzzle for seed {seed} within {MAX_ATTEMPTS} attempts"
        )),
        most_states,
    )
}

/// The solution rewritten as the submission the validator grades, for the
/// generator self-check.
#[must_use]
pub fn solution_submission(solution: &Value) -> Value {
    json!({ "moveCount": solution.get("minMoves").cloned().unwrap_or(Value::Null) })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Board layouts of the biggest block mix the generator can make (one
    /// 1x2, one 2x1 and six 1x1 blocks around the target, two cells empty).
    /// A solve that keys states by layout can never visit more.
    const MOST_LAYOUTS: usize = 964_656;

    /// Product days whose puzzle made one solve hold 140-496 MiB when every
    /// ordering of same-sized blocks was its own state; that OOM-killed the
    /// 256 MiB api during the daily puzzle fill. Seed: `YYYYMMDD` + 0/1/2.
    const HEAVY_DAYS: [(i64, &str); 6] = [
        (20_260_919, "hard"), // 2026-09-17: 496 MiB, 21 s
        (20_260_915, "hard"), // 2026-09-13: 248 MiB
        (20_261_111, "hard"), // 2026-11-09: 248 MiB
        (20_261_111, "easy"), // 2026-11-11: 248 MiB
        (20_261_214, "easy"), // 2026-12-14: 232 MiB
        (20_261_020, "hard"), // 2026-10-18: 140 MiB
    ];

    #[test]
    fn a_solve_visits_each_board_layout_at_most_once() {
        for (seed, difficulty) in HEAVY_DAYS {
            let (made, states) = generate_counted(seed, Some(difficulty));
            assert!(made.is_ok(), "seed {seed} {difficulty}: {made:?}");
            assert!(
                states <= MOST_LAYOUTS,
                "seed {seed} {difficulty}: one solve visited {states} states"
            );
        }
    }
}
