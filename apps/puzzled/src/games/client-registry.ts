/**
 * Client-Safe Game Registry
 *
 * This file provides game metadata for client components WITHOUT importing
 * full game configs (which contain server-only puzzle generation code).
 *
 * ARCHITECTURE:
 * - registry.ts - Full configs with generatePuzzle, validateAndScore (server-only)
 * - client-registry.ts - Client-safe metadata: icons, HowToPlay, GameComponent, display info
 *
 * Client components should import from this file, NOT from registry.ts
 */

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import type { GameProps } from './types'
import type { GameColorTheme } from './theme-colors'

// ==========================================
// Icons (client-safe - just SVG components)
// ==========================================
import { ArithmoIcon } from './arithmo/icon'
import { BlockSlideIcon } from './block-slide/icon'
import { CrosswordIcon } from './crossword/icon'
import { CryptogramIcon } from './cryptogram/icon'
import { KillerSudokuIcon } from './killer-sudoku/icon'
import { NonogramIcon } from './nonogram/icon'
import { PatternMatchIcon } from './pattern-match/icon'
import { QuadWordsIcon } from './quad-words/icon'
import { QueensIcon } from './queens/icon'
import { SudokuIcon } from './sudoku/icon'
import { TangoIcon } from './tango/icon'
import { WordBoxIcon } from './word-box/icon'
import { WordGroupsIcon } from './word-groups/icon'
import { WordGuessIcon } from './word-guess/icon'
import { WordHiveIcon } from './word-hive/icon'
import { WordLadderIcon } from './word-ladder/icon'
import { WordSearchIcon } from './word-search/icon'

// ==========================================
// HowToPlay components (client-safe - just UI)
// ==========================================
import { ArithmoHowToPlay } from './arithmo/components/how-to-play'
import { BlockSlideHowToPlay } from './block-slide/components/how-to-play'
import { CrosswordHowToPlay } from './crossword/components/how-to-play'
import { CryptogramHowToPlay } from './cryptogram/components/how-to-play'
import { KillerSudokuHowToPlay } from './killer-sudoku/components/how-to-play'
import { NonogramHowToPlay } from './nonogram/components/how-to-play'
import { PatternMatchHowToPlay } from './pattern-match/components/how-to-play'
import { QuordleHowToPlay } from './quad-words/components/how-to-play'
import { QueensHowToPlay } from './queens/components/how-to-play'
import { SudokuHowToPlay } from './sudoku/components/how-to-play'
import { TangoHowToPlay } from './tango/components/how-to-play'
import { LetterBoxedHowToPlay } from './word-box/components/how-to-play'
import { ConnectionsHowToPlay } from './word-groups/components/how-to-play'
import { WordleHowToPlay } from './word-guess/components/how-to-play'
import { SpellingBeeHowToPlay } from './word-hive/components/how-to-play'
import { WordLadderHowToPlay } from './word-ladder/components/how-to-play'
import { WordSearchHowToPlay } from './word-search/components/how-to-play'

// ==========================================
// Game Components (lazy-loaded, client-only)
// Using { ssr: false } to prevent server-side tracing of game component dependencies
// This is required because game components import HowToPlayModal which would create circular deps
// ==========================================
const ArithmoGame = dynamic(() => import('./arithmo/arithmo-game').then((m) => ({ default: m.ArithmoGame })), { ssr: false })
const BlockSlideGame = dynamic(() => import('./block-slide/block-slide-game').then((m) => ({ default: m.BlockSlideGame })), { ssr: false })
const CrosswordGame = dynamic(() => import('./crossword/crossword-game').then((m) => ({ default: m.CrosswordGame })), { ssr: false })
const CryptogramGame = dynamic(() => import('./cryptogram/cryptogram-game').then((m) => ({ default: m.CryptogramGame })), { ssr: false })
const KillerSudokuGame = dynamic(() => import('./killer-sudoku/killer-sudoku-game').then((m) => ({ default: m.KillerSudokuGame })), { ssr: false })
const NonogramGame = dynamic(() => import('./nonogram/nonogram-game').then((m) => ({ default: m.NonogramGame })), { ssr: false })
const PatternMatchGame = dynamic(() => import('./pattern-match/pattern-match-game').then((m) => ({ default: m.PatternMatchGame })), { ssr: false })
const QuadWordsGame = dynamic(() => import('./quad-words/quad-words-game').then((m) => ({ default: m.QuadWordsGame })), { ssr: false })
const QueensGame = dynamic(() => import('./queens/queens-game').then((m) => ({ default: m.QueensGame })), { ssr: false })
const SudokuGame = dynamic(() => import('./sudoku/sudoku-game').then((m) => ({ default: m.SudokuGame })), { ssr: false })
const TangoGame = dynamic(() => import('./tango/tango-game').then((m) => ({ default: m.TangoGame })), { ssr: false })
const WordBoxGame = dynamic(() => import('./word-box/word-box-game').then((m) => ({ default: m.WordBoxGame })), { ssr: false })
const WordGroupsGame = dynamic(() => import('./word-groups/word-groups-game').then((m) => ({ default: m.WordGroupsGame })), { ssr: false })
const WordGuessGame = dynamic(() => import('./word-guess/word-guess-game').then((m) => ({ default: m.WordGuessGame })), { ssr: false })
const WordHiveGame = dynamic(() => import('./word-hive/word-hive-game').then((m) => ({ default: m.WordHiveGame })), { ssr: false })
const WordLadderGame = dynamic(() => import('./word-ladder/word-ladder-game').then((m) => ({ default: m.WordLadderGame })), { ssr: false })
const WordSearchGame = dynamic(() => import('./word-search/word-search-game').then((m) => ({ default: m.WordSearchGame })), { ssr: false })

// ==========================================
// Types
// ==========================================

type IconComponent = ComponentType<{ size?: number; className?: string }>
type HowToPlayComponent = ComponentType

/**
 * Client-safe game config - no server-side code
 */
export interface ClientGameConfig {
	slug: string
	name: string
	IconComponent: IconComponent
	HowToPlayContent: HowToPlayComponent
	GameComponent: ComponentType<GameProps>
	display: {
		theme: GameColorTheme
	}
}

// ==========================================
// Client Registry
// ==========================================

/**
 * Client-safe game configs
 * Contains only metadata needed for client-side rendering
 */
const CLIENT_GAME_CONFIGS: Record<string, ClientGameConfig> = {
	arithmo: {
		slug: 'arithmo',
		name: 'Arithmo',
		IconComponent: ArithmoIcon,
		HowToPlayContent: ArithmoHowToPlay,
		GameComponent: ArithmoGame,
		display: { theme: 'lime' },
	},
	'block-slide': {
		slug: 'block-slide',
		name: 'Block Slide',
		IconComponent: BlockSlideIcon,
		HowToPlayContent: BlockSlideHowToPlay,
		GameComponent: BlockSlideGame,
		display: { theme: 'slate' },
	},
	crossword: {
		slug: 'crossword',
		name: 'Crossword',
		IconComponent: CrosswordIcon,
		HowToPlayContent: CrosswordHowToPlay,
		GameComponent: CrosswordGame,
		display: { theme: 'blue' },
	},
	cryptogram: {
		slug: 'cryptogram',
		name: 'Cryptogram',
		IconComponent: CryptogramIcon,
		HowToPlayContent: CryptogramHowToPlay,
		GameComponent: CryptogramGame,
		display: { theme: 'violet' },
	},
	'killer-sudoku': {
		slug: 'killer-sudoku',
		name: 'Killer Sudoku',
		IconComponent: KillerSudokuIcon,
		HowToPlayContent: KillerSudokuHowToPlay,
		GameComponent: KillerSudokuGame,
		display: { theme: 'rose' },
	},
	nonogram: {
		slug: 'nonogram',
		name: 'Nonogram',
		IconComponent: NonogramIcon,
		HowToPlayContent: NonogramHowToPlay,
		GameComponent: NonogramGame,
		display: { theme: 'pink' },
	},
	'pattern-match': {
		slug: 'pattern-match',
		name: 'Pattern Match',
		IconComponent: PatternMatchIcon,
		HowToPlayContent: PatternMatchHowToPlay,
		GameComponent: PatternMatchGame,
		display: { theme: 'sky' },
	},
	'quad-words': {
		slug: 'quad-words',
		name: 'Quordle',
		IconComponent: QuadWordsIcon,
		HowToPlayContent: QuordleHowToPlay,
		GameComponent: QuadWordsGame,
		display: { theme: 'amber' },
	},
	queens: {
		slug: 'queens',
		name: 'Queens',
		IconComponent: QueensIcon,
		HowToPlayContent: QueensHowToPlay,
		GameComponent: QueensGame,
		display: { theme: 'violet' },
	},
	sudoku: {
		slug: 'sudoku',
		name: 'Sudoku',
		IconComponent: SudokuIcon,
		HowToPlayContent: SudokuHowToPlay,
		GameComponent: SudokuGame,
		display: { theme: 'cyan' },
	},
	tango: {
		slug: 'tango',
		name: 'Tango',
		IconComponent: TangoIcon,
		HowToPlayContent: TangoHowToPlay,
		GameComponent: TangoGame,
		display: { theme: 'amber' },
	},
	'word-box': {
		slug: 'word-box',
		name: 'Letter Boxed',
		IconComponent: WordBoxIcon,
		HowToPlayContent: LetterBoxedHowToPlay,
		GameComponent: WordBoxGame,
		display: { theme: 'cyan' },
	},
	'word-groups': {
		slug: 'word-groups',
		name: 'Connections',
		IconComponent: WordGroupsIcon,
		HowToPlayContent: ConnectionsHowToPlay,
		GameComponent: WordGroupsGame,
		display: { theme: 'violet' },
	},
	'word-guess': {
		slug: 'word-guess',
		name: 'Wordle',
		IconComponent: WordGuessIcon,
		HowToPlayContent: WordleHowToPlay,
		GameComponent: WordGuessGame,
		display: { theme: 'emerald' },
	},
	'word-hive': {
		slug: 'word-hive',
		name: 'Spelling Bee',
		IconComponent: WordHiveIcon,
		HowToPlayContent: SpellingBeeHowToPlay,
		GameComponent: WordHiveGame,
		display: { theme: 'amber' },
	},
	'word-ladder': {
		slug: 'word-ladder',
		name: 'Word Ladder',
		IconComponent: WordLadderIcon,
		HowToPlayContent: WordLadderHowToPlay,
		GameComponent: WordLadderGame,
		display: { theme: 'orange' },
	},
	'word-search': {
		slug: 'word-search',
		name: 'Word Search',
		IconComponent: WordSearchIcon,
		HowToPlayContent: WordSearchHowToPlay,
		GameComponent: WordSearchGame,
		display: { theme: 'cyan' },
	},
}

// ==========================================
// Exports
// ==========================================

/**
 * Get client-safe game config by slug
 */
export function getClientGameConfig(slug: string): ClientGameConfig | undefined {
	return CLIENT_GAME_CONFIGS[slug]
}

/**
 * Check if a game slug is valid
 */
export function isValidGameSlug(slug: string): boolean {
	return slug in CLIENT_GAME_CONFIGS
}

/**
 * Get all client game configs
 */
export function getAllClientGameConfigs(): ClientGameConfig[] {
	return Object.values(CLIENT_GAME_CONFIGS)
}

/**
 * Derived type for all valid game slugs
 */
export type GameSlug = keyof typeof CLIENT_GAME_CONFIGS
