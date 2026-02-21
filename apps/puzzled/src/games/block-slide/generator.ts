/**
 * Block Slide (Klotski) Puzzle Generator
 *
 * Classic Klotski rules: any block can move in any direction if there's space.
 * Generates infinite unique puzzles using seeded PRNG.
 * Each puzzle is validated with BFS solver for solvability.
 */

import { seededRandom } from "@/games/shared/random";
import { isValidConfiguration, solvePuzzle } from "./solver";
import type { Block, BlockSlidePuzzle } from "./types";

/**
 * Standard Klotski grid configuration
 */
const GRID_WIDTH = 4;
const GRID_HEIGHT = 5;
const EXIT_X = 1;
const EXIT_Y = 3; // Target needs to reach (1,3) to exit through bottom center

/**
 * Block templates for generation
 * Mix of vertical (1×2), horizontal (2×1), and small (1×1) blocks
 */
type BlockTemplate = { width: number; height: number };

const BLOCK_TEMPLATES: BlockTemplate[] = [
	{ width: 1, height: 2 }, // Vertical
	{ width: 1, height: 2 }, // Vertical (duplicated for probability)
	{ width: 2, height: 1 }, // Horizontal
	{ width: 2, height: 1 }, // Horizontal (duplicated for probability)
	{ width: 1, height: 1 }, // Small
];

/**
 * Try to place a block on the grid
 * Returns null if placement is invalid
 */
function tryPlaceBlock(
	occupied: boolean[][],
	template: BlockTemplate,
	startX: number,
	startY: number,
): boolean {
	// Check bounds
	if (startX + template.width > GRID_WIDTH) return false;
	if (startY + template.height > GRID_HEIGHT) return false;

	// Check if cells are free
	for (let y = startY; y < startY + template.height; y++) {
		for (let x = startX; x < startX + template.width; x++) {
			if (occupied[y][x]) return false;
		}
	}

	// Mark cells as occupied
	for (let y = startY; y < startY + template.height; y++) {
		for (let x = startX; x < startX + template.width; x++) {
			occupied[y][x] = true;
		}
	}

	return true;
}

/**
 * Generate a random block configuration
 */
function generateConfiguration(random: () => number): Block[] | null {
	// Initialize empty grid
	const occupied: boolean[][] = Array(GRID_HEIGHT)
		.fill(null)
		.map(() => Array(GRID_WIDTH).fill(false));

	const blocks: Block[] = [];

	// Always start with target 2×2 block
	// Place it in upper portion of grid (not at exit)
	const targetPositions = [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 2, y: 0 },
		{ x: 0, y: 1 },
		{ x: 1, y: 1 },
		{ x: 2, y: 1 },
	];
	const targetPos =
		targetPositions[Math.floor(random() * targetPositions.length)];

	// Mark target cells as occupied
	for (let y = targetPos.y; y < targetPos.y + 2; y++) {
		for (let x = targetPos.x; x < targetPos.x + 2; x++) {
			occupied[y][x] = true;
		}
	}

	blocks.push({
		id: "target",
		x: targetPos.x,
		y: targetPos.y,
		width: 2,
		height: 2,
		isTarget: true,
	});

	// Add 5-8 additional blocks
	const numBlocks = 5 + Math.floor(random() * 4); // 5-8 blocks
	let blockId = 0;

	for (let i = 0; i < numBlocks; i++) {
		// Shuffle through templates
		const templateIdx = Math.floor(random() * BLOCK_TEMPLATES.length);
		const template = BLOCK_TEMPLATES[templateIdx];

		// Try random positions
		let placed = false;
		for (let attempt = 0; attempt < 20; attempt++) {
			const x = Math.floor(random() * GRID_WIDTH);
			const y = Math.floor(random() * GRID_HEIGHT);

			if (tryPlaceBlock(occupied, template, x, y)) {
				blocks.push({
					id: String.fromCharCode(97 + blockId), // a, b, c, ...
					x,
					y,
					width: template.width,
					height: template.height,
					isTarget: false,
				});
				blockId++;
				placed = true;
				break;
			}
		}

		// If couldn't place this block, try a smaller one
		if (!placed && (template.width > 1 || template.height > 1)) {
			const smallTemplate = { width: 1, height: 1 };
			for (let attempt = 0; attempt < 20; attempt++) {
				const x = Math.floor(random() * GRID_WIDTH);
				const y = Math.floor(random() * GRID_HEIGHT);

				if (tryPlaceBlock(occupied, smallTemplate, x, y)) {
					blocks.push({
						id: String.fromCharCode(97 + blockId),
						x,
						y,
						width: 1,
						height: 1,
						isTarget: false,
					});
					blockId++;
					break;
				}
			}
		}
	}

	// Must have at least 4 additional blocks for interesting puzzle
	if (blocks.length < 5) return null;

	// Must have at least 2 empty cells for movement
	let emptyCells = 0;
	for (let y = 0; y < GRID_HEIGHT; y++) {
		for (let x = 0; x < GRID_WIDTH; x++) {
			if (!occupied[y][x]) emptyCells++;
		}
	}
	if (emptyCells < 2) return null;

	return blocks;
}

/**
 * Default difficulty ranges based on move count
 */
const DEFAULT_DIFFICULTY_RANGE = { min: 16, max: 35 }; // medium

/**
 * Generate a Block Slide puzzle from seed
 *
 * Uses seeded PRNG for determinism. Same seed always produces same puzzle.
 * @param seed - Numeric seed for deterministic generation
 * @param difficultyRange - Optional difficulty range (min/max moves). Defaults to medium.
 */
export function generateBlockSlidePuzzle(
	seed: number,
	difficultyRange?: { min: number; max: number },
): {
	puzzleData: BlockSlidePuzzle;
	solution: { minMoves: number };
} {
	const difficulty = difficultyRange ?? DEFAULT_DIFFICULTY_RANGE;
	let currentSeed = seed;

	// Try up to 100 seeds to find a valid puzzle
	for (let attempt = 0; attempt < 100; attempt++) {
		const random = seededRandom(currentSeed);

		const blocks = generateConfiguration(random);
		if (!blocks) {
			currentSeed = currentSeed * 2 + 1; // Next seed
			continue;
		}

		const puzzle: BlockSlidePuzzle = {
			blocks,
			gridWidth: GRID_WIDTH,
			gridHeight: GRID_HEIGHT,
			exitX: EXIT_X,
			exitY: EXIT_Y,
			minMoves: 0, // Will be set by solver
		};

		// Validate configuration
		if (!isValidConfiguration(puzzle)) {
			currentSeed = currentSeed * 2 + 1;
			continue;
		}

		// Solve to get minimum moves
		const result = solvePuzzle(puzzle, 120);

		if (!result.solvable) {
			currentSeed = currentSeed * 2 + 1;
			continue;
		}

		// Check if within difficulty range
		if (result.minMoves < difficulty.min || result.minMoves > difficulty.max) {
			currentSeed = currentSeed * 2 + 1;
			continue;
		}

		// Valid puzzle found!
		puzzle.minMoves = result.minMoves;

		return {
			puzzleData: puzzle,
			solution: { minMoves: result.minMoves },
		};
	}

	// NO FALLBACK: Algorithm must succeed
	// This should never happen with proper random generation
	throw new Error(
		`Block Slide generation failed for seed ${seed} after 100 attempts. ` +
			`Difficulty range: ${difficulty.min}-${difficulty.max} moves.`,
	);
}
