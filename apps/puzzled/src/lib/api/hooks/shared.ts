'use client'

/**
 * Puzzled API hooks - shared kernel (errors + query keys).
 *
 * Split out of hooks.ts (TD-11); hooks.ts re-exports the public surface and
 * remains the import path callers use.
 */

// ==========================================
// Errors
// ==========================================

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly error?: {
			code?: string
			message?: string
			zodError?: { formErrors: string[]; fieldErrors: Record<string, string[]> }
		},
	) {
		super(message)
		this.name = 'ApiError'
	}
}

export function toApiError(e: unknown, fallbackCode: string): ApiError {
	if (e instanceof ApiError) return e
	const message = e instanceof Error ? e.message : String(e)
	return new ApiError(503, message, { code: fallbackCode, message })
}

// ==========================================
// Query keys
// ==========================================

export const queryKeys = {
	root: ['puzzled'] as const,
	dailyStatus: (gameSlug: string, difficulty?: string) =>
		['puzzled', 'daily-status', gameSlug, difficulty ?? null] as const,
	todaysPuzzle: (gameSlug: string, difficulty?: string) =>
		['puzzled', 'todays-puzzle', gameSlug, difficulty ?? null] as const,
	userStats: () => ['puzzled', 'user-stats'] as const,
	streakInfo: () => ['puzzled', 'streak-info'] as const,
	todayCompletions: () => ['puzzled', 'today-completions'] as const,
	notificationPreferences: () => ['puzzled', 'notification-preferences'] as const,
	auditLogs: (params?: Record<string, unknown>) =>
		['puzzled', 'admin', 'audit-logs', params ?? {}] as const,
	auditLogDetails: (id: string) => ['puzzled', 'admin', 'audit-logs', id] as const,
	dlq: (params?: Record<string, unknown>) => ['puzzled', 'admin', 'dlq', params ?? {}] as const,
	announcements: () => ['puzzled', 'admin', 'announcements'] as const,
	settings: () => ['puzzled', 'admin', 'settings'] as const,
	gamesOverview: () => ['puzzled', 'admin', 'games-overview'] as const,
	gameAnalytics: (slug: string, days: number) =>
		['puzzled', 'admin', 'game-analytics', slug, days] as const,
	systemHealth: () => ['puzzled', 'admin', 'system-health'] as const,
	todayPercentile: (params: Record<string, unknown>) =>
		['puzzled', 'today-percentile', params] as const,
}
