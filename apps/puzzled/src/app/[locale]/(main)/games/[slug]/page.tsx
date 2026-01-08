import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getServerUser } from '@/features/auth/server'
import { AlreadyCompletedView } from '@/features/daily/components/already-completed-view'
import { gameSupportsDifficulty, getGameSlugs, isValidGameSlug } from '@/games/registry'
import type { PuzzleDifficulty } from '@/games/types'
import { PUZZLE_DIFFICULTY_VALUES } from '@/games/types'
import type { GameMode } from '@/lib/db/schema'
import { createServerCaller } from '@/trpc/server'
import { DifficultySelectionView } from './difficulty-selection-view'
import { GamePageClient } from './game-page-client'

// Force dynamic rendering - puzzle data must be fresh
export const dynamic = 'force-dynamic'

type Props = {
	params: Promise<{ locale: string; slug: string }>
	searchParams: Promise<{ mode?: string; date?: string; difficulty?: string }>
}

// Convert slug to camelCase for translation key (e.g., 'spelling-bee' → 'spellingBee')
const slugToCamelCase = (slug: string) => slug.replace(/-([a-z])/g, (_, char) => char.toUpperCase())

export async function generateStaticParams() {
	// Use all locales from config and all games from registry (SSOT)
	const { locales } = await import('@/lib/i18n/config')
	const gameSlugs = getGameSlugs()
	return locales.flatMap((locale) => gameSlugs.map((slug) => ({ locale, slug })))
}

export async function generateMetadata({ params }: Props) {
	const { locale, slug } = await params
	const t = await getTranslations({ locale, namespace: 'games' })

	// Use camelCase conversion for translation key lookup
	const translationKey = slugToCamelCase(slug)
	const gameName = t(`${translationKey}.name`, { defaultValue: 'Game' })
	const gameDescription = t(`${translationKey}.description`, {
		defaultValue: `Play ${gameName} on Puzzled - daily puzzles to challenge your mind`,
	})

	return {
		title: gameName,
		description: gameDescription,
		openGraph: {
			title: `${gameName} | Puzzled`,
			description: gameDescription,
		},
		twitter: {
			title: `${gameName} | Puzzled`,
			description: gameDescription,
		},
	}
}

export default async function GamePage({ params, searchParams }: Props) {
	const { locale, slug } = await params
	const { mode: modeParam, date: dateParam, difficulty: difficultyParam } = await searchParams
	setRequestLocale(locale)

	// Validate game slug using registry (SSOT)
	if (!isValidGameSlug(slug)) {
		notFound()
	}

	// Validate mode parameter
	const validModes: GameMode[] = ['daily', 'archive']
	const mode: GameMode = validModes.includes(modeParam as GameMode)
		? (modeParam as GameMode)
		: 'daily'

	// Check if game supports difficulty and validate difficulty parameter
	const supportsDifficulty = gameSupportsDifficulty(slug)
	const difficulty: PuzzleDifficulty | undefined = supportsDifficulty
		? PUZZLE_DIFFICULTY_VALUES.includes(difficultyParam as PuzzleDifficulty)
			? (difficultyParam as PuzzleDifficulty)
			: undefined
		: undefined

	const t = await getTranslations('games')

	// Get user and tRPC caller
	const user = await getServerUser()
	const trpc = await createServerCaller()

	// Get game name from translations using SSOT pattern
	const translationKey = slugToCamelCase(slug)
	const gameName = t(`${translationKey}.name`)

	// For games with difficulty support, if no difficulty selected, show difficulty selection
	if (supportsDifficulty && !difficulty && mode === 'daily') {
		// Fetch completion status for all difficulties to show in selector
		const completionStatus: Record<PuzzleDifficulty, boolean> = {
			easy: false,
			medium: false,
			hard: false,
		}

		if (user) {
			// Check completion status for each difficulty in parallel
			const [easyStatus, mediumStatus, hardStatus] = await Promise.all([
				trpc.games.getDailyStatus({ gameSlug: slug, difficulty: 'easy' }),
				trpc.games.getDailyStatus({ gameSlug: slug, difficulty: 'medium' }),
				trpc.games.getDailyStatus({ gameSlug: slug, difficulty: 'hard' }),
			])
			completionStatus.easy = easyStatus?.hasCompleted ?? false
			completionStatus.medium = mediumStatus?.hasCompleted ?? false
			completionStatus.hard = hardStatus?.hasCompleted ?? false
		}

		return (
			<DifficultySelectionView
				gameSlug={slug}
				gameName={gameName}
				locale={locale}
				completionStatus={completionStatus}
			/>
		)
	}

	// Fetch puzzle data based on mode
	let puzzleStatus: Awaited<ReturnType<typeof trpc.games.getDailyStatus>> | null = null
	let puzzle: { puzzleId: string; puzzleData: unknown; puzzleDate?: string } | null = null
	let streakInfo: Awaited<ReturnType<typeof trpc.gamification.getStreakInfo>> | null = null

	try {
		if (mode === 'archive' && user && dateParam) {
			// Archive mode - get specific date's puzzle (premium only)
			const archivePuzzle = await trpc.games.getArchivePuzzle({
				gameSlug: slug,
				date: dateParam,
			})
			puzzle = {
				puzzleId: archivePuzzle.id, // Archive returns 'id', not 'puzzleId'
				puzzleData: archivePuzzle.puzzleData,
				puzzleDate: dateParam,
			}
		} else {
			// Daily mode (default) - pass difficulty for games that support it
			const results = await Promise.all([
				user ? trpc.games.getDailyStatus({ gameSlug: slug, difficulty }) : null,
				trpc.games.getTodaysPuzzle({ gameSlug: slug, difficulty }),
				user ? trpc.gamification.getStreakInfo() : null,
			])
			puzzleStatus = results[0]
			puzzle = results[1]
			streakInfo = results[2]
		}
	} catch (error) {
		console.error('[GamePage] Failed to load puzzle data:', error)
		// puzzle will remain null, showing error message
	}

	// If no puzzle found, show error
	if (!puzzle) {
		return (
			<div className="flex flex-1 flex-col">
				<main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
					<p className="text-lg font-medium">Puzzle not available</p>
					<p className="text-sm text-muted-foreground">
						Unable to load today's puzzle. Please try again later.
					</p>
					<a
						href={`/games/${slug}`}
						className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
					>
						Retry
					</a>
				</main>
			</div>
		)
	}

	// Use puzzle data from server
	const puzzleDate = puzzle.puzzleDate ?? new Date().toISOString().split('T')[0]
	const currentStreak = streakInfo?.currentStreak ?? 0

	// Check if user has already completed today's daily puzzle (only applies to daily mode)
	const hasCompletedToday = mode === 'daily' && (puzzleStatus?.hasCompleted ?? false)
	const completedSession = puzzleStatus?.completedSession

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
					attempts: completedSession.attempts,
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
