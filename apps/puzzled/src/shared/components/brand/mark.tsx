import { cn } from '@/lib/utils'

/**
 * Puzzled brand mark.
 *
 * Four rounded tiles on the midnight ink ground, the last one lit amber - the
 * piece you are looking for. It mirrors public/brand/mark.svg so the app, the
 * OG card and the raster favicons stay one shape, and plain rectangles need no
 * gradient ids when several marks render on one page.
 */

const INK = '#0e1226'
const PAPER = '#faf6ef'
const AMBER = '#fbbf24'

const PIECES = [
	{ x: 1.5, y: 1.5, accent: false },
	{ x: 13.5, y: 1.5, accent: false },
	{ x: 1.5, y: 13.5, accent: false },
	{ x: 13.5, y: 13.5, accent: true },
] as const

export type BrandMarkTone = 'tile' | 'mono' | 'inverse'

type BrandMarkProps = {
	/** Rendered size in CSS pixels. */
	size?: number
	tone?: BrandMarkTone
	className?: string
	/** Decorative marks next to text stay hidden from assistive tech. */
	decorative?: boolean
}

/**
 * `tile` paints the ink container with warm paper pieces (the app icon),
 * `inverse` draws the pieces for ink backgrounds, and `mono` is a single
 * currentColor mark with the fourth piece hollowed out, so it holds on both
 * paper and ink.
 */
export function BrandMark({
	size = 32,
	tone = 'tile',
	className,
	decorative = true,
}: BrandMarkProps) {
	const mono = tone === 'mono'
	return (
		<span
			className={cn('inline-flex shrink-0 items-center justify-center', className)}
			style={{
				width: size,
				height: size,
				borderRadius: Math.round(size * 0.22),
				background: tone === 'tile' ? INK : undefined,
			}}
		>
			<svg
				viewBox="0 0 26 26"
				width={Math.round(size * 0.68)}
				height={Math.round(size * 0.68)}
				aria-hidden={decorative}
				role={decorative ? undefined : 'img'}
				aria-label={decorative ? undefined : 'Puzzled'}
			>
				{PIECES.map((piece) => {
					if (mono && piece.accent) {
						return (
							<rect
								key={`${piece.x}-${piece.y}`}
								x={piece.x}
								y={piece.y}
								width={11}
								height={11}
								rx={3.2}
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
							/>
						)
					}
					const fill = piece.accent ? AMBER : mono ? 'currentColor' : PAPER
					return (
						<rect
							key={`${piece.x}-${piece.y}`}
							x={piece.x}
							y={piece.y}
							width={11}
							height={11}
							rx={3.2}
							fill={fill}
						/>
					)
				})}
			</svg>
		</span>
	)
}
