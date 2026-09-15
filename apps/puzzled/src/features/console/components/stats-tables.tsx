import { getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/routing'
import { GameIcon } from '@/shared/components/ui/game-icons'
import { durationParts, type FinishSession, type ModuleStatRow } from '../lib/finish-activity'
import { ConsoleCard } from './console-chrome'

/** Per-module record for the modules this player has actually finished. */
export async function ModuleBreakdownCard({ rows }: { rows: readonly ModuleStatRow[] }) {
	const t = await getTranslations('stats')
	const totals = rows.reduce(
		(acc, row) => ({
			played: acc.played + row.played,
			won: acc.won + row.won,
		}),
		{ played: 0, won: 0 },
	)
	const totalRate = totals.played > 0 ? Math.round((totals.won / totals.played) * 100) : null

	if (rows.length === 0) {
		return (
			<ConsoleCard title={t('modules.title')} description={t('modules.description')}>
				<p className="text-sm text-muted-foreground">{t('modules.empty')}</p>
				<Link
					href="/games"
					className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-background px-4 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{t('modules.browse')}
				</Link>
			</ConsoleCard>
		)
	}

	return (
		<ConsoleCard title={t('modules.title')} description={t('modules.description')}>
			<div className="-mx-4 overflow-x-auto md:-mx-5">
				<table className="w-full min-w-[32rem] border-collapse text-sm">
					<caption className="sr-only">{t('modules.tableCaption')}</caption>
					<thead>
						<tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
							<th scope="col" className="px-4 py-2 font-semibold md:px-5">
								{t('modules.module')}
							</th>
							<th scope="col" className="px-3 py-2 text-right font-semibold">
								{t('modules.finished')}
							</th>
							<th scope="col" className="px-3 py-2 text-right font-semibold">
								{t('modules.won')}
							</th>
							<th scope="col" className="px-3 py-2 text-right font-semibold">
								{t('modules.winRate')}
							</th>
							<th scope="col" className="px-4 py-2 text-right font-semibold md:px-5">
								{t('modules.bestScore')}
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.slug} className="border-t border-border/60">
								<th scope="row" className="px-4 py-3 text-left font-medium md:px-5">
									<span className="flex items-center gap-2">
										<GameIcon slug={row.slug} size={20} aria-hidden="true" />
										<span className="truncate">{row.name}</span>
									</span>
								</th>
								<td className="px-3 py-3 text-right tnum">{row.played}</td>
								<td className="px-3 py-3 text-right tnum">{row.won}</td>
								<td className="px-3 py-3 text-right tnum">
									{row.winRate === null ? t('notRecorded') : `${row.winRate}%`}
								</td>
								<td className="px-4 py-3 text-right tnum md:px-5">{row.bestScore}</td>
							</tr>
						))}
					</tbody>
					<tfoot>
						<tr className="border-t border-border bg-surface-muted/60 font-semibold">
							<th scope="row" className="px-4 py-3 text-left md:px-5">
								{t('modules.allModules')}
							</th>
							<td className="px-3 py-3 text-right tnum">{totals.played}</td>
							<td className="px-3 py-3 text-right tnum">{totals.won}</td>
							<td className="px-3 py-3 text-right tnum">
								{totalRate === null ? t('notRecorded') : `${totalRate}%`}
							</td>
							{/* Best score is per module: a total would be a number that means nothing. */}
							<td className="px-4 py-3 text-right md:px-5" />
						</tr>
					</tfoot>
				</table>
			</div>
		</ConsoleCard>
	)
}

/** Newest accepted finishes, as the server ordered them. */
export async function FinishHistoryCard({
	sessions,
	moduleNames,
	locale,
}: {
	sessions: readonly FinishSession[]
	moduleNames: Record<string, string>
	locale: string
}) {
	const t = await getTranslations('stats')

	if (sessions.length === 0) {
		return (
			<ConsoleCard title={t('historyTitle')} description={t('history.description')}>
				<p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>
			</ConsoleCard>
		)
	}

	return (
		<ConsoleCard title={t('historyTitle')} description={t('history.description')}>
			<div className="-mx-4 overflow-x-auto md:-mx-5">
				<table className="w-full min-w-[34rem] border-collapse text-sm">
					<caption className="sr-only">{t('history.tableCaption')}</caption>
					<thead>
						<tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
							<th scope="col" className="px-4 py-2 font-semibold md:px-5">
								{t('history.day')}
							</th>
							<th scope="col" className="px-3 py-2 font-semibold">
								{t('history.module')}
							</th>
							<th scope="col" className="px-3 py-2 font-semibold">
								{t('history.result')}
							</th>
							<th scope="col" className="px-3 py-2 text-right font-semibold">
								{t('history.score')}
							</th>
							<th scope="col" className="px-4 py-2 text-right font-semibold md:px-5">
								{t('history.time')}
							</th>
						</tr>
					</thead>
					<tbody>
						{sessions.map((session, index) => {
							const parts = durationParts(session.timeSpentMs)
							return (
								<tr
									key={`${session.gameSlug}-${session.puzzleDate}-${index}`}
									className="border-t border-border/60"
								>
									<td className="px-4 py-3 md:px-5">{session.puzzleDate || t('notRecorded')}</td>
									<td className="px-3 py-3">
										<span className="flex items-center gap-2">
											<GameIcon slug={session.gameSlug} size={20} aria-hidden="true" />
											<span className="truncate">
												{moduleNames[session.gameSlug] ?? session.gameSlug}
											</span>
										</span>
									</td>
									<td className="px-3 py-3">
										{session.status === 'won' ? t('history.won') : t('history.finished')}
									</td>
									<td className="px-3 py-3 text-right tnum">{session.score}</td>
									<td className="px-4 py-3 text-right tnum md:px-5">
										{t('duration', { minutes: parts.minutes, seconds: parts.seconds })}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>
			<p className="mt-3 text-xs text-muted-foreground">{t('history.note')}</p>
		</ConsoleCard>
	)
}
