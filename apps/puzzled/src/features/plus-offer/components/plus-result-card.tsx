'use client'

import { Crown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSyncExternalStore } from 'react'
import {
	DAILY_FREE_PICKS,
	readDailyPicks,
	subscribeDailyPicks,
} from '@/features/daily/lib/daily-picks'
import { Link } from '@/lib/i18n/routing'
import { showResultPlusCard } from '../lib/plus-offer'
import { usePlusOffer } from './plus-offer-context'

const NO_PICKS: readonly string[] = []

/**
 * One Plus card under a finished free daily game. Shows live 3-Day Pass and
 * Plus pricing when available, and surfaces a dedicated 3/3 picks-used prompt
 * right at peak Aha Moment on the player's third game of the day.
 * Renders nothing for a member, a closed store, or an archive run.
 */
export function PlusResultCard({
	gameSlug,
	mode,
	puzzleDate,
}: {
	gameSlug: string
	mode: 'daily' | 'archive'
	puzzleDate?: string
}) {
	const t = useTranslations('plus.offer')
	const tPlus = useTranslations('plus')
	const tUnlock = useTranslations('plus.unlock')
	const offer = usePlusOffer()
	const picks = useSyncExternalStore(
		subscribeDailyPicks,
		() => (offer ? readDailyPicks(offer.dayKey) : NO_PICKS),
		() => NO_PICKS,
	)

	if (!offer || !showResultPlusCard(offer, { mode, gameSlug, puzzleDate })) return null

	const usedPicks = Math.min(offer.picksUsed ?? picks.length, DAILY_FREE_PICKS)
	const allFreePicksUsed = usedPicks >= DAILY_FREE_PICKS
	const passDays = offer.passDays ?? 3
	const priceLine =
		offer.passPrice && offer.yearlyPrice
			? t('resultPriceWithPass', {
					days: passDays,
					passPrice: offer.passPrice,
					plan: tPlus('name'),
					price: offer.yearlyPrice,
				})
			: offer.passPrice
				? t('resultPassPrice', { days: passDays, passPrice: offer.passPrice })
				: offer.yearlyPrice
					? t('resultPrice', { plan: tPlus('name'), price: offer.yearlyPrice })
					: null

	const pricingHref = allFreePicksUsed
		? '/pricing?utm_source=tryit&utm_medium=result_card&utm_content=picks_exhausted&entry_surface=result_card_picks_exhausted&plan=individual_once#plus'
		: '/pricing?utm_source=tryit&utm_medium=result_card&utm_content=a&entry_surface=result_card'

	return (
		<section
			aria-labelledby="plus-result-title"
			data-result-picks-exhausted={allFreePicksUsed ? 'true' : 'false'}
			className="mt-4 rounded-2xl border border-border bg-muted/50 p-4 text-center"
		>
			{allFreePicksUsed ? (
				<div className="mb-2 flex justify-center">
					<span className="picks-pill">
						<span className="flex items-center gap-1" aria-hidden="true">
							{Array.from({ length: DAILY_FREE_PICKS }, (_, i) => (
								<span key={i} className="picks-slot picks-slot-used" />
							))}
						</span>
						<span className="numeral">
							{t('resultPicksUsedBadge', { used: DAILY_FREE_PICKS, total: DAILY_FREE_PICKS })}
						</span>
					</span>
				</div>
			) : null}
			<h3
				id="plus-result-title"
				className="flex items-center justify-center gap-2 font-display text-base"
			>
				<Crown className="h-4 w-4 text-primary" aria-hidden="true" />
				{allFreePicksUsed
					? t('resultPicksUsedTitle', { total: DAILY_FREE_PICKS, count: offer.gameCount })
					: t('resultTitle', { count: offer.gameCount })}
			</h3>
			{priceLine ? <p className="mt-1 text-sm font-semibold tnum">{priceLine}</p> : null}
			<p className="mt-1 text-sm text-muted-foreground">
				{allFreePicksUsed ? t('resultPicksUsedBody', { count: offer.gameCount }) : t('resultBody')}
			</p>
			<Link
				href={pricingHref}
				className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-primary-foreground"
			>
				{tUnlock('cta')}
			</Link>
		</section>
	)
}
