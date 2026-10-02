'use client'

import { Crown, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link } from '@/lib/i18n/routing'
import {
	dueMilestone,
	markSeen,
	type PlusOffer,
	parseSeen,
	seenStorageKey,
} from '../lib/plus-offer'

function readSeen(key: string): number[] {
	try {
		return parseSeen(window.localStorage.getItem(key))
	} catch {
		return []
	}
}

function writeSeen(key: string, seen: number[]) {
	try {
		window.localStorage.setItem(key, JSON.stringify(seen))
	} catch {
		// Storage can be blocked; the prompt then simply shows again next visit.
	}
}

/**
 * Day-3 and day-7 prompt for a returning, signed-in player who is not a
 * member. The server mounts it only when sales are open, the viewer is not
 * entitled and `playedDays` (distinct product days with a finish) reached a
 * milestone. It is fixed to the viewport, so showing or dismissing it moves no
 * content, and it is remembered per account on this browser.
 */
export function PlusMilestonePrompt({
	userId,
	playedDays,
	offer,
}: {
	userId: string
	playedDays: number
	offer: PlusOffer
}) {
	const t = useTranslations('plus.offer')
	const tUnlock = useTranslations('plus.unlock')
	const tCommon = useTranslations('common')
	const key = seenStorageKey(userId)
	const [milestone, setMilestone] = useState<number | null>(null)

	useEffect(() => {
		const due = dueMilestone(playedDays, readSeen(key))
		if (due !== null) {
			setMilestone(due)
			// Shown once: retire it as soon as it is on screen.
			writeSeen(key, markSeen(readSeen(key), due))
		}
	}, [playedDays, key])

	if (milestone === null) return null
	return (
		<aside
			aria-labelledby="plus-milestone-title"
			className="fixed inset-x-4 bottom-24 z-toast mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-lg sm:left-auto sm:right-4 sm:mx-0"
		>
			<button
				type="button"
				onClick={() => setMilestone(null)}
				aria-label={tCommon('dismiss')}
				className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
			>
				<X className="h-4 w-4" aria-hidden="true" />
			</button>
			<h2
				id="plus-milestone-title"
				className="flex items-center gap-2 pr-10 font-display text-base"
			>
				<Crown className="h-4 w-4 text-primary" aria-hidden="true" />
				{t(milestone >= 7 ? 'day7Title' : 'day3Title')}
			</h2>
			<p className="mt-1 text-sm text-muted-foreground">
				{t('milestoneBody', { count: offer.gameCount })}
			</p>
			<Link
				href="/pricing"
				onClick={() => setMilestone(null)}
				className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-primary-foreground"
			>
				{tUnlock('cta')}
			</Link>
		</aside>
	)
}
