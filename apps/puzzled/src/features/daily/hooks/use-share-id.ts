'use client'

import { useCallback } from 'react'
import { shareResult } from '@/lib/connect'

/**
 * Ask the api for the id a share link carries as `ref`, recording the share.
 *
 * The server reads the player's own accepted finish, so the id only exists for
 * a real daily finish. Any failure (archive day, offline, no finish yet) gives
 * undefined and the caller shares the plain module link instead: sharing must
 * never fail because the count could not be recorded.
 */
/** Longest the share tap waits for the id before it shares the plain link. */
const SHARE_ID_TIMEOUT_MS = 3000

export function useShareId(): (
	gameSlug: string,
	puzzleDate?: string,
) => Promise<string | undefined> {
	return useCallback(async (gameSlug, puzzleDate) => {
		try {
			const id = await Promise.race([
				shareResult({ gameSlug, puzzleDate }),
				new Promise<undefined>((resolve) => setTimeout(resolve, SHARE_ID_TIMEOUT_MS)),
			])
			return id || undefined
		} catch {
			return undefined
		}
	}, [])
}
