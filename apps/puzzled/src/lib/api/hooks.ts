'use client'

/**
 * React Query Hooks for Puzzled API
 *
 * Replaces tRPC hooks with standard React Query patterns.
 * Uses the type-safe API client for API calls.
 */

import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationOptions,
	type UseQueryOptions,
} from '@tanstack/react-query'
import { api, ApiError } from './client'

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
	featureFlags: () => ['admin', 'featureFlags'] as const,
	gamesOverview: () => ['admin', 'analytics', 'gamesOverview'] as const,
	gameAnalytics: (slug: string, days: number) =>
		['admin', 'analytics', 'game', slug, days] as const,
	systemHealth: () => ['admin', 'system', 'health'] as const,
	realTimeStats: () => ['admin', 'analytics', 'realTime'] as const,
	streakAnalytics: () => ['admin', 'analytics', 'streaks'] as const,
} as const

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
		queryFn: () => api.games.getDailyStatus({ gameSlug, difficulty }),
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
		queryFn: () => api.games.getTodaysPuzzle({ gameSlug, difficulty }),
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
		queryFn: () => api.games.getArchivePuzzle({ gameSlug, date }),
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
		queryFn: () => api.games.getHistory({ gameSlug, limit }),
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
		queryFn: () => api.games.getArchiveDates({ gameSlug, startDate, endDate }),
		...options,
	})
}

export function useValidateGuess() {
	return useMutation({
		mutationFn: api.games.validateGuess,
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
		mutationFn: api.games.saveResult,
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
		queryFn: () => api.stats.getUserStats() as Promise<UserStatsResponse>,
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
		queryFn: () => api.stats.getUserRank({ gameSlug, type, period }),
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
		queryFn: () => api.stats.getLeaderboard({ gameSlug, type, period, limit }),
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
		queryFn: () => api.stats.getTodayPercentile(params) as Promise<TodayPercentileResponse>,
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
		queryFn: api.gamification.getStreakInfo,
		...options,
	})
}

export function useTodayPlayerCount(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.todayPlayerCount(),
		queryFn: api.gamification.getTodayPlayerCount,
		staleTime: 30 * 1000, // 30 seconds
		...options,
	})
}

export function useTodayCompletions(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.todayCompletions(),
		queryFn: api.gamification.getTodayCompletions,
		...options,
	})
}

export function useToggleAutoFreeze() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.gamification.toggleAutoFreeze,
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
		queryFn: api.user.getProfile,
		...options,
	})
}

export function useCheckUsername(
	username: string,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.checkUsername(username),
		queryFn: () => api.user.checkUsername({ username }),
		enabled: username.length >= 3,
		...options,
	})
}

export function useUpdateProfile() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.user.updateProfile,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.profile() })
		},
	})
}

export function useUpdatePreferences() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.user.updatePreferences,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.profile() })
		},
	})
}

// ==========================================
// Notifications Hooks
// ==========================================

export function useNotificationPreferences(
	options?: Omit<UseQueryOptions<NotificationPreferencesResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.notificationPreferences(),
		queryFn: () => api.notifications.getPreferences() as Promise<NotificationPreferencesResponse>,
		...options,
	})
}

export function useUpdatePushPreferences() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.notifications.updatePushPreferences,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences() })
		},
	})
}

export function useUpdateEmailPreferences() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.notifications.updateEmailPreferences,
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
		queryFn: () => api.admin.getDlqList(params) as Promise<DLQListResponse>,
		...options,
	})
}

export function useDlqRetry() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.retryDlq,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] })
		},
	})
}

export function useDlqResolve() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.resolveDlq,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin', 'dlq'] })
		},
	})
}

export function useDlqMarkFailed() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.markDlqFailed,
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
		queryFn: () => api.admin.getAuditLogs(params) as Promise<AuditLogsResponse>,
		...options,
	})
}

export function useAuditLogDetails(
	id: string,
	options?: Omit<UseQueryOptions<AuditLogItem, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.auditLogDetails(id),
		queryFn: () => api.admin.getAuditLogDetails({ id }) as Promise<AuditLogItem>,
		enabled: !!id,
		...options,
	})
}

export function useSettings(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.settings(),
		queryFn: api.admin.getSettings,
		...options,
	})
}

export function useUpdateSetting() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.updateSetting,
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
		queryFn: api.admin.getAnnouncements,
		...options,
	})
}

export function useCreateAnnouncement() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.createAnnouncement,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.announcements() })
		},
	})
}

export function useUpdateAnnouncement() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.updateAnnouncement,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.announcements() })
		},
	})
}

export function useDeleteAnnouncement() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.deleteAnnouncement,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.announcements() })
		},
	})
}

export function useFeatureFlags(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.featureFlags(),
		queryFn: api.admin.getFeatureFlags,
		...options,
	})
}

export function useCreateFeatureFlag() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.createFeatureFlag,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.featureFlags() })
		},
	})
}

export function useUpdateFeatureFlag() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.updateFeatureFlag,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.featureFlags() })
		},
	})
}

export function useDeleteFeatureFlag() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: api.admin.deleteFeatureFlag,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.featureFlags() })
		},
	})
}

export function useGamesOverview(
	options?: Omit<UseQueryOptions<GameOverviewItem[], ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.gamesOverview(),
		queryFn: () => api.admin.getGamesOverview() as Promise<GameOverviewItem[]>,
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
		queryFn: () => api.admin.getGameAnalytics({ slug, days }) as Promise<GameAnalyticsResponse>,
		enabled: !!slug,
		...options,
	})
}

export function useSystemHealth(
	options?: Omit<UseQueryOptions<SystemHealthResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.systemHealth(),
		queryFn: () => api.admin.getSystemHealth() as Promise<SystemHealthResponse>,
		refetchInterval: 30 * 1000, // 30 seconds
		...options,
	})
}

export function useRealTimeStats(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.realTimeStats(),
		queryFn: api.admin.getRealTimeStats,
		refetchInterval: 10 * 1000, // 10 seconds
		...options,
	})
}

export function useStreakAnalytics(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.streakAnalytics(),
		queryFn: api.admin.getStreakAnalytics,
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
