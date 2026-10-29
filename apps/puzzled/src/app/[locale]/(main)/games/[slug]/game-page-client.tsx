'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { sendFunnel } from '@/features/analytics/lib/funnel'
import { MinimalHeader } from '@/features/daily/components/minimal-header'
import type { GameSlug } from '@/games/how-to-play-registry'
import type { PuzzleDifficulty } from '@/games/types'
import type { GameMode } from '@/lib/db/schema'
import { GameRenderer } from './game-renderer'

// The help dialog (Base UI dialog, motion and the game's how-to content) is only
// needed once someone asks for it, so it stays out of the route's first load.
// It mounts on the first press of the help button and stays mounted after that,
// so closing keeps its exit animation.
const HowToPlayModal = dynamic(
	() => import('@/features/daily/components/how-to-play-modal').then((m) => m.HowToPlayModal),
	{ ssr: false },
)

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
	const [helpRequested, setHelpRequested] = useState(false)

	// One first-party funnel count each time a playable board is shown.
	useEffect(() => {
		sendFunnel({ event: 'game_start', game_slug: slug })
	}, [slug])

	return (
		<div className="flex flex-1 flex-col">
			{/* Help Modal - managed at page level */}
			{helpRequested ? (
				<HowToPlayModal
					open={showHelpModal}
					onClose={() => setShowHelpModal(false)}
					gameSlug={slug}
				/>
			) : null}

			{/* Minimal Header with help button */}
			<MinimalHeader
				gameName={gameName}
				puzzleDate={puzzleDate}
				currentStreak={currentStreak}
				mode={mode}
				locale={locale}
				onHelpClick={() => {
					setHelpRequested(true)
					setShowHelpModal(true)
				}}
				difficulty={difficulty}
				changeDifficultyHref={difficulty && mode === 'daily' ? `/games/${slug}#play` : undefined}
			/>

			{/* Game Content - centered vertically */}
			<div className="flex flex-1 flex-col items-center justify-center">
				<GameRenderer
					slug={slug}
					puzzleId={puzzleId}
					puzzleData={puzzleData}
					puzzleDate={puzzleDate}
					mode={mode}
					difficulty={difficulty}
				/>
			</div>
		</div>
	)
}
