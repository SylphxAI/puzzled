/**
 * Block Slide Game Component
 * Slide blocks to free the target block and guide it to the exit.
 */

'use client'

import { Flag, HelpCircle, Play, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { useGameSession } from '@/games/shared/use-game-session'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { BlockSlideIcon } from '@/shared/components/ui/game-icons'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import { Board } from './components/board'
import type { BlockSlideClientData } from './config'
import { getPuzzleFromSeed } from './puzzles'
import { useBlockSlide } from './use-block-slide'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function BlockSlideGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.blockSlide')

	// Get puzzle from server data or generate from seed (deterministic)
	const [puzzle] = useState(() => {
		if (puzzleData && typeof puzzleData === 'object' && 'blocks' in puzzleData) {
			return puzzleData as BlockSlideClientData
		}

		const seed = parseInt(puzzleId || String(Date.now()), 10)
		const generated = getPuzzleFromSeed(seed)
		return generated.puzzleData
	})

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
		gameSlug: 'block-slide',
		mode,
		puzzleId,
		enableStarBurst: false,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)

	// Game hook
	const game = useBlockSlide(puzzle)

	// Handle messages
	useEffect(() => {
		if (game.message) {
			switch (game.message) {
				case 'moved':
					triggerHaptic('light')
					break
				case 'blocked':
					triggerHaptic('error')
					triggerSound('error')
					break
				case 'win':
					triggerHaptic('success')
					triggerSound('perfectWin')
					break
			}
			game.clearMessage()
		}
	}, [game.message, game.clearMessage])

	const gameEndedRef = useRef(false)

	// Handle game end - in useEffect to avoid render-phase side effects
	useEffect(() => {
		if ((game.status === 'won' || game.status === 'gave_up') && !gameEndedRef.current) {
			gameEndedRef.current = true
			endGame({
				status: game.status === 'won' ? 'won' : 'lost',
				attempts: game.moveCount,
				data: {
					moveCount: game.moveCount,
					minMoves: game.minMoves,
				},
			})
		}
	}, [game.status, game.moveCount, game.minMoves, endGame])

	// Share result
	const handleShare = useCallback(() => {
		const timeMs = game.endTime && startTime ? game.endTime - startTime : 0
		const minutes = Math.floor(timeMs / 60000)
		const seconds = Math.floor((timeMs % 60000) / 1000)

		const emoji = game.status === 'won' ? '🎉' : '😔'
		const efficiency = game.minMoves > 0 ? Math.round((game.minMoves / game.moveCount) * 100) : 0
		const text = `🧊 Block Slide\n${emoji} ${game.moveCount} moves (min: ${game.minMoves}) • ${efficiency}% efficiency\n⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}\n\nPlay at puzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.status, game.endTime, game.moveCount, game.minMoves, startTime])

	// Reset game
	const handleReset = useCallback(() => {
		game.reset()
	}, [game])

	const isComplete = game.status === 'won' || game.status === 'gave_up'

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center">
						<BlockSlideIcon size={48} className="text-primary" />
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

			{/* Header */}
			<div className="flex w-full max-w-sm items-center justify-between">
				<div className="flex items-center gap-2 sm:gap-4">
					<div className="text-center">
						<div className="text-xl sm:text-2xl font-bold">{game.moveCount}</div>
						<div className="text-[10px] sm:text-xs text-muted-foreground">{t('moves')}</div>
					</div>
					<div className="text-center">
						<div className="text-xs sm:text-sm text-muted-foreground">
							{t('minMoves')}: {game.minMoves}
						</div>
					</div>
				</div>
				<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
					<HelpCircle className="h-4 w-4" />
				</Button>
			</div>

			{/* Game board */}
			<Board
				blocks={game.blocks}
				gridWidth={game.gridWidth}
				gridHeight={game.gridHeight}
				exitX={game.exitX}
				exitY={game.exitY}
				selectedBlockId={game.selectedBlockId}
				onBlockClick={game.selectBlock}
				onBlockDrag={game.dragMove}
				onMove={game.move}
			/>

			{/* Controls */}
			{!isComplete && (
				<div className="flex w-full max-w-sm gap-2">
					<Button variant="outline" onClick={handleReset} className="flex-1">
						<RotateCcw className="mr-2 h-4 w-4" />
						{t('reset')}
					</Button>
					<Button variant="ghost" onClick={game.giveUp} className="text-muted-foreground">
						<Flag className="mr-2 h-4 w-4" />
						{t('giveUp')}
					</Button>
				</div>
			)}

			{/* Hint */}
			{!isComplete && <p className="text-center text-xs text-muted-foreground">{t('hint')}</p>}

			{/* Modals */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="block-slide"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="block-slide"
				status={game.status === 'won' ? 'won' : 'lost'}
				stats={{
					score: game.moveCount,
					mistakes: Math.max(0, game.moveCount - game.minMoves),
					timeSpentMs: game.endTime && startTime ? game.endTime - startTime : 0,
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
