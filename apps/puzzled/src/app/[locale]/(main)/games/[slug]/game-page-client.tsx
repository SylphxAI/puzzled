'use client'

import { useState } from 'react'
import { AlreadyCompletedView } from '@/features/daily/components/already-completed-view'
import { HowToPlayModal } from '@/features/daily/components/how-to-play-modal'
import { MinimalHeader } from '@/features/daily/components/minimal-header'
import { useGuestGameState } from '@/features/daily/hooks/use-guest-game-state'
import type { GameSlug } from '@/games/how-to-play-registry'
import type { PuzzleDifficulty } from '@/games/types'
import type { GameMode } from '@/lib/db/schema'
import { GameRenderer } from './game-renderer'

type GamePageClientProps = {
	slug: GameSlug
	gameName: string
	puzzleDate: string
	currentStreak: number
	mode: GameMode
	locale: string
	puzzleId: string
	puzzleData: unknown
	difficulty?: PuzzleDifficulty
	supportsDifficulty: boolean
	isGuest: boolean
}

export function GamePageClient({
	slug,
	gameName,
	puzzleDate,
	currentStreak,
	mode,
	locale,
	puzzleId,
	puzzleData,
	difficulty,
	supportsDifficulty,
	isGuest,
}: GamePageClientProps) {
	const [showHelpModal, setShowHelpModal] = useState(false)
	const guestState = useGuestGameState(slug)

	// A guest finish is persisted only after the server accepts SubmitGuess.
	// Rehydrate that display projection on direct revisit so the daily result
	// remains honest without creating a client-side completion authority.
	if (isGuest && mode === 'daily' && guestState.isLoaded && guestState.todaySession) {
		const session = guestState.todaySession
		return (
			<AlreadyCompletedView
				gameSlug={slug}
				gameName={gameName}
				puzzleDate={puzzleDate}
				session={{
					status: session.status,
					score: session.score ?? null,
					attempts: session.attempts,
					completedAt: new Date(session.completedAt),
				}}
				currentStreak={guestState.currentStreak}
				locale={locale}
				difficulty={difficulty}
				supportsDifficulty={supportsDifficulty}
			/>
		)
	}

	return (
		<div className="flex flex-1 flex-col">
			{/* Help Modal - managed at page level */}
			<HowToPlayModal
				open={showHelpModal}
				onClose={() => setShowHelpModal(false)}
				gameSlug={slug}
			/>

			{/* Minimal Header with help button */}
			<MinimalHeader
				gameName={gameName}
				puzzleDate={puzzleDate}
				currentStreak={currentStreak}
				mode={mode}
				locale={locale}
				onHelpClick={() => setShowHelpModal(true)}
				difficulty={difficulty}
			/>

			{/* Game Content - centered vertically */}
			<main className="flex flex-1 flex-col items-center justify-center px-3 py-4 sm:px-4">
				<GameRenderer
					slug={slug}
					puzzleId={puzzleId}
					puzzleData={puzzleData}
					puzzleDate={puzzleDate}
					mode={mode}
					difficulty={difficulty}
				/>
			</main>
		</div>
	)
}
