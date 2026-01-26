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

// Re-export individual icons from their game modules



export { CrosswordIcon } from '@/games/crossword/icon'
export { WordLadderIcon } from '@/games/word-ladder/icon'




export { SudokuIcon } from '@/games/sudoku/icon'

export { NonogramIcon } from '@/games/nonogram/icon'


export { PatternMatchIcon } from '@/games/pattern-match/icon'
export { BlockSlideIcon } from '@/games/block-slide/icon'
export { ArithmoIcon } from '@/games/arithmo/icon'

// Familiar name aliases (our games are inspired by these popular puzzles)
export { WordGuessIcon as WordleIcon } from '@/games/word-guess/icon'
export { WordGroupsIcon as ConnectionsIcon } from '@/games/word-groups/icon'
export { WordHiveIcon as SpellingBeeIcon } from '@/games/word-hive/icon'

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

function GamepadIcon({ className, size = 24, ...props }: GameIconProps) {
	return <Icon icon="mdi:gamepad-variant" className={className} size={size} {...props} />
}

// Leaderboard Avatar Icons
const AVATAR_ICONS = [
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

function AvatarIcon({
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
const CATEGORY_COLORS = {
	0: 'rose', // Coral pink (was yellow)
	1: 'teal', // Cyan (was green)
	2: 'amber', // Gold (was blue)
	3: 'fuchsia', // Violet (was purple)
} as const

// Share text helpers (text-based for clipboard compatibility)
// Using purple/orange for Word Guess (distinctive from NYT green/yellow)
const SHARE_SQUARES = {
	correct: '🟪', // Purple - Puzzled brand (was green)
	partial: '🟧', // Orange - warm, friendly (was yellow)
	wrong: '⬛',
	// Word Groups category colors
	rose: '🟥', // Coral/Rose
	teal: '🩵', // Teal/Cyan
	amber: '🟨', // Amber/Gold
	fuchsia: '🟪', // Fuchsia/Violet
} as const
