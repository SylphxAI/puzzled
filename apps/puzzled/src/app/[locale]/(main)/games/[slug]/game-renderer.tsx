'use client'

import { type GameSlug, getGameConfig } from '@/games/registry'
import type { PuzzleDifficulty } from '@/games/types'
import type { GameMode } from '@/lib/db/schema'

type GameRendererProps = {
	slug: GameSlug
	puzzleId: string
	puzzleData: unknown
	mode?: GameMode
	difficulty?: PuzzleDifficulty
}

/**
 * GameRenderer - Dynamic game component loader
 *
 * Renders the appropriate game component based on slug.
 * All games are lazy-loaded via their config's GameComponent.
 *
 * PLUG-AND-PLAY: New games automatically work when registered.
 * No changes needed to this file - just add game to registry.
 */
export function GameRenderer({
	slug,
	puzzleId,
	puzzleData,
	mode = 'daily',
	difficulty,
}: GameRendererProps) {
	const config = getGameConfig(slug)

	if (!config) {
		return (
			<div className="flex items-center justify-center p-8 text-muted-foreground">
				Game not found: {slug}
			</div>
		)
	}

	const { GameComponent } = config

	return (
		<div className="w-full sm:max-w-lg">
			<GameComponent
				puzzleId={puzzleId}
				puzzleData={puzzleData}
				mode={mode}
				difficulty={difficulty}
			/>
		</div>
	)
}
