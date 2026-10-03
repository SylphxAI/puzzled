'use client'

import { Crown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { trackOfferClicked, trackOfferShown } from '@/features/analytics/lib/plus-funnel'
import { Link } from '@/lib/i18n/routing'
import { showResultPlusCard } from '../lib/plus-offer'
import { usePlusOffer } from './plus-offer-context'

/**
 * One Plus card under the finished free game of the day. It renders in the
 * result screen's first paint, so it moves nothing, and nothing at all for a
 * member, a closed store, an archive run or a game that is not today's free one.
 */
export function PlusResultCard({
	gameSlug,
	mode,
}: {
	gameSlug: string
	mode: 'daily' | 'archive'
}) {
	const t = useTranslations('plus.offer')
	const tUnlock = useTranslations('plus.unlock')
	const offer = usePlusOffer()
	const visible = Boolean(offer && showResultPlusCard(offer, { mode, gameSlug }))
	useEffect(() => {
		if (visible) trackOfferShown('result_card')
	}, [visible])
	if (!offer || !visible) return null
	return (
		<section
			aria-labelledby="plus-result-title"
			className="mt-4 rounded-2xl border border-border bg-muted/50 p-4 text-center"
		>
			<h3
				id="plus-result-title"
				className="flex items-center justify-center gap-2 font-display text-base"
			>
				<Crown className="h-4 w-4 text-primary" aria-hidden="true" />
				{t('resultTitle', { count: offer.gameCount })}
			</h3>
			<p className="mt-1 text-sm text-muted-foreground">{t('resultBody')}</p>
			<Link
				href="/pricing"
				onClick={() => trackOfferClicked('result_card')}
				className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-primary-foreground"
			>
				{tUnlock('cta')}
			</Link>
		</section>
	)
}
