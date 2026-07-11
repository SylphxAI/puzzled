/**
 * Golden fixture parity: TS validateAndScore vs frozen baseline corpus.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateAndScore } from '@/games/registry'
import { sudokuConfig } from '@/games/sudoku/config'
import type { GameSubmission } from '@/games/types'

const goldenPath = join(import.meta.dir, '../../../fixtures/puzzle-solution/golden.json')

type ScoringCase = {
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

function buildSubmission(
	template: ScoringCase['submission'],
	solutionGrid: number[][],
): GameSubmission {
	const { useSolutionGrid, useIncorrectGrid, finalGrid, mistakes, ...rest } = template.data
	let grid = finalGrid
	if (!grid && useSolutionGrid) grid = solutionGrid
	if (!grid && useIncorrectGrid) {
		grid = solutionGrid.map((row, r) =>
			row.map((cell, c) => (r === 0 && c === 0 ? (cell % 9) + 1 : cell)),
		)
	}
	return {
		status: template.status,
		attempts: template.attempts,
		timeSpentMs: template.timeSpentMs,
		data: grid === undefined ? rest : { ...rest, finalGrid: grid },
	}
}

describe('puzzle-solution golden corpus', () => {
	const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
		scoringCases: ScoringCase[]
	}

	for (const scoringCase of golden.scoringCases) {
		it(`scoring case ${scoringCase.id}`, () => {
			const { puzzleData, solution } = sudokuConfig.generatePuzzle(
				scoringCase.seed,
				scoringCase.difficulty,
			)
			const submission = buildSubmission(scoringCase.submission, solution.grid)
			const actual = validateAndScore(scoringCase.gameSlug, solution, puzzleData, submission)

			if (scoringCase.expected.valid) {
				expect(actual.valid).toBe(true)
				if (actual.valid) {
					expect(actual.status).toBe(scoringCase.expected.status)
					expect(actual.score).toBe(scoringCase.expected.score)
				}
			} else {
				expect(actual.valid).toBe(false)
				if (!actual.valid) {
					expect(actual.error).toContain(scoringCase.expected.error)
				}
			}
		})
	}
})
