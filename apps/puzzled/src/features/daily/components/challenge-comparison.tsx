'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
	recallChallenge,
	type SharedResult,
	sharedResultCard,
	toSharedResult,
} from '@/features/daily/lib/challenge'
import type { ResultCardModel, ResultCardStrings } from '@/features/daily/lib/result-card'
import { getSharedResult } from '@/lib/connect'
import { getBaseUrl } from '@/lib/utils'
import { ResultCardSummary } from './result-card-summary'

type ChallengeComparisonProps = {
	/** The visitor's own result, as the card model the result screen already builds. */
	mine: ResultCardModel
	strings: ResultCardStrings
	gameName: string
}

/**
 * "Beat my result": when the player opened a share link and has now finished
 * that same module on that same day, both results sit side by side.
 * Renders nothing otherwise, and nothing while the shared result loads.
 */
export function ChallengeComparison({ mine, strings, gameName }: ChallengeComparisonProps) {
	const t = useTranslations('share.challenge')
	const locale = useLocale()
	const [theirs, setTheirs] = useState<SharedResult | null>(null)
	const { gameSlug, dayKey } = mine

	useEffect(() => {
		if (!dayKey) return
		const shareId = recallChallenge(safeStorage(), gameSlug, dayKey)
		if (!shareId) return
		let cancelled = false
		getSharedResult(shareId)
			.then((res) => {
				const shared = toSharedResult(res)
				// The link decides the module and day; a mismatch would compare unlike results.
				if (!cancelled && shared.gameSlug === gameSlug && shared.dayKey === dayKey) {
					setTheirs(shared)
				}
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [gameSlug, dayKey])

	if (!theirs) return null
	const theirCard = sharedResultCard(theirs, {
		origin: getBaseUrl('origin'),
		gameName,
		theme: mine.theme,
		locale,
	})
	return (
		<section aria-label={t('title')} className="mb-6">
			<h4 className="mb-2 text-center text-sm font-semibold">{t('title')}</h4>
			<div className="grid grid-cols-2 gap-2">
				<ResultCardSummary model={theirCard} strings={strings} heading={t('theirs')} stacked />
				<ResultCardSummary model={mine} strings={strings} heading={t('yours')} stacked />
			</div>
		</section>
	)
}

function safeStorage(): Storage | null {
	try {
		return window.localStorage
	} catch {
		return null
	}
}
