/**
 * Server-side API Client for Puzzled
 *
 * Domain-specific hc (Hono client) instances for use in:
 * - React Server Components (RSC)
 * - Server Actions
 *
 * Each domain has its own client for better code splitting and type inference.
 * Uses React's cache() to dedupe calls within the same request.
 *
 * @example
 * // In a Server Component
 * const { gamification } = await createServerApi()
 * const res = await gamification['streak-info'].$get()
 * const streakInfo = await res.json()
 *
 * @example
 * // In a Server Action
 * const { games } = await createServerApi()
 * const res = await games['save-result'].$post({ json: { ... } })
 */

import 'server-only'
import { hc } from 'hono/client'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import type {
	AdminRoutes,
	GamesRoutes,
	GamificationRoutes,
	NotificationsRoutes,
	StatsRoutes,
	UserRoutes,
} from '@/server/api/app'

// API base path
const API_BASE = '/api/v1'

/**
 * Get the base URL for server-side API calls
 */
function getServerBaseUrl(): string {
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`
	}
	return `http://localhost:${process.env.PORT ?? 3001}`
}

/**
 * Create a custom fetch with forwarded headers/cookies for auth
 */
async function createAuthFetch() {
	const headersList = await headers()
	const cookieStore = await cookies()

	return (input: RequestInfo | URL, init?: RequestInit) =>
		fetch(input, {
			...init,
			headers: {
				...init?.headers,
				cookie: cookieStore.toString(),
				// Forward relevant headers for auth context
				'x-forwarded-for': headersList.get('x-forwarded-for') ?? '',
				'user-agent': headersList.get('user-agent') ?? '',
			},
		})
}

/**
 * Create cached server-side Hono clients
 *
 * Uses React's cache() to dedupe calls within the same request.
 * Each request gets its own clients with proper headers/cookies.
 *
 * @returns Domain-specific API clients
 */
export const createServerApi = cache(async () => {
	const baseUrl = getServerBaseUrl()
	const authFetch = await createAuthFetch()

	return {
		games: hc<GamesRoutes>(`${baseUrl}${API_BASE}/games`, { fetch: authFetch }),
		stats: hc<StatsRoutes>(`${baseUrl}${API_BASE}/stats`, { fetch: authFetch }),
		gamification: hc<GamificationRoutes>(`${baseUrl}${API_BASE}/gamification`, {
			fetch: authFetch,
		}),
		user: hc<UserRoutes>(`${baseUrl}${API_BASE}/user`, { fetch: authFetch }),
		notifications: hc<NotificationsRoutes>(`${baseUrl}${API_BASE}/notifications`, {
			fetch: authFetch,
		}),
		admin: hc<AdminRoutes>(`${baseUrl}${API_BASE}/admin`, { fetch: authFetch }),
	}
})

/**
 * Helper types for common API responses
 */
export type StreakInfo = {
	currentStreak: number
	maxStreak: number
	hasPlayedToday: boolean
	totalGamesPlayed: number
	freezesAvailable: number
	autoFreezeEnabled: boolean
}

export type TodayCompletion = {
	slug: string
	name: string
	completed: boolean
	score?: string
}

export type TodayPlayerCount = {
	count: number
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
