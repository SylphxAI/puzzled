'use client'

/**
 * React Query Hooks for Puzzled API
 *
 * Uses domain-specific hc clients for type-safe API calls.
 * Each hook fetches via hc then parses JSON response.
 */

import {
	type UseMutationOptions,
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query'
import {
	ApiError,
	adminApi,
	gamesApi,
	gamificationApi,
	notificationsApi,
	statsApi,
	userApi,
} from './client'

// ==========================================
// Response Types
// ==========================================

/** Today percentile response */
type TodayPercentileResponse = {
	percentile: number
	totalPlayers: number
}

/** Games overview item */
type GameOverviewItem = {
	slug: string
	name: string
	todayGamesPlayed: number
	todayWins: number
	allTimeGamesPlayed: number
	allTimeWins: number
}

/** Daily stats item */
type DailyStatsItem = {
	date: string
	gamesPlayed: number
	wins: number | null
	avgAttempts: number | null
}

/** Game analytics response */
type GameAnalyticsResponse = {
	dailyStats: DailyStatsItem[]
}

/** System health response */
type SystemHealthResponse = {
	database: boolean
	redis: boolean
	timestamp: string
}

/** Audit log item - matches schema type for components */
type AuditLogItem = {
	id: string
	action: string
	resourceType: string
	resourceId: string | null
	userId: string | null
	actorId: string | null
	ipAddress: string | null
	userAgent: string | null
	metadata: Record<string, unknown> | null
	createdAt: Date
}

/** Audit logs response */
type AuditLogsResponse = {
	logs: AuditLogItem[]
	total: number
}

/** DLQ item - matches deadLetterQueue.$inferSelect */
type DLQItem = {
	id: string
	workflowName: string
	workflowRunId: string | null
	error: string
	errorStack: string | null
	payload: Record<string, unknown> | null
	metadata: Record<string, unknown> | null
	retryCount: number
	maxRetries: number
	status: 'pending' | 'retrying' | 'resolved' | 'failed'
	lastRetryAt: Date | null
	resolvedAt: Date | null
	createdAt: Date
}

/** DLQ stats */
type DLQStats = {
	total: number
	pending: number
	retrying: number
	resolved: number
	failed: number
	byWorkflow: Record<string, number>
}

/** DLQ list response */
type DLQListResponse = {
	items: DLQItem[]
	stats?: DLQStats
}

/** User stats response - per-game stats */
type UserStatsResponse = {
	wordle?: {
		gamesPlayed: number
		gamesWon: number
		guessDistribution?: Record<string, number>
	}
	connections?: {
		gamesPlayed: number
		gamesWon: number
		perfectGames?: number
	}
	[key: string]: unknown
}

/** Notification preferences response */
type NotificationPreferencesResponse = {
	pushEnabled?: boolean
	pushDailyReminder?: boolean
	pushStreakAlert?: boolean
	pushNewGames?: boolean
	dailyReminderTime?: string
}

// ==========================================
// Query Keys
// ==========================================

export const queryKeys = {
	// Games
	games: ['games'] as const,
	dailyStatus: (gameSlug: string, difficulty?: string) =>
		['games', 'dailyStatus', gameSlug, difficulty] as const,
	todaysPuzzle: (gameSlug: string, difficulty?: string) =>
		['games', 'todaysPuzzle', gameSlug, difficulty] as const,
	archivePuzzle: (gameSlug: string, date: string) =>
		['games', 'archivePuzzle', gameSlug, date] as const,
	history: (gameSlug: string) => ['games', 'history', gameSlug] as const,
	archiveDates: (gameSlug: string, startDate: string, endDate: string) =>
		['games', 'archiveDates', gameSlug, startDate, endDate] as const,

	// Stats
	stats: ['stats'] as const,
	userStats: () => ['stats', 'userStats'] as const,
	userRank: (gameSlug: string, type: string, period: string) =>
		['stats', 'userRank', gameSlug, type, period] as const,
	leaderboard: (gameSlug: string, type: string, period: string) =>
		['stats', 'leaderboard', gameSlug, type, period] as const,
	todayPercentile: (params: {
		gameSlug: string
		status: string
		attempts?: number
		score?: number
	}) => ['stats', 'todayPercentile', params] as const,

	// Gamification
	gamification: ['gamification'] as const,
	streakInfo: () => ['gamification', 'streakInfo'] as const,
	todayPlayerCount: () => ['gamification', 'todayPlayerCount'] as const,
	todayCompletions: () => ['gamification', 'todayCompletions'] as const,

	// User
	user: ['user'] as const,
	profile: () => ['user', 'profile'] as const,
	checkUsername: (username: string) => ['user', 'checkUsername', username] as const,

	// Notifications
	notifications: ['notifications'] as const,
	notificationPreferences: () => ['notifications', 'preferences'] as const,

	// Admin
	admin: ['admin'] as const,
	dlq: (params?: { workflow?: string; status?: string }) => ['admin', 'dlq', params] as const,
	auditLogs: (params?: Record<string, unknown>) => ['admin', 'auditLogs', params] as const,
	auditLogDetails: (id: string) => ['admin', 'auditLogDetails', id] as const,
	settings: () => ['admin', 'settings'] as const,
	announcements: () => ['admin', 'announcements'] as const,
	gamesOverview: () => ['admin', 'analytics', 'gamesOverview'] as const,
	gameAnalytics: (slug: string, days: number) =>
		['admin', 'analytics', 'game', slug, days] as const,
	systemHealth: () => ['admin', 'system', 'health'] as const,
	realTimeStats: () => ['admin', 'analytics', 'realTime'] as const,
	freezeAnalytics: () => ['admin', 'analytics', 'freezes'] as const,
} as const

// ==========================================
// Helper: Parse hc response with error handling
// ==========================================

async function parseResponse<T>(response: Response): Promise<T> {
	if (!response.ok) {
		// Try to parse error response as JSON
		let errorPayload: { error?: { message?: string; code?: string } } = {
			error: { message: 'Request failed' },
		}

		try {
			const text = await response.text()
			if (text) {
				errorPayload = JSON.parse(text)
			}
		} catch (parseError) {
			// JSON parsing failed — log for debugging and include status context
			console.error(
				`[Puzzled API] Failed to parse error response (${response.status}):`,
				parseError,
			)
			errorPayload = {
				error: {
					message: `Request failed with status ${response.status}`,
					code: 'PARSE_ERROR',
				},
			}
		}

		throw new ApiError(
			response.status,
			errorPayload.error?.message ?? 'Request failed',
			errorPayload.error,
		)
	}

	// Parse successful response
	try {
		return await response.json()
	} catch (parseError) {
		// Success response JSON parsing failed — this is unexpected
		console.error('[Puzzled API] Failed to parse success response:', parseError)
		throw new ApiError(500, 'Invalid response format', {
			code: 'PARSE_ERROR',
			message: 'Server returned invalid JSON',
		})
	}
}

// ==========================================
// Games Hooks
// ==========================================

export function useDailyStatus(
	gameSlug: string,
	difficulty?: string,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.dailyStatus(gameSlug, difficulty),
		queryFn: async () => {
			const res = await gamesApi['daily-status'].$get({ query: { gameSlug, difficulty } })
			return parseResponse(res)
		},
		...options,
	})
}

export function useTodaysPuzzle(
	gameSlug: string,
	difficulty?: string,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.todaysPuzzle(gameSlug, difficulty),
		queryFn: async () => {
			const res = await gamesApi['todays-puzzle'].$get({ query: { gameSlug, difficulty } })
			return parseResponse(res)
		},
		...options,
	})
}

export function useArchivePuzzle(
	gameSlug: string,
	date: string,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.archivePuzzle(gameSlug, date),
		queryFn: async () => {
			const res = await gamesApi['archive-puzzle'].$get({ query: { gameSlug, date } })
			return parseResponse(res)
		},
		...options,
	})
}

export function useGameHistory(
	gameSlug: string,
	limit?: number,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.history(gameSlug),
		queryFn: async () => {
			const res = await gamesApi.history.$get({ query: { gameSlug, limit } })
			return parseResponse(res)
		},
		...options,
	})
}

export function useArchiveDates(
	gameSlug: string,
	startDate: string,
	endDate: string,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.archiveDates(gameSlug, startDate, endDate),
		queryFn: async () => {
			const res = await gamesApi['archive-dates'].$get({ query: { gameSlug, startDate, endDate } })
			return parseResponse(res)
		},
		...options,
	})
}

export function useValidateGuess() {
	return useMutation({
		mutationFn: async (input: { puzzleId: string; gameSlug: string; guess: unknown }) => {
			const res = await gamesApi['validate-guess'].$post({ json: input })
			return parseResponse(res)
		},
	})
}

type SaveResultInput = {
	gameSlug: string
	status: 'won' | 'lost' | 'abandoned'
	attempts: number
	timeSpentMs: number
	mode?: 'daily' | 'archive' | 'practice'
	archiveDate?: string
	puzzleId: string
	difficulty?: string
	data: unknown
}

type SaveResultOutput = {
	success: boolean
	score?: number
	session?: unknown
	mode?: string
}

export function useSaveResult(
	options?: Omit<
		UseMutationOptions<SaveResultOutput, ApiError, SaveResultInput, unknown>,
		'mutationFn' | 'onSuccess'
	> & {
		onSuccess?: (data: SaveResultOutput, variables: SaveResultInput) => void
	},
) {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: SaveResultInput) => {
			const res = await gamesApi['save-result'].$post({ json: input })
			return parseResponse<SaveResultOutput>(res)
		},
		onSuccess: (data, variables) => {
			// Invalidate related queries
			queryClient.invalidateQueries({ queryKey: queryKeys.userStats() })
			queryClient.invalidateQueries({ queryKey: queryKeys.streakInfo() })
			queryClient.invalidateQueries({ queryKey: queryKeys.todayCompletions() })
			queryClient.invalidateQueries({
				queryKey: queryKeys.dailyStatus(variables.gameSlug, variables.difficulty),
			})
			options?.onSuccess?.(data, variables)
		},
		...options,
	})
}

// ==========================================
// Stats Hooks
// ==========================================

export function useUserStats(
	options?: Omit<UseQueryOptions<UserStatsResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.userStats(),
		queryFn: async () => {
			const res = await statsApi['user-stats'].$get()
			return parseResponse<UserStatsResponse>(res)
		},
		...options,
	})
}

export function useUserRank(
	gameSlug: string,
	type: 'streak' | 'score' = 'streak',
	period: 'today' | 'week' | 'all' = 'all',
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.userRank(gameSlug, type, period),
		queryFn: async () => {
			const res = await statsApi['user-rank'].$get({ query: { gameSlug, type, period } })
			return parseResponse(res)
		},
		...options,
	})
}

export function useLeaderboard(
	gameSlug: string,
	type: 'streak' | 'score' = 'streak',
	period: 'today' | 'week' | 'all' = 'all',
	limit = 20,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.leaderboard(gameSlug, type, period),
		queryFn: async () => {
			const res = await statsApi.leaderboard.$get({ query: { gameSlug, type, period, limit } })
			return parseResponse(res)
		},
		...options,
	})
}

export function useTodayPercentile(
	params: {
		gameSlug: string
		status: 'won' | 'lost' | 'abandoned'
		attempts?: number
		score?: number
		mistakes?: number
		timeSpentMs?: number
	},
	options?: Omit<UseQueryOptions<TodayPercentileResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.todayPercentile(params),
		queryFn: async () => {
			const res = await statsApi['today-percentile'].$get({ query: params })
			return parseResponse<TodayPercentileResponse>(res)
		},
		enabled: !!params.gameSlug && !!params.status,
		...options,
	})
}

// ==========================================
// Gamification Hooks
// ==========================================

export function useStreakInfo(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.streakInfo(),
		queryFn: async () => {
			const res = await gamificationApi['streak-info'].$get()
			return parseResponse(res)
		},
		...options,
	})
}

export function useTodayPlayerCount(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.todayPlayerCount(),
		queryFn: async () => {
			const res = await gamificationApi['today-player-count'].$get()
			return parseResponse(res)
		},
		staleTime: 30 * 1000, // 30 seconds
		...options,
	})
}

export function useTodayCompletions(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.todayCompletions(),
		queryFn: async () => {
			const res = await gamificationApi['today-completions'].$get()
			return parseResponse(res)
		},
		...options,
	})
}

export function useToggleAutoFreeze() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { enabled: boolean }) => {
			const res = await gamificationApi['toggle-auto-freeze'].$post({ json: input })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.streakInfo() })
		},
	})
}

// ==========================================
// User Hooks
// ==========================================

export function useProfile(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.profile(),
		queryFn: async () => {
			const res = await userApi.profile.$get()
			return parseResponse(res)
		},
		...options,
	})
}

export function useCheckUsername(
	username: string,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.checkUsername(username),
		queryFn: async () => {
			const res = await userApi['check-username'].$get({ query: { username } })
			return parseResponse(res)
		},
		enabled: username.length >= 3,
		...options,
	})
}

export function useUpdateProfile() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { username?: string; bio?: string; isPublicProfile?: boolean }) => {
			const res = await userApi.profile.$put({ json: input })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.profile() })
		},
	})
}

export function useUpdatePreferences() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { compactMode?: boolean; leaderboardVisible?: boolean }) => {
			const res = await userApi.preferences.$put({ json: input })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.profile() })
		},
	})
}

// ==========================================
// Notifications Hooks
// ==========================================

export function useNotificationPreferences(
	options?: Omit<
		UseQueryOptions<NotificationPreferencesResponse, ApiError>,
		'queryKey' | 'queryFn'
	>,
) {
	return useQuery({
		queryKey: queryKeys.notificationPreferences(),
		queryFn: async () => {
			const res = await notificationsApi.preferences.$get()
			return parseResponse<NotificationPreferencesResponse>(res)
		},
		...options,
	})
}

export function useUpdatePushPreferences() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: Record<string, unknown>) => {
			const res = await notificationsApi['push-preferences'].$put({ json: input })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences() })
		},
	})
}

export function useUpdateEmailPreferences() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: Record<string, unknown>) => {
			const res = await notificationsApi['email-preferences'].$put({ json: input })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences() })
		},
	})
}

// ==========================================
// Admin Hooks
// ==========================================

export function useDlqList(
	params?: { workflow?: string; status?: string; limit?: number; offset?: number },
	options?: Omit<UseQueryOptions<DLQListResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.dlq(params),
		queryFn: async () => {
			const res = await adminApi.dlq.$get({ query: params ?? {} })
			return parseResponse<DLQListResponse>(res)
		},
		...options,
	})
}

export function useDlqRetry() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { id: string }) => {
			const res = await adminApi.dlq[':id'].retry.$post({ param: { id: input.id } })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] })
		},
	})
}

export function useDlqResolve() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { id: string }) => {
			const res = await adminApi.dlq[':id'].resolve.$post({ param: { id: input.id } })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] })
		},
	})
}

export function useDlqMarkFailed() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { id: string }) => {
			const res = await adminApi.dlq[':id']['mark-failed'].$post({ param: { id: input.id } })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] })
		},
	})
}

export function useAuditLogs(
	params?: Record<string, unknown>,
	options?: Omit<UseQueryOptions<AuditLogsResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.auditLogs(params),
		queryFn: async () => {
			const res = await adminApi['audit-logs'].$get({ query: params ?? {} })
			return parseResponse<AuditLogsResponse>(res)
		},
		...options,
	})
}

export function useAuditLogDetails(
	id: string,
	options?: Omit<UseQueryOptions<AuditLogItem, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.auditLogDetails(id),
		queryFn: async () => {
			const res = await adminApi['audit-logs'][':id'].$get({ param: { id } })
			return parseResponse<AuditLogItem>(res)
		},
		enabled: !!id,
		...options,
	})
}

export function useSettings(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.settings(),
		queryFn: async () => {
			const res = await adminApi.settings.$get()
			return parseResponse(res)
		},
		...options,
	})
}

export function useUpdateSetting() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { key: string; value: string }) => {
			const res = await adminApi.settings.$put({ json: input })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.settings() })
		},
	})
}

export function useAnnouncements(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.announcements(),
		queryFn: async () => {
			const res = await adminApi.announcements.$get()
			return parseResponse(res)
		},
		...options,
	})
}

export function useCreateAnnouncement() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: Record<string, unknown>) => {
			const res = await adminApi.announcements.$post({ json: input })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.announcements() })
		},
	})
}

export function useUpdateAnnouncement() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { id: string } & Record<string, unknown>) => {
			const { id, ...data } = input
			// Route accepts body but hc doesn't infer it - use fetch directly
			const res = await fetch(`/api/v1/admin/announcements/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
				credentials: 'include',
			})
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.announcements() })
		},
	})
}

export function useDeleteAnnouncement() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: { id: string }) => {
			const res = await adminApi.announcements[':id'].$delete({ param: { id: input.id } })
			return parseResponse(res)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.announcements() })
		},
	})
}

// NOTE: Feature flags now managed via Platform Console (Sylphx Platform)
// Use Platform SDK useFeatureFlags() hook instead of local admin hooks

export function useGamesOverview(
	options?: Omit<UseQueryOptions<GameOverviewItem[], ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.gamesOverview(),
		queryFn: async () => {
			const res = await adminApi.analytics['games-overview'].$get()
			return parseResponse<GameOverviewItem[]>(res)
		},
		...options,
	})
}

export function useGameAnalytics(
	slug: string,
	days = 30,
	options?: Omit<UseQueryOptions<GameAnalyticsResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.gameAnalytics(slug, days),
		queryFn: async () => {
			// Route accepts query params but hc doesn't infer it - use fetch directly
			const res = await fetch(`/api/v1/admin/analytics/game/${slug}?days=${days}`, {
				credentials: 'include',
			})
			return parseResponse<GameAnalyticsResponse>(res)
		},
		enabled: !!slug,
		...options,
	})
}

export function useSystemHealth(
	options?: Omit<UseQueryOptions<SystemHealthResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.systemHealth(),
		queryFn: async () => {
			const res = await adminApi.system.health.$get()
			return parseResponse<SystemHealthResponse>(res)
		},
		refetchInterval: 30 * 1000, // 30 seconds
		...options,
	})
}

export function useRealTimeStats(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.realTimeStats(),
		queryFn: async () => {
			const res = await adminApi.analytics['real-time'].$get()
			return parseResponse(res)
		},
		refetchInterval: 10 * 1000, // 10 seconds
		...options,
	})
}

export function useFreezeAnalytics(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.freezeAnalytics(),
		queryFn: async () => {
			const res = await adminApi.analytics.freezes.$get()
			return parseResponse(res)
		},
		...options,
	})
}

// ==========================================
// Utility Hook for Query Invalidation
// ==========================================

/**
 * Hook to access query utilities for manual cache operations
 * Replacement for trpc.useUtils()
 */
export function useApiUtils() {
	const queryClient = useQueryClient()

	return {
		stats: {
			getUserStats: {
				invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.userStats() }),
			},
		},
		gamification: {
			getStreakInfo: {
				invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.streakInfo() }),
			},
			getTodayCompletions: {
				invalidate: () => queryClient.invalidateQueries({ queryKey: queryKeys.todayCompletions() }),
			},
		},
		games: {
			getDailyStatus: {
				invalidate: (params?: { gameSlug?: string; difficulty?: string }) =>
					queryClient.invalidateQueries({
						queryKey: params?.gameSlug
							? queryKeys.dailyStatus(params.gameSlug, params.difficulty)
							: ['games', 'dailyStatus'],
					}),
			},
		},
	}
}
