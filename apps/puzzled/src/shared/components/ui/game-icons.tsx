/**
 * Game Icons
 *
 * Custom SVG icons for all games.
 * Each game has its own icon in its folder (games/[slug]/icon.tsx).
 * This file provides a unified GameIcon component that pulls from the registry.
 */

import { getGameIconComponent } from '@/games/registry'
import { Icon } from './icon'

type GameIconProps = {
	className?: string
	size?: number
	'aria-hidden'?: boolean | 'true' | 'false'
}

export { ArithmoIcon } from '@/games/arithmo/icon'
export { BlockSlideIcon } from '@/games/block-slide/icon'
export { CrosswordIcon } from '@/games/crossword/icon'
export { CryptogramIcon } from '@/games/cryptogram/icon'
export { KillerSudokuIcon } from '@/games/killer-sudoku/icon'
export { NonogramIcon } from '@/games/nonogram/icon'
export { PatternMatchIcon } from '@/games/pattern-match/icon'
export { QuadWordsIcon } from '@/games/quad-words/icon'
export { QueensIcon } from '@/games/queens/icon'
export { SudokuIcon } from '@/games/sudoku/icon'
export { TangoIcon } from '@/games/tango/icon'
export { WordBoxIcon } from '@/games/word-box/icon'
export { WordGroupsIcon, WordGroupsIcon as ConnectionsIcon } from '@/games/word-groups/icon'
// Re-export individual icons from their game modules
// Familiar name aliases (our games are inspired by these popular puzzles)
export { WordGuessIcon, WordGuessIcon as WordleIcon } from '@/games/word-guess/icon'
export { WordHiveIcon, WordHiveIcon as SpellingBeeIcon } from '@/games/word-hive/icon'
export { WordLadderIcon } from '@/games/word-ladder/icon'
export { WordSearchIcon } from '@/games/word-search/icon'

/**
 * Universal GameIcon component
 * Pulls icon from the game registry - each game owns its own icon
 */
export function GameIcon({
	slug,
	className,
	size = 24,
	...props
}: GameIconProps & { slug: string }) {
	const IconComponent = getGameIconComponent(slug)

	if (IconComponent) {
		return <IconComponent size={size} className={className} {...props} />
	}

	// Fallback: generic puzzle icon
	return <Icon icon="mdi:puzzle" className={className} size={size} {...props} />
}

// ==========================================
// Branding Icons (used in auth pages)
// ==========================================

export function GamepadIcon({ className, size = 24, ...props }: GameIconProps) {
	return <Icon icon="mdi:gamepad-variant" className={className} size={size} {...props} />
}

// Leaderboard Avatar Icons
export const AVATAR_ICONS = [
	'mdi:trophy',
	'mdi:medal',
	'mdi:star',
	'mdi:target',
	'mdi:fire',
	'mdi:crown',
	'mdi:lightning-bolt',
	'mdi:brain',
	'mdi:book-open-variant',
	'mdi:school',
] as const

export function AvatarIcon({
	index,
	className,
	size = 24,
	...props
}: GameIconProps & { index: number }) {
	const iconName = AVATAR_ICONS[index % AVATAR_ICONS.length]
	return <Icon icon={iconName} className={className} size={size} {...props} />
}

// Category Colors for Word Groups (text representation for share)
// Using distinctive Puzzled palette instead of NYT colors
export const CATEGORY_COLORS = {
	0: 'rose', // Coral pink (was yellow)
	1: 'teal', // Cyan (was green)
	2: 'amber', // Gold (was blue)
	3: 'fuchsia', // Violet (was purple)
} as const

// Share text helpers (text-based for clipboard compatibility)
// Using purple/orange for Word Guess (distinctive from NYT green/yellow)
export const SHARE_SQUARES = {
	correct: '🟪', // Purple - Puzzled brand (was green)
	partial: '🟧', // Orange - warm, friendly (was yellow)
	wrong: '⬛',
	// Word Groups category colors
	rose: '🟥', // Coral/Rose
	teal: '🩵', // Teal/Cyan
	amber: '🟨', // Amber/Gold
	fuchsia: '🟪', // Fuchsia/Violet
} as const
