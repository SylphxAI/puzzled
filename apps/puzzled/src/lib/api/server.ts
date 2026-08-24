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
	GetHistoryRequestSchema,
	GetTodayOverviewRequestSchema,
	GetUserStatsRequestSchema,
	StatsService,
} from '@/gen/connect/puzzled/v1/stats_pb'
import { mergeServerConnectInit } from '@/lib/api/connect-fetch'
import { resolveServerConnectBaseUrl } from '@/lib/connect/transport'
import { servedPuzzleId } from '@/lib/product-day'
import { projectStreakInfo, type StreakInfo } from '@/lib/streak-info'

// ==========================================
// Response types (unchanged public shapes)
// ==========================================

export type { StreakInfo }

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
	const baseUrl = resolveServerConnectBaseUrl()
	return createConnectTransport({
		baseUrl,
		useBinaryFormat: false,
		fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
			fetch(input, mergeServerConnectInit(init, cookie))) as typeof fetch,
	})
}

/** True when SSR can attach a guest or Platform identity to Connect reads. */
export async function hasServerProgressIdentity(): Promise<boolean> {
	const cookieStore = await cookies()
	if (cookieStore.get('puzzled_guest_id')?.value) return true
	return cookieStore
		.getAll()
		.some(
			(cookie) =>
				cookie.name.startsWith('__sylphx_') &&
				cookie.name.endsWith('_session') &&
				Boolean(cookie.value),
		)
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
	return projectStreakInfo(res.info)
})

export type PersonalDailyResult = {
	hasCompleted: boolean
	completedSession: DailyStatus['completedSession']
	/** False means the server could not prove this status; callers must not render Play. */
	statusAvailable: boolean
}

/**
 * Personal home/progress today-state. GetTodayOverview is a public aggregate
 * for social proof, not a user's completion state; guests and accounts both
 * read GetDaily.has_completed / completed_session.
 */
export async function getServerPersonalDailyResults(input: {
	gameSlugs: readonly string[]
	isGuest: boolean
	isPremium: boolean
	freeGameSlug: string
}): Promise<Record<string, PersonalDailyResult>> {
	const statuses = new Map<string, DailyStatus>()
	const unavailableSlugs = new Set<string>()
	await loadDailyCompletionMap({
		...input,
		read: async (gameSlug) => {
			try {
				const status = await getServerDailyStatus({ gameSlug })
				statuses.set(gameSlug, status)
				return status.hasCompleted
			} catch (error) {
				unavailableSlugs.add(gameSlug)
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
					statusAvailable: !unavailableSlugs.has(gameSlug),
				},
			] as const
		}),
	)
}

export type HistoryEntry = {
	gameSlug: string
	puzzleId: string
	puzzleDate: string
	status: string
	score: number
	attempts: number
	timeSpentMs: number
	mode: string
}

export const getServerHistory = cache(
	async (input?: { gameSlug?: string; limit?: number }): Promise<HistoryEntry[]> => {
		const transport = await getServerTransport()
		const client = createClient(StatsService, transport)
		const res = await client.getHistory(
			create(GetHistoryRequestSchema, {
				gameSlug: input?.gameSlug?.trim() ?? '',
				limit: input?.limit ?? 20,
			}),
		)
		return res.sessions.map((session) => ({
			gameSlug: session.gameSlug,
			puzzleId: session.puzzleId,
			puzzleDate: session.puzzleDate,
			status: session.status,
			score: Number(session.score),
			attempts: Number(session.attempts),
			timeSpentMs: Number(session.timeSpentMs),
			mode: session.mode,
		}))
	},
)

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
