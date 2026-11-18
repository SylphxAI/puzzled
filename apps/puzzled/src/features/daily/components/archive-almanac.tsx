'use client'

import { LockKeyhole, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import type { GameCategory } from '@/games/types'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { GameMotifImage } from '@/shared/components/games/game-motif'
import { archivePlayPath } from '../lib/archive-days'

export type AlmanacGame = {
	slug: string
	name: string
	theme: GameColorTheme
	category: GameCategory
}

type ArchiveAlmanacProps = {
	/** Past product days, newest first (`archiveDayKeys`). */
	days: readonly string[]
	games: readonly AlmanacGame[]
	locale: string
	/** Past days need Tryit Plus for this viewer; the preview stays visible. */
	locked: boolean
	categories: readonly { value: GameCategory; label: string }[]
	labels: {
		dayPicker: string
		filter: string
		all: string
		yesterday: string
		dayCount: string
		play: string
		locked: string
	}
}

type Filter = 'all' | GameCategory

/**
 * The archive as an almanac: a strip of the past days, a category filter and
 * the chosen day's games. One day is on screen at a time, so the whole month
 * fits in one view. Connect alone admits dated play; this only links.
 */
export function ArchiveAlmanac({
	days,
	games,
	locale,
	locked,
	categories,
	labels,
}: ArchiveAlmanacProps) {
	const [selected, setSelected] = useState(days[0] ?? '')
	const [filter, setFilter] = useState<Filter>('all')

	const formats = useMemo(
		() => ({
			weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }),
			day: new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone: 'UTC' }),
			month: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }),
			long: new Intl.DateTimeFormat(locale, {
				weekday: 'long',
				month: 'long',
				day: 'numeric',
				year: 'numeric',
				timeZone: 'UTC',
			}),
		}),
		[locale],
	)
	const asDate = (dayKey: string) => new Date(`${dayKey}T00:00:00Z`)
	const visible = filter === 'all' ? games : games.filter((game) => game.category === filter)

	return (
		<div className="tactile-card overflow-hidden" data-archive-almanac="">
			<div className="border-b-[1.5px] border-[var(--tactile-line)] bg-[var(--color-surface-muted)] px-3 pb-3 pt-3 sm:px-4">
				<fieldset className="min-w-0 border-0 p-0">
					<legend className="sr-only">{labels.dayPicker}</legend>
					<ul className="no-scrollbar -mx-3 flex snap-x gap-1.5 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
						{days.map((dayKey, index) => {
							const date = asDate(dayKey)
							const on = dayKey === selected
							const monthStart = index === 0 || date.getUTCDate() === 1
							return (
								<li key={dayKey} className="snap-start">
									<button
										type="button"
										aria-pressed={on}
										aria-label={formats.long.format(date)}
										onClick={() => setSelected(dayKey)}
										className={cn('almanac-day', on && 'almanac-day-on')}
									>
										<span className="text-[11px] font-semibold uppercase leading-none tracking-wide opacity-75">
											{index === 0 ? labels.yesterday : formats.weekday.format(date)}
										</span>
										<span className="numeral font-display text-lg font-bold leading-none">
											{formats.day.format(date)}
										</span>
										<span className="text-[10px] font-semibold leading-none opacity-70">
											{monthStart ? formats.month.format(date) : ' '}
										</span>
									</button>
								</li>
							)
						})}
					</ul>
				</fieldset>
				<fieldset className="mt-2 min-w-0 border-0 p-0">
					<legend className="sr-only">{labels.filter}</legend>
					<div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:-mx-4 sm:px-4">
						{[{ value: 'all' as const, label: labels.all }, ...categories].map((option) => (
							<button
								key={option.value}
								type="button"
								aria-pressed={filter === option.value}
								onClick={() => setFilter(option.value)}
								className={cn(
									'category-chip shrink-0',
									filter === option.value && 'category-chip-on',
								)}
							>
								{option.label}
							</button>
						))}
					</div>
				</fieldset>
			</div>

			<section className="px-3 pb-4 pt-3 sm:px-4" aria-labelledby="archive-day-title">
				<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
					<h3 id="archive-day-title" className="font-display text-xl leading-tight">
						<time dateTime={selected}>{formats.long.format(asDate(selected))}</time>
					</h3>
					<p className="numeral text-sm text-muted-foreground">
						{labels.dayCount.replace('{count}', String(visible.length))}
					</p>
				</div>
				<ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
					{visible.map((game) => {
						const colors = getGameColors(game.theme)
						return (
							<li key={game.slug}>
								<Link
									href={archivePlayPath(game.slug, selected)}
									prefetch={false}
									className="almanac-game group flex items-center gap-2 sm:gap-2.5"
								>
									<span
										className={cn(
											'flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border-[1.5px] border-[var(--tactile-line)] p-0.5 sm:h-11 sm:w-[4.25rem]',
											colors.bg,
										)}
										aria-hidden="true"
									>
										<GameMotifImage slug={game.slug} zoom />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold leading-snug">
											{game.name}
										</span>
										<span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
											{locked ? (
												<LockKeyhole className="h-3 w-3 shrink-0" aria-hidden="true" />
											) : (
												<Play className="h-3 w-3 shrink-0" aria-hidden="true" />
											)}
											{locked ? labels.locked : labels.play}
										</span>
									</span>
								</Link>
							</li>
						)
					})}
				</ul>
			</section>
		</div>
	)
}
