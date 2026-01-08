/**
 * Sudoku Game Component
 * Main game wrapper with state management
 */

'use client'

import { HelpCircle, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { SudokuIcon } from '@/shared/components/ui/game-icons'
import { SudokuGrid, SudokuNumberPad } from './components'
import { sudokuConfig } from './config'
import { useSudoku } from './use-sudoku'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function SudokuGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.sudoku')

	// Type-safe puzzle parsing via config - no type assertions needed
	const [puzzle] = useState(() => defaultParsePuzzleData(sudokuConfig, puzzleData, puzzleId))

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
		gameSlug: 'sudoku',
		mode,
		puzzleId,
	})

	// Game-specific state
	const [showHelpModal, setShowHelpModal] = useState(false)
	const gameEndedRef = useRef(false)

	// Game hook
	const game = useSudoku(puzzle.puzzleData, puzzle.solution)
	const conflictingCells = game.getConflictingCells()

	// Handle game completion - in useEffect to avoid render-phase side effects
	useEffect(() => {
		if (game.state.isComplete && !gameEndedRef.current) {
			gameEndedRef.current = true
			endGame({
				status: 'won',
				attempts: 1,
				data: {
					finalGrid: game.state.userGrid.map((row) => row.map((cell) => cell.value)),
				},
			})
		}
	}, [game.state.isComplete, game.state.userGrid, endGame])

	// Share result
	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0
		const minutes = Math.floor(timeMs / 60000)
		const seconds = Math.floor((timeMs % 60000) / 1000)

		const text = `🔢 Sudoku (${puzzle.puzzleData.difficulty})\n⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}\n\nPlay at puzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.state.endTime, startTime, puzzle.puzzleData.difficulty])

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center">
						<SudokuIcon size={48} className="text-primary" />
					</div>
					<CardTitle>{t('name')}</CardTitle>
					<p className="text-sm text-muted-foreground">{t('description')}</p>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Rules */}
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
						{t('startGame')}
					</Button>
				</CardContent>
			</Card>
		)
	}

	return (
		<div className="relative flex w-full flex-col items-center">
			{/* Celebration */}
			<Celebration show={showCelebration} />

			{/* Game container - single width constraint, no internal padding */}
			<div className="flex w-full max-w-[280px] flex-col gap-3 xs:max-w-[320px] sm:max-w-[360px] sm:gap-4">
				{/* Header with help button */}
				<div className="flex w-full items-center justify-between">
					<div className="text-sm text-muted-foreground">
						{t('name')} ({t(`difficulty.${puzzle.puzzleData.difficulty}`)})
					</div>
					<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
						<HelpCircle className="h-4 w-4" />
					</Button>
				</div>

				{/* Grid */}
				<SudokuGrid
					userGrid={game.state.userGrid}
					selectedCell={game.state.selectedCell}
					conflictingCells={conflictingCells}
					onCellClick={game.selectCell}
				/>

				{/* Number pad */}
				<SudokuNumberPad
					onNumberPress={game.inputNumber}
					onDelete={game.clearCell}
					onToggleNotes={game.toggleNotesMode}
					isNotesMode={game.state.isNotesMode}
					disabled={game.state.isComplete}
				/>
			</div>

			{/* Help Modal */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="sudoku"
			/>

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="sudoku"
				status="won"
				stats={{
					attempts: 1,
					maxAttempts: 1,
					timeSpentMs: game.state.endTime && startTime ? game.state.endTime - startTime : 0,
				}}
				mode={mode}
				onShare={handleShare}
			/>

			{/* Guest signup prompt */}
			<GuestSignupPrompt open={showGuestSignupPrompt} onClose={handleCloseGuestPrompt} />
		</div>
	)
}
