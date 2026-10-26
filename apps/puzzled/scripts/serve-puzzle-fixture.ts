/**
 * Deterministic GetDaily fixture API for the post-merge browser harnesses.
 * It speaks the same Connect JSON protocol as the generated client, serves
 * real frozen boards, and never implements account or write operations.
 */
import { frozenPuzzle } from '../src/games/test-fixtures'
import type { PuzzleDifficulty } from '../src/games/types'
import { isValidDayKey, productDayKey } from '../src/lib/product-day'

const DIFFICULTIES = new Set<PuzzleDifficulty>(['easy', 'medium', 'hard'])

type GetDailyWireRequest = {
	gameSlug?: unknown
	difficulty?: unknown
	puzzleDate?: unknown
}

function connectError(status: number, code: string, message: string) {
	return Response.json({ code, message }, { status })
}

export function createPuzzleFixtureServer(port = 8787) {
	return Bun.serve({
		hostname: '127.0.0.1',
		port,
		async fetch(request: Request) {
			const url = new URL(request.url)
			if (url.pathname === '/healthz') return new Response('ok')
			if (url.pathname !== '/puzzled.v1.PuzzleService/GetDaily') {
				return connectError(404, 'not_found', 'not_found')
			}
			if (request.method !== 'POST') {
				return connectError(405, 'unimplemented', 'post_required')
			}

			let input: GetDailyWireRequest
			try {
				input = (await request.json()) as GetDailyWireRequest
			} catch {
				return connectError(400, 'invalid_argument', 'invalid_json')
			}
			const slug = typeof input.gameSlug === 'string' ? input.gameSlug.trim() : ''
			if (!slug) return connectError(400, 'invalid_argument', 'game_slug_required')
			const requestedDifficulty =
				typeof input.difficulty === 'string' ? input.difficulty.trim() : ''
			if (requestedDifficulty && !DIFFICULTIES.has(requestedDifficulty as PuzzleDifficulty)) {
				return connectError(400, 'invalid_argument', 'invalid_difficulty')
			}
			const difficulty = requestedDifficulty ? (requestedDifficulty as PuzzleDifficulty) : undefined
			const today = productDayKey()
			const requestedDate =
				typeof input.puzzleDate === 'string' && input.puzzleDate.trim()
					? input.puzzleDate.trim()
					: today
			if (!isValidDayKey(requestedDate) || requestedDate > today) {
				return connectError(400, 'invalid_argument', 'invalid_puzzle_date')
			}

			try {
				const { puzzleData, solution } = frozenPuzzle({ slug }, difficulty)
				// Word-search's public board includes the words to find, but never
				// their placements. Its frozen generator case stores those words in
				// the private solution, so project only that one public field.
				const servedData =
					slug === 'word-search' &&
					typeof puzzleData === 'object' &&
					puzzleData !== null &&
					typeof solution === 'object' &&
					solution !== null &&
					'words' in solution &&
					Array.isArray(solution.words)
						? { ...puzzleData, words: solution.words }
						: puzzleData
				return Response.json({
					gameSlug: slug,
					puzzleNumber: 1,
					puzzleDate: requestedDate,
					difficulty: requestedDifficulty,
					hasCompleted: false,
					canPlay: true,
					mode: requestedDate === today ? 'daily' : 'archive',
					slice: 'CI-frozen-fixture',
					stub: false,
					puzzleDataJson: JSON.stringify(servedData),
				})
			} catch {
				return connectError(404, 'not_found', 'unknown_game_or_difficulty')
			}
		},
	})
}

if (import.meta.main) {
	const server = createPuzzleFixtureServer(Number(process.env.FIXTURE_API_PORT ?? 8787))
	console.log(`fixture GetDaily listening on http://127.0.0.1:${server.port}`)
	await new Promise(() => {})
}
