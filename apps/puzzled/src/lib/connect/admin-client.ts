/**
 * AdminService generated client (sole Connect surface; admin scope required).
 */
import { create } from '@bufbuild/protobuf'
import { type Client, createClient } from '@connectrpc/connect'
import {
	AdminService,
	type Announcement,
	type AppSettings,
	type AuditLogEntry,
	CreateAnnouncementRequestSchema,
	type DailyStat,
	DeleteAnnouncementRequestSchema,
	type DlqEntry,
	type GamesOverviewEntry,
	GamesOverviewRequestSchema,
	GetAuditLogRequestSchema,
	GetGameAnalyticsRequestSchema,
	GetSettingsRequestSchema,
	ListAnnouncementsRequestSchema,
	ListAuditLogsRequestSchema,
	ListDlqRequestSchema,
	MarkDlqFailedRequestSchema,
	ResolveDlqRequestSchema,
	RetryDlqRequestSchema,
	SystemHealthRequestSchema,
	type SystemHealthResponse,
	UpdateAnnouncementRequestSchema,
	UpdateSettingsRequestSchema,
} from '@/gen/connect/puzzled/v1/admin_pb'
import { getConnectTransport } from './transport'

export type AdminServiceClient = Client<typeof AdminService>

export function createAdminServiceClient(baseUrl?: string): AdminServiceClient {
	return createClient(AdminService, getConnectTransport(baseUrl))
}

export async function listAnnouncements(client?: AdminServiceClient): Promise<Announcement[]> {
	const c = client ?? createAdminServiceClient()
	const res = await c.listAnnouncements(create(ListAnnouncementsRequestSchema, {}))
	return res.announcements
}

export async function createAnnouncement(
	input: { title: string; body: string; type?: string; active?: boolean },
	client?: AdminServiceClient,
): Promise<Announcement> {
	const c = client ?? createAdminServiceClient()
	const res = await c.createAnnouncement(
		create(CreateAnnouncementRequestSchema, {
			title: input.title,
			body: input.body,
			type: input.type ?? 'info',
			active: input.active ?? true,
		}),
	)
	if (!res.announcement) throw new Error('announcement_unavailable')
	return res.announcement
}

export async function updateAnnouncement(
	input: { id: string; title?: string; body?: string; type?: string; active?: boolean },
	client?: AdminServiceClient,
): Promise<Announcement> {
	const c = client ?? createAdminServiceClient()
	const res = await c.updateAnnouncement(
		create(UpdateAnnouncementRequestSchema, {
			id: input.id,
			title: input.title ?? undefined,
			body: input.body ?? undefined,
			type: input.type ?? undefined,
			active: input.active ?? undefined,
		}),
	)
	if (!res.announcement) throw new Error('announcement_unavailable')
	return res.announcement
}

export async function deleteAnnouncement(id: string, client?: AdminServiceClient): Promise<void> {
	const c = client ?? createAdminServiceClient()
	await c.deleteAnnouncement(create(DeleteAnnouncementRequestSchema, { id }))
}

export async function getSettings(client?: AdminServiceClient): Promise<AppSettings[]> {
	const c = client ?? createAdminServiceClient()
	const res = await c.getSettings(create(GetSettingsRequestSchema, {}))
	return res.settings
}

export async function updateSetting(
	key: string,
	valueJson: string,
	client?: AdminServiceClient,
): Promise<AppSettings> {
	const c = client ?? createAdminServiceClient()
	const res = await c.updateSettings(create(UpdateSettingsRequestSchema, { key, valueJson }))
	if (!res.setting) throw new Error('setting_unavailable')
	return res.setting
}

export async function listAuditLogs(
	input: { limit?: number; offset?: number; action?: string },
	client?: AdminServiceClient,
): Promise<{ entries: AuditLogEntry[]; total: number }> {
	const c = client ?? createAdminServiceClient()
	const res = await c.listAuditLogs(
		create(ListAuditLogsRequestSchema, {
			limit: input.limit ?? 50,
			offset: input.offset ?? 0,
			action: input.action ?? '',
		}),
	)
	return { entries: res.entries, total: res.total }
}

export async function getAuditLog(id: string, client?: AdminServiceClient): Promise<AuditLogEntry> {
	const c = client ?? createAdminServiceClient()
	const res = await c.getAuditLog(create(GetAuditLogRequestSchema, { id }))
	if (!res.entry) throw new Error('audit_entry_unavailable')
	return res.entry
}

export async function listDlq(
	input: { limit?: number; offset?: number },
	client?: AdminServiceClient,
): Promise<{
	entries: DlqEntry[]
	total: number
	pending: number
	retrying: number
	resolved: number
	failed: number
	byWorkflow: Record<string, number>
}> {
	const c = client ?? createAdminServiceClient()
	const res = await c.listDlq(
		create(ListDlqRequestSchema, { limit: input.limit ?? 50, offset: input.offset ?? 0 }),
	)
	return {
		entries: res.entries,
		total: res.total,
		pending: res.pending,
		retrying: res.retrying,
		resolved: res.resolved,
		failed: res.failed,
		byWorkflow: res.byWorkflow,
	}
}

export async function retryDlq(id: string, client?: AdminServiceClient): Promise<void> {
	const c = client ?? createAdminServiceClient()
	await c.retryDlq(create(RetryDlqRequestSchema, { id }))
}

export async function resolveDlq(id: string, client?: AdminServiceClient): Promise<void> {
	const c = client ?? createAdminServiceClient()
	await c.resolveDlq(create(ResolveDlqRequestSchema, { id }))
}

export async function markDlqFailed(id: string, client?: AdminServiceClient): Promise<void> {
	const c = client ?? createAdminServiceClient()
	await c.markDlqFailed(create(MarkDlqFailedRequestSchema, { id }))
}

export async function gamesOverview(client?: AdminServiceClient): Promise<GamesOverviewEntry[]> {
	const c = client ?? createAdminServiceClient()
	const res = await c.gamesOverview(create(GamesOverviewRequestSchema, {}))
	return res.games
}

export async function gameAnalytics(
	gameSlug: string,
	days: number,
	client?: AdminServiceClient,
): Promise<DailyStat[]> {
	const c = client ?? createAdminServiceClient()
	const res = await c.getGameAnalytics(create(GetGameAnalyticsRequestSchema, { gameSlug, days }))
	return res.dailyStats
}

export async function systemHealth(client?: AdminServiceClient): Promise<SystemHealthResponse> {
	const c = client ?? createAdminServiceClient()
	return c.systemHealth(create(SystemHealthRequestSchema, {}))
}
