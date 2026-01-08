/**
 * Nonogram Game Component
 * Main game wrapper with state management
 */

'use client'

import { HelpCircle, MousePointer2, Play, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { NonogramIcon } from '@/shared/components/ui/game-icons'
import { triggerHaptic } from '@/shared/hooks'
import { NonogramGrid } from './components'
import { nonogramConfig } from './config'
import { useNonogram } from './use-nonogram'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function NonogramGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.nonogram')
	const _tCommon = useTranslations('common')

	// Get puzzle from server data or generate from seed (deterministic)
	const [puzzle] = useState(() => defaultParsePuzzleData(nonogramConfig, puzzleData, puzzleId))

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
		gameSlug: 'nonogram',
		mode,
		puzzleId,
		enableStarBurst: false,
		isPerfectWin: (stats) => stats.attempts === 1,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)

	// Game hook
	const game = useNonogram()

	// Initialize game when puzzle is ready
	useEffect(() => {
		if (puzzle && !isReady) {
			game.init(puzzle.puzzleData, puzzle.solution.grid)
		}
	}, [puzzle, isReady, game.init]) // eslint-disable-line react-hooks/exhaustive-deps

	// Track game completion - in useEffect to avoid render-phase side effects
	const gameEndedRef = useRef(false)
	useEffect(() => {
		if (game.state.isComplete && !gameEndedRef.current) {
			gameEndedRef.current = true
			// Convert CellState[][] to boolean[][] for server
			const finalGrid = game.state.userGrid.map((row) => row.map((cell) => cell === 'filled'))
			endGame({
				status: 'won',
				attempts: 1,
				maxAttempts: 1,
				data: {
					finalGrid,
				},
			})
		}
	}, [game.state.isComplete, game.state.userGrid, endGame])

	// Handle cell click - toggle based on fill mode
	const handleCellClick = useCallback(
		(row: number, col: number) => {
			game.toggleCell(row, col)
			triggerHaptic('light')
		},
		[game],
	)

	// Handle right-click - opposite of current mode
	// Only toggle between empty and the opposite state (don't overwrite same-mode cells)
	const handleCellRightClick = useCallback(
		(row: number, col: number) => {
			const currentState = game.state.userGrid[row]?.[col]
			if (currentState === undefined) return

			if (game.state.fillMode === 'fill') {
				// In fill mode, right-click toggles marks on empty/marked cells only
				// Don't overwrite filled cells
				if (currentState === 'empty') {
					game.setCell(row, col, 'marked')
				} else if (currentState === 'marked') {
					game.setCell(row, col, 'empty')
				}
				// Ignore right-click on filled cells
			} else {
				// In mark mode, right-click toggles fills on empty/filled cells only
				// Don't overwrite marked cells
				if (currentState === 'empty') {
					game.setCell(row, col, 'filled')
				} else if (currentState === 'filled') {
					game.setCell(row, col, 'empty')
				}
				// Ignore right-click on marked cells
			}
			triggerHaptic('light')
		},
		[game],
	)

	// Share result
	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0
		const minutes = Math.floor(timeMs / 60000)
		const seconds = Math.floor((timeMs % 60000) / 1000)

		const theme = puzzle.puzzleData.theme || 'Picture'
		const text = `🎨 Nonogram: ${theme}\n⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}\n\nPlay at puzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.state.endTime, startTime, puzzle.puzzleData.theme])

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center">
						<NonogramIcon size={48} className="text-primary" />
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
		<div className="relative flex w-full flex-col items-center gap-3 sm:gap-4 px-2 sm:px-4">
			{/* Celebration */}
			<Celebration show={showCelebration} />

			{/* Header with help button */}
			<div className="flex w-full max-w-sm items-center justify-between">
				<div className="text-sm text-muted-foreground">
					{t('name')} {puzzle.puzzleData.theme && `• ${puzzle.puzzleData.theme}`}
				</div>
				<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
					<HelpCircle className="h-4 w-4" />
				</Button>
			</div>

			{/* Grid */}
			{game.state.puzzle && (
				<NonogramGrid
					puzzle={game.state.puzzle}
					userGrid={game.state.userGrid}
					selectedCell={game.state.selectedCell}
					completedRows={game.state.completedRows}
					completedCols={game.state.completedCols}
					fillMode={game.state.fillMode}
					onCellClick={handleCellClick}
					onCellRightClick={handleCellRightClick}
					disabled={game.state.isComplete}
				/>
			)}

			{/* Mode toggle */}
			<div className="flex gap-2">
				<Button
					variant={game.state.fillMode === 'fill' ? 'default' : 'outline'}
					size="sm"
					onClick={game.toggleMode}
					disabled={game.state.isComplete}
				>
					<MousePointer2 className="mr-1 h-4 w-4" />
					{t('fillMode')}
				</Button>
				<Button
					variant={game.state.fillMode === 'mark' ? 'default' : 'outline'}
					size="sm"
					onClick={game.toggleMode}
					disabled={game.state.isComplete}
				>
					<X className="mr-1 h-4 w-4" />
					{t('markMode')}
				</Button>
			</div>

			{/* Error counter */}
			{game.state.errors > 0 && (
				<div className="text-sm text-destructive">{t('errors', { count: game.state.errors })}</div>
			)}

			{/* Help Modal */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="nonogram"
			/>

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="nonogram"
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
