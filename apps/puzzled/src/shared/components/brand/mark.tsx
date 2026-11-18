import { cn } from '@/lib/utils'
import wordmark from '../../../../../../brand/wordmark.json'

/**
 * Tryit brand mark and wordmark.
 *
 * The mark is a T built from five puzzle tiles: three across, two down, and
 * the last one amber, the piece that clicks into place. It mirrors
 * brand/svg/puzzled-symbol.svg (64-unit canvas), so the app, the OG card and
 * the raster icons stay one shape. The ground and tiles read the primary
 * tokens, so the mark is ink on paper and paper on charcoal without a second
 * asset.
 */

/** Tile side on the 64-unit canvas. */
export const MARK_TILE = 14
/** Tile corner radius on the 64-unit canvas. */
export const MARK_TILE_RADIUS = 3.2
/** The paper tiles: the T's bar and the top of its stem. */
export const MARK_TILES: ReadonlyArray<readonly [number, number]> = [
	[8.5, 8.5],
	[25, 8.5],
	[41.5, 8.5],
	[25, 25],
]
/** The amber keystone at the foot of the stem. */
export const MARK_KEYSTONE: readonly [number, number] = [25, 41.5]
export const MARK_AMBER = '#F4B42A'

/** Fraunces 600 outline of "Tryit" (brand/svg/puzzled-wordmark.svg). */
export const WORDMARK_VIEWBOX = wordmark.viewBox
export const WORDMARK_PATH = wordmark.path
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
 * `tile` is the app icon (primary ground, contrasting tiles), `inverse` swaps
 * ground and tiles for ink bands, and `mono` is the bare glyph in currentColor.
 */
export function BrandMark({
	size = 32,
	tone = 'tile',
	className,
	decorative = true,
}: BrandMarkProps) {
	const ground =
		tone === 'tile'
			? 'var(--color-primary, #1a1712)'
			: tone === 'inverse'
				? 'var(--color-ink-foreground, #f7f3ea)'
				: 'none'
	const tile =
		tone === 'tile'
			? 'var(--color-primary-foreground, #fbf9f4)'
			: tone === 'inverse'
				? 'var(--color-ink, #1a1712)'
				: 'currentColor'
	return (
		<svg
			viewBox={tone === 'mono' ? '8.5 8.5 47 47' : '0 0 64 64'}
			width={size}
			height={size}
			className={cn('shrink-0', className)}
			aria-hidden={decorative}
			role={decorative ? undefined : 'img'}
			aria-label={decorative ? undefined : 'Tryit'}
		>
			{tone !== 'mono' && <rect width="64" height="64" rx="14" fill={ground} />}
			{MARK_TILES.map(([x, y]) => (
				<rect
					key={`${x}-${y}`}
					x={x}
					y={y}
					width={MARK_TILE}
					height={MARK_TILE}
					rx={MARK_TILE_RADIUS}
					fill={tile}
				/>
			))}
			<rect
				x={MARK_KEYSTONE[0]}
				y={MARK_KEYSTONE[1]}
				width={MARK_TILE}
				height={MARK_TILE}
				rx={MARK_TILE_RADIUS}
				fill={tone === 'mono' ? 'currentColor' : MARK_AMBER}
			/>
		</svg>
	)
}

type WordmarkProps = {
	/** Cap-to-baseline height in CSS pixels. */
	height?: number
	className?: string
}

/** The outlined wordmark in currentColor; it never waits on a web font. */
export function Wordmark({ height = 22, className }: WordmarkProps) {
	const [, , w, h] = WORDMARK_VIEWBOX.split(' ').map(Number)
	return (
		<svg
			viewBox={WORDMARK_VIEWBOX}
			height={height}
			width={Math.round((height * (w ?? 1)) / (h ?? 1))}
			className={cn('shrink-0', className)}
			aria-hidden="true"
		>
			<path d={WORDMARK_PATH} fill="currentColor" />
		</svg>
	)
}
