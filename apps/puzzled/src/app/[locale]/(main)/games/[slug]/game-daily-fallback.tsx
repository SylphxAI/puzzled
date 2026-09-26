'use client'

import { Button } from '@sylphx/ui'
import { RotateCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useReducer } from 'react'
import { AlreadyCompletedView } from '@/features/daily/components/already-completed-view'
import {
	dailyLoadReducer,
	initialDailyLoadState,
	loadDailySnapshot,
} from '@/features/daily/lib/daily-fallback'
import type { GameSlug } from '@/games/how-to-play-registry'
import type { PuzzleDifficulty } from '@/games/types'
import type { GameMode } from '@/lib/db/schema'
import { Link } from '@/lib/i18n/routing'
import { logger } from '@/lib/logger'
import { GamePageClient } from './game-page-client'

type GameDailyFallbackProps = {
	slug: GameSlug
	gameName: string
	locale: string
	mode: GameMode
	difficulty?: PuzzleDifficulty
	supportsDifficulty: boolean
	/** Archive day key; only passed when the server already admitted that read. */
	puzzleDate?: string
}

/**
 * Client-side GetDaily fallback for the game page.
 *
 * SSR Connect can fail where the browser transport still works (private
 * web -> api path vs. the public edge route). Rather than dead-ending on a
 * retry link that repeats the failing SSR request, this component reads
 * GetDaily over the browser transport and renders the server's answer:
 * a playable board, the server-recorded result, or an honest retry.
 */
export function GameDailyFallback({
	slug,
	gameName,
	locale,
	mode,
	difficulty,
	supportsDifficulty,
	puzzleDate,
}: GameDailyFallbackProps) {
	const t = useTranslations('daily')
	const tCommon = useTranslations('common')
	const [state, dispatch] = useReducer(dailyLoadReducer, initialDailyLoadState)

	// `state.status` drives the fetch: retry moves error/unavailable back to
	// `loading`, which re-runs this effect without a hard navigation.
	useEffect(() => {
		if (state.status !== 'loading') return

		let cancelled = false
		void (async () => {
			try {
				const snapshot = await loadDailySnapshot({
					gameSlug: slug,
					difficulty,
					puzzleDate,
				})
				if (!cancelled) dispatch({ type: 'load-succeeded', snapshot })
			} catch (error) {
				logger.error('game-daily-fallback.load-failed', { error })
				if (!cancelled) dispatch({ type: 'load-failed' })
			}
		})()

		return () => {
			cancelled = true
		}
	}, [state.status, slug, difficulty, puzzleDate])

	if (state.status === 'loading') {
		return (
			<div className="flex flex-1 flex-col">
				<div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
					<RotateCw className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
					<output className="block text-sm text-muted-foreground">{t('loadingPuzzle')}</output>
				</div>
			</div>
		)
	}

	const snapshot = state.status === 'ready' ? state.snapshot : null

	// Server-recorded finish: render the result, never a fresh board.
	if (snapshot?.kind === 'completed') {
		return (
			<AlreadyCompletedView
				gameSlug={slug}
				gameName={gameName}
				puzzleDate={snapshot.puzzleDate}
				session={snapshot.session}
				currentStreak={0}
				locale={locale}
				difficulty={difficulty}
				supportsDifficulty={supportsDifficulty}
			/>
		)
	}

	// Accepted finish without a result payload: non-playable, no invented result.
	if (snapshot?.kind === 'closed') {
		return (
			<div className="flex flex-1 flex-col">
				<div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
					<p className="text-lg font-medium">{t('alreadyCompleted')}</p>
					<p className="text-sm text-muted-foreground">{t('completedNoResult')}</p>
					<Link href="/games" className="text-sm font-medium text-primary hover:underline">
						{t('backToGames')}
					</Link>
				</div>
			</div>
		)
	}

	if (snapshot?.kind === 'playable') {
		return (
			<GamePageClient
				slug={slug}
				gameName={gameName}
				puzzleDate={snapshot.puzzleDate}
				currentStreak={0}
				mode={mode}
				locale={locale}
				puzzleId={snapshot.puzzleId}
				puzzleData={snapshot.puzzleData}
				difficulty={difficulty}
			/>
		)
	}

	// The server answered but has no board for this day: say so, and point at
	// the puzzle that is ready. A retry would ask the same question again.
	if (snapshot?.kind === 'unavailable') {
		return (
			<div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-border bg-card px-6 py-8 text-center shadow-card">
				<p className="font-display text-2xl leading-tight">
					{t('notReadyTitle', { game: gameName })}
				</p>
				<p className="text-[15px] text-muted-foreground">{t('notReadyBody', { game: gameName })}</p>
				<Link
					href="/"
					className="pressable mt-2 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
				>
					{t('notReadyCta')}
				</Link>
				<Link
					href="/games"
					className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
				>
					{t('backToGames')}
				</Link>
			</div>
		)
	}

	// The fetch failed: a client-side retry.
	return (
		<div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-border bg-card px-6 py-8 text-center shadow-card">
			<p className="font-display text-2xl leading-tight">{t('unavailableTitle')}</p>
			<p className="text-[15px] text-muted-foreground">{t('unavailableDescription')}</p>
			<Button
				type="button"
				className="mt-2 rounded-full"
				onClick={() => dispatch({ type: 'retry' })}
			>
				<RotateCw className="h-4 w-4" aria-hidden="true" />
				{tCommon('retry')}
			</Button>
			<Link
				href="/games"
				className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
			>
				{t('backToGames')}
			</Link>
		</div>
	)
}
