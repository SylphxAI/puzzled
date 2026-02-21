/**
 * Block Slide Solver Tests
 *
 * Note: Generator tests are slow (~4-10s each) due to BFS solving.
 * This is acceptable for daily puzzle generation but we use longer timeouts for tests.
 */

import { describe, expect, it } from "bun:test";
import { generateBlockSlidePuzzle } from "./generator";
import { isValidConfiguration, solvePuzzle } from "./solver";
import type { BlockSlidePuzzle } from "./types";

describe("Block Slide Solver", () => {
	it("solves a simple puzzle", () => {
		const puzzle: BlockSlidePuzzle = {
			gridWidth: 4,
			gridHeight: 5,
			exitX: 1,
			exitY: 3,
			minMoves: 0,
			blocks: [
				{ id: "target", x: 1, y: 1, width: 2, height: 2, isTarget: true },
				{ id: "a", x: 0, y: 0, width: 1, height: 2, isTarget: false },
				{ id: "b", x: 3, y: 0, width: 1, height: 2, isTarget: false },
			],
		};

		const result = solvePuzzle(puzzle);
		expect(result.solvable).toBe(true);
		expect(result.minMoves).toBeGreaterThan(0);
		expect(result.minMoves).toBeLessThan(20);
	});

	it("detects unsolvable puzzle", () => {
		// Target blocked by immovable pieces
		const puzzle: BlockSlidePuzzle = {
			gridWidth: 4,
			gridHeight: 5,
			exitX: 1,
			exitY: 3,
			minMoves: 0,
			blocks: [
				{ id: "target", x: 1, y: 0, width: 2, height: 2, isTarget: true },
				{ id: "a", x: 0, y: 0, width: 1, height: 5, isTarget: false },
				{ id: "b", x: 3, y: 0, width: 1, height: 5, isTarget: false },
				{ id: "c", x: 1, y: 2, width: 2, height: 3, isTarget: false },
			],
		};

		const result = solvePuzzle(puzzle, 50);
		expect(result.solvable).toBe(false);
	});

	it("validates configuration correctly", () => {
		// Valid config
		const valid: BlockSlidePuzzle = {
			gridWidth: 4,
			gridHeight: 5,
			exitX: 1,
			exitY: 3,
			minMoves: 0,
			blocks: [
				{ id: "target", x: 1, y: 0, width: 2, height: 2, isTarget: true },
				{ id: "a", x: 0, y: 0, width: 1, height: 2, isTarget: false },
			],
		};
		expect(isValidConfiguration(valid)).toBe(true);

		// Invalid - overlapping blocks
		const invalid: BlockSlidePuzzle = {
			gridWidth: 4,
			gridHeight: 5,
			exitX: 1,
			exitY: 3,
			minMoves: 0,
			blocks: [
				{ id: "target", x: 0, y: 0, width: 2, height: 2, isTarget: true },
				{ id: "a", x: 1, y: 0, width: 1, height: 2, isTarget: false },
			],
		};
		expect(isValidConfiguration(invalid)).toBe(false);
	});
});

describe("Block Slide Generator", () => {
	// Classic Klotski rules: any block can move in any direction
	// This makes puzzle generation more reliable across all difficulty ranges
	it("generates solvable puzzle for seed", () => {
		const { puzzleData, solution } = generateBlockSlidePuzzle(0);

		expect(puzzleData.gridWidth).toBe(4);
		expect(puzzleData.gridHeight).toBe(5);
		expect(puzzleData.blocks.some((b) => b.isTarget)).toBe(true);
		expect(solution.minMoves).toBeGreaterThan(0);

		// Verify with solver
		const result = solvePuzzle(puzzleData);
		expect(result.solvable).toBe(true);
		expect(result.minMoves).toBe(solution.minMoves);
	}, 30000); // 30 second timeout for BFS solving

	it("produces deterministic results", () => {
		const seed = 0;
		const result1 = generateBlockSlidePuzzle(seed);
		const result2 = generateBlockSlidePuzzle(seed);

		expect(result1.solution.minMoves).toBe(result2.solution.minMoves);
		expect(result1.puzzleData.blocks.length).toBe(
			result2.puzzleData.blocks.length,
		);
	}, 60000); // 60 second timeout (two generations)

	// Skip slow tests by default - run with specific seed
	it.skip("generates different puzzles for different seeds", () => {
		const result1 = generateBlockSlidePuzzle(1);
		const result2 = generateBlockSlidePuzzle(2);
		const result3 = generateBlockSlidePuzzle(3);

		// At least some should differ (not all the same)
		const moves = [
			result1.solution.minMoves,
			result2.solution.minMoves,
			result3.solution.minMoves,
		];
		const uniqueMoves = new Set(moves);
		expect(uniqueMoves.size).toBeGreaterThan(1);
	});

	// Skip slow difficulty test
	it.skip("cycles through difficulty levels", () => {
		// Seeds 0,4,8 = easy, 1,5,9 = medium, 2,6,10 = hard, 3,7,11 = expert
		const easySeed = 0;
		const mediumSeed = 1;
		const hardSeed = 2;

		const easyResult = generateBlockSlidePuzzle(easySeed);
		const mediumResult = generateBlockSlidePuzzle(mediumSeed);
		const hardResult = generateBlockSlidePuzzle(hardSeed);

		// Easy should be 4-15 moves
		expect(easyResult.solution.minMoves).toBeGreaterThanOrEqual(4);
		expect(easyResult.solution.minMoves).toBeLessThanOrEqual(15);

		// Medium should be 16-35 moves
		expect(mediumResult.solution.minMoves).toBeGreaterThanOrEqual(16);
		expect(mediumResult.solution.minMoves).toBeLessThanOrEqual(35);

		// Hard should be 36-60 moves
		expect(hardResult.solution.minMoves).toBeGreaterThanOrEqual(36);
		expect(hardResult.solution.minMoves).toBeLessThanOrEqual(60);
	});
});
