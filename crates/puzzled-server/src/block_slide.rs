//! Block Slide pure move/solver/score — mirrors
//! `apps/puzzled/src/games/block-slide/{types,solver,config}.ts`.
//!
//! FLEET residual pure deepen. NO authority_rust / ts_deleted.
//! Generator (seeded layout search) remains TS; this kernel covers legality,
//! BFS min-moves, configuration validity, and validateAndScore.

use std::collections::{HashSet, VecDeque};

/// Base score for an optimal win.
pub const BASE_WIN_SCORE: u32 = 500;
/// Floor score for a win.
pub const MIN_WIN_SCORE: u32 = 100;
/// Penalty per extra move beyond minMoves.
pub const EXTRA_MOVE_PENALTY: u32 = 5;
/// Bonus when solved under 60 seconds.
pub const FAST_SOLVE_BONUS: u32 = 50;
/// Fast-solve threshold (ms) — mirrors `MINUTE_MS`.
pub const FAST_SOLVE_MS: u64 = 60_000;
/// Default BFS depth cap.
pub const DEFAULT_MAX_MOVES: u32 = 150;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

impl Direction {
    const ALL: [Direction; 4] = [
        Direction::Up,
        Direction::Down,
        Direction::Left,
        Direction::Right,
    ];

    #[must_use]
    pub fn delta(self) -> (i32, i32) {
        match self {
            Direction::Left => (-1, 0),
            Direction::Right => (1, 0),
            Direction::Up => (0, -1),
            Direction::Down => (0, 1),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Block {
    pub id: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub is_target: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockSlidePuzzle {
    pub blocks: Vec<Block>,
    pub grid_width: i32,
    pub grid_height: i32,
    pub exit_x: i32,
    pub exit_y: i32,
    pub min_moves: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SolveResult {
    pub solvable: bool,
    pub min_moves: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SubmissionStatus {
    Won,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GameResult {
    Invalid {
        error: String,
    },
    Valid {
        status: SubmissionStatus,
        score: u32,
    },
}

impl GameResult {
    #[must_use]
    pub fn is_valid(&self) -> bool {
        matches!(self, Self::Valid { .. })
    }
}

/// Axis-aligned rectangle overlap (strict interior; edge-touching OK).
#[must_use]
pub fn blocks_overlap(a: &Block, b: &Block) -> bool {
    !(a.x + a.width <= b.x
        || b.x + b.width <= a.x
        || a.y + a.height <= b.y
        || b.y + b.height <= a.y)
}

/// Whether the named block can move one step in `direction`.
#[must_use]
pub fn can_move(
    blocks: &[Block],
    block_id: &str,
    direction: Direction,
    grid_width: i32,
    grid_height: i32,
) -> bool {
    let Some(block) = blocks.iter().find(|b| b.id == block_id) else {
        return false;
    };
    let (dx, dy) = direction.delta();
    let new_x = block.x + dx;
    let new_y = block.y + dy;
    if new_x < 0 || new_y < 0 {
        return false;
    }
    if new_x + block.width > grid_width {
        return false;
    }
    if new_y + block.height > grid_height {
        return false;
    }
    let mut moved = block.clone();
    moved.x = new_x;
    moved.y = new_y;
    for other in blocks {
        if other.id == block_id {
            continue;
        }
        if blocks_overlap(&moved, other) {
            return false;
        }
    }
    true
}

/// Apply one-step move; returns new block vector.
#[must_use]
pub fn move_block(blocks: &[Block], block_id: &str, direction: Direction) -> Vec<Block> {
    let (dx, dy) = direction.delta();
    blocks
        .iter()
        .map(|b| {
            if b.id != block_id {
                return b.clone();
            }
            Block {
                id: b.id.clone(),
                x: b.x + dx,
                y: b.y + dy,
                width: b.width,
                height: b.height,
                is_target: b.is_target,
            }
        })
        .collect()
}

/// Target block at exit coordinates.
#[must_use]
pub fn is_win(blocks: &[Block], exit_x: i32, exit_y: i32) -> bool {
    blocks
        .iter()
        .find(|b| b.is_target)
        .is_some_and(|t| t.x == exit_x && t.y == exit_y)
}

/// Serialize state for BFS memo: sorted `id:x,y` joined by `|`.
#[must_use]
pub fn serialize_state(blocks: &[Block]) -> String {
    let mut parts: Vec<String> = blocks
        .iter()
        .map(|b| format!("{}:{},{}", b.id, b.x, b.y))
        .collect();
    parts.sort();
    parts.join("|")
}

fn can_move_index(
    blocks: &[Block],
    block_index: usize,
    direction: Direction,
    grid_width: i32,
    grid_height: i32,
) -> bool {
    let Some(block) = blocks.get(block_index) else {
        return false;
    };
    can_move(blocks, &block.id, direction, grid_width, grid_height)
}

fn move_index(blocks: &[Block], block_index: usize, direction: Direction) -> Vec<Block> {
    let id = blocks[block_index].id.clone();
    move_block(blocks, &id, direction)
}

/// BFS shortest path; `min_moves = -1` when unsolvable within `max_moves`.
#[must_use]
pub fn solve_puzzle(puzzle: &BlockSlidePuzzle, max_moves: u32) -> SolveResult {
    let BlockSlidePuzzle {
        blocks,
        grid_width,
        grid_height,
        exit_x,
        exit_y,
        ..
    } = puzzle;

    if is_win(blocks, *exit_x, *exit_y) {
        return SolveResult {
            solvable: true,
            min_moves: 0,
        };
    }

    let initial = serialize_state(blocks);
    let mut visited: HashSet<String> = HashSet::new();
    visited.insert(initial);
    let mut queue: VecDeque<(Vec<Block>, u32)> = VecDeque::new();
    queue.push_back((blocks.clone(), 0));

    while let Some((current, moves)) = queue.pop_front() {
        if moves >= max_moves {
            continue;
        }
        for i in 0..current.len() {
            for dir in Direction::ALL {
                if !can_move_index(&current, i, dir, *grid_width, *grid_height) {
                    continue;
                }
                let next_blocks = move_index(&current, i, dir);
                let state = serialize_state(&next_blocks);
                if visited.contains(&state) {
                    continue;
                }
                visited.insert(state);
                if is_win(&next_blocks, *exit_x, *exit_y) {
                    return SolveResult {
                        solvable: true,
                        min_moves: (moves + 1) as i32,
                    };
                }
                queue.push_back((next_blocks, moves + 1));
            }
        }
    }

    SolveResult {
        solvable: false,
        min_moves: -1,
    }
}

/// Blocks in-bounds, no overlap, exactly one target present.
#[must_use]
pub fn is_valid_configuration(puzzle: &BlockSlidePuzzle) -> bool {
    let BlockSlidePuzzle {
        blocks,
        grid_width,
        grid_height,
        ..
    } = puzzle;
    let mut has_target = false;
    for block in blocks {
        if block.is_target {
            has_target = true;
        }
        if block.x < 0 || block.y < 0 {
            return false;
        }
        if block.x + block.width > *grid_width {
            return false;
        }
        if block.y + block.height > *grid_height {
            return false;
        }
    }
    if !has_target {
        return false;
    }
    for i in 0..blocks.len() {
        for j in (i + 1)..blocks.len() {
            if blocks_overlap(&blocks[i], &blocks[j]) {
                return false;
            }
        }
    }
    true
}

/// Score: `max(100, 500 - extra*5 + (time < 60s ? 50 : 0))`.
#[must_use]
pub fn block_slide_score(min_moves: u32, move_count: u32, time_spent_ms: u64) -> u32 {
    let extra = move_count.saturating_sub(min_moves);
    let move_penalty = extra.saturating_mul(EXTRA_MOVE_PENALTY);
    let time_bonus = if time_spent_ms < FAST_SOLVE_MS {
        FAST_SOLVE_BONUS
    } else {
        0
    };
    BASE_WIN_SCORE
        .saturating_sub(move_penalty)
        .saturating_add(time_bonus)
        .max(MIN_WIN_SCORE)
}

/// Validate claimed win/loss + moveCount against solution.minMoves; score wins.
#[must_use]
pub fn validate_and_score(
    min_moves: u32,
    move_count: Option<u32>,
    time_spent_ms: u64,
    claimed: SubmissionStatus,
) -> GameResult {
    if claimed == SubmissionStatus::Lost {
        return GameResult::Valid {
            status: SubmissionStatus::Lost,
            score: 0,
        };
    }

    let Some(move_count) = move_count else {
        return GameResult::Invalid {
            error: "Missing move count data".into(),
        };
    };

    if move_count < min_moves {
        return GameResult::Invalid {
            error: format!("Impossible: solved in {move_count} moves, minimum is {min_moves}"),
        };
    }

    GameResult::Valid {
        status: SubmissionStatus::Won,
        score: block_slide_score(min_moves, move_count, time_spent_ms),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn simple_puzzle() -> BlockSlidePuzzle {
        BlockSlidePuzzle {
            grid_width: 4,
            grid_height: 5,
            exit_x: 1,
            exit_y: 3,
            min_moves: 0,
            blocks: vec![
                Block {
                    id: "target".into(),
                    x: 1,
                    y: 1,
                    width: 2,
                    height: 2,
                    is_target: true,
                },
                Block {
                    id: "a".into(),
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 2,
                    is_target: false,
                },
                Block {
                    id: "b".into(),
                    x: 3,
                    y: 0,
                    width: 1,
                    height: 2,
                    is_target: false,
                },
            ],
        }
    }

    #[test]
    fn solve_simple_puzzle() {
        let puzzle = simple_puzzle();
        let result = solve_puzzle(&puzzle, DEFAULT_MAX_MOVES);
        assert!(result.solvable);
        assert!(result.min_moves > 0);
        assert!(result.min_moves < 20);
    }

    #[test]
    fn detect_unsolvable() {
        let puzzle = BlockSlidePuzzle {
            grid_width: 4,
            grid_height: 5,
            exit_x: 1,
            exit_y: 3,
            min_moves: 0,
            blocks: vec![
                Block {
                    id: "target".into(),
                    x: 1,
                    y: 0,
                    width: 2,
                    height: 2,
                    is_target: true,
                },
                Block {
                    id: "a".into(),
                    x: 0,
                    y: 0,
                    width: 1,
                    height: 5,
                    is_target: false,
                },
                Block {
                    id: "b".into(),
                    x: 3,
                    y: 0,
                    width: 1,
                    height: 5,
                    is_target: false,
                },
                Block {
                    id: "c".into(),
                    x: 1,
                    y: 2,
                    width: 2,
                    height: 3,
                    is_target: false,
                },
            ],
        };
        let result = solve_puzzle(&puzzle, 50);
        assert!(!result.solvable);
        assert_eq!(result.min_moves, -1);
    }

    #[test]
    fn configuration_valid_and_overlap() {
        let valid = simple_puzzle();
        assert!(is_valid_configuration(&valid));

        let mut invalid = simple_puzzle();
        invalid.blocks[0].x = 0;
        invalid.blocks[0].y = 0;
        invalid.blocks[1].x = 1;
        invalid.blocks[1].y = 0;
        assert!(!is_valid_configuration(&invalid));
    }

    #[test]
    fn can_move_and_win() {
        let puzzle = simple_puzzle();
        assert!(can_move(
            &puzzle.blocks,
            "target",
            Direction::Down,
            puzzle.grid_width,
            puzzle.grid_height
        ));
        let moved = move_block(&puzzle.blocks, "target", Direction::Down);
        let target_y = moved.iter().find(|b| b.is_target).map(|b| b.y);
        assert_eq!(target_y, Some(2));
        assert!(!is_win(&puzzle.blocks, puzzle.exit_x, puzzle.exit_y));
    }

    #[test]
    fn score_table_matches_ts() {
        // optimal under 60s → 550
        assert_eq!(block_slide_score(10, 10, 30_000), 550);
        // optimal over 60s → 500
        assert_eq!(block_slide_score(10, 10, 120_000), 500);
        // 5 extra over 60s → 475
        assert_eq!(block_slide_score(10, 15, 120_000), 475);
        // 5 extra under 60s → 525
        assert_eq!(block_slide_score(10, 15, 30_000), 525);
        // huge extra floors at 100
        assert_eq!(block_slide_score(1, 200, 120_000), 100);
    }

    #[test]
    fn validate_win_and_loss() {
        let r = validate_and_score(10, Some(10), 30_000, SubmissionStatus::Won);
        assert_eq!(
            r,
            GameResult::Valid {
                status: SubmissionStatus::Won,
                score: 550
            }
        );
        let lost = validate_and_score(10, None, 0, SubmissionStatus::Lost);
        assert_eq!(
            lost,
            GameResult::Valid {
                status: SubmissionStatus::Lost,
                score: 0
            }
        );
        let impossible = validate_and_score(10, Some(5), 0, SubmissionStatus::Won);
        assert!(!impossible.is_valid());
        let missing = validate_and_score(10, None, 0, SubmissionStatus::Won);
        assert!(!missing.is_valid());
    }
}
