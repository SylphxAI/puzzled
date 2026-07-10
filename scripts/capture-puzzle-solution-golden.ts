/**
 * Capture frozen TS puzzle-solution scoring baselines into fixtures/puzzle-solution/golden.json.
 *
 * Run: bun scripts/capture-puzzle-solution-golden.ts
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateAndScore } from '../apps/puzzled/src/games/registry'
import { sudokuConfig } from '../apps/puzzled/src/games/sudoku/config'
import type { GameSubmission } from '../apps/puzzled/src/games/types'

const repoRoot = join(import.meta.dir, '..')
const outPath = join(repoRoot, 'fixtures/puzzle-solution/golden.json')

type ScoringCaseTemplate = {
	id: string
	gameSlug: string
	seed: number
	difficulty: 'easy' | 'medium' | 'hard'
	submission: GameSubmission & {
		data: {
			useSolutionGrid?: boolean
			useIncorrectGrid?: boolean
			mistakes?: number
			finalGrid?: (number | null)[][]
		}
	}
	expected: { valid: true; status: 'won' | 'lost'; score: number } | { valid: false; error: string }
}

function buildFinalGrid(
	solutionGrid: number[][],
	flags: ScoringCaseTemplate['submission']['data'],
): (number | null)[][] | undefined {
	if (flags.finalGrid) return flags.finalGrid
	if (flags.useSolutionGrid) return solutionGrid
	if (flags.useIncorrectGrid) {
		return solutionGrid.map((row, r) =>
			row.map((cell, c) => (r === 0 && c === 0 ? (cell % 9) + 1 : cell)),
		)
	}
	return undefined
}

function materializeSubmission(
	template: ScoringCaseTemplate,
	solutionGrid: number[][],
): GameSubmission {
	const { useSolutionGrid: _a, useIncorrectGrid: _b, finalGrid: _c, ...rest } =
		template.submission.data
	const finalGrid = buildFinalGrid(solutionGrid, template.submission.data)
	return {
		status: template.submission.status,
		attempts: template.submission.attempts,
		timeSpentMs: template.submission.timeSpentMs,
		data: finalGrid === undefined ? rest : { ...rest, finalGrid },
	}
}

const templates: ScoringCaseTemplate[] = [
	{
		id: 'fast-win-no-mistakes',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'won',
			attempts: 1,
			timeSpentMs: 0,
			data: { useSolutionGrid: true, mistakes: 0 },
		},
		expected: { valid: true, status: 'won', score: 1000 },
	},
	{
		id: '100s-win-no-mistakes',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'won',
			attempts: 1,
			timeSpentMs: 100000,
			data: { useSolutionGrid: true, mistakes: 0 },
		},
		expected: { valid: true, status: 'won', score: 900 },
	},
	{
		id: '500s-win-capped-time-penalty',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'won',
			attempts: 1,
			timeSpentMs: 600000,
			data: { useSolutionGrid: true, mistakes: 0 },
		},
		expected: { valid: true, status: 'won', score: 500 },
	},
	{
		id: 'fast-win-5-mistakes',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'won',
			attempts: 1,
			timeSpentMs: 0,
			data: { useSolutionGrid: true, mistakes: 5 },
		},
		expected: { valid: true, status: 'won', score: 750 },
	},
	{
		id: '200s-win-3-mistakes',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'won',
			attempts: 1,
			timeSpentMs: 200000,
			data: { useSolutionGrid: true, mistakes: 3 },
		},
		expected: { valid: true, status: 'won', score: 650 },
	},
	{
		id: 'minimum-win-score-100',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'won',
			attempts: 1,
			timeSpentMs: 700000,
			data: { useSolutionGrid: true, mistakes: 20 },
		},
		expected: { valid: true, status: 'won', score: 100 },
	},
	{
		id: 'loss-scores-zero',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'lost',
			attempts: 1,
			timeSpentMs: 60000,
			data: { useIncorrectGrid: true, mistakes: 0 },
		},
		expected: { valid: true, status: 'lost', score: 0 },
	},
	{
		id: 'missing-final-grid',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'won',
			attempts: 1,
			timeSpentMs: 60000,
			data: { mistakes: 0 },
		},
		expected: { valid: false, error: 'Missing final grid data' },
	},
	{
		id: 'false-win-claim',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'won',
			attempts: 1,
			timeSpentMs: 60000,
			data: { useIncorrectGrid: true, mistakes: 0 },
		},
		expected: { valid: false, error: 'Invalid win claim - grid does not match solution' },
	},
	{
		id: 'false-loss-claim',
		gameSlug: 'sudoku',
		seed: 12345,
		difficulty: 'medium',
		submission: {
			status: 'lost',
			attempts: 1,
			timeSpentMs: 60000,
			data: { useSolutionGrid: true, mistakes: 0 },
		},
		expected: { valid: false, error: 'Invalid loss claim - grid matches solution' },
	},
]

const scoringCases = templates
	.map((template) => {
		const { puzzleData, solution } = sudokuConfig.generatePuzzle(
			template.seed,
			template.difficulty,
		)
		const submission = materializeSubmission(template, solution.grid)
		const actual = validateAndScore(template.gameSlug, solution, puzzleData, submission)
		if (template.expected.valid && actual.valid) {
			if (actual.status !== template.expected.status || actual.score !== template.expected.score) {
				throw new Error(
					`${template.id}: expected ${JSON.stringify(template.expected)} got ${JSON.stringify(actual)}`,
				)
			}
		} else if (!template.expected.valid && !actual.valid) {
			if (!actual.error.includes(template.expected.error)) {
				throw new Error(`${template.id}: expected error ${template.expected.error} got ${actual.error}`)
			}
		} else {
			throw new Error(`${template.id}: validation mismatch ${JSON.stringify(actual)}`)
		}
		return {
			id: template.id,
			gameSlug: template.gameSlug,
			seed: template.seed,
			difficulty: template.difficulty,
			submission: template.submission,
			expected: template.expected,
		}
	})

const { puzzleData, solution } = sudokuConfig.generatePuzzle(42, 'medium')
const httpWinSubmission = materializeSubmission(
	{
		id: 'http-fast-win',
		gameSlug: 'sudoku',
		seed: 42,
		difficulty: 'medium',
		submission: {
			status: 'won',
			attempts: 1,
			timeSpentMs: 0,
			data: { useSolutionGrid: true, mistakes: 0 },
		},
		expected: { valid: true, status: 'won', score: 1000 },
	},
	solution.grid,
)

const golden = {
	schemaVersion: 1,
	source:
		'apps/puzzled/src/games/sudoku/config.ts validateAndScore (ADR-168 S2 puzzle-solution-submit)',
	capturedAt: new Date().toISOString().slice(0, 10),
	scoringCases,
	httpCases: [
		{
			id: 'sudoku-fast-win-seed-42',
			method: 'POST',
			path: '/api/v1/puzzles/submit',
			requestBody: {
				gameSlug: 'sudoku',
				solution,
				puzzleData,
				submission: httpWinSubmission,
			},
			httpStatus: 200,
			responseBody: {
				valid: true,
				status: 'won',
				score: 1000,
				slice: 'S2-puzzle-solution-submit',
			},
		},
		{
			id: 'unsupported-game',
			method: 'POST',
			path: '/api/v1/puzzles/submit',
			requestBody: {
				gameSlug: 'word-guess',
				solution: { grid: [] },
				submission: {
					status: 'won',
					attempts: 1,
					timeSpentMs: 0,
					data: {},
				},
			},
			httpStatus: 400,
			responseBody: {
				error: 'unsupported gameSlug',
				supported: ['sudoku'],
				slice: 'S2-puzzle-solution-submit',
			},
		},
	],
}

writeFileSync(outPath, `${JSON.stringify(golden, null, 2)}\n`)
console.log(`wrote ${outPath}`)