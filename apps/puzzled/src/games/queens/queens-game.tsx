/**
 * Queens Game Component
 * N-Queens puzzle with colored regions
 */

'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { Crown, HelpCircle, Play, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { formatTimer } from '@/games/shared/format'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import { cn } from '@/lib/utils'
import { queensConfig } from './config'
import { REGION_COLORS } from './types'
import { useQueens } from './use-queens'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function QueensGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.queens')
	const tCommon = useTranslations('common')

	const [puzzle] = useState(() => defaultParsePuzzleData(queensConfig, puzzleData, puzzleId))

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
		gameSlug: 'queens',
		mode,
		puzzleId,
	})

	// Game-specific state
	const [showHelpModal, setShowHelpModal] = useState(false)
	const gameEndedRef = useRef(false)

	// Game hook
	const game = useQueens(puzzle.puzzleData, puzzle.solution)
	const conflictingCells = game.getConflictingCells()

	// Handle game completion - in useEffect to avoid render-phase side effects
	useEffect(() => {
		if (game.state.isComplete && !gameEndedRef.current) {
			gameEndedRef.current = true
			endGame({
				status: 'won',
				attempts: 1,
				data: {
					finalGrid: game.state.grid,
				},
			})
		}
	}, [game.state.isComplete, game.state.grid, endGame])

	// Share result
	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0

		const text = `👑 Queens ${puzzle.puzzleData.size}×${puzzle.puzzleData.size}\n⏱️ ${formatTimer(timeMs)}\n\nPlay at puzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.state.endTime, startTime, puzzle.puzzleData.size])

	// Reset game
	const handleReset = useCallback(() => {
		game.reset()
		gameEndedRef.current = false
		setShowResultModal(false)
	}, [game, setShowResultModal])

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center">
						<Crown className="h-12 w-12 text-violet-500" />
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
							<li>• {t('rules.rule4')}</li>
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

	const size = puzzle.puzzleData.size
	const cellSize = size <= 6 ? 'w-12 h-12' : size <= 7 ? 'w-10 h-10' : 'w-9 h-9'

	return (
		<div className="relative flex w-full flex-col items-center">
			{/* Celebration */}
			<Celebration show={showCelebration} />

			{/* Game container */}
			<div className="flex w-full max-w-md flex-col items-center gap-4">
				{/* Header */}
				<div className="flex w-full items-center justify-between px-2">
					<div className="text-sm text-muted-foreground">
						{t('name')} ({size}×{size})
					</div>
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							{game.queenCount}/{size} 👑
						</span>
						<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
							<HelpCircle className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Grid */}
				<div
					className="grid gap-0.5 rounded-lg border bg-muted/30 p-2"
					style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
				>
					{Array.from({ length: size }, (_, row) =>
						Array.from({ length: size }, (_, col) => {
							const region = puzzle.puzzleData.regions[row][col]
							const hasQueen = game.state.grid[row][col]
							const isSelected =
								game.state.selectedCell?.row === row && game.state.selectedCell?.col === col
							const hasConflict = hasQueen && conflictingCells.has(`${row},${col}`)

							return (
								<button
									key={`${row}-${col}`}
									type="button"
									onClick={() => game.toggleQueen(row, col)}
									className={cn(
										cellSize,
										'flex items-center justify-center rounded-md border transition-all',
										REGION_COLORS[region % REGION_COLORS.length],
										isSelected && 'ring-2 ring-primary ring-offset-1',
										hasConflict && 'ring-2 ring-red-500',
										game.state.isComplete && 'pointer-events-none',
									)}
								>
									{hasQueen && (
										<Crown
											className={cn('h-6 w-6', hasConflict ? 'text-red-600' : 'text-foreground')}
											fill={hasConflict ? 'rgb(220 38 38)' : 'currentColor'}
										/>
									)}
								</button>
							)
						}),
					)}
				</div>

				{/* Actions */}
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleReset}
						disabled={game.state.isComplete}
					>
						<RotateCcw className="mr-1 h-4 w-4" />
						{tCommon('reset')}
					</Button>
				</div>

				{/* Status message */}
				{conflictingCells.size > 0 && !game.state.isComplete && (
					<p className="text-sm text-red-500">{t('hasConflicts')}</p>
				)}
			</div>

			{/* Help Modal */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="queens"
			/>

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="queens"
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
