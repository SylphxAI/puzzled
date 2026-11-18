import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { DayCountdown } from '@/features/home/components/day-countdown'

type HomeMastheadProps = {
	/** `getPuzzleNumber` for the server-rendered product day and module. */
	puzzleNumber: number
	/** Registered games in today's set. */
	gameCount: number
	/** The day's free-picks pill (client island). */
	picks: ReactNode
}

/**
 * The broadsheet masthead: the shared puzzle number, the three free picks and
 * the clock to the next set, between a heavy ink rule and a hairline. It names
 * no calendar date: the day is the server's Hong Kong day, which is not every
 * visitor's local date, so the number and the clock identify it instead.
 */
export async function HomeMasthead({ puzzleNumber, gameCount, picks }: HomeMastheadProps) {
	const t = await getTranslations('home')

	return (
		<div className="home-day-masthead masthead-rule grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-2 text-xs text-muted-foreground sm:text-[13px] md:grid-cols-[minmax(0,1fr)_auto_auto] md:gap-x-6">
			<p className="flex min-w-0 items-center gap-2 truncate">
				<span className="day-numeral shrink-0 font-semibold text-foreground">
					{t('day.puzzleNumber', { number: puzzleNumber })}
				</span>
				<span aria-hidden="true" className="text-foreground/40">
					·
				</span>
				<span className="truncate">{t('lineup.subtitleShort', { count: gameCount })}</span>
			</p>
			<div className="col-span-2 row-start-2 md:col-span-1 md:row-start-1 md:col-start-2">
				{picks}
			</div>
			<p className="flex shrink-0 items-center gap-1.5 whitespace-nowrap md:col-start-3">
				<span>{t('day.resetsIn')}</span>
				<DayCountdown className="font-semibold text-foreground" />
			</p>
		</div>
	)
}
