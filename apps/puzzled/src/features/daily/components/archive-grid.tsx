import { LockKeyhole, Play } from 'lucide-react'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { GameIcon } from '@/shared/components/ui/game-icons'
import { archivePlayPath } from '../lib/archive-days'

type Props = {
	days: string[]
	games: { slug: string; name: string; theme: GameColorTheme }[]
	locale: string
	locked: boolean
	lockedLabel: string
	playLabel: string
}

/** The preview remains visible; Connect alone admits dated play. */
export function ArchiveGrid({ days, games, locale, locked, lockedLabel, playLabel }: Props) {
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })
	return (
		<div className="space-y-7">
			{days.map((dayKey) => (
				<section key={dayKey} aria-labelledby={'archive-day-' + dayKey} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
					<h3 id={'archive-day-' + dayKey} className="mb-4 font-display text-xl">
						<time dateTime={dayKey}>{dateFormat.format(new Date(dayKey + 'T00:00:00Z'))}</time>
					</h3>
					<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
						{games.map((game) => {
							const colors = getGameColors(game.theme)
							return (
								<li key={game.slug}>
									<Link href={archivePlayPath(game.slug, dayKey)} prefetch={false} className="group flex min-h-16 items-center gap-2.5 rounded-xl border border-border/70 p-2.5 transition-colors hover:border-foreground/30 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
										<span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', colors.bg, colors.onField)}>
											<GameIcon slug={game.slug} className="h-6 w-6" aria-hidden="true" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="block break-words text-sm font-semibold leading-snug">{game.name}</span>
											<span className="mt-1 flex items-center gap-1 break-words text-xs text-muted-foreground">
												{locked ? <LockKeyhole className="h-3 w-3 shrink-0" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}
												{locked ? lockedLabel : playLabel}
											</span>
										</span>
									</Link>
								</li>
							)
						})}
					</ul>
				</section>
			))}
		</div>
	)
}
