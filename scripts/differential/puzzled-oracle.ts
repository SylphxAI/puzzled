#!/usr/bin/env bun
/**
 * TS oracle for puzzled differential parity (rej-010).
 *
 * Re-executes frozen TS authority paths against golden fixture corpora and emits
 * canonical JSON consumed by `crates/puzzled-server/tests/puzzled_differential.rs`.
 *
 * Slices: puzzle-grid, puzzle-solution-submit, leaderboard-read.
 * Fail-closed: requires bun (no SKIP-as-pass).
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isValidGameSlug, validateAndScore } from '../../apps/puzzled/src/games/registry'
import { generateSudokuPuzzle } from '../../apps/puzzled/src/games/sudoku/generator'
import { sudokuConfig } from '../../apps/puzzled/src/games/sudoku/config'
import { seededRandom, shuffleArray } from '../../apps/puzzled/src/games/shared/random'
import { PAGINATION } from '../../apps/puzzled/src/lib/config/validation'
import type { GameSubmission } from '../../apps/puzzled/src/games/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../..')
const CORPUS_PATH = join(__dirname, 'fixtures/puzzled-corpus.json')
const GRID_GOLDEN = join(REPO_ROOT, 'fixtures/puzzle-grid/golden.json')
const SOLUTION_GOLDEN = join(REPO_ROOT, 'fixtures/puzzle-solution/golden.json')
const LEADERBOARD_GOLDEN = join(REPO_ROOT, 'fixtures/leaderboard/golden.json')

export interface DifferentialCase {
	readonly id: string
	readonly slice: 'puzzle-grid' | 'puzzle-solution-submit' | 'leaderboard-read'
	readonly domain: string
	readonly kind: 'core' | 'http'
	readonly input: Record<string, unknown>
	readonly output: unknown
}

export interface DifferentialCorpus {
	readonly corpusVersion: number
	readonly fixtureCorpusHash: string
	readonly cases: readonly DifferentialCase[]
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

type RandomCase = {
	id: string
	seed: number
	values: number[]
	input?: Json
	output?: Json
}

type SudokuCase = {
	id: string
	seed: number
	difficulty: 'easy' | 'medium' | 'hard'
}

type HttpCase = {
	id: string
	method?: string
	path: string
	query?: string
	body?: Json
	requestBody?: Json
	httpStatus: number
	responseBody?: Json
}

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
	expected: Json
}

type EnrichCase = {
	id: string
	rankRows: Array<{ userId: string; totalScore: number }>
	displayCache: Array<{
		userId: string
		displayName: string | null
		avatarUrl: string | null
	}>
	expected: Json
}

type QueryParseCase = {
	id: string
	params: Record<string, string>
	valid: boolean
	parsed?: {
		gameSlug: string
		type: string
		period: string
		limit: number
	}
}

function fixtureCorpusHash(parts: string[]): string {
	const payload = parts.join('\n---\n')
	return createHash('sha256').update(payload).digest('hex')
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

function scoringToJson(result: ReturnType<typeof validateAndScore>): Json {
	if (result.valid) {
		return { valid: true, status: result.status, score: result.score }
	}
	return { valid: false, error: result.error }
}

function parseLeaderboardQuery(params: Record<string, string>): QueryParseCase['parsed'] | null {
	const gameSlug = params.gameSlug?.trim()
	if (!gameSlug) return null

	const type = params.type ?? 'streak'
	if (type !== 'streak' && type !== 'score') return null

	const period = params.period ?? 'all'
	if (period !== 'today' && period !== 'week' && period !== 'all') return null

	const limit = params.limit === undefined ? PAGINATION.DEFAULT_LIMIT : Number(params.limit)
	if (!Number.isFinite(limit) || limit < 1 || limit > PAGINATION.ADMIN_MAX_LIMIT) return null

	return { gameSlug, type, period, limit }
}

/** S0 no-postgres leaderboard HTTP behavior mirrored from stats.ts. */
function tsLeaderboardHttpResponse(query: string, path: string): { httpStatus: number; body: Json } {
	if (path === '/api/leaderboard') {
		return { httpStatus: 200, body: { entries: [], stub: true } }
	}

	const params = Object.fromEntries(new URLSearchParams(query))
	const parsed = parseLeaderboardQuery(params)
	if (!parsed) {
		return { httpStatus: 200, body: [] }
	}
	if (!isValidGameSlug(parsed.gameSlug)) {
		return { httpStatus: 200, body: [] }
	}
	if (parsed.type === 'streak') {
		return { httpStatus: 200, body: [] }
	}
	// Score path without DB/redis in differential oracle — S0 empty array.
	return { httpStatus: 200, body: [] }
}

function buildLeaderboardEntries(
	rankRows: EnrichCase['rankRows'],
	displayCache: EnrichCase['displayCache'],
): Json {
	const displayMap = new Map(displayCache.map((entry) => [entry.userId, entry]))
	return rankRows.map((row, index) => {
		const display = displayMap.get(row.userId)
		return {
			rank: index + 1,
			userId: row.userId,
			userName: display?.displayName ?? 'Anonymous',
			userImage: display?.avatarUrl ?? null,
			value: row.totalScore,
		}
	})
}

function tsPuzzleGridHttpResponse(query: string): { httpStatus: number; body: Json } {
	const params = Object.fromEntries(new URLSearchParams(query))
	const gameSlug = params.gameSlug ?? ''
	if (gameSlug !== 'sudoku') {
		return {
			httpStatus: 400,
			body: {
				error: 'unsupported gameSlug',
				supported: ['sudoku'],
				slice: 'S2-puzzle-grid',
			},
		}
	}
	const seed = Number(params.seed ?? '0')
	const difficulty = (params.difficulty ?? 'medium') as 'easy' | 'medium' | 'hard'
	const result = generateSudokuPuzzle(seed, difficulty)
	return {
		httpStatus: 200,
		body: {
			gameSlug,
			seed,
			...result,
			slice: 'S2-puzzle-grid',
		},
	}
}

function tsPuzzleSubmitHttpResponse(requestBody: Json): { httpStatus: number; body: Json } {
	const body = requestBody as {
		gameSlug?: string
		solution?: { grid: number[][] }
		puzzleData?: Json
		submission?: GameSubmission
	}
	if (body.gameSlug !== 'sudoku') {
		return {
			httpStatus: 400,
			body: {
				error: 'unsupported gameSlug',
				supported: ['sudoku'],
				slice: 'S2-puzzle-solution-submit',
			},
		}
	}
	const result = validateAndScore(
		body.gameSlug,
		body.solution,
		body.puzzleData,
		body.submission as GameSubmission,
	)
	const scored = scoringToJson(result)
	return {
		httpStatus: 200,
		body: { ...scored, slice: 'S2-puzzle-solution-submit' },
	}
}

async function main(): Promise<void> {
	const [corpusRaw, gridRaw, solutionRaw, leaderboardRaw] = await Promise.all([
		readFile(CORPUS_PATH, 'utf8'),
		readFile(GRID_GOLDEN, 'utf8'),
		readFile(SOLUTION_GOLDEN, 'utf8'),
		readFile(LEADERBOARD_GOLDEN, 'utf8'),
	])

	const gridGolden = JSON.parse(gridRaw) as {
		randomCases: RandomCase[]
		sudokuCases: SudokuCase[]
		httpCases: HttpCase[]
	}
	const solutionGolden = JSON.parse(solutionRaw) as {
		scoringCases: ScoringCaseTemplate[]
		httpCases: HttpCase[]
	}
	const leaderboardGolden = JSON.parse(leaderboardRaw) as {
		httpCases: HttpCase[]
		enrichCases: EnrichCase[]
		queryParseCases: QueryParseCase[]
	}

	const cases: DifferentialCase[] = []

	for (const testCase of gridGolden.randomCases) {
		if (testCase.input !== undefined && testCase.output !== undefined) {
			const items = testCase.input as string[]
			const actual = shuffleArray(items, seededRandom(testCase.seed))
			cases.push({
				id: `puzzle-grid.shuffle.${testCase.id}`,
				slice: 'puzzle-grid',
				domain: 'shuffle',
				kind: 'core',
				input: { seed: testCase.seed, items },
				output: actual,
			})
			continue
		}
		const rng = seededRandom(testCase.seed)
		const values = testCase.values.map(() => rng())
		cases.push({
			id: `puzzle-grid.random.${testCase.id}`,
			slice: 'puzzle-grid',
			domain: 'random',
			kind: 'core',
			input: { seed: testCase.seed, count: testCase.values.length },
			output: { values },
		})
	}

	for (const testCase of gridGolden.sudokuCases) {
		const result = generateSudokuPuzzle(testCase.seed, testCase.difficulty)
		cases.push({
			id: `puzzle-grid.sudoku.${testCase.id}`,
			slice: 'puzzle-grid',
			domain: 'sudoku',
			kind: 'core',
			input: { seed: testCase.seed, difficulty: testCase.difficulty },
			output: result,
		})
	}

	for (const testCase of gridGolden.httpCases) {
		const query = testCase.query ?? ''
		const ts = tsPuzzleGridHttpResponse(query)
		cases.push({
			id: `puzzle-grid.http.${testCase.id}`,
			slice: 'puzzle-grid',
			domain: 'http',
			kind: 'http',
			input: {
				method: 'GET',
				path: testCase.path,
				query,
			},
			output: { httpStatus: ts.httpStatus, body: ts.body },
		})
	}

	for (const template of solutionGolden.scoringCases) {
		const { puzzleData, solution } = sudokuConfig.generatePuzzle(
			template.seed,
			template.difficulty,
		)
		const submission = materializeSubmission(template, solution.grid)
		const actual = validateAndScore(template.gameSlug, solution, puzzleData, submission)
		cases.push({
			id: `puzzle-solution.scoring.${template.id}`,
			slice: 'puzzle-solution-submit',
			domain: 'scoring',
			kind: 'core',
			input: {
				gameSlug: template.gameSlug,
				seed: template.seed,
				difficulty: template.difficulty,
				submission: template.submission,
			},
			output: scoringToJson(actual),
		})
	}

	for (const testCase of solutionGolden.httpCases) {
		const requestBody = testCase.requestBody ?? {}
		const ts = tsPuzzleSubmitHttpResponse(requestBody)
		cases.push({
			id: `puzzle-solution.http.${testCase.id}`,
			slice: 'puzzle-solution-submit',
			domain: 'http',
			kind: 'http',
			input: {
				method: testCase.method ?? 'POST',
				path: testCase.path,
				requestBody,
			},
			output: { httpStatus: ts.httpStatus, body: ts.body },
		})
	}

	for (const testCase of leaderboardGolden.httpCases) {
		const query = testCase.query ?? ''
		const ts = tsLeaderboardHttpResponse(query, testCase.path)
		cases.push({
			id: `leaderboard.http.${testCase.id}`,
			slice: 'leaderboard-read',
			domain: 'http',
			kind: 'http',
			input: {
				method: 'GET',
				path: testCase.path,
				query,
			},
			output: { httpStatus: ts.httpStatus, body: ts.body },
		})
	}

	for (const testCase of leaderboardGolden.enrichCases) {
		const actual = buildLeaderboardEntries(testCase.rankRows, testCase.displayCache)
		cases.push({
			id: `leaderboard.enrich.${testCase.id}`,
			slice: 'leaderboard-read',
			domain: 'enrich',
			kind: 'core',
			input: {
				rankRows: testCase.rankRows,
				displayCache: testCase.displayCache,
			},
			output: actual,
		})
	}

	for (const testCase of leaderboardGolden.queryParseCases) {
		const parsed = parseLeaderboardQuery(testCase.params)
		cases.push({
			id: `leaderboard.queryParse.${testCase.id}`,
			slice: 'leaderboard-read',
			domain: 'queryParse',
			kind: 'core',
			input: { params: testCase.params },
			output: {
				valid: parsed !== null,
				parsed: parsed ?? null,
			},
		})
	}

	const corpus = JSON.parse(corpusRaw) as { corpusVersion: number }
	const payload: DifferentialCorpus = {
		corpusVersion: corpus.corpusVersion,
		fixtureCorpusHash: fixtureCorpusHash([corpusRaw, gridRaw, solutionRaw, leaderboardRaw]),
		cases,
	}
	process.stdout.write(`${JSON.stringify(payload)}\n`)
}

await main()