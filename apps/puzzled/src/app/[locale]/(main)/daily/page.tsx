import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { SharedResultLanding } from '@/features/daily/components/shared-result-landing'
import {
	buildChallengeMetadata,
	firstQueryValues,
	resolveDailyShareContext,
} from '@/features/daily/lib/shared-landing'
import { redirect } from '@/lib/i18n/routing'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
	const { locale } = await params
	const query = await firstQueryValues(searchParams)
	return buildChallengeMetadata({
		locale,
		path: '/daily',
		query,
		requireShareQuery: true,
	})
}

/**
 * `/daily`: today's free puzzle for product links (Tryit), or a friend's
 * shared challenge landing when `?ref=<share id>` or `?utm_source=share` is
 * carried so the sharer's game, score card and attribution are preserved.
 */
export default async function DailyPage({ params, searchParams }: Props) {
	const { locale } = await params
	setRequestLocale(locale)
	const query = await firstQueryValues(searchParams)
	const resolved = await resolveDailyShareContext(query)
	if (resolved.kind === 'redirect-daily') {
		redirect({ href: { pathname: `/games/${resolved.gameSlug}`, query }, locale })
		return null
	}
	return (
		<SharedResultLanding
			shareId={resolved.shareId}
			shared={resolved.shared}
			fallbackGameSlug={resolved.fallbackGameSlug}
			utmSource={resolved.utmSource}
			locale={locale}
		/>
	)
}
