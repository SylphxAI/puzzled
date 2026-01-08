/**
 * Cryptogram Game Component
 * Decrypt famous quotes by letter substitution
 */

'use client'

import { HelpCircle, Lightbulb, Play, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { triggerHaptic } from '@/shared/hooks'
import { cryptogramConfig } from './config'
import { ALPHABET, MAX_HINTS } from './types'
import { useCryptogram } from './use-cryptogram'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function CryptogramGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const _t = useTranslations('games.cryptogram')
	const tCommon = useTranslations('common')

	const [puzzle] = useState(() => defaultParsePuzzleData(cryptogramConfig, puzzleData, puzzleId))

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
		gameSlug: 'cryptogram',
		mode,
		puzzleId,
		enableStarBurst: true,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)

	const game = useCryptogram(puzzle.puzzleData, puzzle.solution)
	const progress = game.getProgress()
	const gameEndedRef = useRef(false)

	// Handle game end - delegate to useGameSession
	if (game.state.gameStatus !== 'playing' && !gameEndedRef.current) {
		gameEndedRef.current = true
		endGame({
			status: game.state.gameStatus,
			hintsUsed: game.state.hintsUsed,
			data: {
				guesses: game.state.guesses,
				hintsUsed: game.state.hintsUsed,
			},
		})
	}

	// Handle keyboard input
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (game.state.gameStatus !== 'playing') return
			if (!game.state.selectedLetter) return

			const key = e.key.toUpperCase()

			if (key === 'BACKSPACE' || key === 'DELETE') {
				game.clearGuess(game.state.selectedLetter)
				e.preventDefault()
			} else if (key.length === 1 && key >= 'A' && key <= 'Z') {
				game.setGuess(game.state.selectedLetter, key)
				triggerHaptic('light')
				e.preventDefault()
			} else if (key === 'ESCAPE') {
				game.selectLetter(null)
				e.preventDefault()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [game, game.state.selectedLetter, game.state.gameStatus])

	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0
		const minutes = Math.floor(timeMs / 60000)
		const seconds = Math.floor((timeMs % 60000) / 1000)

		const hintsText = game.state.hintsUsed > 0 ? ` (${game.state.hintsUsed} hints)` : ''
		const text = `Cryptogram\n"${puzzle.puzzleData.author}"\n${minutes}:${seconds.toString().padStart(2, '0')}${hintsText}\n\npuzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.state.endTime, game.state.hintsUsed, startTime, puzzle.puzzleData.author])

	// Parse the encrypted text into words for display
	const words = puzzle.puzzleData.encryptedText.split(' ')

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-lg">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center text-4xl">🔐</div>
					<CardTitle>Cryptogram</CardTitle>
					<p className="text-sm text-muted-foreground">Decrypt the famous quote</p>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="rounded-lg bg-muted/50 p-4">
						<h3 className="mb-2 flex items-center gap-2 font-medium">
							<HelpCircle className="h-4 w-4" />
							How to Play
						</h3>
						<ul className="space-y-1 text-sm text-muted-foreground">
							<li>• Each letter has been replaced with a different letter</li>
							<li>• Figure out the substitution to reveal the quote</li>
							<li>• The same letter always maps to the same replacement</li>
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

			<div className="flex w-full max-w-2xl flex-col items-center gap-4">
				{/* Header */}
				<div className="flex w-full items-center justify-between px-2">
					<div className="flex flex-col">
						<span className="text-sm text-muted-foreground">Cryptogram</span>
						<span className="text-xs text-muted-foreground">
							{progress.correct}/{progress.total} letters
						</span>
					</div>
					<div className="flex gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={game.useHint}
							disabled={!game.canUseHint}
							className="gap-1"
						>
							<Lightbulb className="h-4 w-4" />
							<span className="text-xs">{MAX_HINTS - game.state.hintsUsed}</span>
						</Button>
						<Button variant="ghost" size="sm" onClick={game.reset}>
							<RotateCcw className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
							<HelpCircle className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Quote author hint */}
				<div className="rounded-lg bg-muted/30 px-4 py-2 text-center">
					<span className="text-sm text-muted-foreground">Quote by </span>
					<span className="text-sm font-medium">{puzzle.puzzleData.author}</span>
				</div>

				{/* Encrypted text display */}
				<div className="flex flex-wrap justify-center gap-x-4 gap-y-3 px-4">
					{words.map((word, wordIndex) => (
						<div key={wordIndex} className="flex gap-0.5">
							{word.split('').map((char, charIndex) => {
								const isLetter = char >= 'A' && char <= 'Z'
								const guess = isLetter ? game.state.guesses[char] : null
								const isSelected = game.state.selectedLetter === char
								const isRevealed = game.state.revealedLetters.includes(char)

								if (!isLetter) {
									// Punctuation
									return (
										<div
											key={charIndex}
											className="flex h-10 w-4 items-end justify-center pb-1 text-lg font-bold"
										>
											{char}
										</div>
									)
								}

								return (
									<button
										key={charIndex}
										type="button"
										onClick={() =>
											!isRevealed && game.state.gameStatus === 'playing' && game.selectLetter(char)
										}
										disabled={isRevealed || game.state.gameStatus !== 'playing'}
										className={cn(
											'flex h-10 w-7 flex-col items-center justify-end rounded transition-all',
											'sm:h-12 sm:w-8',
											isSelected && 'ring-2 ring-primary ring-offset-2',
											isRevealed
												? 'cursor-default bg-green-500/20'
												: 'cursor-pointer hover:bg-muted',
											game.state.gameStatus !== 'playing' && 'cursor-default',
										)}
									>
										{/* Guess (what player thinks it is) */}
										<span
											className={cn(
												'text-base font-bold',
												'sm:text-lg',
												isRevealed
													? 'text-green-600'
													: guess
														? 'text-primary'
														: 'text-muted-foreground/30',
											)}
										>
											{guess || '_'}
										</span>
										{/* Encrypted letter (shown below) */}
										<span className="text-[10px] text-muted-foreground">{char}</span>
									</button>
								)
							})}
						</div>
					))}
				</div>

				{/* Keyboard */}
				<div className="mt-4 w-full max-w-lg px-2">
					<div className="flex flex-wrap justify-center gap-1">
						{ALPHABET.split('').map((letter) => {
							// Check if this letter is already used as a guess
							const isUsed = Object.values(game.state.guesses).includes(letter)

							return (
								<button
									key={letter}
									type="button"
									onClick={() => {
										if (game.state.selectedLetter && game.state.gameStatus === 'playing') {
											game.setGuess(game.state.selectedLetter, letter)
											triggerHaptic('light')
										}
									}}
									disabled={game.state.gameStatus !== 'playing' || !game.state.selectedLetter}
									className={cn(
										'flex h-10 w-8 items-center justify-center rounded-lg border text-sm font-bold transition-all',
										'sm:h-11 sm:w-9 sm:text-base',
										isUsed
											? 'border-muted bg-muted/50 text-muted-foreground'
											: 'border-border bg-background hover:bg-muted',
										!game.state.selectedLetter && 'opacity-50',
									)}
								>
									{letter}
								</button>
							)
						})}
					</div>
				</div>

				{/* Instructions */}
				{game.state.selectedLetter && (
					<p className="text-sm text-muted-foreground">
						Type a letter to replace "{game.state.selectedLetter}"
					</p>
				)}
			</div>

			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="cryptogram"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="cryptogram"
				status={game.state.gameStatus === 'won' ? 'won' : 'lost'}
				stats={{
					timeSpentMs: game.state.endTime && startTime ? game.state.endTime - startTime : 0,
					hintsUsed: game.state.hintsUsed,
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
