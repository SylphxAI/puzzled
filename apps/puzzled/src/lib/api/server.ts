/**
 * Server-side API helpers — sole Connect authority (ADR-170).
 *
 * Server components call the api service through the private
 * API_INTERNAL_URL (platform-injected) and forward the browser's session
 * cookie (HttpOnly `__sylphx_*_session` JWT) for identity. There is no Hono
 * REST client; the web service has no backend authority.
 */

import 'server-only'

import { create } from '@bufbuild/protobuf'
import { Code, ConnectError, createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { createActiveAnnouncementsCache } from '@/features/announcements/lib/active-cache'
import { type SharedResult, toSharedResult } from '@/features/daily/lib/challenge'
import { offerAccess } from '@/features/plus-offer/lib/plus-offer'
import { AdminService, GetSettingsRequestSchema } from '@/gen/connect/puzzled/v1/admin_pb'
import {
	AnnouncementService,
	ListActiveAnnouncementsRequestSchema,
} from '@/gen/connect/puzzled/v1/announcements_pb'
import {
	BillingService,
	GetSubscriptionRequestSchema,
	ListPlansRequestSchema,
} from '@/gen/connect/puzzled/v1/billing_pb'
import {
	GamificationService,
	GetStreakInfoRequestSchema,
} from '@/gen/connect/puzzled/v1/gamification_pb'
import {
	GetDailyRequestSchema,
	GetSharedResultRequestSchema,
	GetTodayProgressRequestSchema,
	PuzzleService,
} from '@/gen/connect/puzzled/v1/puzzle_pb'
import {
	GetHistoryRequestSchema,
	GetTodayOverviewRequestSchema,
	GetUserStatsRequestSchema,
	StatsService,
} from '@/gen/connect/puzzled/v1/stats_pb'
import { mergeServerConnectInit, SERVER_CONNECT_TIMEOUT_MS } from '@/lib/api/connect-fetch'
import {
	type DailyStatus,
	mapDailyStatus,
	mapTodayProgress,
	mapTodaysPuzzle,
	type TodaysPuzzle,
} from '@/lib/api/domain/daily'
import { isNoIdentityError } from '@/lib/api/no-identity'
import {
	OPEN_ACCESS,
	type PlusAccess,
	subscriptionView,
	trialBannerEndMs,
} from '@/lib/billing/plus'
import { getLeaderboard } from '@/lib/connect/stats-client'
import type { GetLeaderboardInput } from '@/lib/connect/stats-domain'
import { resolveServerConnectBaseUrl } from '@/lib/connect/transport'
import { SESSION_COOKIE_NAMES } from '@/lib/identity/session-cookie'
import { logger } from '@/lib/logger'
import { projectStreakInfo, type StreakInfo } from '@/lib/streak-info'

// ==========================================
// Response types (unchanged public shapes)
// ==========================================

export type { DailyStatus, StreakInfo, TodaysPuzzle }

export type UserStats = {
	[gameSlug: string]: {
		gameSlug: string
		gamesPlayed: number
		gamesWon: number
		currentStreak: number
		maxStreak: number
		totalScore: number
		averageAttempts: number | null
		guessDistribution: unknown
		perfectGames: number
	}
}

// ==========================================
// Per-request Connect transport (forwards the session cookie)
// ==========================================

async function getServerTransport() {
	const cookieStore = await cookies()
	const cookie = cookieStore
		.getAll()
		.filter(
			(cookie) =>
				cookie.name === '__Host-puzzled_guest' ||
				SESSION_COOKIE_NAMES.some((name) => name === cookie.name) ||
				(cookie.name.startsWith('__sylphx_') && cookie.name.endsWith('_session')),
		)
		.map((cookie) => `${cookie.name}=${cookie.value}`)
		.join('; ')
	// The api checks the Sylphx Auth session with Auth, which binds it to the
	// browser's User-Agent.
	const userAgent = (await headers()).get('user-agent')
	const baseUrl = resolveServerConnectBaseUrl()
	return createConnectTransport({
		baseUrl,
		useBinaryFormat: false,
		fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
			fetch(
				input,
				mergeServerConnectInit(init, cookie, SERVER_CONNECT_TIMEOUT_MS, userAgent),
			)) as typeof fetch,
	})
}

/** True when SSR can attach a guest or Platform identity to Connect reads. */
export async function hasServerProgressIdentity(): Promise<boolean> {
	const cookieStore = await cookies()
	if (cookieStore.get('__Host-puzzled_guest')?.value) return true
	return cookieStore
		.getAll()
		.some(
			(cookie) =>
				(SESSION_COOKIE_NAMES.some((name) => name === cookie.name) ||
					(cookie.name.startsWith('__sylphx_') && cookie.name.endsWith('_session'))) &&
				Boolean(cookie.value),
		)
}

/**
 * Whether the signed-in player is a Puzzled admin, as the api decides it
 * (`is_admin` on the verified identity, enforced by `require_admin` on every
 * admin RPC). The web keeps no admin check of its own: it asks the api through
 * the cheapest admin read, so the page gate and the data gate share one source.
 * Any failure reads as not admin (fail closed).
 */
export const getServerIsAdmin = cache(async (): Promise<boolean> => {
	try {
		const transport = await getServerTransport()
		await createClient(AdminService, transport).getSettings(create(GetSettingsRequestSchema, {}))
		return true
	} catch (error) {
		const denied =
			ConnectError.from(error).code === Code.PermissionDenied ||
			ConnectError.from(error).code === Code.Unauthenticated
		if (!denied) logger.warn('admin.gate-check-failed')
		return false
	}
})

// ==========================================
// Server data accessors (sole Connect)
// ==========================================

async function fetchServerDailyStatus(input: {
	gameSlug: string
	difficulty?: string
	puzzleDate?: string
}): Promise<DailyStatus> {
	const transport = await getServerTransport()
	const client = createClient(PuzzleService, transport)
	const res = await client.getDaily(
		create(GetDailyRequestSchema, {
			gameSlug: input.gameSlug.trim(),
			difficulty: (input.difficulty ?? '').trim(),
			puzzleDate: input.puzzleDate?.trim() || undefined,
		}),
	)
	return mapDailyStatus(res, input.difficulty)
}

export const getServerDailyStatus = cache(fetchServerDailyStatus)

/**
 * The result behind a share link, for the public landing. Null for an unknown
 * or unreadable share, so the landing falls back to today's puzzle.
 */
export const getServerSharedResult = cache(
	async (shareId: string): Promise<SharedResult | null> => {
		try {
			const transport = await getServerTransport()
			const client = createClient(PuzzleService, transport)
			return toSharedResult(
				await client.getSharedResult(create(GetSharedResultRequestSchema, { shareId })),
			)
		} catch (error) {
			logger.warn('share.read-failed', {
				error: error instanceof Error ? error.message : String(error),
			})
			return null
		}
	},
)

export const getServerTodaysPuzzle = cache(
	async (input: { gameSlug: string; difficulty?: string }): Promise<TodaysPuzzle> => {
		const transport = await getServerTransport()
		const client = createClient(PuzzleService, transport)
		const res = await client.getDaily(
			create(GetDailyRequestSchema, {
				gameSlug: input.gameSlug.trim(),
				difficulty: (input.difficulty ?? '').trim(),
			}),
		)
		return mapTodaysPuzzle(res, input.difficulty)
	},
)

export const getServerStreakInfo = cache(async (): Promise<StreakInfo> => {
	const transport = await getServerTransport()
	const client = createClient(GamificationService, transport)
	const res = await client.getStreakInfo(create(GetStreakInfoRequestSchema, {}))
	return projectStreakInfo(res.info)
})

export type PersonalDailyResult = {
	hasCompleted: boolean
	completedSession: DailyStatus['completedSession']
	/** False means the server could not prove this status; callers must not render Play. */
	statusAvailable: boolean
}

async function fetchTodayProgress(gameSlugs: readonly string[]) {
	const transport = await getServerTransport()
	const client = createClient(PuzzleService, transport)
	const res = await client.getTodayProgress(
		create(GetTodayProgressRequestSchema, { gameSlugs: [...gameSlugs] }),
	)
	return mapTodayProgress(res)
}

/**
 * Personal home/progress today-state in ONE batched GetTodayProgress read
 * (the server computes the product day). GetTodayOverview is a public
 * aggregate for social proof, not a user's completion state. One retry for a
 * transient failure; a missing identity is an empty state, not a failure.
 */
export async function getServerPersonalDailyResults(input: {
	gameSlugs: readonly string[]
}): Promise<Record<string, PersonalDailyResult>> {
	const gameSlugs = [...new Set(input.gameSlugs)]
	let progress: Awaited<ReturnType<typeof fetchTodayProgress>> | null = null
	let noIdentity = false
	try {
		try {
			progress = await fetchTodayProgress(gameSlugs)
		} catch (error) {
			if (isNoIdentityError(error)) throw error
			progress = await fetchTodayProgress(gameSlugs)
		}
	} catch (error) {
		// A missing or stale session/guest id is an expected empty state.
		noIdentity = isNoIdentityError(error)
		if (!noIdentity) logger.error('home.personal-result-read-failed', { error })
	}

	return Object.fromEntries(
		gameSlugs.map((gameSlug) => {
			const entry = progress?.[gameSlug]
			return [
				gameSlug,
				{
					hasCompleted: entry?.hasCompleted ?? false,
					completedSession: entry?.completedSession ?? null,
					// Unknown unless the server answered for this slug (or has no one to answer for).
					statusAvailable: noIdentity || entry !== undefined,
				},
			] as const
		}),
	)
}

export type HistoryEntry = {
	gameSlug: string
	puzzleId: string
	puzzleDate: string
	status: string
	score: number
	attempts: number
	timeSpentMs: number
	mode: string
}

export const getServerHistory = cache(
	async (input?: { gameSlug?: string; limit?: number }): Promise<HistoryEntry[]> => {
		const transport = await getServerTransport()
		const client = createClient(StatsService, transport)
		const res = await client.getHistory(
			create(GetHistoryRequestSchema, {
				gameSlug: input?.gameSlug?.trim() ?? '',
				limit: input?.limit ?? 20,
			}),
		)
		return res.sessions.map((session) => ({
			gameSlug: session.gameSlug,
			puzzleId: session.puzzleId,
			puzzleDate: session.puzzleDate,
			status: session.status,
			score: Number(session.score),
			attempts: Number(session.attempts),
			timeSpentMs: Number(session.timeSpentMs),
			mode: session.mode,
		}))
	},
)

/** Request-scoped authenticated board read; never use the browser transport in SSR. */
export const getServerLeaderboard = cache(async (input: GetLeaderboardInput) => {
	const transport = await getServerTransport()
	return getLeaderboard(input, createClient(StatsService, transport))
})

export const getServerUserStats = cache(async (): Promise<UserStats> => {
	const transport = await getServerTransport()
	const client = createClient(StatsService, transport)
	const res = await client.getUserStats(create(GetUserStatsRequestSchema, { gameSlug: '' }))
	const out: UserStats = {}
	for (const g of res.games) {
		out[g.gameSlug] = {
			gameSlug: g.gameSlug,
			gamesPlayed: Number(g.gamesPlayed),
			gamesWon: Number(g.gamesWon),
			currentStreak: 0,
			maxStreak: 0,
			totalScore: Number(g.bestScore),
			averageAttempts: null,
			guessDistribution: null,
			perfectGames: 0,
		}
	}
	return out
})

export type TodayCompletion = {
	slug: string
	name: string
	completed: boolean
	score?: string
}

export type TodayPlayerCount = {
	count: number
}

export const getServerTodayOverview = cache(
	async (): Promise<{
		playerCount: number
		completions: { gameSlug: string; count: number }[]
	}> => {
		const transport = await getServerTransport()
		const client = createClient(StatsService, transport)
		const res = await client.getTodayOverview(create(GetTodayOverviewRequestSchema, {}))
		return {
			playerCount: Number(res.playerCount),
			completions: res.completions.map((c) => ({
				gameSlug: c.gameSlug,
				count: Number(c.count),
			})),
		}
	},
)

// ==========================================
// Announcements (AnnouncementService)
// ==========================================

/**
 * The notices an admin has switched on right now, shared across requests (see
 * `active-cache`). The endpoint ignores identity, so this uses a bare
 * transport: no session or guest cookie and no user agent leave the web tier.
 */
const activeAnnouncements = createActiveAnnouncementsCache({
	fetch: async () => {
		const transport = createConnectTransport({
			baseUrl: resolveServerConnectBaseUrl(),
			useBinaryFormat: false,
			fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
				fetch(input, mergeServerConnectInit(init, '', SERVER_CONNECT_TIMEOUT_MS))) as typeof fetch,
		})
		const res = await createClient(AnnouncementService, transport).listActiveAnnouncements(
			create(ListActiveAnnouncementsRequestSchema, {}),
		)
		return res.announcements.map((a) => ({
			id: a.id,
			title: a.title,
			body: a.body,
			type: a.type,
			dismissible: a.dismissible,
			endsAt: a.endsAt,
		}))
	},
})

export const getServerActiveAnnouncements = () => activeAnnouncements.get()

// ==========================================
// Puzzled Plus (BillingService)
// ==========================================

/** The price list; guests can read it. */
export const getServerPlans = cache(async () => {
	const transport = await getServerTransport()
	return createClient(BillingService, transport).listPlans(create(ListPlansRequestSchema, {}))
})

/** The signed-in account's subscription; `refresh` is accepted for compatibility; access is Sylphx Money's answer. */
export const getServerSubscription = cache(async (refresh = false) => {
	const transport = await getServerTransport()
	return createClient(BillingService, transport).getSubscription(
		create(GetSubscriptionRequestSchema, { refresh }),
	)
})

/**
 * The end of the viewer's paid trial when it is in its last days (see
 * `trialBannerEndMs`), else null. Rides the cached subscription read; a failed
 * read shows nothing.
 */
export const getServerTrialBannerEndMs = cache(async (): Promise<number | null> => {
	try {
		const view = subscriptionView(await getServerSubscription())
		return trialBannerEndMs(view, Date.now())
	} catch (error) {
		logger.warn('plus.trial-banner-read-failed', { error })
		return null
	}
})

/**
 * Access for offers only (result card, milestone prompt). A failed read hides
 * the offer instead of selling to a member Money could not confirm; it reuses
 * the cached reads above, so it adds no calls.
 */
export const getServerPlusOfferAccess = cache(async (signedIn: boolean): Promise<PlusAccess> => {
	let subscription: PlusAccess | 'failed' = 'failed'
	let plansSalesOpen: boolean | 'failed' = 'failed'
	if (signedIn) {
		try {
			const res = await getServerSubscription()
			subscription = { salesOpen: res.salesOpen, entitled: res.entitled }
		} catch (error) {
			logger.warn('plus.offer-subscription-read-failed', { error })
		}
	} else {
		try {
			plansSalesOpen = (await getServerPlans()).salesOpen
		} catch (error) {
			logger.warn('plus.offer-plans-read-failed', { error })
		}
	}
	return offerAccess(signedIn, subscription, plansSalesOpen)
})

/**
 * Sales state and the viewer's entitlement, for choosing what a page shows.
 * A failed read shows nothing locked; Connect still refuses paid play itself.
 */
export const getServerPlusAccess = cache(async (signedIn: boolean): Promise<PlusAccess> => {
	if (signedIn) {
		try {
			const res = await getServerSubscription()
			return {
				salesOpen: res.salesOpen,
				entitled: res.entitled,
				trialEndsMs: Number(res.trialEndsMs) || null,
			}
		} catch (error) {
			logger.warn('plus.subscription-read-failed', { error })
		}
	}
	try {
		const plans = await getServerPlans()
		return { salesOpen: plans.salesOpen, entitled: false }
	} catch (error) {
		logger.warn('plus.plans-read-failed', { error })
		return OPEN_ACCESS
	}
})
