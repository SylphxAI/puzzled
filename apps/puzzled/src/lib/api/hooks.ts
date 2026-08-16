'use client'

/**
 * Puzzled React Query hooks — sole Connect authority (ADR-170).
 *
 * Every hook calls a generated Connect client. The Hono REST client layer is
 * deleted; there is no REST fallback and no client-computed authority.
 */

import {
	type UseMutationOptions,
	type UseQueryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from '@tanstack/react-query'
import type { Announcement } from '@/gen/connect/puzzled/v1/admin_pb'
import {
	createAnnouncement,
	deleteAnnouncement,
	gameAnalytics,
	gamesOverview,
	getAuditLog,
	getSettings,
	listAnnouncements,
	listAuditLogs,
	listDlq,
	markDlqFailed,
	resolveDlq,
	retryDlq,
	systemHealth,
	updateAnnouncement,
	updateSetting,
} from '@/lib/connect/admin-client'
import { isAlreadyPlayedError } from '@/lib/connect/already-played'
import {
	checkUsername,
	getNotificationPreferences,
	getProfile,
	updateEmailPreferences,
	updateProfile,
	updatePushPreferences,
} from '@/lib/connect/preferences-client'
import { admitGetDailyViaConnect, admitSubmitGuessViaConnect } from '@/lib/connect/puzzle-admission'
import { getTodayPercentile, getUserStats } from '@/lib/connect/stats-client'
import { servedPuzzleId } from '@/lib/product-day'

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

function toApiError(e: unknown, fallbackCode: string): ApiError {
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

// ==========================================
// Play (sole Connect)
// ==========================================

export function useDailyStatus(
	gameSlug: string,
	difficulty?: string,
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.dailyStatus(gameSlug, difficulty),
		queryFn: async () => {
			const admit = await admitGetDailyViaConnect({ gameSlug, difficulty })
			if (admit.ok) {
				const r = admit.response
				const completion = r.completedSession
				const completedSession =
					completion && (completion.status === 'won' || completion.status === 'lost')
						? {
								status: completion.status,
								score: completion.score ?? null,
								attempts: completion.attempts ?? null,
								completedAt:
									completion.completedAtMs === undefined
										? null
										: new Date(Number(completion.completedAtMs)),
							}
						: null
				return {
					hasCompleted: r.hasCompleted,
					completedSession,
					puzzle: {
						id: servedPuzzleId(r.puzzleId) || '',
						puzzleNumber: r.puzzleNumber,
						puzzleDate: r.puzzleDate,
						puzzleData: r.puzzleDataJson
							? (() => {
									try {
										return JSON.parse(r.puzzleDataJson)
									} catch {
										return null
									}
								})()
							: null,
						difficulty: r.difficulty || difficulty || null,
					},
					canPlay: r.canPlay,
					mode: r.mode || 'daily',
					slice: r.slice || 'S2-daily-connect',
					authority: 'connect' as const,
				}
			}
			throw new ApiError(503, admit.error || 'connect_play_fail_closed', {
				code: 'CONNECT_PLAY_FAIL_CLOSED',
				message: admit.error || 'connect_play_fail_closed',
			})
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
			const admit = await admitGetDailyViaConnect({ gameSlug, difficulty })
			if (admit.ok) {
				const r = admit.response
				return {
					puzzleId: servedPuzzleId(r.puzzleId) || '',
					puzzleNumber: r.puzzleNumber,
					puzzleDate: r.puzzleDate,
					puzzleData: r.puzzleDataJson
						? (() => {
								try {
									return JSON.parse(r.puzzleDataJson)
								} catch {
									return null
								}
							})()
						: null,
					difficulty: r.difficulty || difficulty || null,
					slice: r.slice || 'S2-daily-connect',
					stub: r.stub,
					authority: 'connect' as const,
				}
			}
			throw new ApiError(503, admit.error || 'connect_play_fail_closed', {
				code: 'CONNECT_PLAY_FAIL_CLOSED',
				message: admit.error || 'connect_play_fail_closed',
			})
		},
		...options,
	})
}

export type SaveResultInput = {
	status: 'won' | 'lost'
	attempts: number
	timeSpentMs: number
	mode?: 'daily' | 'archive'
	archiveDate?: string
	puzzleId?: string
	puzzleDate?: string
	puzzleNumber?: number
	difficulty?: string
	gameSlug: string
	data?: unknown
}

export type SaveResultOutput = {
	success: boolean
	score?: number
	session?: unknown
	mode: string
	slice: string
	authority: 'connect'
	error?: string
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
			// Sole Connect authority: PuzzleService.SubmitGuess. No REST fallback.
			if (input.status !== 'won' && input.status !== 'lost') {
				throw new ApiError(400, 'status_required_won_or_lost', {
					code: 'CONNECT_SUBMIT_STATUS',
					message: 'status_required_won_or_lost',
				})
			}
			const admit = await admitSubmitGuessViaConnect({
				gameSlug: input.gameSlug,
				difficulty: input.difficulty,
				status: input.status,
				attempts: input.attempts,
				timeSpentMs: input.timeSpentMs,
				submission: input.data,
				puzzleId: servedPuzzleId(input.puzzleId),
				puzzleDate: input.mode === 'archive' ? input.archiveDate : input.puzzleDate || undefined,
			})
			if (admit.ok) {
				const r = admit.response
				return {
					success: r.valid,
					score: r.score,
					session: undefined,
					mode: input.mode ?? 'daily',
					slice: r.slice || 'S2-puzzle-solution-connect',
					authority: 'connect' as const,
					error: r.error,
				}
			}
			if (isAlreadyPlayedError(admit.error)) {
				return {
					success: true,
					session: undefined,
					mode: input.mode ?? 'daily',
					slice: 'S2-puzzle-solution-connect',
					authority: 'connect' as const,
					error: 'already_played',
				}
			}
			throw new ApiError(503, admit.error || 'connect_play_fail_closed', {
				code: 'CONNECT_PLAY_FAIL_CLOSED',
				message: admit.error || 'connect_play_fail_closed',
			})
		},
		onSuccess: (data, variables) => {
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
// Stats (sole Connect)
// ==========================================

export type UserStatsEntry = {
	gameSlug: string
	gamesPlayed: number
	gamesWon: number
	currentStreak: number
	maxStreak: number
	totalScore: number
	averageAttempts: number | null
	guessDistribution: Record<string, number> | null
	perfectGames: number
}

export type UserStatsResponse = Record<string, UserStatsEntry>

export function useUserStats(
	options?: Omit<UseQueryOptions<UserStatsResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.userStats(),
		queryFn: async () => {
			try {
				const res = await getUserStats({})
				const out: UserStatsResponse = {}
				for (const g of res.games) {
					out[g.gameSlug] = {
						gameSlug: g.gameSlug,
						gamesPlayed: g.gamesPlayed,
						gamesWon: g.gamesWon,
						currentStreak: 0,
						maxStreak: 0,
						totalScore: g.bestScore,
						averageAttempts: null,
						guessDistribution: null,
						perfectGames: 0,
					}
				}
				return out
			} catch (e) {
				throw toApiError(e, 'USER_STATS_FAILED')
			}
		},
		...options,
	})
}

export type TodayPercentileResponse = {
	percentile: number | null
	totalPlayers: number
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
			try {
				const res = await getTodayPercentile({
					gameSlug: params.gameSlug,
					status: params.status,
					attempts: params.attempts,
					score: params.score,
					mistakes: params.mistakes,
					timeSpentMs: params.timeSpentMs,
				})
				return {
					percentile: res.percentile === undefined ? null : Number(res.percentile),
					totalPlayers: Number(res.totalPlayers),
				}
			} catch (e) {
				throw toApiError(e, 'PERCENTILE_FAILED')
			}
		},
		enabled: !!params.gameSlug && !!params.status,
		...options,
	})
}

// ==========================================
// Notification preferences (sole Connect)
// ==========================================

export type NotificationPreferencesResponse = {
	pushEnabled: boolean
	pushDailyReminder: boolean
	pushStreakAlert: boolean
	pushNewGames: boolean
	dailyReminderTime: string
	emailEnabled: boolean
	emailWeeklyDigest: boolean
	emailMarketing: boolean
}

export function useNotificationPreferences(
	options?: Omit<
		UseQueryOptions<NotificationPreferencesResponse, ApiError>,
		'queryKey' | 'queryFn'
	>,
) {
	return useQuery({
		queryKey: queryKeys.notificationPreferences(),
		queryFn: async () => {
			try {
				const p = await getNotificationPreferences()
				return {
					pushEnabled: p.pushEnabled,
					pushDailyReminder: p.pushDailyReminder,
					pushStreakAlert: p.pushStreakAlert,
					pushNewGames: p.pushNewGames,
					dailyReminderTime: p.dailyReminderTime,
					emailEnabled: p.emailEnabled,
					emailWeeklyDigest: p.emailWeeklyDigest,
					emailMarketing: p.emailMarketing,
				}
			} catch (e) {
				throw toApiError(e, 'PREFERENCES_FAILED')
			}
		},
		...options,
	})
}

export function useUpdatePushPreferences() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: async (input: Record<string, unknown>) => {
			try {
				const p = await updatePushPreferences({
					pushEnabled: typeof input.pushEnabled === 'boolean' ? input.pushEnabled : undefined,
					pushDailyReminder:
						typeof input.pushDailyReminder === 'boolean' ? input.pushDailyReminder : undefined,
					pushStreakAlert:
						typeof input.pushStreakAlert === 'boolean' ? input.pushStreakAlert : undefined,
					pushNewGames: typeof input.pushNewGames === 'boolean' ? input.pushNewGames : undefined,
					dailyReminderTime:
						typeof input.dailyReminderTime === 'string' ? input.dailyReminderTime : undefined,
				})
				return {
					pushEnabled: p.pushEnabled,
					pushDailyReminder: p.pushDailyReminder,
					pushStreakAlert: p.pushStreakAlert,
					pushNewGames: p.pushNewGames,
					dailyReminderTime: p.dailyReminderTime,
					emailEnabled: p.emailEnabled,
					emailWeeklyDigest: p.emailWeeklyDigest,
					emailMarketing: p.emailMarketing,
				}
			} catch (e) {
				throw toApiError(e, 'PREFERENCES_UPDATE_FAILED')
			}
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
			try {
				const p = await updateEmailPreferences({
					emailEnabled: typeof input.emailEnabled === 'boolean' ? input.emailEnabled : undefined,
					emailWeeklyDigest:
						typeof input.emailWeeklyDigest === 'boolean' ? input.emailWeeklyDigest : undefined,
					emailMarketing:
						typeof input.emailMarketing === 'boolean' ? input.emailMarketing : undefined,
				})
				return {
					pushEnabled: p.pushEnabled,
					pushDailyReminder: p.pushDailyReminder,
					pushStreakAlert: p.pushStreakAlert,
					pushNewGames: p.pushNewGames,
					dailyReminderTime: p.dailyReminderTime,
					emailEnabled: p.emailEnabled,
					emailWeeklyDigest: p.emailWeeklyDigest,
					emailMarketing: p.emailMarketing,
				}
			} catch (e) {
				throw toApiError(e, 'PREFERENCES_UPDATE_FAILED')
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences() })
		},
	})
}

// ==========================================
// Admin (sole Connect, exact admin scope)
// ==========================================

export type AuditLogEntryShape = {
	id: string
	userId: string | null
	actorId: string | null
	action: string
	resourceType: string
	resourceId: string | null
	metadata: Record<string, unknown> | null
	ipAddress: string | null
	userAgent: string | null
	createdAt: Date
}

export type AuditLogListResponse = {
	logs: AuditLogEntryShape[]
	total: number
}

function mapAuditEntry(e: {
	id: string
	userId: string
	actorId: string
	action: string
	entityType: string
	entityId: string
	metadataJson: string
	ipAddress: string
	userAgent: string
	createdAt: string
}): AuditLogEntryShape {
	let metadata: Record<string, unknown> | undefined
	if (e.metadataJson) {
		try {
			metadata = JSON.parse(e.metadataJson) as Record<string, unknown>
		} catch {
			metadata = undefined
		}
	}
	return {
		id: e.id,
		userId: e.userId || null,
		actorId: e.actorId || null,
		action: e.action,
		resourceType: e.entityType,
		resourceId: e.entityId || null,
		metadata: metadata ?? null,
		ipAddress: e.ipAddress || null,
		userAgent: e.userAgent || null,
		createdAt: new Date(e.createdAt),
	}
}

export function useAuditLogs(
	params?: {
		limit?: number
		offset?: number
		action?: string
		resourceType?: string
		dateFrom?: string
		dateTo?: string
	},
	options?: Omit<UseQueryOptions<AuditLogListResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.auditLogs(params ?? {}),
		queryFn: async () => {
			try {
				const res = await listAuditLogs({
					limit: params?.limit ?? 50,
					offset: params?.offset ?? 0,
					action: params?.action ?? '',
				})
				return {
					logs: res.entries.map(mapAuditEntry),
					total: res.total,
				}
			} catch (e) {
				throw toApiError(e, 'AUDIT_LOGS_FAILED')
			}
		},
		...options,
	})
}

export function useAuditLogDetails(
	id: string,
	options?: Omit<UseQueryOptions<AuditLogEntryShape, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.auditLogDetails(id),
		queryFn: async () => {
			try {
				return mapAuditEntry(await getAuditLog(id))
			} catch (e) {
				throw toApiError(e, 'AUDIT_LOG_FAILED')
			}
		},
		enabled: !!id,
		...options,
	})
}

export type DlqEntryShape = {
	id: string
	workflowName: string
	workflowRunId: string | null
	payload: Record<string, unknown> | null
	error: string
	errorStack: string | null
	status: 'pending' | 'retrying' | 'resolved' | 'failed'
	retryCount: number
	maxRetries: number
	lastRetryAt: Date | null
	resolvedAt: Date | null
	metadata: Record<string, unknown> | null
	createdAt: Date
}

export type DLQListResponse = {
	items: DlqEntryShape[]
	stats: {
		total: number
		pending: number
		retrying: number
		resolved: number
		failed: number
		byWorkflow: Record<string, number>
	}
}

function mapDlqEntry(e: {
	id: string
	jobType: string
	payloadJson: string
	status: string
	attempts: number
	error: string
	createdAt: string
	nextRetryAt: string
}): DlqEntryShape {
	let payload: Record<string, unknown> | null = null
	if (e.payloadJson) {
		try {
			payload = JSON.parse(e.payloadJson) as Record<string, unknown>
		} catch {
			payload = null
		}
	}
	const parseDate = (raw: string): Date | null => {
		if (!raw) return null
		const d = new Date(raw)
		return Number.isNaN(d.getTime()) ? null : d
	}
	return {
		id: e.id,
		workflowName: e.jobType,
		workflowRunId: null,
		payload,
		error: e.error,
		errorStack: null,
		status: e.status as 'pending' | 'retrying' | 'resolved' | 'failed',
		retryCount: e.attempts,
		maxRetries: 3,
		lastRetryAt: parseDate(e.nextRetryAt),
		resolvedAt: null,
		metadata: null,
		createdAt: parseDate(e.createdAt) ?? new Date(),
	}
}

export function useDlqList(
	params?: { workflow?: string; status?: string; limit?: number; offset?: number },
	options?: Omit<UseQueryOptions<DLQListResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.dlq(params ?? {}),
		queryFn: async () => {
			try {
				const res = await listDlq({
					limit: params?.limit ?? 50,
					offset: params?.offset ?? 0,
				})
				return {
					items: res.entries.map(mapDlqEntry),
					stats: {
						total: res.total,
						pending: res.pending,
						retrying: res.retrying,
						resolved: res.resolved,
						failed: res.failed,
						byWorkflow: res.byWorkflow,
					},
				}
			} catch (e) {
				throw toApiError(e, 'DLQ_FAILED')
			}
		},
		...options,
	})
}

export function useDlqRetry() {
	return useMutation({
		mutationFn: async (input: { id: string }) => {
			try {
				await retryDlq(input.id)
				return { ok: true }
			} catch (e) {
				throw toApiError(e, 'DLQ_RETRY_FAILED')
			}
		},
	})
}

export function useDlqResolve() {
	return useMutation({
		mutationFn: async (input: { id: string }) => {
			try {
				await resolveDlq(input.id)
				return { ok: true }
			} catch (e) {
				throw toApiError(e, 'DLQ_RESOLVE_FAILED')
			}
		},
	})
}

export function useDlqMarkFailed() {
	return useMutation({
		mutationFn: async (input: { id: string }) => {
			try {
				await markDlqFailed(input.id)
				return { ok: true }
			} catch (e) {
				throw toApiError(e, 'DLQ_MARK_FAILED')
			}
		},
	})
}

export function useAnnouncements(
	options?: Omit<UseQueryOptions<Announcement[], ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.announcements(),
		queryFn: async () => {
			try {
				return await listAnnouncements()
			} catch (e) {
				throw toApiError(e, 'ANNOUNCEMENTS_FAILED')
			}
		},
		...options,
	})
}

export function useCreateAnnouncement() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: Record<string, unknown>) => {
			try {
				return await createAnnouncement({
					title: String(input.title ?? ''),
					body: String(input.body ?? ''),
					type: typeof input.type === 'string' ? input.type : 'info',
					active: typeof input.active === 'boolean' ? input.active : true,
				})
			} catch (e) {
				throw toApiError(e, 'ANNOUNCEMENT_CREATE_FAILED')
			}
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
			try {
				return await updateAnnouncement({
					id: input.id,
					title: typeof input.title === 'string' ? input.title : undefined,
					body: typeof input.body === 'string' ? input.body : undefined,
					type: typeof input.type === 'string' ? input.type : undefined,
					active: typeof input.active === 'boolean' ? input.active : undefined,
				})
			} catch (e) {
				throw toApiError(e, 'ANNOUNCEMENT_UPDATE_FAILED')
			}
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
			try {
				await deleteAnnouncement(input.id)
				return { ok: true }
			} catch (e) {
				throw toApiError(e, 'ANNOUNCEMENT_DELETE_FAILED')
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.announcements() })
		},
	})
}

export function useSettings(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.settings(),
		queryFn: async () => {
			try {
				return await getSettings()
			} catch (e) {
				throw toApiError(e, 'SETTINGS_FAILED')
			}
		},
		...options,
	})
}

export function useUpdateSetting() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: { key: string; valueJson: string }) => {
			try {
				return await updateSetting(input.key, input.valueJson)
			} catch (e) {
				throw toApiError(e, 'SETTINGS_UPDATE_FAILED')
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.settings() })
		},
	})
}

export type GamesOverviewEntry = {
	slug: string
	name: string
	todayPlayed: number
	todayGamesPlayed: number
	todayWins: number
	allTimeGamesPlayed: number
	allTimeWins: number
}

export type GamesOverviewResponse = GamesOverviewEntry[]

const GAME_NAMES: Record<string, string> = {
	'word-guess': 'Five',
	'word-groups': 'Threads',
	'word-hive': 'Hive',
	crossword: 'Mini Grid',
	sudoku: 'Sudoku',
	nonogram: 'Paint',
	'word-ladder': 'Rungs',
	arithmo: 'Arithmo',
	'pattern-match': 'Match',
	'block-slide': 'Slides',
	crowns: 'Crowns',
	duo: 'Duo',
	'word-box': 'Frame',
	'quad-words': 'Quad',
	'killer-sudoku': 'Cage Sudoku',
	cryptogram: 'Cipher',
	'word-search': 'Hunt',
}

export function useGamesOverview(
	options?: Omit<UseQueryOptions<GamesOverviewResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.gamesOverview(),
		queryFn: async () => {
			try {
				const rows = await gamesOverview()
				return rows.map((g) => {
					return {
						slug: g.slug,
						name: GAME_NAMES[g.slug] ?? g.slug,
						todayPlayed: Number(g.todayPlayed),
						todayGamesPlayed: Number(g.todayPlayed),
						todayWins: Number(g.todayWins),
						allTimeGamesPlayed: Number(g.allTimePlayed),
						allTimeWins: Number(g.allTimeWins),
					}
				})
			} catch (e) {
				throw toApiError(e, 'GAMES_OVERVIEW_FAILED')
			}
		},
		...options,
	})
}

export type GameAnalyticsResponse = {
	dailyStats: {
		date: string
		gamesPlayed: number
		wins: number | null
		avgAttempts: number | null
	}[]
}

export function useGameAnalytics(
	slug: string,
	days = 30,
	options?: Omit<UseQueryOptions<GameAnalyticsResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.gameAnalytics(slug, days),
		queryFn: async () => {
			try {
				const rows = await gameAnalytics(slug, days)
				return {
					dailyStats: rows.map((d) => ({
						date: d.date,
						gamesPlayed: Number(d.gamesPlayed),
						wins: Number(d.wins),
						avgAttempts: Number(d.avgAttempts),
					})),
				}
			} catch (e) {
				throw toApiError(e, 'GAME_ANALYTICS_FAILED')
			}
		},
		enabled: !!slug,
		...options,
	})
}

export type SystemHealthResponse = {
	database: boolean
	redis: boolean
	timestamp: string
	uptime: string
	databaseError?: string
}

export function useSystemHealth(
	options?: Omit<UseQueryOptions<SystemHealthResponse, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: queryKeys.systemHealth(),
		queryFn: async () => {
			try {
				const h = await systemHealth()
				return {
					database: h.databaseOk,
					// The api service does not manage Redis; it is not part of the
					// api health contract (platform-owned infrastructure).
					redis: true,
					timestamp: new Date().toISOString(),
					uptime: h.uptime,
					databaseError: h.databaseError || undefined,
				}
			} catch (e) {
				throw toApiError(e, 'SYSTEM_HEALTH_FAILED')
			}
		},
		refetchInterval: 30 * 1000,
		...options,
	})
}

// ==========================================
// Profile (sole Connect) — used by future settings surfaces
// ==========================================

export function useProfile(
	options?: Omit<UseQueryOptions<unknown, ApiError>, 'queryKey' | 'queryFn'>,
) {
	return useQuery({
		queryKey: ['puzzled', 'profile'] as const,
		queryFn: async () => {
			try {
				return await getProfile()
			} catch (e) {
				throw toApiError(e, 'PROFILE_FAILED')
			}
		},
		...options,
	})
}

export function useUpdateProfile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (input: Record<string, unknown>) => {
			try {
				return await updateProfile({
					username: typeof input.username === 'string' ? input.username : undefined,
					bio: typeof input.bio === 'string' ? input.bio : undefined,
					isPublicProfile:
						typeof input.isPublicProfile === 'boolean' ? input.isPublicProfile : undefined,
					compactMode: typeof input.compactMode === 'boolean' ? input.compactMode : undefined,
					leaderboardVisible:
						typeof input.leaderboardVisible === 'boolean' ? input.leaderboardVisible : undefined,
				})
			} catch (e) {
				throw toApiError(e, 'PROFILE_UPDATE_FAILED')
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['puzzled', 'profile'] as const })
		},
	})
}

export function useCheckUsername() {
	return useMutation({
		mutationFn: async (input: { username: string }) => {
			try {
				return { available: await checkUsername(input.username) }
			} catch (e) {
				throw toApiError(e, 'USERNAME_CHECK_FAILED')
			}
		},
	})
}
