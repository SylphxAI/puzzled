/**
 * Killer Sudoku Game Component
 * Sudoku with cage sum constraints
 */

'use client'

import { Delete, HelpCircle, Pencil, Play, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { killerSudokuConfig } from './config'
import { useKillerSudoku } from './use-killer-sudoku'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function KillerSudokuGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.killerSudoku')
	const tCommon = useTranslations('common')

	const [puzzle] = useState(() => defaultParsePuzzleData(killerSudokuConfig, puzzleData, puzzleId))

	// ==========================================
	// useGameSession: Consolidates 200+ lines of boilerplate
	// ==========================================
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
		gameSlug: 'killer-sudoku',
		mode,
		puzzleId,
	})

	// Game-specific state
	const [showHelpModal, setShowHelpModal] = useState(false)
	const gameEndedRef = useRef(false)

	const game = useKillerSudoku(puzzle.puzzleData, puzzle.solution)

	// Handle game completion - delegate to useGameSession
	if (game.state.gameStatus === 'won' && !gameEndedRef.current) {
		gameEndedRef.current = true
		endGame({
			status: 'won',
			attempts: 1,
			data: {
				finalGrid: game.state.cells.map((row) => row.map((cell) => cell.value)),
				mistakes: game.state.mistakes,
			},
		})
	}

	// Keyboard handler
	useEffect(() => {
		if (isReady || game.state.gameStatus !== 'playing') return

		function handleKeyDown(e: KeyboardEvent) {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return
			}

			if (/^[1-9]$/.test(e.key)) {
				game.setValue(parseInt(e.key, 10))
			} else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
				e.preventDefault()
				game.clearCell()
			} else if (e.key === 'n' || e.key === 'N') {
				game.toggleNotesMode()
			} else if (e.key === 'ArrowUp' && game.state.selectedCell) {
				const [row, col] = game.state.selectedCell
				if (row > 0) game.selectCell(row - 1, col)
			} else if (e.key === 'ArrowDown' && game.state.selectedCell) {
				const [row, col] = game.state.selectedCell
				if (row < 8) game.selectCell(row + 1, col)
			} else if (e.key === 'ArrowLeft' && game.state.selectedCell) {
				const [row, col] = game.state.selectedCell
				if (col > 0) game.selectCell(row, col - 1)
			} else if (e.key === 'ArrowRight' && game.state.selectedCell) {
				const [row, col] = game.state.selectedCell
				if (col < 8) game.selectCell(row, col + 1)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isReady, game])

	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0
		const minutes = Math.floor(timeMs / 60000)
		const seconds = Math.floor((timeMs % 60000) / 1000)

		const text = `🔢 Killer Sudoku\n⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}\n\npuzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.state.endTime, startTime])

	// Build cage border map for visual rendering
	const cageBorders = useMemo(() => {
		const borders: Map<
			string,
			{ top: boolean; right: boolean; bottom: boolean; left: boolean; cageId: number }
		> = new Map()

		for (let cageId = 0; cageId < game.cages.length; cageId++) {
			const cage = game.cages[cageId]
			const cellSet = new Set(cage.cells.map(([r, c]) => `${r},${c}`))

			for (const [row, col] of cage.cells) {
				const key = `${row},${col}`
				borders.set(key, {
					top: !cellSet.has(`${row - 1},${col}`),
					right: !cellSet.has(`${row},${col + 1}`),
					bottom: !cellSet.has(`${row + 1},${col}`),
					left: !cellSet.has(`${row},${col - 1}`),
					cageId,
				})
			}
		}

		return borders
	}, [game.cages])

	// Get cage sum display position (top-left cell of each cage)
	const cageSumPositions = useMemo(() => {
		const positions: Map<number, [number, number]> = new Map()

		for (let cageId = 0; cageId < game.cages.length; cageId++) {
			const cage = game.cages[cageId]
			// Find top-left cell
			let minRow = 9,
				minCol = 9
			for (const [row, col] of cage.cells) {
				if (row < minRow || (row === minRow && col < minCol)) {
					minRow = row
					minCol = col
				}
			}
			positions.set(cageId, [minRow, minCol])
		}

		return positions
	}, [game.cages])

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center text-4xl">🔢</div>
					<CardTitle>{t('name')}</CardTitle>
					<p className="text-sm text-muted-foreground">{t('description')}</p>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg bg-muted/50 p-4">
						<h3 className="mb-2 flex items-center gap-2 font-medium">
							<HelpCircle className="h-4 w-4" />
							{t('rules.title')}
						</h3>
						<ul className="space-y-1 text-sm text-muted-foreground">
							<li>• {t('rules.rule1')}</li>
							<li>• {t('rules.rule2')}</li>
							<li>• {t('rules.rule3')}</li>
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

			<div className="flex w-full max-w-md flex-col items-center gap-4">
				{/* Header */}
				<div className="flex w-full items-center justify-between px-2">
					<div className="text-sm text-muted-foreground">{t('name')}</div>
					<div className="flex gap-2">
						<Button
							variant={game.state.notesMode ? 'default' : 'ghost'}
							size="sm"
							onClick={game.toggleNotesMode}
						>
							<Pencil className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="sm" onClick={game.reset}>
							<RotateCcw className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
							<HelpCircle className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Grid */}
				<div className="relative grid grid-cols-9 gap-0 rounded-lg border-2 border-foreground/50 bg-background p-0.5">
					{Array.from({ length: 9 }).map((_, row) => (
						<div key={row} className="contents">
							{Array.from({ length: 9 }).map((_, col) => {
								const cell = game.state.cells[row][col]
								const isSelected =
									game.state.selectedCell?.[0] === row && game.state.selectedCell?.[1] === col
								const conflicts = game.getCellConflicts(row, col)
								const hasConflict = conflicts.size > 0

								const border = cageBorders.get(`${row},${col}`)
								const cageId = border?.cageId ?? 0
								const sumPos = cageSumPositions.get(cageId)
								const showSum = sumPos?.[0] === row && sumPos?.[1] === col

								return (
									<button
										key={`${row}-${col}`}
										type="button"
										onClick={() => game.selectCell(row, col)}
										className={cn(
											'relative flex h-9 w-9 items-center justify-center text-sm font-medium transition-colors',
											// Sudoku box borders
											col % 3 === 2 && col !== 8 && 'border-r border-foreground/30',
											row % 3 === 2 && row !== 8 && 'border-b border-foreground/30',
											// Selection
											isSelected && 'bg-primary/20',
											// Given vs user input
											cell.isGiven && 'font-bold text-foreground',
											!cell.isGiven && cell.value && 'text-primary',
											// Conflicts
											hasConflict && 'bg-destructive/20 text-destructive',
											// Cage borders (dashed)
											border?.top && 'border-t border-dashed border-muted-foreground',
											border?.right &&
												col !== 8 &&
												'border-r border-dashed border-muted-foreground',
											border?.bottom &&
												row !== 8 &&
												'border-b border-dashed border-muted-foreground',
											border?.left && 'border-l border-dashed border-muted-foreground',
										)}
									>
										{/* Cage sum indicator */}
										{showSum && (
											<span className="absolute left-0.5 top-0 text-[8px] font-normal text-muted-foreground">
												{game.cages[cageId].sum}
											</span>
										)}

										{/* Cell value or notes */}
										{cell.value ? (
											cell.value
										) : cell.notes.size > 0 ? (
											<div className="grid grid-cols-3 gap-0 text-[6px] text-muted-foreground">
												{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
													<span key={n} className={cn(!cell.notes.has(n) && 'invisible')}>
														{n}
													</span>
												))}
											</div>
										) : null}
									</button>
								)
							})}
						</div>
					))}
				</div>

				{/* Number pad */}
				<div className="grid grid-cols-5 gap-2">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
						<Button
							key={n}
							variant="outline"
							size="sm"
							onClick={() => game.setValue(n)}
							disabled={game.state.gameStatus !== 'playing'}
							className="h-10 w-10 text-lg font-bold"
						>
							{n}
						</Button>
					))}
					<Button
						variant="outline"
						size="sm"
						onClick={game.clearCell}
						disabled={game.state.gameStatus !== 'playing'}
						className="h-10 w-10"
					>
						<Delete className="h-4 w-4" />
					</Button>
				</div>

				{/* Mode indicator */}
				{game.state.notesMode && (
					<div className="text-xs text-muted-foreground">Notes Mode (Press N to toggle)</div>
				)}
			</div>

			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="killer-sudoku"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="killer-sudoku"
				status="won"
				stats={{
					timeSpentMs: game.state.endTime && startTime ? game.state.endTime - startTime : 0,
				}}
				mode={mode}
				onShare={handleShare}
			/>

			<GuestSignupPrompt open={showGuestSignupPrompt} onClose={handleCloseGuestPrompt} />
		</div>
	)
}
