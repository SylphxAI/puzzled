/**
 * Server-side API helpers — sole Connect authority (ADR-170).
 *
 * Server components call the api service through the private
 * API_INTERNAL_URL (platform-injected) and forward the browser's session
 * cookie (HttpOnly `__sylphx_*_session` JWT) for identity. There is no Hono
 * REST client; the web service has no backend authority.
 */

import 'server-only'

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { loadDailyCompletionMap } from '@/features/daily/lib/daily-completion'
import {
	GamificationService,
	GetStreakInfoRequestSchema,
} from '@/gen/connect/puzzled/v1/gamification_pb'
import {
	GetDailyRequestSchema,
	type GetDailyResponse,
	PuzzleService,
} from '@/gen/connect/puzzled/v1/puzzle_pb'
import {
	GetTodayOverviewRequestSchema,
	GetUserStatsRequestSchema,
	StatsService,
} from '@/gen/connect/puzzled/v1/stats_pb'
import { mergeServerConnectInit } from '@/lib/api/connect-fetch'
import { resolveConnectBaseUrl } from '@/lib/connect/transport'
import { servedPuzzleId } from '@/lib/product-day'

// ==========================================
// Response types (unchanged public shapes)
// ==========================================

export type StreakInfo = {
	currentStreak: number
	maxStreak: number
	hasPlayedToday: boolean
	totalGamesPlayed: number
	freezesAvailable: number
	autoFreezeEnabled: boolean
}

export type DailyStatus = {
	hasCompleted: boolean
	completedSession: {
		status: 'won' | 'lost'
		score: number | null
		attempts: number | null
		completedAt: Date | null
	} | null
	puzzle: {
		id: string
		puzzleNumber: number
		puzzleDate: string
		puzzleData: unknown
		difficulty: string | null
	}
	canPlay: boolean
	mode: 'daily'
}

export type TodaysPuzzle = {
	puzzleId: string
	puzzleNumber: number
	puzzleDate: string
	puzzleData: unknown
	difficulty: string | null
}

export type UserStats = {
	[gameSlug: string]: {
		gameSlug: string
		gamesPlayed: number
		gamesWon: number
		currentStreak: number
		maxStreak: number
		totalScore: number
		averageAttempts: number | null
		guessDistribution: unknown
		perfectGames: number
	}
}

// ==========================================
// Per-request Connect transport (forwards the session cookie)
// ==========================================

async function getServerTransport() {
	const cookieStore = await cookies()
	const cookie = cookieStore.toString()
	const baseUrl = resolveConnectBaseUrl()
	return createConnectTransport({
		baseUrl,
		useBinaryFormat: false,
		fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
			fetch(input, mergeServerConnectInit(init, cookie))) as typeof fetch,
	})
}

function parsePuzzleData(json: string): unknown {
	if (!json) return null
	try {
		return JSON.parse(json)
	} catch {
		return null
	}
}

function parseCompletedSession(res: GetDailyResponse): DailyStatus['completedSession'] {
	const completion = res.completedSession
	if (!res.hasCompleted || !completion) return null
	if (completion.status !== 'won' && completion.status !== 'lost') return null

	const completedAt =
		completion.completedAtMs === undefined ? null : new Date(Number(completion.completedAtMs))
	return {
		status: completion.status,
		score: completion.score ?? null,
		attempts: completion.attempts ?? null,
		completedAt: completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : null,
	}
}

// ==========================================
// Server data accessors (sole Connect)
// ==========================================

export const getServerDailyStatus = cache(
	async (input: {
		gameSlug: string
		difficulty?: string
		puzzleDate?: string
	}): Promise<DailyStatus> => {
		const transport = await getServerTransport()
		const client = createClient(PuzzleService, transport)
		const res = await client.getDaily(
			create(GetDailyRequestSchema, {
				gameSlug: input.gameSlug.trim(),
				difficulty: (input.difficulty ?? '').trim(),
				puzzleDate: input.puzzleDate?.trim() || undefined,
			}),
		)
		const completedSession = parseCompletedSession(res)
		return {
			hasCompleted: res.hasCompleted,
			completedSession,
			puzzle: {
				id: servedPuzzleId(res.puzzleId) || '',
				puzzleNumber: Number(res.puzzleNumber),
				puzzleDate: res.puzzleDate,
				puzzleData: parsePuzzleData(res.puzzleDataJson),
				difficulty: res.difficulty || input.difficulty || null,
			},
			canPlay: res.canPlay,
			mode: 'daily',
		}
	},
)

/**
 * Personal home progress. GetTodayOverview is a public aggregate for social
 * proof, not a user's completion state; use each module's server-derived
 * GetDaily.has_completed instead.
 */
export async function getServerPersonalDailyCompletions(input: {
	gameSlugs: readonly string[]
	isGuest: boolean
	isPremium: boolean
	freeGameSlug: string
}): Promise<Record<string, boolean>> {
	const results = await getServerPersonalDailyResults(input)
	return Object.fromEntries(
		Object.entries(results).map(([gameSlug, result]) => [gameSlug, result.hasCompleted]),
	)
}

export type PersonalDailyResult = {
	hasCompleted: boolean
	completedSession: DailyStatus['completedSession']
}

/**
 * Personal daily result details for the home return journey.
 *
 * GetDaily remains the sole result authority. The completion loader still
 * controls guest, entitlement, and fail-closed targeting; a missing payload
 * never becomes a fabricated score or status.
 */
export async function getServerPersonalDailyResults(input: {
	gameSlugs: readonly string[]
	isGuest: boolean
	isPremium: boolean
	freeGameSlug: string
}): Promise<Record<string, PersonalDailyResult>> {
	const statuses = new Map<string, DailyStatus>()
	await loadDailyCompletionMap({
		...input,
		read: async (gameSlug) => {
			try {
				const status = await getServerDailyStatus({ gameSlug })
				statuses.set(gameSlug, status)
				return status.hasCompleted
			} catch (error) {
				console.error(`[HomePage] Failed to read personal daily result for ${gameSlug}:`, error)
				throw error
			}
		},
	})

	return Object.fromEntries(
		input.gameSlugs.map((gameSlug) => {
			const status = statuses.get(gameSlug)
			return [
				gameSlug,
				{
					hasCompleted: status?.hasCompleted ?? false,
					completedSession: status?.completedSession ?? null,
				},
			] as const
		}),
	)
}

export const getServerTodaysPuzzle = cache(
	async (input: { gameSlug: string; difficulty?: string }): Promise<TodaysPuzzle> => {
		const transport = await getServerTransport()
		const client = createClient(PuzzleService, transport)
		const res = await client.getDaily(
			create(GetDailyRequestSchema, {
				gameSlug: input.gameSlug.trim(),
				difficulty: (input.difficulty ?? '').trim(),
			}),
		)
		return {
			puzzleId: servedPuzzleId(res.puzzleId) || '',
			puzzleNumber: Number(res.puzzleNumber),
			puzzleDate: res.puzzleDate,
			puzzleData: parsePuzzleData(res.puzzleDataJson),
			difficulty: res.difficulty || input.difficulty || null,
		}
	},
)

export const getServerStreakInfo = cache(async (): Promise<StreakInfo> => {
	const transport = await getServerTransport()
	const client = createClient(GamificationService, transport)
	const res = await client.getStreakInfo(create(GetStreakInfoRequestSchema, {}))
	const info = res.info
	return {
		currentStreak: info ? Number(info.currentStreak) : 0,
		maxStreak: info ? Number(info.maxStreak) : 0,
		hasPlayedToday: info ? info.hasPlayedToday : false,
		totalGamesPlayed: info ? Number(info.totalGamesPlayed) : 0,
		freezesAvailable: info ? Number(info.freezesAvailable) : 0,
		autoFreezeEnabled: info ? info.autoFreezeEnabled : false,
	}
})

export const getServerUserStats = cache(async (): Promise<UserStats> => {
	const transport = await getServerTransport()
	const client = createClient(StatsService, transport)
	const res = await client.getUserStats(create(GetUserStatsRequestSchema, { gameSlug: '' }))
	const out: UserStats = {}
	for (const g of res.games) {
		out[g.gameSlug] = {
			gameSlug: g.gameSlug,
			gamesPlayed: Number(g.gamesPlayed),
			gamesWon: Number(g.gamesWon),
			currentStreak: 0,
			maxStreak: 0,
			totalScore: Number(g.bestScore),
			averageAttempts: null,
			guessDistribution: null,
			perfectGames: 0,
		}
	}
	return out
})

export type TodayCompletion = {
	slug: string
	name: string
	completed: boolean
	score?: string
}

export type TodayPlayerCount = {
	/** Server-derived daily puzzle completers for the current product day. */
	count: number
}

export const getServerTodayOverview = cache(
	async (): Promise<{
		playerCount: number
		completions: { gameSlug: string; count: number }[]
	}> => {
		const transport = await getServerTransport()
		const client = createClient(StatsService, transport)
		const res = await client.getTodayOverview(create(GetTodayOverviewRequestSchema, {}))
		return {
			playerCount: Number(res.playerCount),
			completions: res.completions.map((c) => ({
				gameSlug: c.gameSlug,
				count: Number(c.count),
			})),
		}
	},
)
