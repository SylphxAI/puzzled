/**
 * Block Slide (Klotski) BFS Solver
 *
 * Classic Klotski rules: any block can move in any direction if there's space.
 * Uses BFS to find the shortest solution for any block slide puzzle.
 * State space is all possible block positions.
 */

import type { Block, BlockSlidePuzzle, Direction } from "./types";

/**
 * Serialize puzzle state to a unique string for memoization
 * Format: sorted block positions (id:x,y)
 */
function serializeState(blocks: Block[]): string {
	return blocks
		.map((b) => `${b.id}:${b.x},${b.y}`)
		.sort()
		.join("|");
}

/**
 * Check if two blocks overlap
 */
function blocksOverlap(a: Block, b: Block): boolean {
	return !(
		a.x + a.width <= b.x ||
		b.x + b.width <= a.x ||
		a.y + a.height <= b.y ||
		b.y + b.height <= a.y
	);
}

/**
 * Check if a block can move in a direction
 * Classic Klotski rules: any block can move in any direction if there's space
 */
function canMoveBlock(
	blocks: Block[],
	blockIndex: number,
	direction: Direction,
	gridWidth: number,
	gridHeight: number,
): boolean {
	const block = blocks[blockIndex];

	const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
	const dy = direction === "up" ? -1 : direction === "down" ? 1 : 0;

	const newX = block.x + dx;
	const newY = block.y + dy;

	// Check bounds
	if (newX < 0 || newY < 0) return false;
	if (newX + block.width > gridWidth) return false;
	if (newY + block.height > gridHeight) return false;

	// Check collision with other blocks
	const movedBlock = { ...block, x: newX, y: newY };
	for (let i = 0; i < blocks.length; i++) {
		if (i === blockIndex) continue;
		if (blocksOverlap(movedBlock, blocks[i])) {
			return false;
		}
	}

	return true;
}

/**
 * Move a block in a direction (returns new blocks array)
 */
function moveBlock(
	blocks: Block[],
	blockIndex: number,
	direction: Direction,
): Block[] {
	const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
	const dy = direction === "up" ? -1 : direction === "down" ? 1 : 0;

	return blocks.map((b, i) => {
		if (i !== blockIndex) return b;
		return { ...b, x: b.x + dx, y: b.y + dy };
	});
}

/**
 * Check if target block is at exit position
 */
function isWinState(blocks: Block[], exitX: number, exitY: number): boolean {
	const target = blocks.find((b) => b.isTarget);
	if (!target) return false;
	return target.x === exitX && target.y === exitY;
}

/**
 * Get all possible next states from current state
 */
function getNextStates(
	blocks: Block[],
	gridWidth: number,
	gridHeight: number,
): Array<{ blocks: Block[]; state: string }> {
	const directions: Direction[] = ["up", "down", "left", "right"];
	const nextStates: Array<{ blocks: Block[]; state: string }> = [];

	for (let i = 0; i < blocks.length; i++) {
		for (const dir of directions) {
			if (canMoveBlock(blocks, i, dir, gridWidth, gridHeight)) {
				const newBlocks = moveBlock(blocks, i, dir);
				nextStates.push({
					blocks: newBlocks,
					state: serializeState(newBlocks),
				});
			}
		}
	}

	return nextStates;
}

export type SolveResult = {
	solvable: boolean;
	minMoves: number;
};

/**
 * Solve a block slide puzzle using BFS
 * Returns minimum moves needed, or null if unsolvable
 *
 * @param puzzle - The puzzle configuration
 * @param maxMoves - Maximum moves to search (prevent infinite loops)
 */
export function solvePuzzle(
	puzzle: BlockSlidePuzzle,
	maxMoves = 150,
): SolveResult {
	const { blocks, gridWidth, gridHeight, exitX, exitY } = puzzle;

	// Check if already solved
	if (isWinState(blocks, exitX, exitY)) {
		return { solvable: true, minMoves: 0 };
	}

	const initialState = serializeState(blocks);
	const visited = new Set<string>([initialState]);
	const queue: Array<{ blocks: Block[]; moves: number }> = [
		{ blocks, moves: 0 },
	];

	while (queue.length > 0) {
		const { blocks: currentBlocks, moves } = queue.shift()!;

		// Limit search depth
		if (moves >= maxMoves) continue;

		for (const next of getNextStates(currentBlocks, gridWidth, gridHeight)) {
			if (visited.has(next.state)) continue;
			visited.add(next.state);

			if (isWinState(next.blocks, exitX, exitY)) {
				return { solvable: true, minMoves: moves + 1 };
			}

			queue.push({ blocks: next.blocks, moves: moves + 1 });
		}
	}

	return { solvable: false, minMoves: -1 };
}

/**
 * Validate a puzzle configuration
 * Checks that blocks don't overlap and are within bounds
 */
export function isValidConfiguration(puzzle: BlockSlidePuzzle): boolean {
	const { blocks, gridWidth, gridHeight } = puzzle;

	// Check bounds and target existence
	let hasTarget = false;
	for (const block of blocks) {
		if (block.isTarget) hasTarget = true;
		if (block.x < 0 || block.y < 0) return false;
		if (block.x + block.width > gridWidth) return false;
		if (block.y + block.height > gridHeight) return false;
	}

	if (!hasTarget) return false;

	// Check for overlaps
	for (let i = 0; i < blocks.length; i++) {
		for (let j = i + 1; j < blocks.length; j++) {
			if (blocksOverlap(blocks[i], blocks[j])) {
				return false;
			}
		}
	}

	return true;
}
