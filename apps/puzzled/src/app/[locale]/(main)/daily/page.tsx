import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SharedResultLanding } from '@/features/daily/components/shared-result-landing'
import { parseShareId, type SharedResult } from '@/features/daily/lib/challenge'
import { resolveModuleDisplayName } from '@/features/daily/lib/result-share'
import { getHowToPlayConfig } from '@/games/how-to-play-registry'
import { getServerSharedResult } from '@/lib/api/server'
import { getTodaysFreeGame } from '@/lib/free-rotation'
import { redirect } from '@/lib/i18n/routing'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function firstValues(searchParams: Props['searchParams']): Promise<Record<string, string>> {
	const query: Record<string, string> = {}
	for (const [key, value] of Object.entries(await searchParams)) {
		const first = Array.isArray(value) ? value[0] : value
		if (first !== undefined) query[key] = first
	}
	return query
}

/** The shared result a `?ref=` names, or null when there is none to show. */
async function sharedFor(query: Record<string, string>) {
	const shareId = parseShareId(query.ref)
	if (!shareId) return null
	const shared: SharedResult | null = await getServerSharedResult(shareId)
	return shared ? { shareId, shared } : null
}

/**
 * A share link's card: the sharer's game and day on the brand card, never a
 * name or a solution. Not indexed: it is one person's result.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
	const { locale } = await params
	const found = await sharedFor(await firstValues(searchParams))
	const t = await getTranslations({ locale, namespace: 'share.landing' })
	if (!found) return { title: t('metaTitle') }
	const tGames = await getTranslations({ locale, namespace: 'games' })
	const tCard = await getTranslations({ locale, namespace: 'share.card' })
	const game = resolveModuleDisplayName(tGames, found.shared.gameSlug)
	return buildPageMetadata({
		locale,
		path: '/daily',
		title: t('ogTitle', { game }),
		description: t('metaDescription'),
		noindex: true,
		withAlternates: false,
		imagePath: ogImagePath({
			title: game,
			subtitle: found.shared.status === 'won' ? tCard('statusWon') : tCard('statusLost'),
			eyebrow: t('eyebrow'),
			theme: getHowToPlayConfig(found.shared.gameSlug)?.display.theme,
		}),
	})
}

/**
 * `/daily`: today's free puzzle. Links from other products (Tryit) land here;
 * the query string (campaign tags) is kept so the landing can be attributed.
 * A share link (`?ref=<share id>`) lands on the sharer's result instead, with
 * today's puzzle one tap away; its `ref` is the attribution tag.
 */
export default async function DailyPage({ params, searchParams }: Props) {
	const { locale } = await params
	setRequestLocale(locale)
	const query = await firstValues(searchParams)
	const found = await sharedFor(query)
	if (found) return <SharedResultLanding {...found} locale={locale} />
	redirect({ href: { pathname: `/games/${getTodaysFreeGame()}`, query }, locale })
}
