'use client'

import { ConnectError } from '@connectrpc/connect'
import { Button } from '@sylphx/ui'
import { Play, RotateCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { AlreadyCompletedView } from '@/features/daily/components/already-completed-view'
import {
	classifyDailyResponse,
	dailyLoadReducer,
	initialDailyLoadState,
	loadDailySnapshot,
} from '@/features/daily/lib/daily-fallback'
import { completedViewLevel } from '@/features/daily/lib/difficulty-completion'
import { takeStartIntent } from '@/features/daily/lib/start-intent'
import type { GameSlug } from '@/games/how-to-play-registry'
import { type GameColorTheme, getGameColors } from '@/games/theme-colors'
import type { PuzzleDifficulty } from '@/games/types'
import { isPlusRequiredError } from '@/lib/billing/plus'
import { startDaily } from '@/lib/connect/puzzle-client'
import type { GameMode } from '@/lib/db/schema'
import { Link } from '@/lib/i18n/routing'
import { logger } from '@/lib/logger'
import { cn } from '@/lib/utils'
import { GameMotif } from '@/shared/components/games/game-motif'
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
	/** The server-rendered unlock path, shown when the api refuses the read. */
	unlock?: ReactNode
	/** Public metadata returned by SSR, without a playable payload. */
	startDate?: string
	/** The player arrived by pressing Play: the start card is the screen's one amber action. */
	started?: boolean
	/** The game's colour field for the start card. */
	theme?: GameColorTheme
	currentStreak?: number
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
	unlock,
	startDate,
	started = false,
	theme = 'violet',
	currentStreak = 0,
}: GameDailyFallbackProps) {
	const t = useTranslations('daily')
	const tCommon = useTranslations('common')
	const tHome = useTranslations('home.day')
	const [state, dispatch] = useReducer(
		dailyLoadReducer,
		startDate
			? { status: 'ready', snapshot: { kind: 'startable', puzzleDate: startDate } }
			: initialDailyLoadState,
	)
	const startPending = useRef(false)
	const [starting, setStarting] = useState(false)

	const play = useCallback(
		async (date: string) => {
			if (startPending.current) return
			startPending.current = true
			setStarting(true)
			try {
				const daily = await startDaily({ gameSlug: slug, puzzleDate: date, difficulty })
				dispatch({ type: 'load-succeeded', snapshot: classifyDailyResponse(daily) })
			} catch (error) {
				if (isPlusRequiredError(ConnectError.from(error).rawMessage)) {
					dispatch({ type: 'load-refused' })
				} else {
					logger.error('game-daily-fallback.start-failed', { error })
					dispatch({ type: 'load-failed' })
				}
			} finally {
				startPending.current = false
				setStarting(false)
			}
		},
		[slug, difficulty],
	)

	// A Play press on the previous page is the explicit start: open the board
	// now instead of asking twice. A pasted or crawled link carries no press
	// (`start-intent.ts`), so it waits for the card's own button.
	const startableDate =
		state.status === 'ready' && state.snapshot.kind === 'startable'
			? state.snapshot.puzzleDate
			: null
	const autoStarted = useRef(false)
	useEffect(() => {
		if (!startableDate || autoStarted.current) return
		autoStarted.current = true
		if (takeStartIntent(slug)) void play(startableDate)
	}, [startableDate, slug, play])

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
				if (isPlusRequiredError(ConnectError.from(error).rawMessage)) {
					if (!cancelled) dispatch({ type: 'load-refused' })
					return
				}
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

	if (state.status === 'locked' && unlock) return unlock

	const snapshot = state.status === 'ready' ? state.snapshot : null

	if (snapshot?.kind === 'startable' && !started) {
		// The game's own page: the hero already shows the board, so the start
		// action is one compact strip under it.
		return (
			<div
				data-game-stage="start"
				className="tactile-card mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-5 py-4 text-center sm:flex-row sm:gap-5 sm:text-left"
			>
				<p className="min-w-0 flex-1 text-[14px] leading-snug text-muted-foreground">
					{t('startUsesPick')}
				</p>
				<Button
					type="button"
					className="min-h-12 w-full shrink-0 gap-2 rounded-xl px-6 text-[15px] font-bold sm:w-auto"
					disabled={starting}
					onClick={() => void play(snapshot.puzzleDate)}
				>
					{starting ? (
						<RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" />
					) : (
						<Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
					)}
					{starting ? t('loadingPuzzle') : tHome('playToday', { game: gameName })}
				</Button>
			</div>
		)
	}

	if (snapshot?.kind === 'startable') {
		const colors = getGameColors(theme)
		return (
			<div data-game-stage="start" className="tactile-card mx-auto w-full max-w-xl overflow-hidden">
				<div
					className={cn('tactile-card-field aspect-[16/7] px-6 py-3 sm:px-10', colors.bg)}
					aria-hidden="true"
				>
					<GameMotif slug={slug} />
				</div>
				<div className="flex flex-col items-center gap-3 px-5 pb-5 pt-4 text-center sm:px-8">
					<Button
						type="button"
						className="stage-cta min-h-14 w-full max-w-sm gap-2 rounded-xl text-[16px] font-bold"
						disabled={starting}
						onClick={() => void play(snapshot.puzzleDate)}
					>
						{starting ? (
							<RotateCw className="h-4 w-4 animate-spin" aria-hidden="true" />
						) : (
							<Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
						)}
						{starting ? t('loadingPuzzle') : tHome('playToday', { game: gameName })}
					</Button>
					<p className="max-w-sm text-[13px] leading-snug text-muted-foreground">
						{t('startUsesPick')}
					</p>
				</div>
			</div>
		)
	}

	// Server-recorded finish: render the result, never a fresh board.
	if (snapshot?.kind === 'completed') {
		return (
			<AlreadyCompletedView
				mode={mode}
				gameSlug={slug}
				gameName={gameName}
				puzzleDate={snapshot.puzzleDate}
				session={snapshot.session}
				currentStreak={currentStreak}
				locale={locale}
				difficulty={completedViewLevel(supportsDifficulty, snapshot.session.difficulty)}
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
				currentStreak={currentStreak}
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
			<div className="tactile-card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-8 text-center">
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
		<div className="tactile-card mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-8 text-center">
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
