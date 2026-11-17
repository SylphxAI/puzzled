import wordmark from '../../../../../../brand/wordmark.json'
import { cn } from '@/lib/utils'

/**
 * Tryit brand mark and wordmark.
 *
 * The mark is a question-mark hook whose dot is a single amber tile: the
 * piece you are looking for. It mirrors brand/svg/puzzled-symbol.svg (64-unit
 * canvas), so the app, the OG card and the raster icons stay one shape.
 * The ground and hook read the primary tokens, so the tile is ink on paper
 * and paper on charcoal without a second asset.
 */

export const MARK_HOOK_PATH = 'M21 23a11 11 0 1 1 16.5 9.53Q32 35.6 32 39'
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
 * `tile` is the app icon (primary ground, contrasting hook), `inverse` swaps
 * ground and hook for ink bands, and `mono` is the bare glyph in currentColor.
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
	const hook =
		tone === 'tile'
			? 'var(--color-primary-foreground, #fbf9f4)'
			: tone === 'inverse'
				? 'var(--color-ink, #1a1712)'
				: 'currentColor'
	return (
		<svg
			viewBox="0 0 64 64"
			width={size}
			height={size}
			className={cn('shrink-0', className)}
			aria-hidden={decorative}
			role={decorative ? undefined : 'img'}
			aria-label={decorative ? undefined : 'Tryit'}
		>
			{tone !== 'mono' && <rect width="64" height="64" rx="14" fill={ground} />}
			<path
				d={MARK_HOOK_PATH}
				fill="none"
				stroke={hook}
				strokeWidth={8}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<rect x="27" y="46" width="10" height="10" rx="2.6" fill={MARK_AMBER} />
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
