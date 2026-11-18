import { Check, Clock } from 'lucide-react'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { GameMotifImage } from './game-motif'

/** `free`: today's featured module. `play`: any other module. `solved`: a proved finish. */
export type GameTileStatus = 'free' | 'play' | 'solved'

type GameTileLabels = {
	play: string
	/** Solved tiles open the finished result, so they say so. */
	seeResult: string
	freeToday: string
}

/** What a tile says about where it leads: the proved score, else the result. */
export function solvedChipLabel(score: string | null | undefined, labels: GameTileLabels): string {
	return score ? score : labels.seeResult
}

/** Hidden link text: a solved tile leads to its result, any other to play. */
export function tileLinkHint(status: GameTileStatus, labels: GameTileLabels): string {
	return status === 'solved' ? labels.seeResult : labels.play
}

type GameTileProps = {
	slug: string
	name: string
	tagline: string
	/** Typical solve time, e.g. "~10 min". */
	duration: string
	/** Localised category, e.g. "Word". */
	category: string
	theme: GameColorTheme
	status: GameTileStatus
	/** Proved score for solved tiles; never invented. */
	score?: string | null
	labels: GameTileLabels
	/** `compact` drops the tagline for dense grids (the home lineup). */
	size?: 'default' | 'compact'
	className?: string
}

/**
 * One daily game as a tactile card: the game's colour field holding a
 * miniature of its board, then the name in the display face, one line about
 * it, and the solve time and category as tags. The whole card is the link, so
 * the target stays large even where a sticky bar covers part of it.
 */
export function GameTile({
	slug,
	name,
	tagline,
	duration,
	category,
	theme,
	status,
	score,
	labels,
	size = 'default',
	className,
}: GameTileProps) {
	const colors = getGameColors(theme)
	const solved = status === 'solved'
	const free = status === 'free'
	const compact = size === 'compact'

	return (
		<Link
			href={`/games/${slug}`}
			data-game-tile={slug}
			className={cn(
				'tactile-card group relative flex h-full flex-col overflow-hidden outline-none',
				'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
				className,
			)}
		>
			<div
				className={cn(
					'tactile-card-field relative aspect-[16/10] overflow-hidden',
					colors.bg,
					compact ? 'px-1.5 py-1' : 'px-3 py-2',
				)}
			>
				<GameMotifImage
					slug={slug}
					zoom={compact}
					className="transition-transform duration-medium ease-out group-hover:scale-[1.04]"
				/>
				{free && (
					<span className="absolute left-2 top-2 rounded-full bg-[#1a1712] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[#fbf9f4]">
						{labels.freeToday}
					</span>
				)}
				{solved && (
					<span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-[#1a1712] bg-[#fbf9f4] px-2 py-0.5 text-[11px] font-semibold leading-4 text-[#1a1712]">
						<Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
						{solvedChipLabel(score, labels)}
					</span>
				)}
			</div>

			<div className={cn('flex flex-1 flex-col', compact ? 'px-3 pb-2.5 pt-2' : 'p-3.5 sm:p-4')}>
				<h3
					className={cn(
						'game-tile-title min-w-0 font-display leading-tight',
						compact ? 'text-[15px] sm:text-base' : 'text-[1.0625rem] sm:text-lg',
					)}
				>
					{name}
				</h3>
				{compact ? (
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						{category} · <span className="numeral">{duration}</span>
						<span className="sr-only"> — {tileLinkHint(status, labels)}</span>
					</p>
				) : (
					<>
						<p className="mt-1 line-clamp-2 flex-1 text-[13px] leading-snug text-muted-foreground sm:text-sm">
							{tagline}
						</p>
						<p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
							<span className="tag-chip numeral">
								<Clock className="h-3 w-3" aria-hidden="true" />
								{duration}
							</span>
							<span className="tag-chip">{category}</span>
							<span className="sr-only"> — {tileLinkHint(status, labels)}</span>
						</p>
					</>
				)}
			</div>
		</Link>
	)
}
