'use client'

/**
 * Puzzled API hooks - Admin domain (sole Connect, exact admin scope).
 */

import { type UseQueryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { type ApiError, queryKeys, toApiError } from './shared'

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
	'number-path': 'Path',
	'pip-place': 'Spots',
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
