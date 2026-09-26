import { Check } from 'lucide-react'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { GameIcon } from '@/shared/components/ui/game-icons'

/** `free`: today's featured module. `play`: any other module. `solved`: a proved finish. */
export type GameTileStatus = 'free' | 'play' | 'solved'

type GameTileLabels = {
	play: string
	playAgain: string
	freeToday: string
}

type GameTileProps = {
	slug: string
	name: string
	tagline: string
	/** Compact fact line, e.g. "~10 min • Classic logic". */
	meta: string
	theme: GameColorTheme
	status: GameTileStatus
	/** Proved score for solved tiles; never invented. */
	score?: string | null
	labels: GameTileLabels
	className?: string
	/** Stagger helper for entrance motion. */
	index?: number
}

/**
 * One daily game as a card: the game's pastel field with its glyph in ink,
 * then the name in the display face and one line about it. The title owns a
 * stretched link, so the whole card is one target with one accessible name.
 */
export function GameTile({
	slug,
	name,
	tagline,
	meta,
	theme,
	status,
	score,
	labels,
	className,
	index = 0,
}: GameTileProps) {
	const colors = getGameColors(theme)
	const solved = status === 'solved'
	const free = status === 'free'

	return (
		<div
			className={cn(
				'group animate-enter surface-card-hover relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card',
				'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
				className,
			)}
			style={{ '--enter-delay': `${Math.min(index, 8) * 40}ms` } as React.CSSProperties}
		>
			<div
				className={cn(
					'relative flex aspect-[16/10] items-center justify-center',
					colors.bg,
					colors.onField,
				)}
			>
				<GameIcon
					slug={slug}
					size={52}
					className="h-11 w-11 transition-transform md:h-14 md:w-14 duration-medium ease-out group-hover:scale-110"
				/>
				{free && (
					<span className="absolute left-2.5 top-2.5 rounded-full bg-[#1a1712] px-2 py-0.5 text-[11px] font-semibold text-[#fbf9f4]">
						{labels.freeToday}
					</span>
				)}
				{solved && (
					<span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[#1a1712]">
						<Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
						{score ? score : labels.playAgain}
					</span>
				)}
			</div>

			<div className="flex flex-1 flex-col p-3.5 sm:p-4">
				<h3 className="font-display text-[1.0625rem] leading-tight sm:text-lg">
					<Link href={`/games/${slug}`} className="outline-none after:absolute after:inset-0">
						{name}
					</Link>
				</h3>
				<p className="mt-1 line-clamp-2 flex-1 text-[13px] leading-snug text-muted-foreground sm:text-sm">
					{tagline}
				</p>
				<p className="mt-2.5 truncate text-xs text-muted-foreground">
					{meta}
					<span className="sr-only"> — {solved ? labels.playAgain : labels.play}</span>
				</p>
			</div>
		</div>
	)
}
