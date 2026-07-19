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

// The Rust OpenAPI client generator will replace this dynamic boundary.
// biome-ignore lint/suspicious/noExplicitAny: Hono no longer owns the API type graph.
export type DynamicApiClient = any
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
export const gamesApi = hc(`${API_BASE}/games`) as unknown as DynamicApiClient

/**
 * Stats API client
 * - User stats, rankings, leaderboards
 */
export const statsApi = hc(`${API_BASE}/stats`) as unknown as DynamicApiClient

/**
 * Gamification API client
 * - Streaks, player counts, achievements
 */
export const gamificationApi = hc(`${API_BASE}/gamification`) as unknown as DynamicApiClient

/**
 * User API client
 * - Profile, preferences, username
 */
export const userApi = hc(`${API_BASE}/user`) as unknown as DynamicApiClient

/**
 * Notifications API client
 * - Push and email preferences
 */
export const notificationsApi = hc(`${API_BASE}/notifications`) as unknown as DynamicApiClient

/**
 * Admin API client
 * - DLQ, audit logs, settings, announcements, feature flags, analytics
 */
export const adminApi = hc(`${API_BASE}/admin`) as unknown as DynamicApiClient

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
