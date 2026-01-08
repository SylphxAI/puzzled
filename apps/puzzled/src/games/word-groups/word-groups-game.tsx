'use client'

import { HelpCircle, Play, Shuffle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Celebration, StarBurst } from '@/features/celebration/components'
import { HowToPlayModal } from '@/features/daily/components'
import { GameResultModal } from '@/features/daily/components/game-result-modal'
import { GuestSignupPrompt } from '@/features/daily/components/guest-signup-prompt'
import { useGameSession } from '@/games/shared/use-game-session'
import { defaultParsePuzzleData } from '@/games/types'
import { Button } from '@sylphx/ui'
import { ConnectionsIcon } from '@/shared/components/ui/game-icons'
import { triggerHaptic, triggerSound } from '@/shared/hooks'
import { MistakeDots, SolvedCategory, WordGrid } from './components'
import { wordGroupsConfig } from './config'
import { useWordGroups } from './use-word-groups'

type Props = {
	mode?: 'daily' | 'archive'
	puzzleId?: string
	puzzleData?: unknown
}

export function WordGroupsGame({ mode = 'daily', puzzleId, puzzleData }: Props) {
	const t = useTranslations('games.wordGroups')
	const tCommon = useTranslations('common')
	const tShare = useTranslations('share')

	// Type-safe puzzle parsing via config - no type assertions needed
	const [initialPuzzle] = useState(() => {
		const parsed = defaultParsePuzzleData(wordGroupsConfig, puzzleData, puzzleId)
		// Convert to ConnectionsPuzzle format for useWordGroups hook
		return {
			id: puzzleId || `daily-${new Date().toISOString().split('T')[0]}`,
			date: new Date().toISOString().split('T')[0],
			categories: parsed.solution.categories as [
				{ name: string; words: string[]; level: 0 | 1 | 2 | 3 },
				{ name: string; words: string[]; level: 0 | 1 | 2 | 3 },
				{ name: string; words: string[]; level: 0 | 1 | 2 | 3 },
				{ name: string; words: string[]; level: 0 | 1 | 2 | 3 },
			],
		}
	})

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
		gameSlug: 'word-groups',
		mode,
		puzzleId,
		enableStarBurst: true,
		isPerfectWin: (stats) => stats.mistakes === 0,
	})

	const {
		puzzle,
		selectedWords,
		solvedCategories,
		remainingWords,
		mistakes,
		gameStatus,
		guessHistory,
		lastGuessWasOneAway,
		toggleWord,
		clearSelection,
		submitGuess,
		shuffle,
		canSubmit,
	} = useWordGroups(initialPuzzle)

	// ==========================================
	// Game-specific state (not consolidated)
	// ==========================================
	const [showToast, setShowToast] = useState(false)
	const [toastMessage, setToastMessage] = useState('')
	const [showHelpModal, setShowHelpModal] = useState(false)
	const [isShuffling, setIsShuffling] = useState(false)
	const gameEndedRef = useRef(false)

	// Help click handler
	const handleHelpClick = useCallback(() => {
		setShowHelpModal(true)
	}, [])

	const showToastMessage = (message: string) => {
		setToastMessage(message)
		setShowToast(true)
		setTimeout(() => setShowToast(false), 2000)
	}

	// Show "One Away" feedback when user submits a guess that was close
	useEffect(() => {
		if (lastGuessWasOneAway) {
			setToastMessage(t('messages.oneAway'))
			setShowToast(true)
			setTimeout(() => setShowToast(false), 2000)
			triggerSound('almostThere')
			triggerHaptic('medium')
		}
	}, [lastGuessWasOneAway, t])

	// Handle game end - delegate to useGameSession
	if (gameStatus !== 'playing' && !gameEndedRef.current) {
		gameEndedRef.current = true
		endGame({
			status: gameStatus,
			attempts: guessHistory.length,
			maxAttempts: 8, // 4 categories + 4 mistakes allowed
			mistakes,
			data: {
				foundCategories: solvedCategories.map((cat) => cat.words),
				mistakes,
			},
		})
	}

	const handleSubmit = () => {
		submitGuess()
	}

	const handleShuffle = useCallback(() => {
		if (isShuffling) return
		setIsShuffling(true)
		triggerSound('shuffle')
		triggerHaptic('shuffle')

		// Brief animation delay before actual shuffle
		setTimeout(() => {
			shuffle()
			// Keep animation state briefly after shuffle for smooth transition
			setTimeout(() => setIsShuffling(false), 150)
		}, 100)
	}, [isShuffling, shuffle])

	const handleShare = async () => {
		const emojiGrid = guessHistory
			.map((guess) => {
				// Find which category each guess word belongs to
				return guess
					.map((word) => {
						for (const category of puzzle.categories) {
							if (category.words.includes(word)) {
								const level = category.level
								// Distinctive Puzzled colors: Rose, Teal, Amber, Fuchsia
								return ['🟥', '🩵', '🟨', '🟪'][level]
							}
						}
						return '⬛'
					})
					.join('')
			})
			.join('\n')

		// Generate engaging share text with personality
		const status = gameStatus as 'won' | 'lost'
		const emoji =
			status === 'won'
				? mistakes === 0
					? '🤯'
					: mistakes === 1
						? '🔥'
						: mistakes <= 2
							? '💪'
							: '😮‍💨'
				: '😅'
		const message =
			status === 'won'
				? mistakes === 0
					? 'Perfect game!'
					: mistakes === 1
						? 'Almost perfect!'
						: mistakes <= 2
							? 'Solved it!'
							: 'Scraped through!'
				: 'This puzzle broke me!'
		const result = `${solvedCategories.length}/4`
		const challenge =
			status === 'won'
				? mistakes === 0
					? 'Try to match my perfect game!'
					: 'Can you beat me?'
				: 'Can you solve it?'

		const text = `${emoji} Puzzled Word Groups\n${result} - ${message}\n\n${emojiGrid}\n\n${challenge}\npuzzled.gg`

		try {
			if (navigator.share) {
				await navigator.share({ text })
			} else {
				await navigator.clipboard.writeText(text)
				showToastMessage(tShare('copied'))
			}
		} catch {
			// User cancelled sharing
		}
	}

	// Sort solved categories by level for display
	const sortedSolvedCategories = [...solvedCategories].sort((a, b) => a.level - b.level)

	// Ready screen - show rules before gameplay
	if (isReady) {
		return (
			<div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
				{/* Help Modal */}
				<HowToPlayModal
					open={showHelpModal}
					onClose={() => setShowHelpModal(false)}
					gameSlug="word-groups"
				/>

				<ConnectionsIcon size={64} className="text-primary" />
				<div>
					<h2 className="mb-2 text-xl font-bold">{t('name')}</h2>
					<p className="text-muted-foreground">{t('description')}</p>
				</div>

				{/* Rules */}
				<div className="w-full rounded-xl bg-muted/40 p-4 text-sm">
					<p className="mb-3 font-medium">{t('rules.title')}</p>
					<ul className="space-y-2 text-left text-muted-foreground">
						<li>• {t('rules.rule1')}</li>
						<li>• {t('rules.rule2')}</li>
						<li>• {t('rules.rule3')}</li>
					</ul>
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
		<div className="flex w-full max-w-md flex-col items-center gap-4 px-2 sm:gap-5 sm:px-0">
			{/* Guest Signup Prompt */}
			<GuestSignupPrompt
				open={showGuestSignupPrompt}
				onClose={handleCloseGuestPrompt}
				streakCount={1}
			/>

			{/* Celebrations */}
			<Celebration show={showCelebration} />
			<StarBurst show={showStarBurst} />

			{/* Solved Categories */}
			<div className="flex w-full flex-col gap-2">
				{sortedSolvedCategories.map((category, index) => (
					<SolvedCategory
						key={category.name}
						category={category}
						animate={index === sortedSolvedCategories.length - 1}
					/>
				))}
			</div>

			{/* Word Grid */}
			{gameStatus === 'playing' && remainingWords.length > 0 && (
				<WordGrid
					words={remainingWords}
					selectedWords={selectedWords}
					onToggleWord={toggleWord}
					isShuffling={isShuffling}
				/>
			)}

			{/* Mistakes */}
			{gameStatus === 'playing' && <MistakeDots mistakes={mistakes} />}

			{/* Game Result Modal */}
			<GameResultModal
				open={showResultModal}
				onClose={() => setShowResultModal(false)}
				gameType="word-groups"
				status={gameStatus === 'playing' ? 'won' : gameStatus}
				stats={{
					attempts: guessHistory.length,
					maxAttempts: 8, // 4 categories + 4 mistakes allowed
					mistakes: mistakes,
					timeSpentMs: startTime ? Date.now() - startTime : 0,
				}}
				mode={mode}
				onShare={handleShare}
				missedCategories={
					gameStatus === 'lost'
						? puzzle.categories.filter((cat) => !solvedCategories.some((s) => s.name === cat.name))
						: undefined
				}
			/>

			{/* Action Buttons (playing state only) */}
			{gameStatus === 'playing' && (
				<div className="flex w-full justify-center gap-2 px-2 sm:px-0">
					<Button
						variant="outline"
						size="sm"
						onClick={handleShuffle}
						disabled={isShuffling}
						className="min-h-[44px] px-3 text-xs sm:px-5 sm:text-sm"
					>
						<Shuffle className="mr-1 h-3.5 w-3.5 sm:mr-1.5 sm:h-4 sm:w-4" />
						{t('shuffle')}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={clearSelection}
						disabled={selectedWords.length === 0}
						className="min-h-[44px] px-3 text-xs sm:px-5 sm:text-sm"
					>
						{t('deselect')}
					</Button>
					<Button
						size="sm"
						onClick={handleSubmit}
						disabled={!canSubmit}
						className="min-h-[44px] px-4 text-xs sm:px-6 sm:text-sm"
					>
						{t('submit')}
					</Button>
				</div>
			)}

			{/* Toast */}
			{showToast && (
				<div
					role="alert"
					aria-live="assertive"
					className="fixed bottom-24 left-1/2 -translate-x-1/2 animate-slide-up rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg"
				>
					{toastMessage}
				</div>
			)}
		</div>
	)
}
