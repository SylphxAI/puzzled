import { currentUser } from '@sylphx/sdk/nextjs'
import { Button } from '@sylphx/ui'
import { Crown, Lock } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AlreadyCompletedView } from '@/features/daily/components/already-completed-view'
import { gameSupportsDifficulty, getGameSlugs, isValidGameSlug } from '@/games/registry'
import type { PuzzleDifficulty } from '@/games/types'
import { PUZZLE_DIFFICULTY_VALUES } from '@/games/types'
import {
	createServerApi,
	type DailyStatus,
	type StreakInfo,
	type TodaysPuzzle,
} from '@/lib/api/server'
import { canAccessGame, getTodaysFreeGame } from '@/lib/billing/server'
import type { GameMode } from '@/lib/db/schema'
import { Link } from '@/lib/i18n/routing'
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

	// Get user and API client
	const user = await currentUser()
	const { games, gamification } = await createServerApi()

	// Get game name from translations using SSOT pattern
	const translationKey = slugToCamelCase(slug)
	const gameName = t(`${translationKey}.name`)

	// Check if user has access to this game
	const hasAccess = await canAccessGame(user?.id ?? null, slug)
	const todaysFreeGame = getTodaysFreeGame()

	// Show paywall if user doesn't have access
	if (!hasAccess) {
		return (
			<div className="flex flex-1 flex-col">
				<main className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
					{/* Lock icon */}
					<div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
						<Lock className="h-10 w-10 text-primary" />
					</div>

					{/* Title */}
					<div className="space-y-2">
						<h1 className="text-2xl font-bold">{gameName}</h1>
						<p className="text-muted-foreground">
							{user
								? 'This game requires a premium subscription'
								: 'Sign in to play or upgrade to premium'}
						</p>
					</div>

					{/* Free game hint */}
					<div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
						<p>
							Today's free game:{' '}
							<Link
								href={`/games/${todaysFreeGame}`}
								className="font-medium text-primary underline"
							>
								{t(`${slugToCamelCase(todaysFreeGame)}.name`)}
							</Link>
						</p>
					</div>

					{/* Actions */}
					<div className="flex flex-col gap-3 sm:flex-row">
						{!user && (
							<Link href={`/login?callbackUrl=/games/${slug}`}>
								<Button variant="outline" className="w-full sm:w-auto">
									Sign In
								</Button>
							</Link>
						)}
						<Link href="/pricing">
							<Button className="w-full gap-2 sm:w-auto">
								<Crown className="h-4 w-4" />
								Unlock All Games
							</Button>
						</Link>
					</div>

					{/* Back to home */}
					<Link href="/" className="text-sm text-muted-foreground hover:underline">
						← Back to all games
					</Link>
				</main>
			</div>
		)
	}

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
			const [easyRes, mediumRes, hardRes] = await Promise.all([
				games['daily-status'].$get({
					query: { gameSlug: slug, difficulty: 'easy' },
				}),
				games['daily-status'].$get({
					query: { gameSlug: slug, difficulty: 'medium' },
				}),
				games['daily-status'].$get({
					query: { gameSlug: slug, difficulty: 'hard' },
				}),
			])
			const [easyStatus, mediumStatus, hardStatus] = await Promise.all([
				easyRes.json() as Promise<DailyStatus>,
				mediumRes.json() as Promise<DailyStatus>,
				hardRes.json() as Promise<DailyStatus>,
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
	let puzzleStatus: DailyStatus | null = null
	let puzzle: {
		puzzleId: string
		puzzleData: unknown
		puzzleDate?: string
	} | null = null
	let streakInfo: StreakInfo | null = null

	try {
		if (mode === 'archive' && user && dateParam) {
			// Archive mode - get specific date's puzzle (premium only)
			const archiveRes = await games['archive-puzzle'].$get({
				query: { gameSlug: slug, date: dateParam },
			})
			const archivePuzzle = (await archiveRes.json()) as {
				id: string
				puzzleData: unknown
			}
			puzzle = {
				puzzleId: archivePuzzle.id, // Archive returns 'id', not 'puzzleId'
				puzzleData: archivePuzzle.puzzleData,
				puzzleDate: dateParam,
			}
		} else {
			// Daily mode (default) - pass difficulty for games that support it
			const [statusRes, puzzleRes, streakRes] = await Promise.all([
				user
					? games['daily-status'].$get({
							query: { gameSlug: slug, difficulty },
						})
					: null,
				games['todays-puzzle'].$get({ query: { gameSlug: slug, difficulty } }),
				user ? gamification['streak-info'].$get() : null,
			])
			puzzleStatus = statusRes ? ((await statusRes.json()) as DailyStatus) : null
			puzzle = (await puzzleRes.json()) as TodaysPuzzle
			streakInfo = streakRes ? ((await streakRes.json()) as StreakInfo) : null
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
