/**
 * Puzzled API Client
 *
 * Domain-specific hc (Hono client) instances for type-safe API calls.
 * Each domain has its own client for better code splitting and type inference.
 *
 * @example
 * // Games API
 * const res = await gamesApi['daily-status'].$get({ query: { gameSlug: 'wordle' } })
 * const status = await res.json()
 *
 * @example
 * // Gamification API
 * const res = await gamificationApi['streak-info'].$get()
 * const streak = await res.json()
 */

import { hc } from 'hono/client'
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
 * API Error class for typed error handling
 */
export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly error?: {
			code?: string
			message?: string
			zodError?: {
				formErrors: string[]
				fieldErrors: Record<string, string[]>
			}
		},
	) {
		super(message)
		this.name = 'ApiError'
	}

	get isValidationError(): boolean {
		return this.status === 400 && !!this.error?.zodError
	}

	get isUnauthorized(): boolean {
		return this.status === 401
	}

	get isForbidden(): boolean {
		return this.status === 403
	}

	get isNotFound(): boolean {
		return this.status === 404
	}

	get isRateLimited(): boolean {
		return this.status === 429
	}

	get isConflict(): boolean {
		return this.status === 409
	}
}

// ==========================================
// Domain-specific hc clients
// ==========================================

/**
 * Games API client
 * - Daily status, puzzles, validation, results, history
 */
export const gamesApi = hc<GamesRoutes>(`${API_BASE}/games`)

/**
 * Stats API client
 * - User stats, rankings, leaderboards
 */
export const statsApi = hc<StatsRoutes>(`${API_BASE}/stats`)

/**
 * Gamification API client
 * - Streaks, player counts, achievements
 */
export const gamificationApi = hc<GamificationRoutes>(`${API_BASE}/gamification`)

/**
 * User API client
 * - Profile, preferences, username
 */
export const userApi = hc<UserRoutes>(`${API_BASE}/user`)

/**
 * Notifications API client
 * - Push and email preferences
 */
export const notificationsApi = hc<NotificationsRoutes>(`${API_BASE}/notifications`)

/**
 * Admin API client
 * - DLQ, audit logs, settings, announcements, feature flags, analytics
 */
export const adminApi = hc<AdminRoutes>(`${API_BASE}/admin`)

// ==========================================
// Convenience export for all clients
// ==========================================

export const api = {
	games: gamesApi,
	stats: statsApi,
	gamification: gamificationApi,
	user: userApi,
	notifications: notificationsApi,
	admin: adminApi,
}
