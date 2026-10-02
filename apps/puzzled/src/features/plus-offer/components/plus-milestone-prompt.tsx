'use client'

import { Crown, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import {
	addDismissed,
	DISMISSED_COOKIE,
	parseDismissed,
	serializeDismissedCookie,
} from '@/features/announcements/lib/dismissed'
import { Link } from '@/lib/i18n/routing'
import { idsToRecord, type PlusOffer } from '../lib/plus-offer'

function recordSeen(milestone: number) {
	try {
		const match = document.cookie
			.split('; ')
			.find((part) => part.startsWith(`${DISMISSED_COOKIE}=`))
		let ids = parseDismissed(match ? match.slice(match.indexOf('=') + 1) : null)
		for (const id of idsToRecord(milestone)) ids = addDismissed(ids, id)
		// biome-ignore lint/suspicious/noDocumentCookie: strictly necessary UI state, the announcements cookie
		document.cookie = serializeDismissedCookie(ids, window.location.protocol === 'https:')
	} catch {
		// Cookies blocked: the prompt may show again next visit.
	}
}

/**
 * Day-3 and day-7 prompt for a returning, signed-in player who is not a
 * member. The server mounts it only when sales are confirmed open, the viewer
 * is confirmed not entitled, a milestone is reached and its id is not already
 * in the dismissed-notices cookie, so a seen prompt is never rendered. It is
 * fixed to the viewport (no layout shift) and is recorded as seen once on
 * screen; dismissing only hides it.
 */
export function PlusMilestonePrompt({
	milestone,
	playedDays,
	offer,
}: {
	milestone: number
	playedDays: number
	offer: PlusOffer
}) {
	const t = useTranslations('plus.offer')
	const tUnlock = useTranslations('plus.unlock')
	const tCommon = useTranslations('common')
	const [open, setOpen] = useState(true)

	useEffect(() => {
		recordSeen(milestone)
	}, [milestone])

	if (!open) return null
	return (
		<aside
			aria-labelledby="plus-milestone-title"
			className="fixed inset-x-4 bottom-24 z-toast mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-lg sm:left-auto sm:right-4 sm:mx-0"
		>
			<button
				type="button"
				onClick={() => {
					recordSeen(milestone)
					setOpen(false)
				}}
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
				{t(milestone >= 7 ? 'day7Title' : 'day3Title', { days: playedDays })}
			</h2>
			<p className="mt-1 text-sm text-muted-foreground">
				{t('milestoneBody', { count: offer.gameCount })}
			</p>
			<Link
				href="/pricing"
				onClick={() => setOpen(false)}
				className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-primary px-5 font-semibold text-primary-foreground"
			>
				{tUnlock('cta')}
			</Link>
		</aside>
	)
}
