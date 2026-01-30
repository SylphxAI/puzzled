/**
 * Crossword Mini Game Component
 * Main game wrapper with state management
 */

'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { HelpCircle, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components/celebration'
import { HowToPlayModal } from '@/features/daily/components/how-to-play-modal'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { formatTimer } from '@/games/shared/format'
import { useGameSession } from '@/games/shared/use-game-session'
import { parsePuzzleDataClient } from '@/games/types'
import { CrosswordIcon } from '@/shared/components/ui/game-icons'
import { ClueList, CrosswordGrid, CrosswordKeyboard, CurrentClueDisplay } from './components'
import type { CrosswordPuzzleClientData, CrosswordSolution } from './types'
import type { CrosswordDirection } from './types'
import { useCrossword } from './use-crossword'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function CrosswordGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.crossword')

	// Get puzzle from server data
	const [puzzle] = useState(() =>
		parsePuzzleDataClient<CrosswordPuzzleClientData, CrosswordSolution>(puzzleData),
	)

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
		gameSlug: 'crossword',
		mode,
		puzzleId,
		enableStarBurst: false,
		isPerfectWin: (stats) => stats.attempts === 1,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)

	// Game hook
	const game = useCrossword(puzzle.puzzleData, puzzle.solution)

	// Handle clue click
	const handleClueClick = useCallback(
		(clue: { row: number; col: number }, direction: CrosswordDirection) => {
			game.setDirection(direction)
			game.selectCell(clue.row, clue.col)
		},
		[game],
	)

	// Track game completion - in useEffect to avoid render-phase side effects
	const gameEndedRef = useRef(false)
	useEffect(() => {
		if (game.state.isComplete && !gameEndedRef.current) {
			gameEndedRef.current = true
			endGame({
				status: 'won',
				attempts: 1,
				maxAttempts: 1,
				data: {
					finalGrid: game.state.userGrid,
				},
			})
		}
	}, [game.state.isComplete, game.state.userGrid, endGame])

	// Share result
	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0

		const text = `📝 Crossword Mini\n⏱️ ${formatTimer(timeMs)}\n\nPlay at puzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.state.endTime, startTime])

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center">
						<CrosswordIcon size={48} className="text-primary" />
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

	const currentClue = game.getCurrentClue()
	const highlightedCells = game.getHighlightedCells()

	return (
		<div className="relative flex w-full max-w-md flex-col items-center gap-4 px-2 sm:px-0">
			{/* Celebration */}
			<Celebration show={showCelebration} />

			{/* Header with help button */}
			<div className="flex w-full items-center justify-between">
				<div className="text-sm text-muted-foreground">{t('name')}</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setShowHelpModal(true)}
					className="min-h-[44px] min-w-[44px]"
				>
					<HelpCircle className="h-4 w-4" />
				</Button>
			</div>

			{/* Current clue display */}
			<div className="w-full">
				<CurrentClueDisplay clue={currentClue} direction={game.state.direction} />
			</div>

			{/* Grid */}
			<CrosswordGrid
				puzzleData={puzzle.puzzleData}
				userGrid={game.state.userGrid}
				selectedCell={game.state.selectedCell}
				highlightedCells={highlightedCells}
				solvedClues={game.state.solvedClues}
				onCellClick={game.selectCell}
			/>

			{/* Mobile keyboard */}
			<CrosswordKeyboard
				onLetterPress={game.inputLetter}
				onDelete={game.deleteLetter}
				disabled={game.state.isComplete}
			/>

			{/* Clue lists */}
			<div className="w-full">
				<ClueList
					clues={puzzle.puzzleData.clues}
					currentClue={currentClue}
					direction={game.state.direction}
					solvedClues={game.state.solvedClues}
					onClueClick={handleClueClick}
				/>
			</div>

			{/* Help Modal */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="crossword"
			/>

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="crossword"
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
			<GuestSignupPrompt
				open={showGuestSignupPrompt}
				onClose={handleCloseGuestPrompt}
				streakCount={1}
			/>
		</div>
	)
}
