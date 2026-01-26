/**
 * Word Search Game Component
 * Find hidden words in a letter grid
 */

'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { Check, HelpCircle, Play, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { formatTimer } from '@/games/shared/format'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import { cn } from '@/lib/utils'
import { triggerHaptic } from '@/shared/hooks'
import { wordSearchConfig } from './config'
import type { Position } from './types'
import { useWordSearch } from './use-word-search'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function WordSearchGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const tCommon = useTranslations('common')

	const [puzzle] = useState(() => defaultParsePuzzleData(wordSearchConfig, puzzleData, puzzleId))

	// useGameSession: Consolidates session, save, and celebration logic
	const {
		isReady,
		startGame,
		endGame,
		startTime,
		showCelebration,
		showResultModal,
		setShowResultModal,
		showGuestSignupPrompt,
		handleCloseGuestPrompt,
	} = useGameSession({
		gameSlug: 'word-search',
		mode,
		puzzleId,
		enableStarBurst: true,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)

	const game = useWordSearch(puzzle.puzzleData, puzzle.solution)
	const progress = game.getProgress()
	const foundPlacements = game.getWordPlacements()
	const gameEndedRef = useRef(false)
	const gridRef = useRef<HTMLDivElement>(null)

	// Handle game end - delegate to useGameSession
	if (game.state.gameStatus === 'won' && !gameEndedRef.current) {
		gameEndedRef.current = true
		endGame({
			status: 'won',
			data: {
				foundWords: game.state.foundWords,
			},
		})
	}

	// Touch/mouse handling for selection
	const getPositionFromEvent = useCallback(
		(e: React.MouseEvent | React.TouchEvent): Position | null => {
			if (!gridRef.current) return null

			const rect = gridRef.current.getBoundingClientRect()
			const cellSize = rect.width / puzzle.puzzleData.grid.length

			let clientX: number
			let clientY: number

			if ('touches' in e) {
				if (e.touches.length === 0) return null
				clientX = e.touches[0].clientX
				clientY = e.touches[0].clientY
			} else {
				clientX = e.clientX
				clientY = e.clientY
			}

			const col = Math.floor((clientX - rect.left) / cellSize)
			const row = Math.floor((clientY - rect.top) / cellSize)

			if (row < 0 || row >= puzzle.puzzleData.grid.length) return null
			if (col < 0 || col >= puzzle.puzzleData.grid[0].length) return null

			return { row, col }
		},
		[puzzle.puzzleData.grid.length, puzzle.puzzleData.grid],
	)

	const handlePointerDown = useCallback(
		(e: React.MouseEvent | React.TouchEvent) => {
			const pos = getPositionFromEvent(e)
			if (pos) {
				game.startSelection(pos)
				triggerHaptic('light')
			}
		},
		[getPositionFromEvent, game],
	)

	const handlePointerMove = useCallback(
		(e: React.MouseEvent | React.TouchEvent) => {
			if (!game.state.selectionStart) return
			const pos = getPositionFromEvent(e)
			if (pos) {
				game.updateSelection(pos)
			}
		},
		[getPositionFromEvent, game],
	)

	const handlePointerUp = useCallback(() => {
		game.endSelection()
	}, [game])

	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0

		const text = `Word Hunt - ${puzzle.puzzleData.theme}\n${progress.found}/${progress.total} words\n${formatTimer(timeMs)}\n\npuzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.state.endTime, startTime, puzzle.puzzleData.theme, progress.found, progress.total])

	// Check if a cell is part of the current selection
	const isInSelection = useCallback(
		(row: number, col: number): boolean => {
			if (!game.state.selectionStart || !game.state.selectionEnd) return false

			const { selectionStart: start, selectionEnd: end } = game.state
			const minRow = Math.min(start.row, end.row)
			const maxRow = Math.max(start.row, end.row)
			const minCol = Math.min(start.col, end.col)
			const maxCol = Math.max(start.col, end.col)

			const rowDiff = end.row - start.row
			const colDiff = end.col - start.col

			// Horizontal
			if (rowDiff === 0) {
				return row === start.row && col >= minCol && col <= maxCol
			}
			// Vertical
			if (colDiff === 0) {
				return col === start.col && row >= minRow && row <= maxRow
			}
			// Diagonal
			const absRowDiff = Math.abs(rowDiff)
			const absColDiff = Math.abs(colDiff)
			if (absRowDiff === absColDiff) {
				const rowStep = rowDiff / absRowDiff
				const colStep = colDiff / absColDiff
				for (let i = 0; i <= absRowDiff; i++) {
					if (row === start.row + i * rowStep && col === start.col + i * colStep) {
						return true
					}
				}
			}

			return false
		},
		[game.state.selectionStart, game.state.selectionEnd, game.state],
	)

	// Check if a cell is part of a found word
	const isFound = useCallback(
		(row: number, col: number): boolean => {
			for (const placement of foundPlacements) {
				const { start, end } = placement
				const rowDiff = end.row - start.row
				const colDiff = end.col - start.col
				const length = Math.max(Math.abs(rowDiff), Math.abs(colDiff)) + 1
				const rowStep = rowDiff === 0 ? 0 : rowDiff / Math.abs(rowDiff)
				const colStep = colDiff === 0 ? 0 : colDiff / Math.abs(colDiff)

				for (let i = 0; i < length; i++) {
					if (row === start.row + i * rowStep && col === start.col + i * colStep) {
						return true
					}
				}
			}
			return false
		},
		[foundPlacements],
	)

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center text-4xl">🔍</div>
					<CardTitle>Word Hunt</CardTitle>
					<p className="text-sm text-muted-foreground">Find hidden words in the grid</p>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg bg-muted/50 p-4">
						<h3 className="mb-2 flex items-center gap-2 font-medium">
							<HelpCircle className="h-4 w-4" />
							How to Play
						</h3>
						<ul className="space-y-1 text-sm text-muted-foreground">
							<li>• Find all hidden words in the letter grid</li>
							<li>• Words can be horizontal, vertical, or diagonal</li>
							<li>• Drag from first to last letter to select</li>
						</ul>
					</div>

					<Button onClick={startGame} className="w-full" size="lg">
						<Play className="mr-2 h-4 w-4" />
						{tCommon('play')}
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="relative flex w-full flex-col items-center">
			<Celebration show={showCelebration} />

			<div className="flex w-full max-w-lg flex-col items-center gap-4">
				{/* Header */}
				<div className="flex w-full items-center justify-between px-2">
					<div className="flex flex-col">
						<span className="text-sm font-medium">Word Hunt</span>
						<span className="text-xs text-muted-foreground">Theme: {puzzle.puzzleData.theme}</span>
					</div>
					<div className="flex gap-2">
						<div className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1">
							<span className="text-sm font-medium">
								{progress.found}/{progress.total}
							</span>
						</div>
						<Button variant="ghost" size="sm" onClick={game.reset}>
							<RotateCcw className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
							<HelpCircle className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Grid */}
				<div
					ref={gridRef}
					className="grid aspect-square w-full max-w-sm touch-none select-none rounded-lg border-2 border-border bg-background p-1"
					style={{
						gridTemplateColumns: `repeat(${puzzle.puzzleData.grid.length}, 1fr)`,
					}}
					onMouseDown={handlePointerDown}
					onMouseMove={handlePointerMove}
					onMouseUp={handlePointerUp}
					onMouseLeave={handlePointerUp}
					onTouchStart={handlePointerDown}
					onTouchMove={handlePointerMove}
					onTouchEnd={handlePointerUp}
				>
					{puzzle.puzzleData.grid.map((row, r) =>
						row.map((letter, c) => {
							const inSelection = isInSelection(r, c)
							const found = isFound(r, c)

							return (
								<div
									key={`${r}-${c}`}
									className={cn(
										'flex items-center justify-center text-sm font-bold transition-colors',
										'sm:text-base',
										inSelection && 'bg-cyan-500/30 text-cyan-600',
										found && !inSelection && 'bg-green-500/20 text-green-600',
										!inSelection && !found && 'text-foreground',
									)}
								>
									{letter}
								</div>
							)
						}),
					)}
				</div>

				{/* Word list */}
				<div className="w-full max-w-sm px-2">
					<div className="flex flex-wrap justify-center gap-2">
						{puzzle.solution.words.map((word) => {
							const found = game.state.foundWords.includes(word)
							return (
								<div
									key={word}
									className={cn(
										'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
										found
											? 'bg-green-500/20 text-green-600 line-through'
											: 'bg-muted text-muted-foreground',
									)}
								>
									{found && <Check className="h-3 w-3" />}
									{word}
								</div>
							)
						})}
					</div>
				</div>
			</div>

			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="word-search"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="word-search"
				status={game.state.gameStatus === 'won' ? 'won' : 'lost'}
				stats={{
					timeSpentMs: game.state.endTime && startTime ? game.state.endTime - startTime : 0,
				}}
				mode={mode}
				onShare={handleShare}
			/>

			<GuestSignupPrompt
				open={showGuestSignupPrompt}
				onClose={handleCloseGuestPrompt}
				streakCount={1}
			/>
		</div>
	)
}
