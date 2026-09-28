'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import {
	buildResultShareText,
	type ResultShareFacts,
	type ResultShareOutcome,
	shareResultText,
} from '@/features/daily/lib/result-share'
import { getBaseUrl } from '@/lib/utils'
import { useShareId } from './use-share-id'

/**
 * The one way a result surface shares its result.
 *
 * Resolves the module name from the catalogue (never a literal), builds the
 * non-spoiler text with formatRitualShareText, and runs the shipped
 * share-sheet -> clipboard decision table. The link carries a server-issued
 * share id as `ref` (see useShareId). Returns the outcome so a surface that
 * already showed feedback can keep it (copied -> its own toast).
 */
export function useResultShare(): (facts: ResultShareFacts) => Promise<ResultShareOutcome> {
	const tGames = useTranslations('games')
	const shareIdFor = useShareId()
	return useCallback(
		async (facts: ResultShareFacts) => {
			const shareId = await shareIdFor(facts.gameSlug, facts.puzzleDate)
			return shareResultText(
				buildResultShareText(tGames, { ...facts, shareId }, getBaseUrl('origin')),
			)
		},
		[tGames, shareIdFor],
	)
}
