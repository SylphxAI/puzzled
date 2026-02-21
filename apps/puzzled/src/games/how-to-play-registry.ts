/**
 * HowToPlay Content Registry
 *
 * SEPARATED FROM client-registry.ts to break circular dependency:
 * - how-to-play-modal.tsx imports from this file
 * - This file does NOT import GameComponents
 * - GameComponents import how-to-play-modal.tsx
 *
 * This breaks the cycle: how-to-play-modal → client-registry → game-xxx-game → how-to-play-modal
 *
 * ALSO provides isPerfectGame for game-result.tsx (client component)
 * to avoid importing from the server-only registry.ts
 */

import { MINUTE_MS } from "@/lib/constants/time";
import type { ComponentType } from "react";
// ==========================================
// HowToPlay components (client-safe - just UI)
// ==========================================
import { ArithmoHowToPlay } from "./arithmo/components/how-to-play";
// ==========================================
// Icons (client-safe - just SVG components)
// ==========================================
import { ArithmoIcon } from "./arithmo/icon";
import { BlockSlideHowToPlay } from "./block-slide/components/how-to-play";
import { BlockSlideIcon } from "./block-slide/icon";
import { CrosswordHowToPlay } from "./crossword/components/how-to-play";
import { CrosswordIcon } from "./crossword/icon";
import { CryptogramHowToPlay } from "./cryptogram/components/how-to-play";
import { CryptogramIcon } from "./cryptogram/icon";
import { KillerSudokuHowToPlay } from "./killer-sudoku/components/how-to-play";
import { KillerSudokuIcon } from "./killer-sudoku/icon";
import { NonogramHowToPlay } from "./nonogram/components/how-to-play";
import { NonogramIcon } from "./nonogram/icon";
import { PatternMatchHowToPlay } from "./pattern-match/components/how-to-play";
import { PatternMatchIcon } from "./pattern-match/icon";
import { QuordleHowToPlay } from "./quad-words/components/how-to-play";
import { QuadWordsIcon } from "./quad-words/icon";
import { QueensHowToPlay } from "./queens/components/how-to-play";
import { QueensIcon } from "./queens/icon";
import { SudokuHowToPlay } from "./sudoku/components/how-to-play";
import { SudokuIcon } from "./sudoku/icon";
import { TangoHowToPlay } from "./tango/components/how-to-play";
import { TangoIcon } from "./tango/icon";
import type { GameColorTheme } from "./theme-colors";
import type { GameCompletionStats } from "./types";
import { LetterBoxedHowToPlay } from "./word-box/components/how-to-play";
import { WordBoxIcon } from "./word-box/icon";
import { ConnectionsHowToPlay } from "./word-groups/components/how-to-play";
import { WordGroupsIcon } from "./word-groups/icon";
import { WordleHowToPlay } from "./word-guess/components/how-to-play";
import { WordGuessIcon } from "./word-guess/icon";
import { SpellingBeeHowToPlay } from "./word-hive/components/how-to-play";
import { WordHiveIcon } from "./word-hive/icon";
import { WordLadderHowToPlay } from "./word-ladder/components/how-to-play";
import { WordLadderIcon } from "./word-ladder/icon";
import { WordSearchHowToPlay } from "./word-search/components/how-to-play";
import { WordSearchIcon } from "./word-search/icon";

// ==========================================
// Types
// ==========================================

type IconComponent = ComponentType<{ size?: number; className?: string }>;
type HowToPlayComponent = ComponentType;

/**
 * HowToPlay config - no server-side code, no GameComponent imports
 * Also includes isPerfectGame for client-side result display
 */
export interface HowToPlayConfig {
	slug: string;
	name: string;
	IconComponent: IconComponent;
	HowToPlayContent: HowToPlayComponent;
	display: {
		theme: GameColorTheme;
	};
	/**
	 * Check if the game result qualifies as a "perfect" game
	 * Used for special celebration/display in result cards
	 * Pure function - no server dependencies
	 */
	isPerfectGame?: (stats: GameCompletionStats) => boolean;
}

// ==========================================
// Registry
// ==========================================

// Standard isPerfectGame: won with zero mistakes
const standardIsPerfectGame = (stats: GameCompletionStats): boolean =>
	stats.status === "won" && (stats.mistakes ?? 0) === 0;

const HOW_TO_PLAY_CONFIGS: Record<string, HowToPlayConfig> = {
	arithmo: {
		slug: "arithmo",
		name: "Arithmo",
		IconComponent: ArithmoIcon,
		HowToPlayContent: ArithmoHowToPlay,
		display: { theme: "lime" },
		isPerfectGame: (stats) => stats.status === "won" && stats.attempts === 1,
	},
	"block-slide": {
		slug: "block-slide",
		name: "Block Slide",
		IconComponent: BlockSlideIcon,
		HowToPlayContent: BlockSlideHowToPlay,
		display: { theme: "slate" },
		isPerfectGame: standardIsPerfectGame,
	},
	crossword: {
		slug: "crossword",
		name: "Crossword",
		IconComponent: CrosswordIcon,
		HowToPlayContent: CrosswordHowToPlay,
		display: { theme: "blue" },
		isPerfectGame: standardIsPerfectGame,
	},
	cryptogram: {
		slug: "cryptogram",
		name: "Cryptogram",
		IconComponent: CryptogramIcon,
		HowToPlayContent: CryptogramHowToPlay,
		display: { theme: "violet" },
		isPerfectGame: (stats) =>
			stats.status === "won" && (stats.hintsUsed ?? 0) === 0,
	},
	"killer-sudoku": {
		slug: "killer-sudoku",
		name: "Killer Sudoku",
		IconComponent: KillerSudokuIcon,
		HowToPlayContent: KillerSudokuHowToPlay,
		display: { theme: "rose" },
		isPerfectGame: standardIsPerfectGame,
	},
	nonogram: {
		slug: "nonogram",
		name: "Nonogram",
		IconComponent: NonogramIcon,
		HowToPlayContent: NonogramHowToPlay,
		display: { theme: "pink" },
		isPerfectGame: standardIsPerfectGame,
	},
	"pattern-match": {
		slug: "pattern-match",
		name: "Pattern Match",
		IconComponent: PatternMatchIcon,
		HowToPlayContent: PatternMatchHowToPlay,
		display: { theme: "sky" },
		isPerfectGame: standardIsPerfectGame,
	},
	"quad-words": {
		slug: "quad-words",
		name: "Quordle",
		IconComponent: QuadWordsIcon,
		HowToPlayContent: QuordleHowToPlay,
		display: { theme: "amber" },
		isPerfectGame: (stats) =>
			stats.status === "won" && (stats.attempts ?? 0) <= 5,
	},
	queens: {
		slug: "queens",
		name: "Queens",
		IconComponent: QueensIcon,
		HowToPlayContent: QueensHowToPlay,
		display: { theme: "violet" },
		isPerfectGame: standardIsPerfectGame,
	},
	sudoku: {
		slug: "sudoku",
		name: "Sudoku",
		IconComponent: SudokuIcon,
		HowToPlayContent: SudokuHowToPlay,
		display: { theme: "cyan" },
		isPerfectGame: standardIsPerfectGame,
	},
	tango: {
		slug: "tango",
		name: "Tango",
		IconComponent: TangoIcon,
		HowToPlayContent: TangoHowToPlay,
		display: { theme: "amber" },
		isPerfectGame: standardIsPerfectGame,
	},
	"word-box": {
		slug: "word-box",
		name: "Letter Boxed",
		IconComponent: WordBoxIcon,
		HowToPlayContent: LetterBoxedHowToPlay,
		display: { theme: "cyan" },
		isPerfectGame: (stats) =>
			stats.status === "won" && (stats.attempts ?? 0) <= 2,
	},
	"word-groups": {
		slug: "word-groups",
		name: "Connections",
		IconComponent: WordGroupsIcon,
		HowToPlayContent: ConnectionsHowToPlay,
		display: { theme: "violet" },
		isPerfectGame: (stats) =>
			stats.status === "won" && (stats.mistakes ?? 0) === 0,
	},
	"word-guess": {
		slug: "word-guess",
		name: "Wordle",
		IconComponent: WordGuessIcon,
		HowToPlayContent: WordleHowToPlay,
		display: { theme: "emerald" },
		isPerfectGame: (stats) => stats.status === "won" && stats.attempts === 1,
	},
	"word-hive": {
		slug: "word-hive",
		name: "Spelling Bee",
		IconComponent: WordHiveIcon,
		HowToPlayContent: SpellingBeeHowToPlay,
		display: { theme: "amber" },
		isPerfectGame: (stats) =>
			stats.status === "won" && stats.score !== undefined,
	},
	"word-ladder": {
		slug: "word-ladder",
		name: "Word Ladder",
		IconComponent: WordLadderIcon,
		HowToPlayContent: WordLadderHowToPlay,
		display: { theme: "orange" },
		isPerfectGame: standardIsPerfectGame,
	},
	"word-search": {
		slug: "word-search",
		name: "Word Search",
		IconComponent: WordSearchIcon,
		HowToPlayContent: WordSearchHowToPlay,
		display: { theme: "cyan" },
		isPerfectGame: (stats) =>
			stats.status === "won" &&
			(stats.timeSpentMs ?? Number.POSITIVE_INFINITY) < MINUTE_MS,
	},
};

// ==========================================
// Exports
// ==========================================

/**
 * Get HowToPlay config by slug
 */
export function getHowToPlayConfig(slug: string): HowToPlayConfig | undefined {
	return HOW_TO_PLAY_CONFIGS[slug];
}

/**
 * Derived type for all valid game slugs
 */
export type GameSlug = keyof typeof HOW_TO_PLAY_CONFIGS;
