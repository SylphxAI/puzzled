/**
 * Game Icons
 *
 * Custom SVG icons for all games.
 * Each game has its own icon in its folder (games/[slug]/icon.tsx).
 * This file provides a unified GameIcon component.
 *
 * NOTE: This file must NOT import from @/games/registry to avoid pulling in
 * server-only code (node:fs via puzzle generators). Icons are client-safe.
 */

import { ArithmoIcon } from "@/games/arithmo/icon";
import { BlockSlideIcon } from "@/games/block-slide/icon";
import { CrosswordIcon } from "@/games/crossword/icon";
import { CryptogramIcon } from "@/games/cryptogram/icon";
import { KillerSudokuIcon } from "@/games/killer-sudoku/icon";
import { NonogramIcon } from "@/games/nonogram/icon";
import { PatternMatchIcon } from "@/games/pattern-match/icon";
import { QuadWordsIcon } from "@/games/quad-words/icon";
import { QueensIcon } from "@/games/queens/icon";
import { SudokuIcon } from "@/games/sudoku/icon";
import { TangoIcon } from "@/games/tango/icon";
import { WordBoxIcon } from "@/games/word-box/icon";
import { WordGroupsIcon } from "@/games/word-groups/icon";
import { WordGuessIcon } from "@/games/word-guess/icon";
import { WordHiveIcon } from "@/games/word-hive/icon";
import { WordLadderIcon } from "@/games/word-ladder/icon";
import { WordSearchIcon } from "@/games/word-search/icon";
import type { ComponentType } from "react";
import { Icon } from "./icon";

type GameIconProps = {
	className?: string;
	size?: number;
	"aria-hidden"?: boolean | "true" | "false";
};

type IconComponent = ComponentType<{ size?: number; className?: string }>;

/**
 * Client-safe icon registry
 * Maps game slugs to their icon components without importing full game configs
 */
const GAME_ICONS: Record<string, IconComponent> = {
	arithmo: ArithmoIcon,
	"block-slide": BlockSlideIcon,
	crossword: CrosswordIcon,
	cryptogram: CryptogramIcon,
	"killer-sudoku": KillerSudokuIcon,
	nonogram: NonogramIcon,
	"pattern-match": PatternMatchIcon,
	"quad-words": QuadWordsIcon,
	queens: QueensIcon,
	sudoku: SudokuIcon,
	tango: TangoIcon,
	"word-box": WordBoxIcon,
	"word-groups": WordGroupsIcon,
	"word-guess": WordGuessIcon,
	"word-hive": WordHiveIcon,
	"word-ladder": WordLadderIcon,
	"word-search": WordSearchIcon,
};

// Re-export individual icons from their game modules
export {
	ArithmoIcon,
	BlockSlideIcon,
	CrosswordIcon,
	CryptogramIcon,
	KillerSudokuIcon,
	NonogramIcon,
	PatternMatchIcon,
	QuadWordsIcon,
	QueensIcon,
	SudokuIcon,
	TangoIcon,
	WordBoxIcon,
	WordGroupsIcon,
	WordGuessIcon,
	WordHiveIcon,
	WordLadderIcon,
	WordSearchIcon,
};

// Familiar name aliases (our games are inspired by these popular puzzles)
export { WordGroupsIcon as ConnectionsIcon };
export { WordGuessIcon as WordleIcon };
export { WordHiveIcon as SpellingBeeIcon };

/**
 * Universal GameIcon component
 * Uses local icon map - does NOT import from registry (server-only code)
 */
export function GameIcon({
	slug,
	className,
	size = 24,
	...props
}: GameIconProps & { slug: string }) {
	const IconComponent = GAME_ICONS[slug];

	if (IconComponent) {
		return <IconComponent size={size} className={className} {...props} />;
	}

	// Fallback: generic puzzle icon
	return (
		<Icon
			icon="mdi:puzzle"
			className={className}
			width={size}
			height={size}
			{...props}
		/>
	);
}

// ==========================================
// Branding Icons (used in auth pages)
// ==========================================

function _GamepadIcon({ className, size = 24, ...props }: GameIconProps) {
	return (
		<Icon
			icon="mdi:gamepad-variant"
			className={className}
			width={size}
			height={size}
			{...props}
		/>
	);
}

// Leaderboard Avatar Icons
const AVATAR_ICONS = [
	"mdi:trophy",
	"mdi:medal",
	"mdi:star",
	"mdi:target",
	"mdi:fire",
	"mdi:crown",
	"mdi:lightning-bolt",
	"mdi:brain",
	"mdi:book-open-variant",
	"mdi:school",
] as const;

function _AvatarIcon({
	index,
	className,
	size = 24,
	...props
}: GameIconProps & { index: number }) {
	const iconName = AVATAR_ICONS[index % AVATAR_ICONS.length];
	return (
		<Icon
			icon={iconName}
			className={className}
			width={size}
			height={size}
			{...props}
		/>
	);
}

// Category Colors for Word Groups (text representation for share)
// Using distinctive Puzzled palette instead of NYT colors
const _CATEGORY_COLORS = {
	0: "rose", // Coral pink (was yellow)
	1: "teal", // Cyan (was green)
	2: "amber", // Gold (was blue)
	3: "fuchsia", // Violet (was purple)
} as const;

// Share text helpers (text-based for clipboard compatibility)
// Using purple/orange for Word Guess (distinctive from NYT green/yellow)
const _SHARE_SQUARES = {
	correct: "🟪", // Purple - Puzzled brand (was green)
	partial: "🟧", // Orange - warm, friendly (was yellow)
	wrong: "⬛",
	// Word Groups category colors
	rose: "🟥", // Coral/Rose
	teal: "🩵", // Teal/Cyan
	amber: "🟨", // Amber/Gold
	fuchsia: "🟪", // Fuchsia/Violet
} as const;
