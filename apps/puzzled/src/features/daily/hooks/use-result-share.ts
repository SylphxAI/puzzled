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

/**
 * The one way a result surface shares its result.
 *
 * Resolves the module name from the catalogue (never a literal), builds the
 * non-spoiler text with formatRitualShareText, and runs the shipped
 * share-sheet -> clipboard decision table. Returns the outcome so a surface
 * that already showed feedback can keep it (copied -> its own toast).
 */
export function useResultShare(): (facts: ResultShareFacts) => Promise<ResultShareOutcome> {
	const tGames = useTranslations('games')
	return useCallback(
		(facts: ResultShareFacts) =>
			shareResultText(buildResultShareText(tGames, facts, getBaseUrl('origin'))),
		[tGames],
	)
}
