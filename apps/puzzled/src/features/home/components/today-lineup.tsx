import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { GameColorTheme } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { GameTile, type GameTileStatus } from '@/shared/components/games/game-tile'

export type LineupEntry = {
	slug: string
	name: string
	tagline: string
	meta: string
	theme: GameColorTheme
	status: GameTileStatus
	score?: string | null
}

type TodayLineupProps = {
	games: readonly LineupEntry[]
	/** Premium viewer without access sees the unlock path. */
	showUnlock: boolean
}

/**
 * The bounded home exposure: today's free ritual first, proved finishes next,
 * then the day's rotation. The full catalog stays on /games.
 */
export async function TodayLineup({ games, showUnlock }: TodayLineupProps) {
	const t = await getTranslations('home')

	return (
		<section className="section-block">
			<div className="page-shell-wide">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<h2 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
							{t('lineup.title')}
						</h2>
						<p className="mt-1.5 text-sm text-muted-foreground">{t('lineup.subtitle')}</p>
					</div>
					<Link
						href="/games"
						className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
					>
						{t('lineup.seeAll')}
						<ArrowRight className="h-4 w-4" aria-hidden="true" />
					</Link>
				</div>

				<ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{games.map((game, index) => (
						<li key={game.slug} className="h-full">
							<GameTile
								slug={game.slug}
								name={game.name}
								tagline={game.tagline}
								meta={game.meta}
								theme={game.theme}
								status={game.status}
								score={game.score}
								showUnlock={showUnlock}
								index={index}
								labels={{
									play: t('lineup.play'),
									playAgain: t('lineup.playAgain'),
									unlock: t('lineup.unlock'),
									freeToday: t('lineup.freeToday'),
									premium: t('lineup.premium'),
								}}
							/>
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}

/**
 * Reserved space for the lineup while personal completion is unread.
 *
 * No copy, no status chips, no unlock call to action: every tile here would be
 * a claim about this viewer, and the shell has not read any of them yet. The
 * card geometry matches `GameTile` so the real lineup lands without moving the
 * page.
 */
export function TodayLineupSkeleton() {
	return (
		<section className="section-block" aria-busy="true">
			<div className="page-shell-wide">
				<div className="h-8 w-56 animate-pulse rounded-lg bg-muted" />
				<div className="mt-3 h-4 w-72 animate-pulse rounded bg-muted" />
				<ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }, (_, index) => (
						<li
							key={index}
							className="h-48 animate-pulse rounded-2xl border border-border bg-card"
						/>
					))}
				</ul>
			</div>
		</section>
	)
}
