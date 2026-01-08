/**
 * Quordle Game Component
 * 4 Wordle boards played simultaneously
 */

'use client'

import { Delete, HelpCircle, Play, RotateCcw } from 'lucide-react'
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
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import { quadWordsConfig } from './config'
import type { LetterStatus } from './types'
import { evaluateGuess, MAX_GUESSES } from './types'
import { useQuadWords } from './use-quad-words'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

const KEYBOARD_ROWS = [
	['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
	['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
	['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
]

export function QuadWordsGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.quadWords')
	const tCommon = useTranslations('common')

	const [puzzle] = useState(() => defaultParsePuzzleData(quadWordsConfig, puzzleData, puzzleId))

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
		gameSlug: 'quad-words',
		mode,
		puzzleId,
	})

	// Game-specific state
	const [showHelpModal, setShowHelpModal] = useState(false)
	const [showToast, setShowToast] = useState(false)
	const [toastMessage, setToastMessage] = useState('')
	const gameEndedRef = useRef(false)

	const game = useQuadWords(puzzle.puzzleData, puzzle.solution)

	// Handle game completion - delegate to useGameSession
	if (
		(game.state.gameStatus === 'won' || game.state.gameStatus === 'lost') &&
		!gameEndedRef.current
	) {
		gameEndedRef.current = true
		endGame({
			status: game.state.gameStatus,
			attempts: game.state.guessHistory.length,
			data: {
				guessHistory: game.state.guessHistory,
				solvedBoards: game.state.boards.map((b) => b.solved),
			},
		})
	}

	const showToastMsg = useCallback((message: string) => {
		setToastMessage(message)
		setShowToast(true)
		setTimeout(() => setShowToast(false), 2000)
	}, [])

	const handleSubmit = useCallback(() => {
		// For now, accept any 5-letter word. In production, validate against dictionary.
		const result = game.submitGuess(game.state.currentGuess.length === 5)
		if (!result.success) {
			showToastMsg(result.error || 'Invalid word')
			triggerSound('error')
			triggerHaptic('error')
		}
	}, [game, showToastMsg])

	const handleKeyPress = useCallback(
		(key: string) => {
			if (game.state.gameStatus !== 'playing') return

			if (key === 'ENTER') {
				handleSubmit()
			} else if (key === 'DEL') {
				game.deleteLetter()
			} else if (/^[A-Z]$/.test(key)) {
				game.addLetter(key)
			}
		},
		[game, handleSubmit],
	)

	// Keyboard handler
	useEffect(() => {
		if (isReady || game.state.gameStatus !== 'playing') return

		function handleKeyDown(e: KeyboardEvent) {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return
			}

			if (/^[a-zA-Z]$/.test(e.key)) {
				game.addLetter(e.key)
			} else if (e.key === 'Backspace') {
				e.preventDefault()
				game.deleteLetter()
			} else if (e.key === 'Enter') {
				e.preventDefault()
				handleSubmit()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isReady, game, handleSubmit])

	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0
		const minutes = Math.floor(timeMs / 60000)
		const seconds = Math.floor((timeMs % 60000) / 1000)
		const solved = game.getSolvedCount()

		const text = `4️⃣ Quordle\n${solved}/4 solved in ${game.state.guessHistory.length}/${MAX_GUESSES} guesses\n⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}\n\npuzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game, startTime])

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center text-4xl">4️⃣</div>
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

			<div className="flex w-full max-w-2xl flex-col items-center gap-2">
				{/* Header */}
				<div className="flex w-full items-center justify-between px-2">
					<div className="text-sm text-muted-foreground">
						{game.getSolvedCount()}/4 • {game.getRemainingGuesses()} guesses left
					</div>
					<div className="flex gap-2">
						<Button variant="ghost" size="sm" onClick={game.reset}>
							<RotateCcw className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
							<HelpCircle className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* 4 Boards in 2x2 grid */}
				<div className="grid grid-cols-2 gap-2">
					{game.state.boards.map((board, boardIndex) => (
						<QuordleBoard
							key={boardIndex}
							board={board}
							currentGuess={game.state.currentGuess}
							guessHistory={game.state.guessHistory}
							isActive={!board.solved}
						/>
					))}
				</div>

				{/* Keyboard */}
				<div className="mt-2 flex w-full max-w-md flex-col gap-1">
					{KEYBOARD_ROWS.map((row, i) => (
						<div key={i} className="flex justify-center gap-1">
							{row.map((key) => {
								const status = game.state.keyboardStatus.get(key)
								const isSpecial = key === 'ENTER' || key === 'DEL'

								return (
									<button
										key={key}
										type="button"
										onClick={() => handleKeyPress(key)}
										disabled={game.state.gameStatus !== 'playing'}
										className={cn(
											'flex items-center justify-center rounded font-bold transition-colors',
											isSpecial ? 'h-10 px-2 text-xs' : 'h-10 w-8 text-sm',
											status === 'correct' && 'bg-correct text-white',
											status === 'present' && 'bg-present text-white',
											status === 'absent' && 'bg-absent text-white',
											!status && 'bg-muted hover:bg-muted/80',
										)}
									>
										{key === 'DEL' ? <Delete className="h-4 w-4" /> : key}
									</button>
								)
							})}
						</div>
					))}
				</div>
			</div>

			{/* Toast */}
			{showToast && (
				<div className="fixed bottom-24 left-1/2 -translate-x-1/2 animate-slide-up rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg">
					{toastMessage}
				</div>
			)}

			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="quad-words"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="quad-words"
				status={game.state.gameStatus === 'won' ? 'won' : 'lost'}
				stats={{
					attempts: game.state.guessHistory.length,
					maxAttempts: MAX_GUESSES,
					timeSpentMs: game.state.endTime && startTime ? game.state.endTime - startTime : 0,
				}}
				mode={mode}
				onShare={handleShare}
			/>

			<GuestSignupPrompt open={showGuestSignupPrompt} onClose={handleCloseGuestPrompt} />
		</div>
	)
}

// Individual board component
function QuordleBoard({
	board,
	currentGuess,
	guessHistory,
	isActive,
}: {
	board: {
		targetWord: string
		guesses: string[]
		solved: boolean
		solvedOnGuess: number | null
	}
	currentGuess: string
	guessHistory: string[]
	isActive: boolean
}) {
	// Calculate how many rows to show (5 rows for compact display)
	const DISPLAY_ROWS = 5

	// Get the guesses that have been made for this board
	const boardGuesses = guessHistory.slice(0, board.guesses.length)

	// Current row is after the last guess
	const currentRow = boardGuesses.length

	return (
		<div
			className={cn(
				'rounded-lg border p-2 transition-all',
				board.solved && 'border-correct bg-correct/10',
				!board.solved && isActive && 'border-primary',
				!board.solved && !isActive && 'border-muted opacity-50',
			)}
		>
			<div className="grid grid-rows-5 gap-0.5">
				{Array.from({ length: DISPLAY_ROWS }).map((_, rowIndex) => {
					let word = ''
					let results: LetterStatus[] = []

					if (rowIndex < boardGuesses.length) {
						// Past guess
						word = boardGuesses[rowIndex]
						results = evaluateGuess(word, board.targetWord)
					} else if (rowIndex === currentRow && isActive && !board.solved) {
						// Current input row
						word = currentGuess
					}

					return (
						<div key={rowIndex} className="flex gap-0.5">
							{Array.from({ length: 5 }).map((_, colIndex) => {
								const letter = word[colIndex] || ''
								const status = results[colIndex]

								return (
									<div
										key={colIndex}
										className={cn(
											'flex h-6 w-6 items-center justify-center rounded text-xs font-bold',
											status === 'correct' && 'bg-correct text-white',
											status === 'present' && 'bg-present text-white',
											status === 'absent' && 'bg-absent text-white',
											!status && letter && 'border border-muted-foreground/30 bg-background',
											!status && !letter && 'border border-muted bg-muted/30',
										)}
									>
										{letter}
									</div>
								)
							})}
						</div>
					)
				})}
			</div>

			{/* Solved indicator */}
			{board.solved && (
				<div className="mt-1 text-center text-xs font-medium text-correct">
					Solved in {board.solvedOnGuess}!
				</div>
			)}

			{/* Lost indicator */}
			{!board.solved && guessHistory.length >= MAX_GUESSES && (
				<div className="mt-1 text-center text-xs font-medium text-destructive">
					{board.targetWord}
				</div>
			)}
		</div>
	)
}
