/**
 * Game icon language v2.
 *
 * One vocabulary for every game icon so the set reads as a family:
 * - 24px grid and 2px round-cap strokes in `currentColor`
 * - 1px construction lines at 35% opacity for grids, cages and baselines
 * - exactly one warm accent detail per icon, painted with `text-accent-warm`
 *   so it follows the shell token (amber on the midnight/paper skin)
 *
 * Each game keeps its own `src/games/<slug>/icon.tsx` component as a thin
 * wrapper around the shared art, keeping the old contract: a `size` prop,
 * `className` passthrough, `aria-hidden` by default, other SVG props spread.
 *
 * Wrappers reference the art by property (GAME_ICON_ART.<slug>), never by a
 * slug string: the player-facing mark corpus treats string literals in copy
 * surfaces as player copy, and two of these slugs carry third-party titles.
 */

import type { SVGProps } from 'react'

/** Shared modifiers for one shape of the vocabulary. */
type ShapeStyle = {
	/** 1px construction line at 35% opacity (grids, cages, baselines). */
	thin?: boolean
	/** Painted with the warm accent token instead of currentColor. */
	accent?: boolean
	/** Filled with currentColor instead of stroked. */
	fill?: boolean
	/** Stroke width override (defaults to 2, or 1 for thin). */
	stroke?: number
	/** Dashed stroke; used by the killer cage. */
	dash?: boolean
}

export type GameIconShape =
	| (ShapeStyle & { kind: 'path'; d: string })
	| (ShapeStyle & { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number })
	| (ShapeStyle & { kind: 'circle'; cx: number; cy: number; r: number })

const ART = {
	// Equation tiles; the last tile is the answer that lights up.
	arithmo: [
		{ kind: 'rect', x: 2.6, y: 8, width: 4.5, height: 8, rx: 1.3 },
		{ kind: 'rect', x: 7.7, y: 8, width: 4.5, height: 8, rx: 1.3, thin: true },
		{ kind: 'rect', x: 12.8, y: 8, width: 4.5, height: 8, rx: 1.3 },
		{ kind: 'rect', x: 17.9, y: 8, width: 4.5, height: 8, rx: 1.3, fill: true, accent: true },
	],
	// Sliding block board with the moving piece lit.
	'block-slide': [
		{ kind: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
		{ kind: 'rect', x: 6.4, y: 6.4, width: 7.2, height: 7.2, rx: 1.5, fill: true },
		{ kind: 'rect', x: 14.2, y: 13.8, width: 5.6, height: 5.6, rx: 1.2, fill: true, accent: true },
	],
	// Plus-shaped grid with the centre cell solved.
	crossword: [
		{ kind: 'path', d: 'M9.8 3.6h4.4v6.2h6.2v4.4h-6.2v6.2H9.8v-6.2H3.6V9.8h6.2z' },
		{ kind: 'rect', x: 10.6, y: 10.6, width: 2.8, height: 2.8, rx: 0.8, fill: true, accent: true },
	],
	// Cipher: one letter tile translated into another.
	cryptogram: [
		{ kind: 'rect', x: 3, y: 7.6, width: 6, height: 8.8, rx: 1.5 },
		{ kind: 'rect', x: 15, y: 7.6, width: 6, height: 8.8, rx: 1.5, fill: true, accent: true },
		{ kind: 'path', d: 'M9.4 12h4.9M12.4 10.2 14.2 12l-1.8 1.8' },
	],
	// Grid with a dashed killer cage.
	'killer-sudoku': [
		{ kind: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
		{ kind: 'path', d: 'M9 3v18M15 3v18M3 9h18M3 15h18', thin: true },
		{ kind: 'rect', x: 4.4, y: 4.4, width: 8.8, height: 8.8, rx: 1.6, accent: true, dash: true },
	],
	// Filled cells reveal the picture.
	nonogram: [
		{ kind: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
		{ kind: 'path', d: 'M9 3v18M15 3v18M3 9h18M3 15h18', thin: true },
		{ kind: 'rect', x: 3.6, y: 3.6, width: 4.8, height: 4.8, rx: 0.9, fill: true },
		{ kind: 'rect', x: 9.6, y: 9.6, width: 4.8, height: 4.8, rx: 0.9, fill: true },
		{ kind: 'rect', x: 15.6, y: 3.6, width: 4.8, height: 4.8, rx: 0.9, fill: true, accent: true },
	],
	// A traced route between waypoints, ending on the lit dot.
	'number-path': [
		{ kind: 'path', d: 'M4.6 19.4 9 13.4l3.9 3.3 6.5-9' },
		{ kind: 'circle', cx: 4.6, cy: 19.4, r: 1.7, fill: true },
		{ kind: 'circle', cx: 9, cy: 13.4, r: 1.1, fill: true },
		{ kind: 'circle', cx: 19.4, cy: 7.7, r: 2.3, fill: true, accent: true },
	],
	// A shape and its match; the matched core lights up.
	'pattern-match': [
		{ kind: 'rect', x: 3, y: 3, width: 8.6, height: 8.6, rx: 2 },
		{ kind: 'rect', x: 5.6, y: 5.6, width: 3.4, height: 3.4, rx: 1, fill: true },
		{ kind: 'circle', cx: 16.9, cy: 16.9, r: 4.6 },
		{ kind: 'circle', cx: 16.9, cy: 16.9, r: 2, fill: true, accent: true },
	],
	// Die face; the winning pip is lit.
	'pip-place': [
		{ kind: 'rect', x: 4, y: 4, width: 16, height: 16, rx: 3.5 },
		{ kind: 'circle', cx: 9, cy: 9, r: 1.45, fill: true },
		{ kind: 'circle', cx: 15, cy: 15, r: 1.45, fill: true },
		{ kind: 'circle', cx: 15, cy: 9, r: 2, fill: true, accent: true },
	],
	// Four word tiles; the odd one out is lit.
	'quad-words': [
		{ kind: 'rect', x: 3, y: 3, width: 8, height: 8, rx: 2 },
		{ kind: 'rect', x: 13, y: 3, width: 8, height: 8, rx: 2 },
		{ kind: 'rect', x: 3, y: 13, width: 8, height: 8, rx: 2 },
		{ kind: 'rect', x: 13, y: 13, width: 8, height: 8, rx: 2, fill: true, accent: true },
		{ kind: 'path', d: 'M5.2 8.4h3.6M15.2 8.4h3.6M5.2 18.4h3.6', thin: true },
	],
	// Board with one crown placed.
	queens: [
		{ kind: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
		{ kind: 'path', d: 'M9 3v18M15 3v18M3 9h18M3 15h18', thin: true },
		{
			kind: 'path',
			d: 'M8.4 14.6 7.2 10.2l2.7 1.5L12 7.4l2.1 4.3 2.7-1.5-1.2 4.4z',
			fill: true,
			accent: true,
		},
	],
	// Boxed 9x9 grid with one solved cell (no glyphs).
	sudoku: [
		{ kind: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 1.6 },
		{ kind: 'path', d: 'M6 3v18M12 3v18M18 3v18M3 6h18M3 12h18M3 18h18', thin: true },
		{ kind: 'path', d: 'M9 3v18M15 3v18M3 9h18M3 15h18' },
		{ kind: 'rect', x: 9.5, y: 9.5, width: 5, height: 5, rx: 1, fill: true, accent: true },
	],
	// A pair: outline companion and lit companion.
	tango: [
		{ kind: 'circle', cx: 8.2, cy: 12, r: 3.7 },
		{ kind: 'circle', cx: 15.8, cy: 12, r: 3.7, fill: true, accent: true },
	],
	// Box with the last cell filled by the answer.
	'word-box': [
		{ kind: 'rect', x: 3, y: 4, width: 18, height: 16, rx: 2 },
		{ kind: 'path', d: 'M12 4v16M3 12h18', thin: true },
		{ kind: 'rect', x: 12.6, y: 12.6, width: 7.8, height: 6.8, rx: 1.4, fill: true, accent: true },
	],
	// Word groups laid out in rows; the odd group is lit.
	'word-groups': [
		{ kind: 'rect', x: 3, y: 4.8, width: 8.4, height: 5.4, rx: 2.7 },
		{ kind: 'rect', x: 12.6, y: 4.8, width: 8.4, height: 5.4, rx: 2.7 },
		{ kind: 'rect', x: 3, y: 13.8, width: 8.4, height: 5.4, rx: 2.7 },
		{ kind: 'rect', x: 12.6, y: 13.8, width: 8.4, height: 5.4, rx: 2.7, fill: true, accent: true },
	],
	// Three guesses; the last one lands.
	'word-guess': [
		{ kind: 'rect', x: 3, y: 7, width: 5.2, height: 10, rx: 1.4 },
		{ kind: 'rect', x: 9.4, y: 7, width: 5.2, height: 10, rx: 1.4 },
		{ kind: 'rect', x: 15.8, y: 7, width: 5.2, height: 10, rx: 1.4, fill: true, accent: true },
	],
	// Hive cell with its centre lit.
	'word-hive': [
		{ kind: 'path', d: 'M12 3.4 19 7.4v9.2L12 20.6 5 16.6V7.4z' },
		{ kind: 'path', d: 'M12 8.4l2.95 1.7v3.8L12 15.6l-2.95-1.7v-3.8z', fill: true, accent: true },
	],
	// One rung of the ladder changed.
	'word-ladder': [
		{ kind: 'path', d: 'M7.5 3.4v17.2M16.5 3.4v17.2' },
		{ kind: 'path', d: 'M7.5 7.6h9M7.5 16.4h9' },
		{ kind: 'path', d: 'M7.5 12h9', accent: true },
	],
	// Grid with the found word marked in the accent.
	'word-search': [
		{ kind: 'rect', x: 3, y: 3, width: 18, height: 18, rx: 2 },
		{ kind: 'path', d: 'M7.5 3v18M12 3v18M16.5 3v18M3 7.5h18M3 12h18M3 16.5h18', thin: true },
		{ kind: 'path', d: 'M5.4 18.6 18.6 5.4', accent: true, stroke: 3.6 },
	],
} as const

/**
 * The art per game. Keyed by folder slug; the key set is the public slug
 * union, so adding a game means adding one entry here and one wrapper.
 */
export const GAME_ICON_ART = ART

export type GameIconSlug = keyof typeof ART

export type GameIconProps = SVGProps<SVGSVGElement> & { size?: number }

function renderShape(shape: GameIconShape, key: string) {
	const { accent = false, fill = false, thin = false, stroke, dash = false } = shape
	const style = {
		className: accent ? 'text-accent-warm' : undefined,
		fill: fill ? 'currentColor' : 'none',
		strokeWidth: stroke ?? (thin ? 1 : 2),
		opacity: thin ? 0.35 : undefined,
		strokeDasharray: dash ? '2.6 2.4' : undefined,
	}
	switch (shape.kind) {
		case 'path':
			return <path key={key} d={shape.d} {...style} />
		case 'rect':
			return (
				<rect
					key={key}
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					rx={shape.rx}
					{...style}
				/>
			)
		case 'circle':
			return <circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...style} />
		default:
			return null
	}
}

/**
 * Builds the icon component for one piece of art. The frame is fixed here so
 * the whole set cannot drift apart: 24px viewBox, currentColor stroke, round
 * caps, `aria-hidden` unless the caller overrides it.
 */
export function createGameIcon(shapes: readonly GameIconShape[]) {
	function GameIcon({ size = 24, className, ...props }: GameIconProps) {
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				width={size}
				height={size}
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				className={className}
				aria-hidden="true"
				{...props}
			>
				{shapes.map((shape, index) => renderShape(shape, String(index)))}
			</svg>
		)
	}
	return GameIcon
}
