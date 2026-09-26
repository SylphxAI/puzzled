import { getTranslations } from 'next-intl/server'
import { GameUnlockPanel } from '@/features/catalog/components/game-unlock-panel'
import { AlreadyCompletedView } from '@/features/daily/components/already-completed-view'
import { deriveDifficultyCompletionStatus } from '@/features/daily/lib/difficulty-completion'
import type { GameSlug } from '@/games/registry'
import type { PuzzleDifficulty } from '@/games/types'
import {
	type DailyStatus,
	getServerDailyStatus,
	getServerPlusAccess,
	getServerStreakInfo,
	hasServerProgressIdentity,
	type StreakInfo,
} from '@/lib/api/server'
import { isPlayLocked } from '@/lib/billing/plus'
import type { GameMode } from '@/lib/db/schema'
import { Link } from '@/lib/i18n/routing'
import { logger } from '@/lib/logger'
import { productDayKey } from '@/lib/product-day'
import { DifficultySelectionView } from './difficulty-selection-view'
import { GameDailyFallback } from './game-daily-fallback'
import { GamePageClient } from './game-page-client'

type GamePlayAreaProps = {
	slug: GameSlug
	locale: string
	gameName: string
	mode: GameMode
	difficulty?: PuzzleDifficulty
	supportsDifficulty: boolean
	/** A signed-in account made this request. */
	hasUser: boolean
	/** Today's free module and its name, for the unlock panel. */
	freeGameSlug: string
	freeGameName: string
	/** Registered module count, for the unlock panel copy. */
	gameCount: number
	/**
	 * Archive day key resolved from the query string by the page. Connect admits
	 * or refuses the read for this day; the client never widens it.
	 */
	dateParam?: string
}

/**
 * The interactive part of a module page.
 *
 * Renders the play flow (the difficulty chooser, the server board, the client
 * GetDaily fallback and the completed card) or, when Puzzled Plus is on sale
 * and the viewer cannot open this game or day, the unlock panel. Connect
 * enforces the same rule (`plus_required`); this only picks what to show.
 *
 * It renders inside a Suspense boundary, so a slow Connect read streams behind
 * the skeleton instead of delaying the page's own content — and, because the
 * registry guard runs in the page before this boundary, a 404 can never be
 * masked by a loading state.
 */
export async function GamePlayArea({
	slug,
	locale,
	gameName,
	mode,
	difficulty,
	supportsDifficulty,
	hasUser,
	freeGameSlug,
	freeGameName,
	gameCount,
	dateParam,
}: GamePlayAreaProps) {
	const tDaily = await getTranslations('daily')

	const access = await getServerPlusAccess(hasUser)
	const archive = mode === 'archive' && Boolean(dateParam)
	if (isPlayLocked(access, { slug, freeSlug: freeGameSlug, archive })) {
		return (
			<GameUnlockPanel
				slug={slug}
				archive={archive}
				gameCount={gameCount}
				isGuest={!hasUser}
				freeGameSlug={freeGameSlug}
				freeGameName={freeGameName}
			/>
		)
	}

	if (supportsDifficulty && !difficulty && mode === 'daily') {
		// GetDaily is identity-agnostic: session cookie or puzzled_guest_id.
		// A read that cannot be verified stays unknown (null) instead of
		// pretending "not completed": the client fetch after the player picks a
		// difficulty re-checks completion server-side before serving a board.
		const [easyStatus, mediumStatus, hardStatus] = await Promise.allSettled([
			getServerDailyStatus({ gameSlug: slug, difficulty: 'easy' }),
			getServerDailyStatus({ gameSlug: slug, difficulty: 'medium' }),
			getServerDailyStatus({ gameSlug: slug, difficulty: 'hard' }),
		])
		for (const [level, result] of [
			['easy', easyStatus],
			['medium', mediumStatus],
			['hard', hardStatus],
		] as const) {
			if (result.status === 'rejected') {
				logger.error('game-page.difficulty-status-failed', { level, reason: result.reason })
			}
		}
		const completionStatus = deriveDifficultyCompletionStatus({
			easy: easyStatus.status === 'fulfilled' ? easyStatus.value : null,
			medium: mediumStatus.status === 'fulfilled' ? mediumStatus.value : null,
			hard: hardStatus.status === 'fulfilled' ? hardStatus.value : null,
		})

		return (
			<DifficultySelectionView
				gameSlug={slug}
				gameName={gameName}
				locale={locale}
				completionStatus={completionStatus.status}
				completionStatusVerified={completionStatus.verified}
			/>
		)
	}

	// Fetch puzzle data based on mode
	let puzzleStatus: DailyStatus | null = null
	let puzzle: {
		puzzleId: string
		puzzleData: unknown
		puzzleDate?: string
	} | null = null
	let streakInfo: StreakInfo | null = null
	// The page resolved the day (a real calendar day strictly before the
	// Asia/Hong_Kong product day; the mode flag alone never creates one) and the
	// same day is forwarded to the client fallback, so SSR and browser reads ask
	// for the same board. Admission stays Connect's: every past day is open to
	// every player, and a future day is refused.
	const archiveDate = mode === 'archive' && dateParam ? dateParam : undefined

	try {
		if (archiveDate) {
			// Archive mode - get specific date's puzzle
			const archivePuzzle = await getServerDailyStatus({
				gameSlug: slug,
				puzzleDate: archiveDate,
			})
			puzzle = {
				puzzleId: archivePuzzle.puzzle.id,
				puzzleData: archivePuzzle.puzzle.puzzleData,
				puzzleDate: archiveDate,
			}
		} else {
			// One GetDaily snapshot for guests and accounts so admission and play
			// cannot straddle the product-day reset or reopen a completed board.
			// Streak is a separate read: a missing streak payload must not reopen
			// or block the puzzle.
			const hasIdentity = hasUser || (await hasServerProgressIdentity())
			const [statusResult, streakResult] = await Promise.allSettled([
				getServerDailyStatus({ gameSlug: slug, difficulty }),
				hasIdentity ? getServerStreakInfo() : Promise.resolve(null),
			])
			if (statusResult.status === 'rejected') {
				throw statusResult.reason
			}
			const statusData = statusResult.value
			puzzleStatus = statusData
			puzzle = {
				puzzleId: statusData.puzzle.id,
				puzzleData: statusData.puzzle.puzzleData,
				puzzleDate: statusData.puzzle.puzzleDate,
			}
			streakInfo = streakResult.status === 'fulfilled' ? streakResult.value : null
		}
	} catch (error) {
		logger.error('game-page.puzzle-data-failed', { error })
		// puzzle will remain null, showing error message
	}

	if (!puzzle?.puzzleData) {
		// SSR Connect could not serve the board. The browser transport reaches
		// the api through the public edge, so hand over to a client-side GetDaily
		// instead of a retry link that repeats the same failing SSR request.
		return (
			<GameDailyFallback
				slug={slug}
				gameName={gameName}
				locale={locale}
				mode={mode}
				difficulty={difficulty}
				supportsDifficulty={supportsDifficulty}
				puzzleDate={archiveDate}
			/>
		)
	}

	// Use puzzle data from server
	const puzzleDate = puzzle.puzzleDate || productDayKey()
	const currentStreak = streakInfo?.currentStreak ?? 0

	// Check if user has already completed today's daily puzzle (only applies to
	// daily mode)
	const hasCompletedToday = mode === 'daily' && (puzzleStatus?.hasCompleted ?? false)
	const completedSession = puzzleStatus?.completedSession

	// A completion without a result payload is still non-playable. Never reopen a
	// server-accepted daily or invent a status to fill the card.
	if (hasCompletedToday && !completedSession) {
		return (
			<div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-border/70 bg-card p-6 text-center">
				<p className="font-display text-lg">{tDaily('alreadyCompleted')}</p>
				<Link href="/games" className="text-sm font-medium text-primary hover:underline">
					{tDaily('backToGames')}
				</Link>
			</div>
		)
	}

	// Already completed view (server rendered, no game interaction needed)
	if (hasCompletedToday && completedSession) {
		return (
			<AlreadyCompletedView
				gameSlug={slug}
				gameName={gameName}
				puzzleDate={puzzleDate}
				session={{
					status: completedSession.status as 'won' | 'lost',
					score: completedSession.score,
					attempts: completedSession.attempts ?? 0,
					completedAt: completedSession.completedAt,
				}}
				currentStreak={currentStreak}
				locale={locale}
				difficulty={difficulty}
				supportsDifficulty={supportsDifficulty}
			/>
		)
	}

	// Active game view (client rendered with help modal support)
	return (
		<GamePageClient
			slug={slug}
			gameName={gameName}
			puzzleDate={puzzleDate}
			currentStreak={currentStreak}
			mode={mode}
			locale={locale}
			puzzleId={puzzle.puzzleId}
			puzzleData={puzzle.puzzleData}
			difficulty={difficulty}
		/>
	)
}
