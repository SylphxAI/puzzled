/**
 * Deterministic GetDaily fixture API for the post-merge browser harnesses.
 * It speaks the same Connect JSON protocol as the generated client, serves
 * real frozen boards, and never implements account or write operations.
 */
import catalogue from '../../../config/commercial/catalogue.json'
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

/**
 * A read-only price list for pricing-page captures, with the amounts of
 * config/commercial/catalogue.json. It is opt-in because an
 * open store locks every game but the free one for guests, which is not the
 * state the board and home harnesses run in.
 */
const PLAN_IDS: Record<string, string> = {
	plus_individual_monthly: 'individual_monthly',
	plus_individual_yearly: 'individual_yearly',
	plus_family_monthly: 'family_monthly',
	plus_family_yearly: 'family_yearly',
	puzzled_starter_unlock: 'individual_once',
}

const OPEN_PLANS = {
	salesOpen: true,
	familyMaxMembers: 4,
	plans: catalogue.plans.map((plan) => ({
		id: PLAN_IDS[plan.price_key] ?? plan.price_key,
		family: plan.grants.seats !== '1',
		interval: plan.interval,
		prices: Object.entries(plan.unit_amounts).map(([currency, amount]) => ({
			currency,
			unitAmountMinor: String(amount),
		})),
		trialDays: plan.trial_days,
		...(plan.interval === '' ? { accessDays: 3 } : {}),
	})),
}

export function createPuzzleFixtureServer(port = 8787, options: { openPlans?: boolean } = {}) {
	return Bun.serve({
		hostname: '127.0.0.1',
		port,
		async fetch(request: Request) {
			const url = new URL(request.url)
			if (url.pathname === '/healthz') return new Response('ok')
			if (url.pathname === '/v1/guest/session' && request.method === 'POST') {
				return Response.json({ issued: true })
			}
			if (options.openPlans && url.pathname === '/puzzled.v1.BillingService/ListPlans') {
				return Response.json(OPEN_PLANS)
			}
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
	const server = createPuzzleFixtureServer(Number(process.env.FIXTURE_API_PORT ?? 8787), {
		openPlans: process.env.FIXTURE_OPEN_PLANS === '1',
	})
	console.log(`fixture GetDaily listening on http://127.0.0.1:${server.port}`)
	await new Promise(() => {})
}
