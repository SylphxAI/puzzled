'use client'

import { useTranslations } from 'next-intl'
import { useSyncExternalStore } from 'react'
import {
	DAILY_FREE_PICKS,
	picksLeft,
	readDailyPicks,
	subscribeDailyPicks,
} from '@/features/daily/lib/daily-picks'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'

const NO_PICKS: readonly string[] = []

type DailyPicksPillProps = {
	/** The server's product day key; the mirror is keyed by it, never a client clock. */
	dayKey: string
	/** The viewer has Tryit Plus: every game is open, so no slots are shown. */
	unlimited?: boolean
	className?: string
}

/**
 * Three slots for the day's free picks, filling as the player opens games.
 *
 * Display only: it reads the browser's mirror of games the server served
 * today (`daily-picks.ts`). The server renders three open slots; the client
 * fills them after hydration, so a first visit never flickers.
 */
export function DailyPicksPill({ dayKey, unlimited = false, className }: DailyPicksPillProps) {
	const t = useTranslations('home.picks')
	const picks = useSyncExternalStore(
		subscribeDailyPicks,
		() => readDailyPicks(dayKey),
		() => NO_PICKS,
	)
	const used = Math.min(picks.length, DAILY_FREE_PICKS)
	const left = picksLeft(used)

	if (unlimited) {
		return (
			<p data-daily-picks="unlimited" className={cn('picks-pill', className)}>
				<span className="picks-slot picks-slot-plus" aria-hidden="true" />
				<span>{t('unlimited')}</span>
			</p>
		)
	}

	const label =
		used === 0
			? t('fresh', { count: DAILY_FREE_PICKS })
			: left > 0
				? t('left', { count: left })
				: t('none')
	const slots = (
		<span className="flex items-center gap-1" aria-hidden="true">
			{Array.from({ length: DAILY_FREE_PICKS }, (_, i) => (
				<span key={i} className={cn('picks-slot', i < used && 'picks-slot-used')} />
			))}
		</span>
	)

	if (left === 0) {
		return (
			<Link
				href="/pricing"
				data-daily-picks={used}
				className={cn('picks-pill picks-pill-link', className)}
			>
				{slots}
				<span>{label}</span>
			</Link>
		)
	}

	return (
		<p data-daily-picks={used} className={cn('picks-pill', className)}>
			{slots}
			<span>{label}</span>
		</p>
	)
}
