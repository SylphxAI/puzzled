/**
 * Arithmo Game Component
 * Guess the equation in 6 tries (Nerdle-style)
 */

'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { HelpCircle, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components/celebration'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { HowToPlayModal } from '@/features/daily/components/how-to-play-modal'
import { formatRitualShareText } from '@/features/daily/lib/share-text'
import { useGameSession } from '@/games/shared/use-game-session'
import { admitSubmitGuessViaConnect } from '@/lib/connect/puzzle-admission'
import { getBaseUrl } from '@/lib/utils'
import { ArithmoIcon } from '@/shared/components/ui/game-icons'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import { ArithmoGrid, ArithmoKeyboard } from './components'
import { parseArithmoClientPayload } from './parse-client'
import { EQUATION_LENGTH, isValidEquation, MAX_ATTEMPTS } from './types'
import { useArithmo } from './use-arithmo'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
	puzzleDate?: string
}

export function ArithmoGame({ mode = 'daily', puzzleId, puzzleData, puzzleDate }: Props) {
	const t = useTranslations('games.arithmo')
	const tCommon = useTranslations('common')

	// Get puzzle from server data
	const [puzzle] = useState(() => parseArithmoClientPayload(puzzleData))

	const {
		isReady,
		startGame,
		endGame,
		startTime,
		serverScore,
		showCelebration,
		showResultModal,
		setShowResultModal,
		showGuestSignupPrompt,
		handleCloseGuestPrompt,
	} = useGameSession({
		gameSlug: 'arithmo',
		mode,
		puzzleId,
		puzzleDate,
		validateArchive: true,
		enableStarBurst: false,
		isPerfectWin: (stats) => stats.attempts === 1,
	})

	const [showHelpModal, setShowHelpModal] = useState(false)
	const [finishError, setFinishError] = useState<string | null>(null)
	const submitInFlight = useRef(false)

	// Game hook
	const game = useArithmo()

	// Initialize game when puzzle is ready
	useEffect(() => {
		if (puzzle && !isReady) {
			game.init()
		}
	}, [puzzle, isReady, game.init])

	const handleSubmit = useCallback(() => {
		if (game.state.currentGuess.length !== EQUATION_LENGTH) {
			triggerHaptic('error')
			triggerSound('error')
			return
		}
		if (!isValidEquation(game.state.currentGuess)) {
			triggerHaptic('error')
			triggerSound('error')
			return
		}
		if (submitInFlight.current) return
		submitInFlight.current = true
		void (async () => {
			try {
				const guesses = [...game.state.guesses, game.state.currentGuess]
				const admit = await admitSubmitGuessViaConnect({
					gameSlug: 'arithmo',
					status: 'playing',
					attempts: guesses.length,
					timeSpentMs: startTime ? Date.now() - startTime : 0,
					submission: { guesses },
					puzzleId,
					puzzleDate,
				})
				if (!admit.ok || !admit.response.valid || !admit.response.evaluationJson) {
					triggerHaptic('error')
					triggerSound('error')
					return
				}
				const parsed = JSON.parse(admit.response.evaluationJson) as {
					letters?: unknown
					won?: unknown
					terminal?: unknown
					reveal?: unknown
				}
				if (
					!Array.isArray(parsed.letters) ||
					parsed.letters.length !== EQUATION_LENGTH ||
					parsed.letters.some(
						(letter) => letter !== 'correct' && letter !== 'present' && letter !== 'absent',
					)
				) {
					triggerHaptic('error')
					triggerSound('error')
					return
				}
				game.applyEvaluation({
					guess: game.state.currentGuess,
					letters: parsed.letters,
					won: parsed.won === true,
					terminal: parsed.terminal === true,
					reveal: typeof parsed.reveal === 'string' ? parsed.reveal : undefined,
				})
			} catch {
				triggerHaptic('error')
				triggerSound('error')
			} finally {
				submitInFlight.current = false
			}
		})()
	}, [game, puzzleDate, puzzleId, startTime])

	// Keyboard event listener
	useEffect(() => {
		if (isReady || game.state.isComplete) return

		function handleKeyDown(e: KeyboardEvent) {
			if (e.ctrlKey || e.metaKey || e.altKey) return

			if (e.key === 'Enter') {
				e.preventDefault()
				handleSubmit()
			} else if (e.key === 'Backspace') {
				e.preventDefault()
				game.deleteChar()
			} else if (/^[0-9+\-*/=]$/.test(e.key)) {
				e.preventDefault()
				game.addChar(e.key)
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isReady, game.state.isComplete, game.addChar, game.deleteChar, handleSubmit]) // eslint-disable-line react-hooks/exhaustive-deps

	const gameEndedRef = useRef(false)
	const terminalAutoSubmitRef = useRef(false)
	const submitTerminalFinish = useCallback(async () => {
		if (!game.state.isComplete || gameEndedRef.current) return
		gameEndedRef.current = true
		const result = await endGame({
			status: game.state.isWon ? 'won' : 'lost',
			attempts: game.state.guesses.length,
			maxAttempts: MAX_ATTEMPTS,
			data: { guesses: game.state.guesses },
		})
		if (result.success) {
			setFinishError(null)
			return
		}
		gameEndedRef.current = false
		setFinishError(result.error || 'finish_rejected')
	}, [endGame, game.state.guesses, game.state.isComplete, game.state.isWon])

	useEffect(() => {
		if (!game.state.isComplete || terminalAutoSubmitRef.current) return
		terminalAutoSubmitRef.current = true
		void submitTerminalFinish()
	}, [game.state.isComplete, submitTerminalFinish])

	// Share result
	const handleShare = useCallback(() => {
		const emojis = game.state.results
			.map((row) =>
				row
					.map((status) => (status === 'correct' ? '🟩' : status === 'present' ? '🟨' : '⬛'))
					.join(''),
			)
			.join('\n')

		const attempts = game.state.isWon ? game.state.guesses.length : undefined
		const text = formatRitualShareText({
			origin: getBaseUrl('origin'),
			gameSlug: 'arithmo',
			gameName: 'Arithmo',
			puzzleDate,
			status: game.state.isWon ? 'won' : 'lost',
			attempts: typeof attempts === 'number' ? attempts : undefined,
			statLine: emojis,
		})
		void navigator.clipboard.writeText(text)
	}, [game.state.results, game.state.guesses.length, game.state.isWon, puzzleDate])

	// Get error message
	const getErrorMessage = () => {
		if (!game.state.error) return null
		switch (game.state.error) {
			case 'notComplete':
				return t('messages.notComplete')
			case 'invalid':
				return t('messages.invalid')
			default:
				return null
		}
	}

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center">
						<ArithmoIcon size={48} className="text-primary" />
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
				<div className="text-sm text-muted-foreground">{t('name')}</div>
				<Button variant="ghost" size="sm" onClick={() => setShowHelpModal(true)}>
					<HelpCircle className="h-4 w-4" />
				</Button>
			</div>

			{/* Grid */}
			<ArithmoGrid
				guesses={game.state.guesses}
				results={game.state.results}
				currentGuess={game.state.currentGuess}
				currentRow={game.state.currentRow}
			/>

			{/* Error message */}
			{game.state.error && (
				<div className="text-sm text-destructive animate-in fade-in">{getErrorMessage()}</div>
			)}

			{/* Keyboard */}
			<ArithmoKeyboard
				onChar={game.addChar}
				onDelete={game.deleteChar}
				onEnter={handleSubmit}
				keyboardStatus={game.state.keyboardStatus}
				disabled={game.state.isComplete}
			/>

			{finishError && (
				<div role="alert" className="flex flex-col items-center gap-2 text-sm text-destructive">
					<span>{tCommon('errorDescription')}</span>
					<Button variant="outline" onClick={() => void submitTerminalFinish()}>
						{tCommon('retry')}
					</Button>
				</div>
			)}

			{/* Help Modal */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="arithmo"
			/>

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="arithmo"
				status={game.state.isWon ? 'won' : 'lost'}
				solution={game.state.isWon ? undefined : game.state.reveal}
				stats={{
					score: serverScore ?? undefined,
					attempts: game.state.guesses.length,
					maxAttempts: MAX_ATTEMPTS,
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
