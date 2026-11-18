import { ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import type { GameColorTheme } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { GameTile, type GameTileStatus } from '@/shared/components/games/game-tile'

export type LineupEntry = {
	slug: string
	name: string
	tagline: string
	duration: string
	/** Localised category name. */
	category: string
	theme: GameColorTheme
	status: GameTileStatus
	score?: string | null
}

export type LineupCategory = {
	/** Catalog filter value (`/games?category=`). */
	value: string
	label: string
	count: number
}

type TodayLineupProps = {
	games: readonly LineupEntry[]
	categories: readonly LineupCategory[]
}

const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'

/**
 * Every game of the day at a glance, beside the lead: today's pick first,
 * proved finishes next, then the day's rotation. The category chips open the
 * filtered catalogue.
 */
export async function TodayLineup({ games, categories }: TodayLineupProps) {
	const t = await getTranslations('home')
	const tResult = await getTranslations('gameResult')

	return (
		<section className="home-lineup min-w-0" aria-labelledby="home-lineup-title">
			<div className="flex items-end justify-between gap-x-4">
				<div className="min-w-0">
					<h2
						id="home-lineup-title"
						className="font-display text-[1.375rem] leading-tight md:text-2xl"
					>
						{t('lineup.title')}
					</h2>
					<p className="mt-0.5 text-sm text-muted-foreground">
						{t('lineup.subtitle', { count: games.length })}
					</p>
				</div>
				<Link
					href="/games"
					className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-foreground underline-offset-4 hover:underline"
				>
					{t('lineup.seeAll')}
					<ArrowRight className="h-4 w-4" aria-hidden="true" />
				</Link>
			</div>
			<ul className="no-scrollbar -mx-4 mt-1 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
				{categories.map((category) => (
					<li key={category.value} className="shrink-0">
						<Link
							href={{ pathname: '/games', query: { category: category.value } }}
							className="category-chip"
						>
							{category.label}
							<span className="numeral text-muted-foreground">{category.count}</span>
						</Link>
					</li>
				))}
			</ul>

			<ul className={`mt-3 ${GRID}`}>
				{games.map((game) => (
					<li key={game.slug} className="h-full">
						<GameTile
							slug={game.slug}
							name={game.name}
							tagline={game.tagline}
							duration={game.duration}
							category={game.category}
							theme={game.theme}
							status={game.status}
							score={game.score}
							size="compact"
							labels={{
								play: t('lineup.play'),
								seeResult: tResult('seeResult'),
								freeToday: t('lineup.freeToday'),
							}}
						/>
					</li>
				))}
			</ul>
		</section>
	)
}

/**
 * Reserved space for the lineup while personal completion is unread.
 *
 * No copy, no status chips, no unlock call to action: every tile here would be
 * a claim about this viewer, and the shell has not read any of them yet. The
 * card geometry matches the compact `GameTile` so the real lineup lands
 * without moving the page.
 */
export function TodayLineupSkeleton({ count }: { count: number }) {
	return (
		<section className="home-lineup min-w-0" aria-busy="true">
			<div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
			<div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
			<div className="mt-3 h-11 w-full animate-pulse rounded-full bg-muted/60" />
			<ul className={`mt-3 ${GRID}`}>
				{Array.from({ length: count }, (_, index) => (
					<li
						key={index}
						className="aspect-[4/3.6] animate-pulse rounded-[1.125rem] border border-border bg-card"
					/>
				))}
			</ul>
		</section>
	)
}
