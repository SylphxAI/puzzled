'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { sendFunnel } from '@/features/analytics/lib/funnel'
import { MinimalHeader } from '@/features/daily/components/minimal-header'
import { recordDailyPick } from '@/features/daily/lib/daily-picks'
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

	// The server served today's board, so this game is one of today's picks:
	// mirror it for the masthead's picks pill (display only, never a gate).
	useEffect(() => {
		if (mode === 'daily') recordDailyPick(puzzleDate, slug)
	}, [mode, puzzleDate, slug])

	return (
		// The game component loads client-side after this paints: the stage
		// reserves a board's usual height so the rules below never jump.
		<div className="game-stage flex min-h-[33rem] flex-1 flex-col" data-game-stage="board">
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
				className="md:rounded-t-[1.25rem] md:border-[var(--tactile-soft-line)] md:bg-surface-muted"
				changeDifficultyHref={difficulty && mode === 'daily' ? `/games/${slug}#play` : undefined}
			/>

			{/* Game content: top-aligned under the header; the stage reserves the height below. */}
			<div className="flex flex-1 flex-col items-center justify-start">
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
