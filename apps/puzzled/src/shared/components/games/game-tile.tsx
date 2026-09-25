import { Check, Sparkles } from 'lucide-react'
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
 * Catalog/home tile for one daily module.
 *
 * The title owns the stretched link so the whole tile is one target.
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
				'group animate-enter relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition duration-200',
				'hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
				colors.glow,
				className,
			)}
			style={{ '--enter-delay': `${Math.min(index, 8) * 45}ms` } as React.CSSProperties}
		>
			<div
				className={cn('pointer-events-none absolute inset-0 opacity-70', colors.pattern)}
				aria-hidden="true"
			/>
			{/* The module's own hue: an accent stripe the shell never repaints. */}
			<div className={cn('absolute inset-x-0 top-0 h-1', colors.stripe)} aria-hidden="true" />

			<div className="relative flex items-start justify-between gap-3">
				<span
					className={cn(
						'flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ring-2 ring-inset ring-white/25 transition-transform duration-200 group-hover:scale-105',
						colors.gradient,
					)}
				>
					<GameIcon slug={slug} size={24} />
				</span>

				{free && (
					<span className="chip bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
						<Sparkles className="h-3 w-3" aria-hidden="true" />
						{labels.freeToday}
					</span>
				)}
				{solved && (
					<span className="chip bg-emerald-500/12 text-emerald-700 dark:text-emerald-400">
						<Check className="h-3 w-3" aria-hidden="true" />
						{score ? score : labels.playAgain}
					</span>
				)}
			</div>

			<h3 className="relative mt-3.5 font-display text-base font-bold leading-tight">
				<Link href={`/games/${slug}`} className="outline-none after:absolute after:inset-0">
					{name}
				</Link>
			</h3>

			<p className="relative mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{tagline}</p>

			<div className="relative mt-3 flex items-center justify-between gap-2 text-xs">
				<span className="font-medium text-muted-foreground">{meta}</span>
				<span className={cn('font-semibold', colors.text)}>
					{solved ? labels.playAgain : labels.play} →
				</span>
			</div>
		</div>
	)
}
