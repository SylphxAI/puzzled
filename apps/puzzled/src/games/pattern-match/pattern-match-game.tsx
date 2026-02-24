/**
 * Pattern Match Game Component
 * Find sets of 3 cards with matching patterns
 */

'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { Flag, HelpCircle, Play, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components/celebration'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { HowToPlayModal } from '@/features/daily/components/how-to-play-modal'
import { formatTimer } from '@/games/shared/format'
import { useGameSession } from '@/games/shared/use-game-session'
import { parsePuzzleDataClient } from '@/games/types'
import { PatternMatchIcon } from '@/shared/components/ui/game-icons'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import { PatternBoard } from './components/board'
import type { PatternMatchClientData, PatternMatchSolution } from './types'
import { usePatternMatch } from './use-pattern-match'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function PatternMatchGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.patternMatch')

	// Parse puzzle data from server (no client-side fallback)
	const [puzzle] = useState(() => {
		const parsed = parsePuzzleDataClient<PatternMatchClientData, PatternMatchSolution>(puzzleData)
		return parsed.puzzleData
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
		gameSlug: 'pattern-match',
		mode,
		puzzleId,
		enableStarBurst: false,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)

	// Game hook
	const game = usePatternMatch(puzzle)

	// Handle messages
	useEffect(() => {
		if (game.message) {
			switch (game.message) {
				case 'correct':
					triggerHaptic('light')
					triggerSound('correct')
					break
				case 'notASet':
					triggerHaptic('error')
					triggerSound('error')
					break
				case 'complete':
					triggerHaptic('success')
					triggerSound('perfectWin')
					break
			}
			game.clearMessage()
		}
	}, [game.message, game.clearMessage])

	const gameEndedRef = useRef(false)

	// Handle game end - delegate to useGameSession
	if ((game.status === 'won' || game.status === 'gave_up') && !gameEndedRef.current) {
		gameEndedRef.current = true
		endGame({
			status: game.status === 'won' ? 'won' : 'lost',
			attempts: game.mistakes,
			data: {
				foundSets: game.foundSets,
				mistakes: game.mistakes,
			},
		})
	}

	// Share result
	const handleShare = useCallback(() => {
		const timeMs = game.endTime && startTime ? game.endTime - startTime : 0

		const emoji = game.status === 'won' ? '🎉' : '😔'
		const text = `🔷 Pattern Match\n${emoji} ${game.foundSets.length}/${game.totalSets} sets • ⏱️ ${formatTimer(timeMs)}\n\nPlay at puzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.status, game.endTime, game.foundSets.length, game.totalSets, startTime])

	const isComplete = game.status === 'won' || game.status === 'gave_up'

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center">
						<PatternMatchIcon size={48} className="text-primary" />
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
				<div className="flex items-center gap-2">
					<span className="text-lg font-bold">
						{game.foundSets.length}/{game.totalSets}
					</span>
					<span className="text-sm text-muted-foreground">{t('setsFound')}</span>
				</div>
				<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
					<HelpCircle className="h-4 w-4" />
				</Button>
			</div>

			{/* Progress bar */}
			<div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
				<div
					className="h-full bg-primary transition-all duration-300"
					style={{
						width: `${(game.foundSets.length / game.totalSets) * 100}%`,
					}}
				/>
			</div>

			{/* Game board */}
			<div className="w-full max-w-sm">
				<PatternBoard
					cards={game.cards}
					selectedIds={game.selectedIds}
					foundSets={game.foundSets}
					onCardClick={game.toggleCard}
				/>
			</div>

			{/* Controls */}
			{!isComplete && (
				<div className="flex w-full max-w-sm gap-2">
					<Button
						variant="outline"
						onClick={game.clearSelection}
						disabled={game.selectedIds.length === 0}
						className="flex-1"
					>
						<RotateCcw className="mr-2 h-4 w-4" />
						{t('clear')}
					</Button>
					<Button variant="ghost" onClick={game.giveUp} className="text-muted-foreground">
						<Flag className="mr-2 h-4 w-4" />
						{t('giveUp')}
					</Button>
				</div>
			)}

			{/* Rules hint */}
			{!isComplete && <p className="text-center text-xs text-muted-foreground">{t('hint')}</p>}

			{/* Modals */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="pattern-match"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="pattern-match"
				status={game.status === 'won' ? 'won' : 'lost'}
				stats={{
					score: game.foundSets.length,
					mistakes: game.mistakes,
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
