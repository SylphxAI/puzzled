/**
 * Word Ladder Game Component
 * Main game wrapper with state management
 */

'use client'

import { HelpCircle, Play, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Input,
	WordLadderIcon,
} from '@/shared/components/ui'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import { WordLadderDisplay } from './components'
import { wordLadderConfig } from './config'
import { useWordLadder } from './use-word-ladder'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function WordLadderGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.wordLadder')
	const _tCommon = useTranslations('common')

	// Get puzzle from server data or generate from seed (deterministic)
	const [puzzle] = useState(() => defaultParsePuzzleData(wordLadderConfig, puzzleData, puzzleId))

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
		gameSlug: 'word-ladder',
		mode,
		puzzleId,
		enableStarBurst: false,
		isPerfectWin: (stats) => stats.attempts === stats.maxAttempts, // Optimal path
	})

	const [showHelpModal, setShowHelpModal] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)

	// Game hook
	const game = useWordLadder()

	// Initialize game when puzzle is ready
	useEffect(() => {
		if (puzzle && !isReady) {
			game.init(puzzle.puzzleData)
		}
	}, [puzzle, isReady, game.init]) // eslint-disable-line react-hooks/exhaustive-deps

	// Focus input after game starts
	useEffect(() => {
		if (!isReady && inputRef.current) {
			inputRef.current.focus()
		}
	}, [isReady])

	// Track game completion - in useEffect to avoid render-phase side effects
	const gameEndedRef = useRef(false)
	useEffect(() => {
		if (game.state.isComplete && !gameEndedRef.current) {
			gameEndedRef.current = true
			endGame({
				status: 'won',
				attempts: game.state.path.length - 1,
				maxAttempts: puzzle.puzzleData.minSteps,
				data: {
					path: game.state.path,
				},
			})
		}
	}, [game.state.isComplete, game.state.path, puzzle.puzzleData.minSteps, endGame])

	// Track previous path length to detect successful submission
	const prevPathLengthRef = useRef(game.state.path.length)

	// React to error state changes
	useEffect(() => {
		if (game.state.error) {
			triggerHaptic('error')
			triggerSound('error')
		}
	}, [game.state.error])

	// React to successful word submission (path grew)
	useEffect(() => {
		if (game.state.path.length > prevPathLengthRef.current) {
			triggerHaptic('light')
			triggerSound('correct')
		}
		prevPathLengthRef.current = game.state.path.length
	}, [game.state.path.length])

	// Handle form submission
	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			if (!game.state.currentWord) return
			game.submitWord()
		},
		[game],
	)

	// Share result
	const handleShare = useCallback(() => {
		const timeMs = game.state.endTime && startTime ? game.state.endTime - startTime : 0
		const minutes = Math.floor(timeMs / 60000)
		const seconds = Math.floor((timeMs % 60000) / 1000)
		const steps = game.state.path.length - 1

		const text = `🪜 Word Ladder: ${puzzle.puzzleData.startWord} → ${puzzle.puzzleData.endWord}\n📊 ${steps} steps • ⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}\n\nPlay at puzzled.gg`
		navigator.clipboard.writeText(text)
	}, [
		game.state.endTime,
		game.state.path.length,
		startTime,
		puzzle.puzzleData.startWord,
		puzzle.puzzleData.endWord,
	])

	// Get error message
	const getErrorMessage = () => {
		if (!game.state.error) return null
		switch (game.state.error) {
			case 'notInList':
				return t('messages.notInList')
			case 'wrongLength':
				return t('messages.wrongLength')
			case 'notOneChange':
				return t('messages.notOneChange')
			case 'alreadyUsed':
				return t('messages.alreadyUsed')
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
						<WordLadderIcon size={48} className="text-primary" />
					</div>
					<CardTitle>{t('name')}</CardTitle>
					<p className="text-sm text-muted-foreground">{t('description')}</p>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Preview */}
					<div className="flex items-center justify-center gap-2 text-lg font-bold">
						<span className="rounded bg-primary px-3 py-1 text-primary-foreground">
							{puzzle.puzzleData.startWord.toUpperCase()}
						</span>
						<span>→</span>
						<span className="rounded bg-correct px-3 py-1 text-white">
							{puzzle.puzzleData.endWord.toUpperCase()}
						</span>
					</div>

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
		<div className="relative flex w-full max-w-md flex-col items-center gap-4 px-2 sm:px-0">
			{/* Celebration */}
			<Celebration show={showCelebration} />

			{/* Header */}
			<div className="flex w-full max-w-xs items-center justify-between">
				<div className="text-sm text-muted-foreground">{t('name')}</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setShowHelpModal(true)}
					className="min-h-[44px] min-w-[44px]"
				>
					<HelpCircle className="h-4 w-4" />
				</Button>
			</div>

			{/* Ladder Display */}
			{game.state.puzzle && (
				<WordLadderDisplay
					startWord={game.state.puzzle.startWord}
					endWord={game.state.puzzle.endWord}
					path={game.state.path}
					minSteps={game.state.puzzle.minSteps}
				/>
			)}

			{/* Input */}
			{!game.state.isComplete && (
				<form onSubmit={handleSubmit} className="flex w-full max-w-xs gap-2">
					<Input
						ref={inputRef}
						value={game.state.currentWord}
						onChange={(e) => game.setInput(e.target.value)}
						placeholder={t('enterWord')}
						maxLength={puzzle.puzzleData.wordLength}
						className="min-h-[44px] text-center text-base font-bold uppercase sm:text-lg"
						autoComplete="off"
						autoCapitalize="characters"
					/>
					<Button type="submit" disabled={!game.state.currentWord} className="min-h-[44px]">
						{t('submit')}
					</Button>
				</form>
			)}

			{/* Error message */}
			{game.state.error && <div className="text-sm text-destructive">{getErrorMessage()}</div>}

			{/* Controls */}
			<div className="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={game.undo}
					disabled={game.state.path.length <= 1 || game.state.isComplete}
					className="min-h-[44px]"
				>
					<Undo2 className="mr-1 h-4 w-4" />
					{t('undo')}
				</Button>
			</div>

			{/* Help Modal */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug="word-ladder"
			/>

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="word-ladder"
				status="won"
				stats={{
					attempts: game.state.path.length - 1,
					maxAttempts: puzzle.puzzleData.minSteps,
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
