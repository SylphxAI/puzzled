import { cn } from '@/lib/utils'

/**
 * Puzzled brand mark.
 *
 * Four rounded tiles with the last one softened — the piece you are looking
 * for. Drawn with plain rectangles so it stays crisp from 16px favicon to
 * full-bleed hero artwork, and it needs no SVG gradient ids that would clash
 * when several marks render on one page.
 */

const PIECES = [
	{ x: 1.5, y: 1.5, soft: false },
	{ x: 13.5, y: 1.5, soft: false },
	{ x: 1.5, y: 13.5, soft: false },
	{ x: 13.5, y: 13.5, soft: true },
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
 * The tile variant paints the gradient container; mono/inverse render the
 * pieces alone for light and dark backgrounds.
 */
export function BrandMark({
	size = 32,
	tone = 'tile',
	className,
	decorative = true,
}: BrandMarkProps) {
	const tile = tone === 'tile'
	const pieceClassName = tile ? 'fill-white' : tone === 'inverse' ? 'fill-white' : 'fill-primary'

	return (
		<span
			className={cn(
				'inline-flex shrink-0 items-center justify-center',
				tile && 'bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-sm',
				className,
			)}
			style={{
				width: size,
				height: size,
				borderRadius: Math.round(size * 0.3),
			}}
		>
			{decorative ? (
				<svg
					viewBox="0 0 26 26"
					width={Math.round(size * 0.68)}
					height={Math.round(size * 0.68)}
					aria-hidden="true"
				>
					<Pieces className={pieceClassName} />
				</svg>
			) : (
				<svg
					viewBox="0 0 26 26"
					width={Math.round(size * 0.68)}
					height={Math.round(size * 0.68)}
					role="img"
					aria-label="Puzzled"
				>
					<Pieces className={pieceClassName} />
				</svg>
			)}
		</span>
	)
}

function Pieces({ className }: { className: string }) {
	return (
		<>
			{PIECES.map((piece) => (
				<rect
					key={`${piece.x}-${piece.y}`}
					x={piece.x}
					y={piece.y}
					width={11}
					height={11}
					rx={3.2}
					className={cn(className, piece.soft && 'opacity-60')}
				/>
			))}
		</>
	)
}
