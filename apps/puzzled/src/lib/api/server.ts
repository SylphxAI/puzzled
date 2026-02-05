/**
 * Server-side API Client for Puzzled
 *
 * Creates a Hono client (hc) for use in:
 * - React Server Components (RSC)
 * - Server Actions
 *
 * This calls the API over HTTP (same process in dev, separate in prod).
 * Uses React's cache() to dedupe calls within the same request.
 */

import 'server-only'
import { hc } from 'hono/client'
import { headers, cookies } from 'next/headers'
import { cache } from 'react'
import type { AppType } from '@/server/api/app'

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
 * Create a cached server-side Hono client
 *
 * Uses React's cache() to dedupe calls within the same request.
 * Each request gets its own client with proper headers/cookies.
 *
 * @example
 * // In a Server Component
 * const api = await createServerApi()
 * const res = await api.api.v1.gamification['streak-info'].$get()
 * const streakInfo = await res.json()
 *
 * @example
 * // In a Server Action
 * const api = await createServerApi()
 * const res = await api.api.v1.games['save-result'].$post({ json: { ... } })
 */
export const createServerApi = cache(async () => {
	const headersList = await headers()
	const cookieStore = await cookies()

	const baseUrl = getServerBaseUrl()

	// Create hc client with forwarded headers/cookies for auth
	return hc<AppType>(baseUrl, {
		fetch: (input: RequestInfo | URL, init?: RequestInit) =>
			fetch(input, {
				...init,
				headers: {
					...init?.headers,
					cookie: cookieStore.toString(),
					// Forward relevant headers for auth context
					'x-forwarded-for': headersList.get('x-forwarded-for') ?? '',
					'user-agent': headersList.get('user-agent') ?? '',
				},
			}),
	})
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
