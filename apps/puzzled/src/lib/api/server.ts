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

import {
	GamificationService,
	GetStreakInfoRequestSchema,
} from '@/gen/connect/puzzled/v1/gamification_pb'
import { GetDailyRequestSchema, PuzzleService } from '@/gen/connect/puzzled/v1/puzzle_pb'
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
		completedAt: Date
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
		return {
			hasCompleted: res.hasCompleted,
			completedSession: res.hasCompleted
				? { status: 'won', score: null, attempts: null, completedAt: new Date() }
				: null,
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

/**
 * Back-compat shim deleted: no Hono clients exist. Use the typed accessors
 * above (getServerDailyStatus / getServerTodaysPuzzle / getServerStreakInfo /
 * getServerUserStats) from server components.
 */
export const createServerApi = null as never
