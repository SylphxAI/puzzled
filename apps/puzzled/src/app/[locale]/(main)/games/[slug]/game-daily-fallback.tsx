'use client'

import { Button } from '@sylphx/ui'
import { Lock, RotateCw } from 'lucide-react'
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
	/** Today's free-rotation module, for the upgrade path's alternative. */
	freeGameSlug?: string
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
	freeGameSlug,
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
				console.error('[GameDailyFallback] Client GetDaily failed:', error)
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
				<main className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
					<RotateCw className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
					<output className="block text-sm text-muted-foreground">{t('loadingPuzzle')}</output>
				</main>
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
				<main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
					<p className="text-lg font-medium">{t('alreadyCompleted')}</p>
					<p className="text-sm text-muted-foreground">{t('completedNoResult')}</p>
					<Link href="/" className="text-sm text-primary underline">
						{t('backToGames')}
					</Link>
				</main>
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

	// Server refused the read (premium/archive gate): the honest answer is the
	// upgrade path plus today's free module, never a retry loop.
	if (snapshot?.kind === 'denied') {
		return (
			<div className="flex flex-1 flex-col">
				<main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
					<div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
						<Lock className="h-10 w-10 text-primary" aria-hidden="true" />
					</div>
					<div className="space-y-2">
						<p className="text-lg font-medium">{t('deniedTitle', { game: gameName })}</p>
						<p className="text-sm text-muted-foreground">{t('deniedDescription')}</p>
					</div>
					<Button asChild className="w-full sm:w-auto">
						<Link href="/pricing">{t('unlockPremium')}</Link>
					</Button>
					{freeGameSlug ? (
						<Link
							href={`/games/${freeGameSlug}`}
							className="text-sm font-medium text-primary underline"
						>
							{t('todaysFreeGame')}
						</Link>
					) : null}
					<Link href="/" className="text-sm text-muted-foreground hover:underline">
						← {t('backToGames')}
					</Link>
				</main>
			</div>
		)
	}

	// Fetch failed or the server served no board: honest, client-side retry.
	return (
		<div className="flex flex-1 flex-col">
			<main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
				<p className="text-lg font-medium">{t('unavailableTitle')}</p>
				<p className="text-sm text-muted-foreground">{t('unavailableDescription')}</p>
				<Button type="button" onClick={() => dispatch({ type: 'retry' })}>
					<RotateCw className="h-4 w-4" />
					{tCommon('retry')}
				</Button>
				<Link href="/" className="text-sm text-muted-foreground hover:underline">
					← {t('backToGames')}
				</Link>
			</main>
		</div>
	)
}
