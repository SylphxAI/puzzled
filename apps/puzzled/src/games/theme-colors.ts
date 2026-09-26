/**
 * Game colour themes.
 *
 * Each game owns one flat pastel field with an ink glyph on it, the way a
 * puzzle book colours its sections: the field identifies the game, and the
 * shell around it stays ink and paper. `text` is the deep form of the hue
 * for small text on paper (AA), and the pastel itself on charcoal.
 *
 * ALL classes are literal strings so Tailwind can see them.
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
	| 'orange' // word-ladder, pip-place
	| 'lime' // arithmo
	| 'slate' // block-slide, number-path

export interface GameColorClasses {
	/** Kept for gradient call sites: a flat field (from = to). */
	gradient: string
	/** Solid field. */
	bg: string
	/** Soft tint of the field. */
	bgLight: string
	/** The hue as small text: deep on paper, pastel on charcoal. */
	text: string
	/** Ring in the hue. */
	ring: string
	/** Border in the hue. */
	border: string
	/** Card texture; flat by design. */
	pattern: string
	/** Accent stripe (the field). */
	stripe: string
	/** Hover emphasis (neutral lift; the field carries the hue). */
	glow: string
	/** Glyph and text colour placed on the field. */
	onField: string
	/** Raw field colour for inline styles and generated images. */
	hex: string
	/** Raw deep hue (the `text` colour on paper) for generated images. */
	deepHex: string
}

const GAME_COLOR_THEMES: Record<GameColorTheme, GameColorClasses> = {
	emerald: {
		gradient: 'from-[#a8d5b5] to-[#a8d5b5]',
		bg: 'bg-[#a8d5b5]',
		bgLight: 'bg-[#a8d5b5]/30',
		text: 'text-[#1d6b3d] dark:text-[#a8d5b5]',
		ring: 'ring-[#a8d5b5]',
		border: 'border-[#a8d5b5]',
		pattern: '',
		stripe: 'bg-[#a8d5b5]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#1d6b3d',
		hex: '#a8d5b5',
	},
	cyan: {
		gradient: 'from-[#a6d8dd] to-[#a6d8dd]',
		bg: 'bg-[#a6d8dd]',
		bgLight: 'bg-[#a6d8dd]/30',
		text: 'text-[#0e5f68] dark:text-[#a6d8dd]',
		ring: 'ring-[#a6d8dd]',
		border: 'border-[#a6d8dd]',
		pattern: '',
		stripe: 'bg-[#a6d8dd]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#0e5f68',
		hex: '#a6d8dd',
	},
	violet: {
		gradient: 'from-[#c6b9f2] to-[#c6b9f2]',
		bg: 'bg-[#c6b9f2]',
		bgLight: 'bg-[#c6b9f2]/30',
		text: 'text-[#4b37a6] dark:text-[#c6b9f2]',
		ring: 'ring-[#c6b9f2]',
		border: 'border-[#c6b9f2]',
		pattern: '',
		stripe: 'bg-[#c6b9f2]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#4b37a6',
		hex: '#c6b9f2',
	},
	amber: {
		gradient: 'from-[#f5d36b] to-[#f5d36b]',
		bg: 'bg-[#f5d36b]',
		bgLight: 'bg-[#f5d36b]/30',
		text: 'text-[#6e4a00] dark:text-[#f5d36b]',
		ring: 'ring-[#f5d36b]',
		border: 'border-[#f5d36b]',
		pattern: '',
		stripe: 'bg-[#f5d36b]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#6e4a00',
		hex: '#f5d36b',
	},
	pink: {
		gradient: 'from-[#f3b8d0] to-[#f3b8d0]',
		bg: 'bg-[#f3b8d0]',
		bgLight: 'bg-[#f3b8d0]/30',
		text: 'text-[#9a2a5c] dark:text-[#f3b8d0]',
		ring: 'ring-[#f3b8d0]',
		border: 'border-[#f3b8d0]',
		pattern: '',
		stripe: 'bg-[#f3b8d0]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#9a2a5c',
		hex: '#f3b8d0',
	},
	rose: {
		gradient: 'from-[#f0aba3] to-[#f0aba3]',
		bg: 'bg-[#f0aba3]',
		bgLight: 'bg-[#f0aba3]/30',
		text: 'text-[#9b2f24] dark:text-[#f0aba3]',
		ring: 'ring-[#f0aba3]',
		border: 'border-[#f0aba3]',
		pattern: '',
		stripe: 'bg-[#f0aba3]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#9b2f24',
		hex: '#f0aba3',
	},
	blue: {
		gradient: 'from-[#aec6f2] to-[#aec6f2]',
		bg: 'bg-[#aec6f2]',
		bgLight: 'bg-[#aec6f2]/30',
		text: 'text-[#2045a0] dark:text-[#aec6f2]',
		ring: 'ring-[#aec6f2]',
		border: 'border-[#aec6f2]',
		pattern: '',
		stripe: 'bg-[#aec6f2]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#2045a0',
		hex: '#aec6f2',
	},
	sky: {
		gradient: 'from-[#b5ddf4] to-[#b5ddf4]',
		bg: 'bg-[#b5ddf4]',
		bgLight: 'bg-[#b5ddf4]/30',
		text: 'text-[#0f5a85] dark:text-[#b5ddf4]',
		ring: 'ring-[#b5ddf4]',
		border: 'border-[#b5ddf4]',
		pattern: '',
		stripe: 'bg-[#b5ddf4]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#0f5a85',
		hex: '#b5ddf4',
	},
	orange: {
		gradient: 'from-[#f5bd8e] to-[#f5bd8e]',
		bg: 'bg-[#f5bd8e]',
		bgLight: 'bg-[#f5bd8e]/30',
		text: 'text-[#8e3f0c] dark:text-[#f5bd8e]',
		ring: 'ring-[#f5bd8e]',
		border: 'border-[#f5bd8e]',
		pattern: '',
		stripe: 'bg-[#f5bd8e]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#8e3f0c',
		hex: '#f5bd8e',
	},
	lime: {
		gradient: 'from-[#cfe39a] to-[#cfe39a]',
		bg: 'bg-[#cfe39a]',
		bgLight: 'bg-[#cfe39a]/30',
		text: 'text-[#4a6512] dark:text-[#cfe39a]',
		ring: 'ring-[#cfe39a]',
		border: 'border-[#cfe39a]',
		pattern: '',
		stripe: 'bg-[#cfe39a]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#4a6512',
		hex: '#cfe39a',
	},
	slate: {
		gradient: 'from-[#cfc9bc] to-[#cfc9bc]',
		bg: 'bg-[#cfc9bc]',
		bgLight: 'bg-[#cfc9bc]/30',
		text: 'text-[#4f4a40] dark:text-[#cfc9bc]',
		ring: 'ring-[#cfc9bc]',
		border: 'border-[#cfc9bc]',
		pattern: '',
		stripe: 'bg-[#cfc9bc]',
		glow: 'hover:shadow-lift',
		onField: 'text-[#1a1712] [--icon-accent:#1a1712]',
		deepHex: '#4f4a40',
		hex: '#cfc9bc',
	},
}

/** Color classes for a theme. */
export function getGameColors(theme: GameColorTheme): GameColorClasses {
	return GAME_COLOR_THEMES[theme]
}

/** Fallback when a module has no theme: ink field, paper glyph. */
export const DEFAULT_GAME_COLORS: GameColorClasses = {
	gradient: 'from-primary to-primary',
	bg: 'bg-primary',
	bgLight: 'bg-muted',
	text: 'text-foreground',
	ring: 'ring-border',
	border: 'border-border',
	pattern: '',
	stripe: 'bg-primary',
	glow: 'hover:shadow-lift',
	onField: 'text-primary-foreground',
	hex: '#1a1712',
	deepHex: '#1a1712',
}
