'use client'

import { useEffect } from 'react'
import { type ChallengeMemory, rememberChallenge } from '@/features/daily/lib/challenge'

/**
 * Remembers which share this visitor opened, so the result screen can show
 * both results after they play. Renders nothing. Stores three short values in
 * the browser; nothing is sent anywhere.
 */
export function ChallengeMemoryWriter({ shareId, gameSlug, dayKey }: ChallengeMemory) {
	useEffect(() => {
		let store: Storage | null = null
		try {
			store = window.localStorage
		} catch {
			store = null
		}
		rememberChallenge(store, { shareId, gameSlug, dayKey })
	}, [shareId, gameSlug, dayKey])
	return null
}
