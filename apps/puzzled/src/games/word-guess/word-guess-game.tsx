'use client'

import { Button } from '@sylphx/ui'
import { HelpCircle, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration, StarBurst } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import { WordleIcon } from '@/shared/components/ui/game-icons'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import { GameBoard, Keyboard } from './components'
import { wordGuessConfig } from './config'
import { WORD_LENGTH } from './types'
import { type SubmitResult, useWordGuess } from './use-word-guess'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function WordGuessGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.wordGuess')
	const tCommon = useTranslations('common')
	const tShare = useTranslations('share')

	// Type-safe puzzle parsing via default helper
	const [puzzle] = useState(() => defaultParsePuzzleData(wordGuessConfig, puzzleData, puzzleId))

	// ==========================================
	// useGameSession: Consolidates 200+ lines of boilerplate
	// ==========================================
	const {
		isReady,
		startGame,
		endGame,
		startTime,
		showCelebration,
		showStarBurst,
		showResultModal,
		setShowResultModal,
		showGuestSignupPrompt,
		handleCloseGuestPrompt,
	} = useGameSession({
		gameSlug: 'word-guess',
		mode,
		puzzleId,
		enableStarBurst: true,
		isPerfectWin: (data) => data.attempts === 1,
	})

	// ==========================================
	// Game-specific state (not consolidated)
	// ==========================================
	const [showToast, setShowToast] = useState(false)
	const [toastMessage, setToastMessage] = useState('')
	const [showHelpModal, setShowHelpModal] = useState(false)
	const [shakeRow, setShakeRow] = useState(false)

	// Ref to store submit result handler (avoids circular dependency with useWordGuess)
	const submitResultHandlerRef = useRef<(result: SubmitResult) => void>(() => {})
	const gameEndedRef = useRef(false)

	const {
		guesses,
		evaluations,
		currentGuess,
		currentRow,
		gameStatus,
		keyboardState,
		solution,
		addLetter,
		deleteLetter,
		trySubmitGuess,
	} = useWordGuess(puzzle.solution.word, (result) => submitResultHandlerRef.current(result))

	// Help click handler for header
	const handleHelpClick = useCallback(() => {
		setShowHelpModal(true)
	}, [])

	// Show toast message
	const showToastMsg = useCallback((message: string) => {
		setToastMessage(message)
		setShowToast(true)
		setTimeout(() => setShowToast(false), 2000)
	}, [])

	// Trigger shake animation with auto-reset
	const triggerShake = useCallback(() => {
		setShakeRow(true)
		setTimeout(() => setShakeRow(false), 300) // Match animation duration
	}, [])

	// Handle submit result feedback (for both keyboard and on-screen)
	const handleSubmitResult = useCallback(
		(result: SubmitResult) => {
			if (result === 'not_enough_letters') {
				showToastMsg(t('messages.notEnoughLetters'))
				triggerSound('error')
				triggerHaptic('error')
				triggerShake()
			} else if (result === 'not_in_word_list') {
				showToastMsg(t('messages.notInWordList'))
				triggerSound('error')
				triggerHaptic('error')
				triggerShake()
			}
		},
		[t, showToastMsg, triggerShake],
	)

	// Keep ref in sync with latest handler
	submitResultHandlerRef.current = handleSubmitResult

	// Submit guess with validation feedback (for on-screen keyboard)
	const handleSubmitGuess = useCallback(() => {
		const result = trySubmitGuess()
		handleSubmitResult(result)
	}, [trySubmitGuess, handleSubmitResult])

	// Handle game end - in useEffect to avoid render-phase side effects
	useEffect(() => {
		if (gameStatus !== 'playing' && !gameEndedRef.current) {
			gameEndedRef.current = true
			endGame({
				status: gameStatus,
				attempts: guesses.length,
				maxAttempts: 6,
				data: { guesses },
			})
		}
	}, [gameStatus, guesses, endGame])

	const handleShare = async () => {
		// Build emoji grid from evaluations
		const emojiGrid = evaluations
			.filter((row) => row.length > 0)
			.map((row) =>
				row
					.map((tile) => {
						switch (tile.status) {
							case 'correct':
								return '🟪' // Purple - Puzzled brand color
							case 'present':
								return '🟧' // Orange - distinctive from NYT yellow
							default:
								return '⬛'
						}
					})
					.join(''),
			)
			.join('\n')

		// Generate engaging share text with personality
		const status = gameStatus as 'won' | 'lost'
		const attempts = guesses.length
		const emoji =
			status === 'won'
				? attempts === 1
					? '🤯'
					: attempts === 2
						? '🔥'
						: attempts <= 3
							? '💪'
							: attempts <= 4
								? '👍'
								: '😮‍💨'
				: '😅'
		const message =
			status === 'won'
				? attempts === 1
					? 'First try!'
					: attempts === 2
						? 'Crushed it!'
						: attempts <= 3
							? 'Not bad!'
							: attempts <= 4
								? 'Got it!'
								: 'Close call!'
				: 'This one got me...'
		const result = status === 'won' ? `${attempts}/6` : 'X/6'
		const challenge = status === 'won' ? 'Can you beat me?' : 'Can you solve it?'

		const text = `${emoji} Puzzled Word Guess\n${result} - ${message}\n\n${emojiGrid}\n\n${challenge}\npuzzled.gg`

		try {
			if (navigator.share) {
				await navigator.share({ text })
			} else {
				await navigator.clipboard.writeText(text)
				showToastMsg(tShare('copied'))
			}
		} catch {
			// User cancelled sharing
		}
	}

	// Ready screen - show rules before gameplay
	if (isReady) {
		return (
			<div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
				{/* Help Modal */}
				<HowToPlayModal
					open={showHelpModal}
					onClose={() => setShowHelpModal(false)}
					gameSlug="word-guess"
				/>

				<WordleIcon size={64} className="text-primary" />
				<div>
					<h2 className="mb-2 text-xl font-bold">{t('name')}</h2>
					<p className="text-muted-foreground">{t('description')}</p>
				</div>

				{/* Rules */}
				<div className="w-full rounded-lg bg-muted/50 p-4 text-sm">
					<p className="mb-3 font-medium">{t('rules.title')}</p>
					<ul className="space-y-2 text-left text-muted-foreground">
						<li>• {t('rules.rule1')}</li>
						<li>• {t('rules.rule2')}</li>
						<li>• {t('rules.rule3')}</li>
					</ul>

					{/* Color examples */}
					<div className="mt-4 space-y-2 border-t pt-4">
						<div className="flex items-center gap-2">
							<div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500 text-xs font-bold text-white">
								W
							</div>
							<span className="text-xs">{t('rules.correct')}</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="flex h-7 w-7 items-center justify-center rounded bg-yellow-500 text-xs font-bold text-white">
								I
							</div>
							<span className="text-xs">{t('rules.present')}</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="flex h-7 w-7 items-center justify-center rounded bg-muted-foreground/50 text-xs font-bold text-white">
								U
							</div>
							<span className="text-xs">{t('rules.absent')}</span>
						</div>
					</div>
				</div>

				<Button onClick={startGame} size="lg" className="gap-2">
					<Play className="h-5 w-5" />
					{tCommon('play')}
				</Button>

				{/* Help link */}
				<button
					type="button"
					onClick={handleHelpClick}
					className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
				>
					<HelpCircle className="h-3 w-3" />
					{t('howToPlay')}
				</button>
			</div>
		)
	}

	return (
		<div className="flex w-full flex-col items-center gap-4 sm:gap-6">
			{/* Guest Signup Prompt */}
			<GuestSignupPrompt
				open={showGuestSignupPrompt}
				onClose={handleCloseGuestPrompt}
				streakCount={1}
			/>

			{/* Celebrations */}
			<Celebration show={showCelebration} />
			<StarBurst show={showStarBurst} />

			{/* Game Board */}
			<GameBoard
				guesses={guesses}
				evaluations={evaluations}
				currentGuess={currentGuess}
				currentRow={currentRow}
				shake={shakeRow}
			/>

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="word-guess"
				status={gameStatus === 'playing' ? 'won' : gameStatus}
				stats={{
					attempts: guesses.length,
					maxAttempts: 6,
					timeSpentMs: startTime ? Date.now() - startTime : 0,
				}}
				solution={solution}
				mode={mode}
				onShare={handleShare}
			/>

			{/* Keyboard */}
			<Keyboard
				keyboardState={keyboardState}
				onKeyPress={addLetter}
				onEnter={handleSubmitGuess}
				onDelete={deleteLetter}
				canSubmit={currentGuess.length === WORD_LENGTH}
			/>

			{/* Toast */}
			{showToast && (
				<div
					role="alert"
					aria-live="assertive"
					className="fixed bottom-24 left-1/2 -translate-x-1/2 animate-slide-up rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg"
				>
					{toastMessage || tShare('copied')}
				</div>
			)}
		</div>
	)
}

// Export the help handler type for parent components
export type { Props as WordleGameProps }
