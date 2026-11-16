import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { SharedResultLanding } from '@/features/daily/components/shared-result-landing'
import {
	buildChallengeMetadata,
	firstQueryValues,
	resolveShareRouteContext,
} from '@/features/daily/lib/shared-landing'

type Props = {
	params: Promise<{ locale: string; shareId: string }>
	searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
	const { locale, shareId } = await params
	const query = await firstQueryValues(searchParams)
	return buildChallengeMetadata({
		locale,
		path: `/r/${encodeURIComponent(shareId)}`,
		shareId,
		query,
	})
}

/**
 * `/r/[shareId]`: dedicated permalink for shared puzzle results, rendering the
 * sharer's game/score OpenGraph card and routing recipients into that game with
 * `ref` and `utm_source=share` preserved.
 */
export default async function SharePermalinkPage({ params, searchParams }: Props) {
	const { locale, shareId } = await params
	setRequestLocale(locale)
	const query = await firstQueryValues(searchParams)
	const resolved = await resolveShareRouteContext(shareId, query)
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
