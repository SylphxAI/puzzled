'use client'

/**
 * Puzzled React Query hooks - sole Connect authority (ADR-170).
 *
 * Every hook calls a generated Connect client. The Hono REST client layer is
 * deleted; there is no REST fallback and no client-computed authority.
 *
 * TD-11: this module is the public barrel; the domains live under ./hooks
 * (shared errors/keys, play, stats, preferences, admin, profile). Export
 * names and import paths are unchanged.
 */

// Kept as a fail-closed fence: no REST residual exists (sole Connect).
export { shouldUseRestPlayResidual } from '@/lib/connect/puzzle-admission'
export {
	type AuditLogEntryShape,
	type AuditLogListResponse,
	type DLQListResponse,
	type DlqEntryShape,
	type GameAnalyticsResponse,
	type GamesOverviewEntry,
	type GamesOverviewResponse,
	type SystemHealthResponse,
	useAnnouncements,
	useAuditLogDetails,
	useAuditLogs,
	useCreateAnnouncement,
	useDeleteAnnouncement,
	useDlqList,
	useDlqMarkFailed,
	useDlqResolve,
	useDlqRetry,
	useGameAnalytics,
	useGamesOverview,
	useSettings,
	useSystemHealth,
	useUpdateAnnouncement,
	useUpdateSetting,
} from './hooks/admin'
export {
	type SaveResultInput,
	type SaveResultOutput,
	useDailyStatus,
	useSaveResult,
	useTodaysPuzzle,
} from './hooks/play'
export {
	type NotificationPreferencesResponse,
	useNotificationPreferences,
	useUpdateEmailPreferences,
	useUpdatePushPreferences,
} from './hooks/preferences'
export { useCheckUsername, useProfile, useUpdateProfile } from './hooks/profile'
export { ApiError, queryKeys } from './hooks/shared'
export {
	type TodayPercentileResponse,
	type UserStatsEntry,
	type UserStatsResponse,
	useTodayPercentile,
	useUserStats,
} from './hooks/stats'
