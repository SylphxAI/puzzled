import { getTranslations } from 'next-intl/server'
import { cn } from '@/lib/utils'
import { type CalendarDay, type FinishCalendar, parseDayKey } from '../lib/finish-activity'
import { ConsoleCard } from './console-chrome'

type FinishCalendarCardProps = {
	calendar: FinishCalendar
	locale: string
}

/** Weekday row labels, Monday-first to match the calendar columns. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function formatDay(key: string, locale: string): string {
	const stamp = parseDayKey(key)
	if (stamp === null) return key
	return new Intl.DateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
	}).format(new Date(stamp))
}

function DayCell({ day, title }: { day: CalendarDay; title: string }) {
	if (day.future) {
		return <span className="h-3.5 w-3.5 rounded-[4px] opacity-0" aria-hidden="true" />
	}
	const won = day.wonCount > 0
	return (
		<span
			title={title}
			className={cn(
				'h-3.5 w-3.5 rounded-[4px] border',
				day.finishedCount === 0 && 'border-border bg-surface-muted',
				day.finishedCount > 0 && won && 'border-transparent bg-gradient-to-br from-muted to-muted',
				day.finishedCount > 0 && !won && 'border-primary/40 bg-primary/15',
			)}
		>
			{day.finishedCount > 0 && !won ? (
				<span className="mx-auto mt-[5px] block h-1 w-1 rounded-full bg-primary" />
			) : null}
		</span>
	)
}

/**
 * Trailing-weeks activity map for accepted daily finishes.
 *
 * The grid is decorative by construction: the same information is stated as a
 * summary sentence and listed day by day in the disclosure table, so nothing
 * depends on colour alone.
 */
export async function FinishCalendarCard({ calendar, locale }: FinishCalendarCardProps) {
	const t = await getTranslations('stats')
	const finishedDays = calendar.weeks
		.flat()
		.filter((day) => day.inRange && day.finishedCount > 0)
		.sort((a, b) => (a.key < b.key ? 1 : -1))

	return (
		<ConsoleCard
			title={t('calendar.title')}
			description={t('calendar.description')}
			bodyClassName="px-4 py-4 md:px-5"
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
				<div className="flex gap-2" aria-hidden="true">
					<div className="flex flex-col justify-between gap-1 pt-4 text-[10px] leading-none text-muted-foreground">
						{WEEKDAY_KEYS.map((key) => (
							<span key={key}>{t(`calendar.weekday.${key}`)}</span>
						))}
					</div>
					<div className="flex gap-1">
						{calendar.weeks.map((week) => (
							<div key={week[0]?.key ?? 'week'} className="flex flex-col gap-1">
								{week.map((day) => (
									<DayCell
										key={day.key}
										day={day}
										title={`${formatDay(day.key, locale)} — ${t('calendar.cellLabel', {
											count: day.finishedCount,
										})}`}
									/>
								))}
							</div>
						))}
					</div>
				</div>

				<div className="min-w-0 flex-1 space-y-3">
					<dl className="space-y-1.5 text-sm">
						<div className="flex flex-wrap items-baseline gap-x-2">
							<dt className="text-muted-foreground">{t('calendar.finishedDaysLabel')}</dt>
							<dd className="font-semibold tnum">
								{t('calendar.finishedDaysValue', {
									finished: calendar.finishedDays,
									total: calendar.daysInWindow,
								})}
							</dd>
						</div>
						<div className="flex flex-wrap items-baseline gap-x-2">
							<dt className="text-muted-foreground">{t('calendar.longestRunLabel')}</dt>
							<dd className="font-semibold tnum">
								{t('calendar.daysValue', { days: calendar.longestRunDays })}
							</dd>
						</div>
						<div className="flex flex-wrap items-baseline gap-x-2">
							<dt className="text-muted-foreground">{t('calendar.todayLabel')}</dt>
							<dd className="font-semibold">
								{calendar.today && calendar.today.finishedCount > 0
									? t('calendar.todayDone')
									: t('calendar.todayOpen')}
							</dd>
						</div>
					</dl>

					<ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
						<li className="flex items-center gap-1.5">
							<span
								className="h-3.5 w-3.5 rounded-[4px] bg-gradient-to-br from-muted to-muted"
								aria-hidden="true"
							/>
							{t('calendar.legendWon')}
						</li>
						<li className="flex items-center gap-1.5">
							<span
								className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-primary/40 bg-primary/15"
								aria-hidden="true"
							>
								<span className="h-1 w-1 rounded-full bg-primary" />
							</span>
							{t('calendar.legendFinished')}
						</li>
						<li className="flex items-center gap-1.5">
							<span
								className="h-3.5 w-3.5 rounded-[4px] border border-border bg-surface-muted"
								aria-hidden="true"
							/>
							{t('calendar.legendOpen')}
						</li>
					</ul>
				</div>
			</div>

			<details className="mt-4 border-t border-border/70 pt-3">
				<summary className="flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
					{t('calendar.showDays')}
				</summary>
				{finishedDays.length === 0 ? (
					<p className="mt-2 text-sm text-muted-foreground">{t('calendar.noDays')}</p>
				) : (
					<table className="mt-2 w-full border-collapse text-sm">
						<caption className="sr-only">{t('calendar.tableCaption')}</caption>
						<thead>
							<tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
								<th scope="col" className="py-2 font-semibold">
									{t('calendar.tableDay')}
								</th>
								<th scope="col" className="py-2 text-right font-semibold">
									{t('calendar.tableFinished')}
								</th>
								<th scope="col" className="py-2 text-right font-semibold">
									{t('calendar.tableWon')}
								</th>
							</tr>
						</thead>
						<tbody>
							{finishedDays.map((day) => (
								<tr key={day.key} className="border-t border-border/60">
									<th scope="row" className="py-2 text-left font-medium">
										{formatDay(day.key, locale)}
									</th>
									<td className="py-2 text-right tnum">{day.finishedCount}</td>
									<td className="py-2 text-right tnum">{day.wonCount}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</details>
		</ConsoleCard>
	)
}
