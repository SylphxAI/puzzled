/**
 * Game Color Theme System
 *
 * Centralized color definitions for all games.
 * ALL classes are static strings - Tailwind tree-shaking works correctly.
 *
 * To add a new theme:
 * 1. Add to GameColorTheme union type
 * 2. Add entry to GAME_COLOR_THEMES with all required classes
 */

/**
 * Available color themes for games
 */
export type GameColorTheme =
	| 'emerald' // word-guess
	| 'cyan' // sudoku, word-search, word-box
	| 'violet' // queens, cryptogram, word-groups
	| 'amber' // word-hive, tango, quad-words
	| 'pink' // nonogram
	| 'rose' // killer-sudoku
	| 'blue' // crossword
	| 'sky' // pattern-match
	| 'orange' // word-ladder
	| 'lime' // arithmo
	| 'slate' // block-slide

/**
 * Complete set of Tailwind classes for a color theme
 * All values are STATIC STRINGS - no runtime construction
 */
export interface GameColorClasses {
	/** Gradient for buttons, cards, icons (e.g., 'from-emerald-500 to-green-600') */
	gradient: string
	/** Solid background (e.g., 'bg-emerald-500') */
	bg: string
	/** Light/transparent background (e.g., 'bg-emerald-500/10') */
	bgLight: string
	/** Text color (e.g., 'text-emerald-500') */
	text: string
	/** Ring/outline color (e.g., 'ring-emerald-500/30') */
	ring: string
	/** Border color (e.g., 'border-emerald-500') */
	border: string
	/** Radial gradient pattern for card backgrounds */
	pattern: string
}

/**
 * Static color class definitions for each theme
 *
 * CRITICAL: All values MUST be literal strings.
 * DO NOT use template literals or string concatenation.
 * This ensures Tailwind can tree-shake unused classes.
 */
export const GAME_COLOR_THEMES: Record<GameColorTheme, GameColorClasses> = {
	emerald: {
		gradient: 'from-emerald-500 to-green-600',
		bg: 'bg-emerald-500',
		bgLight: 'bg-emerald-500/10',
		text: 'text-emerald-500',
		ring: 'ring-emerald-500/30',
		border: 'border-emerald-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.15),transparent_50%)]',
	},
	cyan: {
		gradient: 'from-cyan-500 to-teal-600',
		bg: 'bg-cyan-500',
		bgLight: 'bg-cyan-500/10',
		text: 'text-cyan-500',
		ring: 'ring-cyan-500/30',
		border: 'border-cyan-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(6,182,212,0.15),transparent_50%)]',
	},
	violet: {
		gradient: 'from-violet-500 to-purple-600',
		bg: 'bg-violet-500',
		bgLight: 'bg-violet-500/10',
		text: 'text-violet-500',
		ring: 'ring-violet-500/30',
		border: 'border-violet-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.15),transparent_50%)]',
	},
	amber: {
		gradient: 'from-amber-500 to-orange-600',
		bg: 'bg-amber-500',
		bgLight: 'bg-amber-500/10',
		text: 'text-amber-500',
		ring: 'ring-amber-500/30',
		border: 'border-amber-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.15),transparent_50%)]',
	},
	pink: {
		gradient: 'from-pink-500 to-rose-600',
		bg: 'bg-pink-500',
		bgLight: 'bg-pink-500/10',
		text: 'text-pink-500',
		ring: 'ring-pink-500/30',
		border: 'border-pink-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(236,72,153,0.15),transparent_50%)]',
	},
	rose: {
		gradient: 'from-rose-500 to-pink-600',
		bg: 'bg-rose-500',
		bgLight: 'bg-rose-500/10',
		text: 'text-rose-500',
		ring: 'ring-rose-500/30',
		border: 'border-rose-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(244,63,94,0.15),transparent_50%)]',
	},
	blue: {
		gradient: 'from-blue-500 to-indigo-600',
		bg: 'bg-blue-500',
		bgLight: 'bg-blue-500/10',
		text: 'text-blue-500',
		ring: 'ring-blue-500/30',
		border: 'border-blue-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.15),transparent_50%)]',
	},
	sky: {
		gradient: 'from-sky-500 to-blue-600',
		bg: 'bg-sky-500',
		bgLight: 'bg-sky-500/10',
		text: 'text-sky-500',
		ring: 'ring-sky-500/30',
		border: 'border-sky-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.15),transparent_50%)]',
	},
	orange: {
		gradient: 'from-orange-500 to-red-600',
		bg: 'bg-orange-500',
		bgLight: 'bg-orange-500/10',
		text: 'text-orange-500',
		ring: 'ring-orange-500/30',
		border: 'border-orange-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(249,115,22,0.15),transparent_50%)]',
	},
	lime: {
		gradient: 'from-lime-500 to-green-600',
		bg: 'bg-lime-500',
		bgLight: 'bg-lime-500/10',
		text: 'text-lime-500',
		ring: 'ring-lime-500/30',
		border: 'border-lime-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(132,204,22,0.15),transparent_50%)]',
	},
	slate: {
		gradient: 'from-slate-500 to-gray-600',
		bg: 'bg-slate-500',
		bgLight: 'bg-slate-500/10',
		text: 'text-slate-500',
		ring: 'ring-slate-500/30',
		border: 'border-slate-500',
		pattern: 'bg-[radial-gradient(circle_at_80%_20%,rgba(100,116,139,0.15),transparent_50%)]',
	},
} as const

/**
 * Get color classes for a theme
 * Returns all pre-defined static Tailwind classes for the theme
 */
export function getGameColors(theme: GameColorTheme): GameColorClasses {
	return GAME_COLOR_THEMES[theme]
}

/**
 * Default colors for fallback (uses primary color)
 */
export const DEFAULT_GAME_COLORS: GameColorClasses = {
	gradient: 'from-primary to-primary/70',
	bg: 'bg-primary',
	bgLight: 'bg-primary/10',
	text: 'text-primary',
	ring: 'ring-primary/30',
	border: 'border-primary',
	pattern: '',
}
