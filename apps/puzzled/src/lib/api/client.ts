/**
 * Puzzled API Client
 *
 * Provides convenient wrapper functions for API calls.
 * Built on fetch with proper error handling.
 */

/**
 * Get the base URL for API requests
 */
function getBaseUrl(): string {
	if (typeof window !== 'undefined') {
		// Browser: use relative URL
		return ''
	}
	// Server: use absolute URL
	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`
	}
	return `http://localhost:${process.env.PORT ?? 3001}`
}

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

/**
 * Base fetch function with error handling
 */
async function fetchJson<T>(
	path: string,
	options?: RequestInit & { params?: Record<string, unknown> },
): Promise<T> {
	const baseUrl = getBaseUrl()
	let url = `${baseUrl}${API_BASE}${path}`

	// Add query params
	if (options?.params) {
		const searchParams = new URLSearchParams()
		for (const [key, value] of Object.entries(options.params)) {
			if (value !== undefined && value !== null) {
				searchParams.set(key, String(value))
			}
		}
		const queryString = searchParams.toString()
		if (queryString) {
			url += `?${queryString}`
		}
	}

	const response = await fetch(url, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...options?.headers,
		},
		credentials: 'include', // Include cookies for auth
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }))
		throw new ApiError(response.status, error.error?.message ?? 'Request failed', error.error)
	}

	return response.json()
}

// ==========================================
// Games API
// ==========================================

export const api = {
	games: {
		getDailyStatus: (params: { gameSlug: string; difficulty?: string }) =>
			fetchJson<unknown>('/games/daily-status', { params }),

		getTodaysPuzzle: (params: { gameSlug: string; difficulty?: string }) =>
			fetchJson<unknown>('/games/todays-puzzle', { params }),

		getArchivePuzzle: (params: { gameSlug: string; date: string }) =>
			fetchJson<unknown>('/games/archive-puzzle', { params }),

		validateGuess: (body: { puzzleId: string; gameSlug: string; guess: unknown }) =>
			fetchJson<unknown>('/games/validate-guess', {
				method: 'POST',
				body: JSON.stringify(body),
			}),

		saveResult: (body: {
			gameSlug: string
			status: 'won' | 'lost' | 'abandoned'
			attempts: number
			timeSpentMs: number
			mode?: 'daily' | 'archive' | 'practice'
			archiveDate?: string
			puzzleId: string
			difficulty?: string
			data: unknown
		}) =>
			fetchJson<{ success: boolean; score?: number; session?: unknown; mode?: string }>(
				'/games/save-result',
				{
					method: 'POST',
					body: JSON.stringify(body),
				},
			),

		getHistory: (params: { gameSlug: string; limit?: number }) =>
			fetchJson<unknown>('/games/history', { params }),

		getArchiveDates: (params: { gameSlug: string; startDate: string; endDate: string }) =>
			fetchJson<unknown>('/games/archive-dates', { params }),
	},

	// ==========================================
	// Stats API
	// ==========================================

	stats: {
		getUserStats: () => fetchJson<unknown>('/stats/user-stats'),

		getUserRank: (params: {
			gameSlug: string
			type?: 'streak' | 'score'
			period?: 'today' | 'week' | 'all'
		}) => fetchJson<unknown>('/stats/user-rank', { params }),

		getLeaderboard: (params: {
			gameSlug: string
			type?: 'streak' | 'score'
			period?: 'today' | 'week' | 'all'
			limit?: number
		}) => fetchJson<unknown>('/stats/leaderboard', { params }),

		getTodayPercentile: (params: {
			gameSlug: string
			status: 'won' | 'lost' | 'abandoned'
			attempts?: number
			score?: number
			mistakes?: number
			timeSpentMs?: number
		}) => fetchJson<unknown>('/stats/today-percentile', { params }),
	},

	// ==========================================
	// Gamification API
	// ==========================================

	gamification: {
		getStreakInfo: () => fetchJson<unknown>('/gamification/streak-info'),

		getTodayPlayerCount: () => fetchJson<{ count: number }>('/gamification/today-player-count'),

		getTodayCompletions: () => fetchJson<unknown>('/gamification/today-completions'),

		toggleAutoFreeze: (body: { enabled: boolean }) =>
			fetchJson<unknown>('/gamification/toggle-auto-freeze', {
				method: 'POST',
				body: JSON.stringify(body),
			}),

		addStreakFreezes: (body: {
			userId: string
			count: number
			reason: 'referral' | 'purchase' | 'promotion' | 'manual' | 'premium_perk'
		}) =>
			fetchJson<unknown>('/gamification/add-streak-freezes', {
				method: 'POST',
				body: JSON.stringify(body),
			}),
	},

	// ==========================================
	// User API
	// ==========================================

	user: {
		getProfile: () => fetchJson<unknown>('/user/profile'),

		updateProfile: (body: { username?: string; bio?: string; isPublicProfile?: boolean }) =>
			fetchJson<unknown>('/user/profile', {
				method: 'PUT',
				body: JSON.stringify(body),
			}),

		checkUsername: (params: { username: string }) =>
			fetchJson<{ available: boolean; username: string }>('/user/check-username', { params }),

		updatePreferences: (body: { compactMode?: boolean; leaderboardVisible?: boolean }) =>
			fetchJson<unknown>('/user/preferences', {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
	},

	// ==========================================
	// Notifications API
	// ==========================================

	notifications: {
		getPreferences: () => fetchJson<unknown>('/notifications/preferences'),

		updatePushPreferences: (body: Record<string, unknown>) =>
			fetchJson<unknown>('/notifications/push-preferences', {
				method: 'PUT',
				body: JSON.stringify(body),
			}),

		updateEmailPreferences: (body: Record<string, unknown>) =>
			fetchJson<unknown>('/notifications/email-preferences', {
				method: 'PUT',
				body: JSON.stringify(body),
			}),
	},

	// ==========================================
	// Admin API
	// ==========================================

	admin: {
		// DLQ
		getDlqList: (params?: { workflow?: string; status?: string; limit?: number; offset?: number }) =>
			fetchJson<unknown>('/admin/dlq', { params }),

		retryDlq: (body: { id: string }) =>
			fetchJson<unknown>(`/admin/dlq/${body.id}/retry`, { method: 'POST' }),

		resolveDlq: (body: { id: string }) =>
			fetchJson<unknown>(`/admin/dlq/${body.id}/resolve`, { method: 'POST' }),

		markDlqFailed: (body: { id: string }) =>
			fetchJson<unknown>(`/admin/dlq/${body.id}/mark-failed`, { method: 'POST' }),

		// Audit Logs
		getAuditLogs: (params?: Record<string, unknown>) =>
			fetchJson<unknown>('/admin/audit-logs', { params }),

		getAuditLogDetails: (params: { id: string }) =>
			fetchJson<unknown>(`/admin/audit-logs/${params.id}`),

		// Settings
		getSettings: () => fetchJson<unknown>('/admin/settings'),

		updateSetting: (body: { key: string; value: string }) =>
			fetchJson<unknown>('/admin/settings', {
				method: 'PUT',
				body: JSON.stringify(body),
			}),

		// Announcements
		getAnnouncements: () => fetchJson<unknown>('/admin/announcements'),

		createAnnouncement: (body: Record<string, unknown>) =>
			fetchJson<unknown>('/admin/announcements', {
				method: 'POST',
				body: JSON.stringify(body),
			}),

		updateAnnouncement: (body: { id: string } & Record<string, unknown>) => {
			const { id, ...data } = body
			return fetchJson<unknown>(`/admin/announcements/${id}`, {
				method: 'PUT',
				body: JSON.stringify(data),
			})
		},

		deleteAnnouncement: (body: { id: string }) =>
			fetchJson<unknown>(`/admin/announcements/${body.id}`, { method: 'DELETE' }),

		// Feature Flags
		getFeatureFlags: () => fetchJson<unknown>('/admin/feature-flags'),

		createFeatureFlag: (body: Record<string, unknown>) =>
			fetchJson<unknown>('/admin/feature-flags', {
				method: 'POST',
				body: JSON.stringify(body),
			}),

		updateFeatureFlag: (body: { key: string } & Record<string, unknown>) => {
			const { key, ...data } = body
			return fetchJson<unknown>(`/admin/feature-flags/${key}`, {
				method: 'PUT',
				body: JSON.stringify(data),
			})
		},

		deleteFeatureFlag: (body: { key: string }) =>
			fetchJson<unknown>(`/admin/feature-flags/${body.key}`, { method: 'DELETE' }),

		// Analytics
		getGamesOverview: () => fetchJson<unknown>('/admin/analytics/games-overview'),

		getGameAnalytics: (params: { slug: string; days?: number }) =>
			fetchJson<unknown>(`/admin/analytics/game/${params.slug}`, {
				params: { days: params.days },
			}),

		getRealTimeStats: () => fetchJson<unknown>('/admin/analytics/real-time'),

		getStreakAnalytics: () => fetchJson<unknown>('/admin/analytics/streaks'),

		// System
		getSystemHealth: () => fetchJson<unknown>('/admin/system/health'),
	},
}
