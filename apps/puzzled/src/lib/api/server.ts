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
import { GetDailyRequestSchema, PuzzleService } from '@/gen/connect/puzzled/v1/puzzle_pb'
import {
	GetHistoryRequestSchema,
	GetTodayOverviewRequestSchema,
	GetUserStatsRequestSchema,
	StatsService,
} from '@/gen/connect/puzzled/v1/stats_pb'
import { mergeServerConnectInit } from '@/lib/api/connect-fetch'
import {
	type DailyStatus,
	mapDailyStatus,
	mapTodaysPuzzle,
	type TodaysPuzzle,
} from '@/lib/api/domain/daily'
import { getServerBilling } from '@/lib/billing/server'
import { resolveServerConnectBaseUrl } from '@/lib/connect/transport'
import { logger } from '@/lib/logger'
import { withPresentationDeadline } from '@/lib/presentation-document'
import { projectStreakInfo, type StreakInfo } from '@/lib/streak-info'

// ==========================================
// Response types (unchanged public shapes)
// ==========================================

export type { StreakInfo }

export type { DailyStatus, TodaysPuzzle }

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
		return mapDailyStatus(res, input.difficulty)
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
		return mapTodaysPuzzle(res, input.difficulty)
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
 *
 * The premium fact is resolved here, from the account id, through the same
 * request-cached authority read the rendering page uses - never accepted as a
 * loose boolean. Which modules are read for a viewer and which the page calls
 * playable can therefore never disagree.
 */
export async function getServerPersonalDailyResults(input: {
	gameSlugs: readonly string[]
	isGuest: boolean
	/** Signed-in account id; the entitlement is resolved from it. */
	userId?: string | null
	freeGameSlug: string
}): Promise<Record<string, PersonalDailyResult>> {
	const isPremium = input.userId
		? (
				await withPresentationDeadline(getServerBilling(input.userId), {
					isPremium: false,
					subscription: null,
				})
			).isPremium
		: false
	const statuses = new Map<string, DailyStatus>()
	const unavailableSlugs = new Set<string>()
	await loadDailyCompletionMap({
		gameSlugs: input.gameSlugs,
		isGuest: input.isGuest,
		isPremium,
		freeGameSlug: input.freeGameSlug,
		read: async (gameSlug) => {
			try {
				const status = await getServerDailyStatus({ gameSlug })
				statuses.set(gameSlug, status)
				return status.hasCompleted
			} catch (error) {
				unavailableSlugs.add(gameSlug)
				logger.error('home.personal-result-read-failed', { gameSlug, error })
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
