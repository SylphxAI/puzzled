//! Deterministic Block Slide generator — fallback when no content-store row exists.
//!
//! Layout search matches `apps/puzzled/src/games/block-slide/generator.ts`.
//! Solvability reuses the frozen Rust BFS kernel.

use serde_json::{json, Value};

use super::block_slide::{is_valid_configuration, solve_puzzle, Block, BlockSlidePuzzle};
use super::random::{seeded_random, SeededRandom};

const GRID_WIDTH: i32 = 4;
const GRID_HEIGHT: i32 = 5;
const EXIT_X: i32 = 1;
const EXIT_Y: i32 = 3;
const SOLVER_MAX_MOVES: u32 = 120;
const TARGET_POSITIONS: [(i32, i32); 6] = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)];
const BLOCK_TEMPLATES: [(i32, i32); 5] = [(1, 2), (1, 2), (2, 1), (2, 1), (1, 1)];

fn difficulty_range(difficulty: Option<&str>) -> (u32, u32) {
    match difficulty
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("easy") => (4, 15),
        Some("hard") => (36, 80),
        _ => (16, 35),
    }
}

fn try_place(
    occupied: &mut [Vec<bool>],
    width: i32,
    height: i32,
    start_x: i32,
    start_y: i32,
) -> bool {
    if start_x + width > GRID_WIDTH || start_y + height > GRID_HEIGHT {
        return false;
    }
    for y in start_y..start_y + height {
        for x in start_x..start_x + width {
            if occupied[y as usize][x as usize] {
                return false;
            }
        }
    }
    for y in start_y..start_y + height {
        for x in start_x..start_x + width {
            occupied[y as usize][x as usize] = true;
        }
    }
    true
}

fn generate_configuration(random: &mut SeededRandom) -> Option<Vec<Block>> {
    let mut occupied = vec![vec![false; GRID_WIDTH as usize]; GRID_HEIGHT as usize];
    let mut blocks = Vec::new();
    let target_idx = (random.next_f64() * TARGET_POSITIONS.len() as f64).floor() as usize;
    let (target_x, target_y) = TARGET_POSITIONS[target_idx];
    for y in target_y..target_y + 2 {
        for x in target_x..target_x + 2 {
            occupied[y as usize][x as usize] = true;
        }
    }
    blocks.push(Block {
        id: "target".into(),
        x: target_x,
        y: target_y,
        width: 2,
        height: 2,
        is_target: true,
    });

    let num_blocks = 5 + (random.next_f64() * 4.0).floor() as usize;
    let mut block_id = 0u8;
    for _ in 0..num_blocks {
        let template_idx = (random.next_f64() * BLOCK_TEMPLATES.len() as f64).floor() as usize;
        let (width, height) = BLOCK_TEMPLATES[template_idx];
        let mut placed = false;
        for _ in 0..20 {
            let x = (random.next_f64() * f64::from(GRID_WIDTH)).floor() as i32;
            let y = (random.next_f64() * f64::from(GRID_HEIGHT)).floor() as i32;
            if try_place(&mut occupied, width, height, x, y) {
                blocks.push(Block {
                    id: ((b'a' + block_id) as char).to_string(),
                    x,
                    y,
                    width,
                    height,
                    is_target: false,
                });
                block_id += 1;
                placed = true;
                break;
            }
        }
        if !placed && (width > 1 || height > 1) {
            for _ in 0..20 {
                let x = (random.next_f64() * f64::from(GRID_WIDTH)).floor() as i32;
                let y = (random.next_f64() * f64::from(GRID_HEIGHT)).floor() as i32;
                if try_place(&mut occupied, 1, 1, x, y) {
                    blocks.push(Block {
                        id: ((b'a' + block_id) as char).to_string(),
                        x,
                        y,
                        width: 1,
                        height: 1,
                        is_target: false,
                    });
                    block_id += 1;
                    break;
                }
            }
        }
    }

    if blocks.len() < 5 {
        return None;
    }
    let empty = occupied.iter().flatten().filter(|cell| !**cell).count();
    if empty < 2 {
        return None;
    }
    Some(blocks)
}

/// Generate client layout + server min-moves for a seed.
#[must_use]
pub fn generate_block_slide_puzzle(seed: i64, difficulty: Option<&str>) -> (Value, Value) {
    let (min_moves, max_moves) = difficulty_range(difficulty);
    let mut current_seed = seed;
    for _ in 0..100 {
        let mut random = seeded_random(current_seed);
        if let Some(blocks) = generate_configuration(&mut random) {
            let puzzle = BlockSlidePuzzle {
                blocks,
                grid_width: GRID_WIDTH,
                grid_height: GRID_HEIGHT,
                exit_x: EXIT_X,
                exit_y: EXIT_Y,
                min_moves: 0,
            };
            if is_valid_configuration(&puzzle) {
                let result = solve_puzzle(&puzzle, SOLVER_MAX_MOVES);
                if result.solvable {
                    let found = u32::try_from(result.min_moves).unwrap_or(0);
                    if found >= min_moves && found <= max_moves {
                        let blocks_json: Vec<Value> = puzzle
                            .blocks
                            .iter()
                            .map(|block| {
                                json!({
                                    "id": block.id,
                                    "x": block.x,
                                    "y": block.y,
                                    "width": block.width,
                                    "height": block.height,
                                    "isTarget": block.is_target,
                                })
                            })
                            .collect();
                        return (
                            json!({
                                "blocks": blocks_json,
                                "gridWidth": GRID_WIDTH,
                                "gridHeight": GRID_HEIGHT,
                                "exitX": EXIT_X,
                                "exitY": EXIT_Y,
                                "minMoves": found,
                            }),
                            json!({ "minMoves": found }),
                        );
                    }
                }
            }
        }
        current_seed = current_seed.saturating_mul(2).saturating_add(1);
    }
    panic!("Block Slide generation failed for seed {seed} after 100 attempts");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_seed_is_deterministic() {
        assert_eq!(
            generate_block_slide_puzzle(1, Some("medium")),
            generate_block_slide_puzzle(1, Some("medium"))
        );
    }

    #[test]
    fn seeds_match_ts_oracle() {
        let (data, solution) = generate_block_slide_puzzle(0, Some("medium"));
        assert_eq!(data["minMoves"], 20);
        assert_eq!(solution["minMoves"], 20);
        assert_eq!(data["blocks"].as_array().map(Vec::len), Some(8));
        assert_eq!(
            data["blocks"][0],
            json!({"id":"target","x":0,"y":0,"width":2,"height":2,"isTarget":true})
        );
        assert_eq!(
            data["blocks"][1],
            json!({"id":"a","x":2,"y":3,"width":1,"height":2,"isTarget":false})
        );

        let (one, _) = generate_block_slide_puzzle(1, None);
        assert_eq!(one["minMoves"], 18);
        assert_eq!(one["blocks"][0]["y"], 1);
        assert_eq!(
            one["blocks"][1],
            json!({"id":"a","x":3,"y":0,"width":1,"height":2,"isTarget":false})
        );

        let (five, _) = generate_block_slide_puzzle(5, Some("medium"));
        assert_eq!(five["minMoves"], 19);
        assert_eq!(five["blocks"].as_array().map(Vec::len), Some(7));
        assert_eq!(
            five["blocks"][1],
            json!({"id":"a","x":2,"y":4,"width":1,"height":1,"isTarget":false})
        );
    }
}
