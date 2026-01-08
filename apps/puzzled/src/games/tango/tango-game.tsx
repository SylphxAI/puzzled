/**
 * Tango Game Component
 * Binary puzzle game (Sun/Moon balance)
 */

'use client'

import { HelpCircle, Play, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui'
import { tangoConfig } from './config'
import { useTango } from './use-tango'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function TangoGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.tango')
	const tCommon = useTranslations('common')

	const [puzzle] = useState(() => defaultParsePuzzleData(tangoConfig, puzzleData, puzzleId))

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
		gameSlug: 'tango',
		mode,
		puzzleId,
		enableStarBurst: false,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)

	const game = useTango(puzzle.puzzleData, puzzle.solution)
	const conflicts = game.getConflicts()
	const conflictSet = new Set(conflicts.map((c) => `${c.row},${c.col}`))
	const gameEndedRef = useRef(false)

	// Handle game end - in useEffect to avoid render-phase side effects
	useEffect(() => {
		if (game.state.gameStatus !== 'playing' && !gameEndedRef.current) {
			gameEndedRef.current = true
			endGame({
				status: game.state.gameStatus,
				attempts: 1,
				data: {
					grid: game.state.grid.map((row) => row.map((cell) => cell.value)),
				},
			})
		}
	}, [game.state.gameStatus, game.state.grid, endGame])

	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0
		const minutes = Math.floor(timeMs / 60000)
		const seconds = Math.floor((timeMs % 60000) / 1000)

		const text = `☀️🌙 Tango\n⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}\n\npuzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.state.endTime, startTime])

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center text-4xl">☀️🌙</div>
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
					className="grid gap-1 rounded-lg border-2 border-border bg-background p-2"
					style={{
						gridTemplateColumns: `repeat(${game.state.size}, minmax(0, 1fr))`,
					}}
				>
					{game.state.grid.map((row, r) =>
						row.map((cell, c) => {
							const hasConflict = conflictSet.has(`${r},${c}`)
							return (
								<button
									key={`${r}-${c}`}
									type="button"
									onClick={() => game.toggleCell(r, c)}
									disabled={cell.isGiven || game.state.gameStatus !== 'playing'}
									className={cn(
										'flex h-10 w-10 items-center justify-center rounded-lg text-2xl transition-all',
										'sm:h-12 sm:w-12',
										cell.isGiven ? 'cursor-default bg-muted' : 'cursor-pointer hover:bg-muted/50',
										hasConflict && 'ring-2 ring-red-500',
										game.state.gameStatus !== 'playing' && 'cursor-default',
									)}
								>
									{cell.value === 'sun' && '☀️'}
									{cell.value === 'moon' && '🌙'}
								</button>
							)
						}),
					)}
				</div>

				{/* Instructions */}
				{conflicts.length > 0 && <p className="text-sm text-red-500">{t('hasConflicts')}</p>}
			</div>

			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="tango"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="tango"
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
