'use client'

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import type { GameProps, PuzzleDifficulty } from '@/games/types'
import type { GameMode } from '@/lib/db/schema'

type GameRendererProps = {
	slug: string
	puzzleId: string
	puzzleData: unknown
	mode?: GameMode
	difficulty?: PuzzleDifficulty
}

// Type for dynamically imported game components
type DynamicGameComponent = ComponentType<GameProps>

/**
 * GameRenderer - Dynamic game component loader
 *
 * Renders the appropriate game component based on slug.
 * Each game is individually lazy-loaded to prevent bundling all games together.
 *
 * ARCHITECTURE NOTE:
 * We use individual dynamic imports here instead of client-registry.ts to avoid
 * Turbopack bundling issues where it traces through all imports and finds
 * node:fs dependencies in game configs.
 */
export function GameRenderer({
	slug,
	puzzleId,
	puzzleData,
	mode = 'daily',
	difficulty,
}: GameRendererProps) {
	// Lazy-load the appropriate game component based on slug
	// Each import is isolated to prevent cross-contamination
	const GameComponent = getGameComponent(slug)

	if (!GameComponent) {
		return (
			<div className="flex items-center justify-center p-8 text-muted-foreground">
				Game not found: {slug}
			</div>
		)
	}

	return (
		<div className="w-full sm:max-w-lg">
			<GameComponent
				puzzleId={puzzleId}
				puzzleData={puzzleData}
				mode={mode}
				difficulty={difficulty}
			/>
		</div>
	)
}

// Individual dynamic imports with { ssr: false } to fully isolate client-only code
const ArithmoGame = dynamic(() => import('@/games/arithmo/arithmo-game').then((m) => ({ default: m.ArithmoGame })), { ssr: false })
const BlockSlideGame = dynamic(() => import('@/games/block-slide/block-slide-game').then((m) => ({ default: m.BlockSlideGame })), { ssr: false })
const CrosswordGame = dynamic(() => import('@/games/crossword/crossword-game').then((m) => ({ default: m.CrosswordGame })), { ssr: false })
const CryptogramGame = dynamic(() => import('@/games/cryptogram/cryptogram-game').then((m) => ({ default: m.CryptogramGame })), { ssr: false })
const KillerSudokuGame = dynamic(() => import('@/games/killer-sudoku/killer-sudoku-game').then((m) => ({ default: m.KillerSudokuGame })), { ssr: false })
const NonogramGame = dynamic(() => import('@/games/nonogram/nonogram-game').then((m) => ({ default: m.NonogramGame })), { ssr: false })
const PatternMatchGame = dynamic(() => import('@/games/pattern-match/pattern-match-game').then((m) => ({ default: m.PatternMatchGame })), { ssr: false })
const QuadWordsGame = dynamic(() => import('@/games/quad-words/quad-words-game').then((m) => ({ default: m.QuadWordsGame })), { ssr: false })
const QueensGame = dynamic(() => import('@/games/queens/queens-game').then((m) => ({ default: m.QueensGame })), { ssr: false })
const SudokuGame = dynamic(() => import('@/games/sudoku/sudoku-game').then((m) => ({ default: m.SudokuGame })), { ssr: false })
const TangoGame = dynamic(() => import('@/games/tango/tango-game').then((m) => ({ default: m.TangoGame })), { ssr: false })
const WordBoxGame = dynamic(() => import('@/games/word-box/word-box-game').then((m) => ({ default: m.WordBoxGame })), { ssr: false })
const WordGroupsGame = dynamic(() => import('@/games/word-groups/word-groups-game').then((m) => ({ default: m.WordGroupsGame })), { ssr: false })
const WordGuessGame = dynamic(() => import('@/games/word-guess/word-guess-game').then((m) => ({ default: m.WordGuessGame })), { ssr: false })
const WordHiveGame = dynamic(() => import('@/games/word-hive/word-hive-game').then((m) => ({ default: m.WordHiveGame })), { ssr: false })
const WordLadderGame = dynamic(() => import('@/games/word-ladder/word-ladder-game').then((m) => ({ default: m.WordLadderGame })), { ssr: false })
const WordSearchGame = dynamic(() => import('@/games/word-search/word-search-game').then((m) => ({ default: m.WordSearchGame })), { ssr: false })

function getGameComponent(slug: string): DynamicGameComponent | null {
	// All games accept GameProps (puzzleId, puzzleData, mode, difficulty)
	// Games that don't support difficulty simply ignore it
	const games: Record<string, DynamicGameComponent> = {
		arithmo: ArithmoGame as DynamicGameComponent,
		'block-slide': BlockSlideGame as DynamicGameComponent,
		crossword: CrosswordGame as DynamicGameComponent,
		cryptogram: CryptogramGame as DynamicGameComponent,
		'killer-sudoku': KillerSudokuGame as DynamicGameComponent,
		nonogram: NonogramGame as DynamicGameComponent,
		'pattern-match': PatternMatchGame as DynamicGameComponent,
		'quad-words': QuadWordsGame as DynamicGameComponent,
		queens: QueensGame as DynamicGameComponent,
		sudoku: SudokuGame as DynamicGameComponent,
		tango: TangoGame as DynamicGameComponent,
		'word-box': WordBoxGame as DynamicGameComponent,
		'word-groups': WordGroupsGame as DynamicGameComponent,
		'word-guess': WordGuessGame as DynamicGameComponent,
		'word-hive': WordHiveGame as DynamicGameComponent,
		'word-ladder': WordLadderGame as DynamicGameComponent,
		'word-search': WordSearchGame as DynamicGameComponent,
	}
	return games[slug] ?? null
}
