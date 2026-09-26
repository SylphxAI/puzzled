import { Play, Trophy } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import type { LeaderboardPeriod } from '../lib/leaderboard-period'
import { ConsoleCard } from './console-chrome'

export type BoardEntry = {
	rank: number
	name: string
	score: number
	/** True when this row belongs to the signed-in viewer. */
	isViewer: boolean
}

type LeaderboardBoardProps = {
	panelId: string
	period: LeaderboardPeriod
	moduleSlug: string
	moduleName: string
	entries: readonly BoardEntry[]
	/** Signed-in player id; null for guests. */
	viewerSignedIn: boolean
	locale: string
}

function initials(name: string): string {
	const trimmed = name.trim()
	if (!trimmed) return '?'
	const words = trimmed.split(/\s+/).slice(0, 2)
	return words.map((word) => word[0]?.toUpperCase() ?? '').join('') || '?'
}

/**
 * One board at a time: the module and scope the URL selects.
 *
 * The table is the whole surface — rank, player, score — with the viewer's own
 * row marked in text as well as colour, and an empty state that points at the
 * module instead of repeating itself for every other module.
 */
export async function LeaderboardBoard({
	panelId,
	period,
	moduleSlug,
	moduleName,
	entries,
	viewerSignedIn,
	locale,
}: LeaderboardBoardProps) {
	const t = await getTranslations('leaderboard')
	const periodLabel = t(`period.${period}`)
	const viewerInBoard = entries.some((entry) => entry.isViewer)

	return (
		<div
			id={panelId}
			role="tabpanel"
			aria-labelledby={`board-tab-${period}`}
			tabIndex={-1}
			className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<ConsoleCard
				title={t('boardTitle', { module: moduleName })}
				description={t('boardDescription', { period: periodLabel })}
			>
				{entries.length === 0 ? (
					<div className="py-2">
						<p className="font-semibold">{t('empty.title')}</p>
						<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
							{t('empty.body', { module: moduleName })}
						</p>
						<Link
							href={`/games/${moduleSlug}`}
							className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<Play className="h-4 w-4" aria-hidden="true" />
							{t('empty.play', { module: moduleName })}
						</Link>
					</div>
				) : (
					<div className="-mx-4 overflow-x-auto md:-mx-5">
						<table className="w-full min-w-[22rem] border-collapse text-sm">
							<caption className="sr-only">
								{t('tableCaption', { module: moduleName, period: periodLabel })}
							</caption>
							<thead>
								<tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
									<th scope="col" className="px-4 py-2 font-semibold md:px-5">
										{t('columns.rank')}
									</th>
									<th scope="col" className="px-3 py-2 font-semibold">
										{t('columns.player')}
									</th>
									<th scope="col" className="px-4 py-2 text-right font-semibold md:px-5">
										{t('columns.score')}
									</th>
								</tr>
							</thead>
							<tbody>
								{entries.map((entry) => (
									<tr
										key={`${entry.rank}-${entry.name}`}
										className={cn('border-t border-border/60', entry.isViewer && 'bg-primary/5')}
									>
										<th
											scope="row"
											className={cn(
												'px-4 py-3 text-left font-semibold tnum md:px-5',
												entry.rank === 1 && 'text-accent-warm-foreground',
											)}
										>
											<span className="flex items-center gap-1.5">
												{entry.rank === 1 ? (
													<Trophy className="h-4 w-4" aria-hidden="true" />
												) : null}
												{entry.rank}
											</span>
										</th>
										<td className="px-3 py-3">
											<span className="flex items-center gap-2">
												<span
													className={cn(
														'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase',
														entry.isViewer
															? 'bg-primary text-primary-foreground'
															: 'bg-muted text-muted-foreground',
													)}
													aria-hidden="true"
												>
													{initials(entry.name)}
												</span>
												<span className="min-w-0 truncate font-medium">{entry.name}</span>
												{entry.isViewer ? (
													<span className="chip bg-primary/10 text-primary">{t('you')}</span>
												) : null}
											</span>
										</td>
										<td className="px-4 py-3 text-right font-semibold tnum md:px-5">
											{entry.score.toLocaleString(locale)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}

				<p className="mt-4 text-xs leading-relaxed text-muted-foreground">
					{entries.length > 0
						? t('notes.top', { count: entries.length, module: moduleName })
						: t('notes.policy')}
				</p>
				{viewerSignedIn && entries.length > 0 && !viewerInBoard ? (
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
						{t('notes.viewerAway', { count: entries.length })}
					</p>
				) : null}
				{!viewerSignedIn ? (
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
						{t('notes.guest')}{' '}
						<Link href="/login" className="font-semibold text-primary hover:underline">
							{t('notes.signIn')}
						</Link>
					</p>
				) : null}
			</ConsoleCard>
		</div>
	)
}
