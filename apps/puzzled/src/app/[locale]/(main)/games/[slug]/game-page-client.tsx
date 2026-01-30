'use client'

import { useState } from 'react'
import { HowToPlayModal } from '@/features/daily/components/how-to-play-modal'
import { MinimalHeader } from '@/features/daily/components/minimal-header'
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
}: GamePageClientProps) {
	const [showHelpModal, setShowHelpModal] = useState(false)

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
					mode={mode}
					difficulty={difficulty}
				/>
			</main>
		</div>
	)
}
