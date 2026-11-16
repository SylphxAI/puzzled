import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import {
	explicitChallengeGame,
	isShareLandingQuery,
	parseShareId,
	resolveKnownGameSlug,
	type SharedResult,
} from '@/features/daily/lib/challenge'
import { resolveModuleDisplayName } from '@/features/daily/lib/result-share'
import { getHowToPlayConfig } from '@/games/how-to-play-registry'
import { getServerSharedResult } from '@/lib/api/server'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'

export type QueryMap = Record<string, string>

export async function firstQueryValues(
	searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<QueryMap> {
	const query: QueryMap = {}
	for (const [key, value] of Object.entries(await searchParams)) {
		const first = Array.isArray(value) ? value[0] : value
		if (first !== undefined) query[key] = first
	}
	return query
}

async function sharedForId(rawShareId: string | null | undefined) {
	const shareId = parseShareId(rawShareId)
	if (!shareId) return null
	const shared: SharedResult | null = await getServerSharedResult(shareId)
	return shared ? { shareId, shared } : null
}

/**
 * OpenGraph + page metadata for `/r/[shareId]` and `/daily?ref=<shareId>`.
 * Uses the sharer's actual game and score/attempts/streak when found; when
 * unavailable, honours any explicit game param or falls back to the neutral
 * challenge card rather than leaking a hardcoded unrelated game.
 */
export async function buildChallengeMetadata(input: {
	locale: string
	path: string
	shareId?: string | null
	query: QueryMap
	requireShareQuery?: boolean
}): Promise<Metadata> {
	const { locale, path, shareId, query, requireShareQuery = false } = input
	const t = await getTranslations({ locale, namespace: 'share.landing' })
	const found = await sharedForId(shareId ?? query.ref)
	const fallbackGame = explicitChallengeGame(query)

	if (!found && !fallbackGame && requireShareQuery && !isShareLandingQuery(query)) {
		return { title: t('metaTitle') }
	}

	const tGames = await getTranslations({ locale, namespace: 'games' })
	const tCard = await getTranslations({ locale, namespace: 'share.card' })

	if (found) {
		const gameSlug = resolveKnownGameSlug(found.shared.gameSlug) ?? found.shared.gameSlug
		const game = resolveModuleDisplayName(tGames, gameSlug)
		const statusText = found.shared.status === 'won' ? tCard('statusWon') : tCard('statusLost')
		const metricText =
			found.shared.score !== null
				? tCard('scorePoints', { score: found.shared.score })
				: found.shared.attempts !== null
					? tCard('attemptsCount', { attempts: found.shared.attempts })
					: null
		const subtitle = metricText ? `${statusText} · ${metricText}` : statusText
		return buildPageMetadata({
			locale,
			path,
			title: t('ogTitle', { game }),
			description: t('metaDescription'),
			noindex: true,
			withAlternates: false,
			imagePath: ogImagePath({
				title: t('ogTitle', { game }),
				subtitle,
				eyebrow: t('eyebrow'),
				badge: found.shared.streak ? tCard('streakDays', { days: found.shared.streak }) : undefined,
				theme: getHowToPlayConfig(gameSlug)?.display.theme,
			}),
		})
	}

	if (fallbackGame) {
		const game = resolveModuleDisplayName(tGames, fallbackGame)
		return buildPageMetadata({
			locale,
			path,
			title: t('ogTitle', { game }),
			description: t('metaDescription'),
			noindex: true,
			withAlternates: false,
			imagePath: ogImagePath({
				title: t('ogTitle', { game }),
				subtitle: t('metaDescription'),
				eyebrow: t('eyebrow'),
				theme: getHowToPlayConfig(fallbackGame)?.display.theme,
			}),
		})
	}

	return buildPageMetadata({
		locale,
		path,
		title: t('metaTitle'),
		description: t('metaDescription'),
		noindex: true,
		withAlternates: false,
		imagePath: ogImagePath({
			title: t('metaTitle'),
			subtitle: t('metaDescription'),
			eyebrow: t('eyebrow'),
		}),
	})
}

export type ResolvedShareLanding =
	| { kind: 'redirect-daily'; gameSlug: string }
	| {
			kind: 'render'
			shareId: string
			shared: SharedResult | null
			fallbackGameSlug: string | null
			utmSource?: string
	  }

/** Resolve `/daily` into either the partner daily redirect or a share landing (with unknown-share fallback). */
export async function resolveDailyShareContext(query: QueryMap): Promise<ResolvedShareLanding> {
	const fallbackGameSlug = explicitChallengeGame(query)
	if (!isShareLandingQuery(query)) {
		return { kind: 'redirect-daily', gameSlug: fallbackGameSlug ?? getTodaysFreeGame() }
	}
	const found = await sharedForId(query.ref)
	if (found) {
		return {
			kind: 'render',
			shareId: found.shareId,
			shared: found.shared,
			fallbackGameSlug,
			utmSource: query.utm_source,
		}
	}
	return {
		kind: 'render',
		shareId: query.ref?.trim() || '',
		shared: null,
		fallbackGameSlug,
		utmSource: query.utm_source,
	}
}

/** Resolve `/r/[shareId]` directly to the shared challenge or a neutral fallback landing. */
export async function resolveShareRouteContext(
	shareId: string,
	query: QueryMap,
): Promise<Extract<ResolvedShareLanding, { kind: 'render' }>> {
	const found = await sharedForId(shareId)
	const fallbackGameSlug = explicitChallengeGame(query)
	if (found) {
		return {
			kind: 'render',
			shareId: found.shareId,
			shared: found.shared,
			fallbackGameSlug,
			utmSource: query.utm_source,
		}
	}
	return {
		kind: 'render',
		shareId: shareId.trim(),
		shared: null,
		fallbackGameSlug,
		utmSource: query.utm_source,
	}
}
