/**
 * Path Game Component
 * Draw a path visiting 1…n through every cell.
 */

'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { HelpCircle, Play, RotateCcw, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components/celebration'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { HowToPlayModal } from '@/features/daily/components/how-to-play-modal'
import { formatRitualShareText } from '@/features/daily/lib/share-text'
import { formatTimer } from '@/games/shared/format'
import { useGameSession } from '@/games/shared/use-game-session'
import { parsePuzzleDataClient } from '@/games/types'
import { cn, getBaseUrl } from '@/lib/utils'
import type { Cell, NumberPathPuzzleData, NumberPathSolution } from './types'
import { cellsEqual } from './types'
import { useNumberPath } from './use-number-path'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function NumberPathGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.numberPath')
	const tCommon = useTranslations('common')

	const [puzzle] = useState(() =>
		parsePuzzleDataClient<NumberPathPuzzleData, NumberPathSolution>(puzzleData),
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
		gameSlug: 'number-path',
		mode,
		puzzleId,
		enableStarBurst: false,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)

	const game = useNumberPath(puzzle.puzzleData)
	const gameEndedRef = useRef(false)
	const gridRef = useRef<HTMLDivElement>(null)
	const draggingRef = useRef(false)
	const size = puzzle.puzzleData.size
	const playing = game.state.gameStatus === 'playing'

	useEffect(() => {
		if (game.state.gameStatus === 'won' && !gameEndedRef.current) {
			gameEndedRef.current = true
			endGame({
				status: 'won',
				attempts: 1,
				data: {
					path: game.state.path,
				},
			})
		}
	}, [game.state.gameStatus, game.state.path, endGame])

	const cellFromEvent = useCallback(
		(e: React.PointerEvent): Cell | null => {
			if (!gridRef.current) return null
			const rect = gridRef.current.getBoundingClientRect()
			if (rect.width <= 0 || rect.height <= 0) return null
			const col = Math.floor(((e.clientX - rect.left) / rect.width) * size)
			const row = Math.floor(((e.clientY - rect.top) / rect.height) * size)
			if (row < 0 || col < 0 || row >= size || col >= size) return null
			return { row, col }
		},
		[size],
	)

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!playing) return
			e.preventDefault()
			e.currentTarget.setPointerCapture(e.pointerId)
			draggingRef.current = true
			const cell = cellFromEvent(e)
			if (cell) game.touchCell(cell)
		},
		[playing, cellFromEvent, game],
	)

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!playing || !draggingRef.current) return
			const cell = cellFromEvent(e)
			if (cell) game.touchCell(cell)
		},
		[playing, cellFromEvent, game],
	)

	const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
		draggingRef.current = false
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId)
		}
	}, [])

	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0
		const text = formatRitualShareText({
			origin: getBaseUrl('origin'),
			gameSlug: 'number-path',
			gameName: 'Path',
			status: 'won',
			statLine: `⏱️ ${formatTimer(timeMs)}`,
		})
		void navigator.clipboard.writeText(text)
	}, [game.state.endTime, startTime])

	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center text-4xl">1→n</div>
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

	const polyline = game.state.path.map((cell) => `${cell.col + 0.5},${cell.row + 0.5}`).join(' ')

	return (
		<div className="relative flex w-full flex-col items-center">
			<Celebration show={showCelebration} />

			<div className="flex w-full max-w-md flex-col items-center gap-4">
				<div className="flex w-full items-center justify-between px-2">
					<div className="text-sm text-muted-foreground">{t('name')}</div>
					<div className="flex gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={game.undo}
							disabled={!playing || game.state.path.length === 0}
							aria-label="Undo"
						>
							<Undo2 className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={game.reset}
							disabled={!playing}
							aria-label="Reset"
						>
							<RotateCcw className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowHelpModal(true)}
							disabled={!playing}
							aria-label="Help"
						>
							<HelpCircle className="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div
					ref={gridRef}
					className="relative aspect-square w-full max-w-sm touch-none select-none overflow-hidden rounded-lg border-2 border-border bg-background"
					style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
					onPointerDown={handlePointerDown}
					onPointerMove={handlePointerMove}
					onPointerUp={handlePointerUp}
					onPointerCancel={handlePointerUp}
				>
					<div
						className="grid h-full w-full gap-0"
						style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
					>
						{puzzle.puzzleData.clues.map((row, r) =>
							row.map((clue, c) => {
								const cell = { row: r, col: c }
								const visit = game.visitNumber(cell)
								const onPath = visit !== null
								const isLast =
									onPath &&
									game.state.path.length > 0 &&
									cellsEqual(game.state.path[game.state.path.length - 1], cell)
								const label = clue ?? (onPath ? visit : null)

								return (
									<div
										key={`${r}-${c}`}
										className={cn(
											'flex items-center justify-center border border-border text-sm',
											onPath && 'bg-slate-500/15',
											isLast && 'bg-slate-500/30',
											clue !== null
												? 'font-semibold text-foreground'
												: 'font-medium text-muted-foreground',
										)}
									>
										{label ?? ''}
									</div>
								)
							}),
						)}
					</div>

					<svg
						className="pointer-events-none absolute inset-0 h-full w-full text-slate-500"
						viewBox={`0 0 ${size} ${size}`}
						aria-hidden="true"
					>
						{game.state.path.length > 1 && (
							<polyline
								points={polyline}
								fill="none"
								stroke="currentColor"
								strokeWidth="0.12"
								strokeLinejoin="round"
								strokeLinecap="round"
								opacity="0.9"
							/>
						)}
						{game.state.path.map((cell) => (
							<circle
								key={`dot-${cell.row}-${cell.col}`}
								cx={cell.col + 0.5}
								cy={cell.row + 0.5}
								r="0.08"
								fill="currentColor"
							/>
						))}
					</svg>
				</div>
			</div>

			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="number-path"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="number-path"
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
