/**
 * Letter Boxed Game Component
 * Word game with letters arranged on box sides
 */

'use client'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { Delete, HelpCircle, Play, RotateCcw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components/celebration'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { HowToPlayModal } from '@/features/daily/components/how-to-play-modal'
import { formatTimer } from '@/games/shared/format'
import { useGameSession } from '@/games/shared/use-game-session'
import { parsePuzzleDataClient } from '@/games/types'
import { cn } from '@/lib/utils'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import type { LetterBoxedPuzzleData, LetterBoxedSolution } from './types'
import { useWordBox } from './use-word-box'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function WordBoxGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.wordBox')
	const tCommon = useTranslations('common')

	// Get puzzle from server data (client-safe - no config import)
	const [puzzle] = useState(() =>
		parsePuzzleDataClient<LetterBoxedPuzzleData, LetterBoxedSolution>(puzzleData),
	)

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
		gameSlug: 'word-box',
		mode,
		puzzleId,
	})

	// Game-specific state
	const [showHelpModal, setShowHelpModal] = useState(false)
	const [showToast, setShowToast] = useState(false)
	const [toastMessage, setToastMessage] = useState('')
	const gameEndedRef = useRef(false)

	const game = useWordBox(puzzle.puzzleData, puzzle.solution)
	const box = puzzle.puzzleData.box

	// Handle game completion - delegate to useGameSession
	if (game.state.gameStatus === 'won' && !gameEndedRef.current) {
		gameEndedRef.current = true
		endGame({
			status: 'won',
			attempts: game.state.words.length,
			data: {
				words: game.state.words,
			},
		})
	}

	const showToastMsg = useCallback((message: string) => {
		setToastMessage(message)
		setShowToast(true)
		setTimeout(() => setShowToast(false), 2000)
	}, [])

	const handleSubmit = useCallback(() => {
		// In production, validate against a dictionary API
		// For now, accept words 3+ letters that pass box rules
		const result = game.submitWord(game.state.currentWord.length >= 3)
		if (!result.success) {
			showToastMsg(result.error || 'Invalid word')
			triggerSound('error')
			triggerHaptic('error')
		}
	}, [game, showToastMsg])

	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0

		const text = `📦 Letter Boxed\n${game.state.words.length} words\n⏱️ ${formatTimer(timeMs)}\n\npuzzled.gg`
		navigator.clipboard.writeText(text)
	}, [game.state.endTime, game.state.words.length, startTime])

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

	// Ready screen
	if (isReady) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader className="text-center">
					<div className="mb-2 flex justify-center text-4xl">📦</div>
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

	const allLetters = [...box.top, ...box.right, ...box.bottom, ...box.left]
	const lastLetter = game.getLastLetter()

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

				{/* Letter Box */}
				<div className="relative h-64 w-64">
					{/* Box outline */}
					<div className="absolute inset-8 rounded-lg border-2 border-primary" />

					{/* Top letters */}
					<div className="absolute left-1/2 top-0 flex -translate-x-1/2 gap-4">
						{box.top.map((letter, i) => (
							<button
								key={`top-${i}`}
								type="button"
								onClick={() => game.addLetter(letter)}
								disabled={game.state.gameStatus !== 'playing'}
								className={cn(
									'flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition-all',
									game.state.usedLetters.has(letter)
										? 'bg-primary text-primary-foreground'
										: 'bg-muted hover:bg-muted/80',
								)}
							>
								{letter}
							</button>
						))}
					</div>

					{/* Right letters */}
					<div className="absolute right-0 top-1/2 flex -translate-y-1/2 flex-col gap-4">
						{box.right.map((letter, i) => (
							<button
								key={`right-${i}`}
								type="button"
								onClick={() => game.addLetter(letter)}
								disabled={game.state.gameStatus !== 'playing'}
								className={cn(
									'flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition-all',
									game.state.usedLetters.has(letter)
										? 'bg-primary text-primary-foreground'
										: 'bg-muted hover:bg-muted/80',
								)}
							>
								{letter}
							</button>
						))}
					</div>

					{/* Bottom letters */}
					<div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-4">
						{box.bottom.map((letter, i) => (
							<button
								key={`bottom-${i}`}
								type="button"
								onClick={() => game.addLetter(letter)}
								disabled={game.state.gameStatus !== 'playing'}
								className={cn(
									'flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition-all',
									game.state.usedLetters.has(letter)
										? 'bg-primary text-primary-foreground'
										: 'bg-muted hover:bg-muted/80',
								)}
							>
								{letter}
							</button>
						))}
					</div>

					{/* Left letters */}
					<div className="absolute left-0 top-1/2 flex -translate-y-1/2 flex-col gap-4">
						{box.left.map((letter, i) => (
							<button
								key={`left-${i}`}
								type="button"
								onClick={() => game.addLetter(letter)}
								disabled={game.state.gameStatus !== 'playing'}
								className={cn(
									'flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold transition-all',
									game.state.usedLetters.has(letter)
										? 'bg-primary text-primary-foreground'
										: 'bg-muted hover:bg-muted/80',
								)}
							>
								{letter}
							</button>
						))}
					</div>
				</div>

				{/* Current word */}
				<div className="flex h-12 min-w-[200px] items-center justify-center rounded-lg border-2 border-primary bg-background px-4 text-xl font-bold">
					{lastLetter && !game.state.currentWord && (
						<span className="text-muted-foreground">{lastLetter}</span>
					)}
					{game.state.currentWord || (lastLetter ? '' : '_')}
				</div>

				{/* Action buttons */}
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={game.deleteLetter}
						disabled={game.state.gameStatus !== 'playing' || game.state.currentWord.length === 0}
					>
						<Delete className="h-4 w-4" />
					</Button>
					<Button
						size="sm"
						onClick={handleSubmit}
						disabled={game.state.gameStatus !== 'playing' || !game.canSubmit()}
					>
						Enter
					</Button>
				</div>

				{/* Previous words */}
				{game.state.words.length > 0 && (
					<div className="flex flex-wrap justify-center gap-2">
						{game.state.words.map((word, i) => (
							<span
								key={i}
								className="rounded bg-primary px-2 py-1 text-sm font-medium text-primary-foreground"
							>
								{word}
							</span>
						))}
					</div>
				)}

				{/* Progress */}
				<div className="text-sm text-muted-foreground">
					{game.state.usedLetters.size}/{allLetters.length} letters used
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
				gameSlug="word-box"
			/>

			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="word-box"
				status="won"
				stats={{
					attempts: game.state.words.length,
					timeSpentMs: game.state.endTime && startTime ? game.state.endTime - startTime : 0,
				}}
				mode={mode}
				onShare={handleShare}
			/>

			<GuestSignupPrompt open={showGuestSignupPrompt} onClose={handleCloseGuestPrompt} />
		</div>
	)
}
