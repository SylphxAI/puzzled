import { currentUser } from '@sylphx/sdk/nextjs'
import { Button } from '@sylphx/ui'
import { AlertCircle, BarChart3, Crown, Flame, Settings, Sparkles, Trophy } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getPuzzleDateString } from '@/features/daily/server'
import { DailyHero, SocialProof } from '@/features/gamification/components'
import { StreakWarning } from '@/features/streak/components/streak-warning'
import { getAllGameMetadata } from '@/games/registry'
import {
	getServerPersonalDailyResults,
	getServerStreakInfo,
	getServerTodayOverview,
	type StreakInfo,
} from '@/lib/api/server'
import { getFreeGameRotation, getTodaysFreeGame, hasPremiumAccess } from '@/lib/billing/server'
import { Link } from '@/lib/i18n/routing'
import { Logo } from '@/shared/components/layout'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'home' })

	return {
		title: t('metaTitle'),
		description: t('metaDescription'),
		openGraph: {
			title: t('metaTitle'),
			description: t('metaDescription'),
		},
	}
}

export default async function HomePage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	// Get user's premium status from platform
	const isPremium = user?.id ? await hasPremiumAccess(user.id) : false

	// Get today's free game from rotation
	const todaysFreeGame = getTodaysFreeGame()

	// Calculate tomorrow's free game for preview
	const freeGameRotation = getFreeGameRotation()
	const todayIndex = freeGameRotation.indexOf(todaysFreeGame)
	const tomorrowsFreeGame = freeGameRotation[(todayIndex + 1) % freeGameRotation.length]

	// Slug to readable name mapping (for tomorrow's preview)
	const gameNameMap: Record<string, string> = {
		'word-guess': 'Five',
		'word-groups': 'Threads',
		crowns: 'Crowns',
		sudoku: 'Sudoku',
		crossword: 'Mini Grid',
		'word-hive': 'Hive',
		arithmo: 'Arithmo',
		duo: 'Duo',
	}
	const tomorrowsFreeGameName = gameNameMap[tomorrowsFreeGame] ?? tomorrowsFreeGame

	// Fetch user's streak info, today's completions, and player count
	let streakInfo: StreakInfo | null = null
	let todayPlayerCount = 0

	try {
		// Server-derived daily puzzle completers; the Rust adapter applies the
		// product-day and puzzle_ritual predicates before this reaches the UI.
		const overview = await getServerTodayOverview()
		todayPlayerCount = overview.playerCount

		// Fetch user-specific streak info if logged in
		if (user) {
			streakInfo = await getServerStreakInfo()
		}
	} catch (error) {
		// Log error for debugging but continue with defaults
		// This is a non-critical path - user can still access games
		console.error('[HomePage] Failed to fetch stats:', error)
	}

	return (
		<HomeContent
			isGuest={!user}
			streakInfo={streakInfo}
			locale={locale}
			todaysFreeGame={todaysFreeGame}
			tomorrowsFreeGameName={tomorrowsFreeGameName}
			isPremium={isPremium}
			todayPlayerCount={todayPlayerCount}
		/>
	)
}

type HomeContentProps = {
	isGuest: boolean
	streakInfo: StreakInfo | null
	locale: string
	todaysFreeGame: string
	tomorrowsFreeGameName: string
	isPremium: boolean
	todayPlayerCount: number
}

async function HomeContent({
	isGuest,
	streakInfo,
	locale,
	todaysFreeGame,
	tomorrowsFreeGameName,
	isPremium,
	todayPlayerCount,
}: HomeContentProps) {
	const t = await getTranslations()
	const today = new Date()
	const dateString = getPuzzleDateString(today, locale)

	// Get all games from registry (SSOT) - sorted by sortOrder
	const gameMetadata = getAllGameMetadata()
	const personalResults = await getServerPersonalDailyResults({
		gameSlugs: gameMetadata.map((game) => game.slug),
		isGuest,
		isPremium,
		freeGameSlug: todaysFreeGame,
	})
	const completionStatusUnavailable = gameMetadata.some(
		(game) => personalResults[game.slug]?.statusAvailable === false,
	)

	if (completionStatusUnavailable) {
		return (
			<main className="flex flex-1 items-center justify-center px-4 py-12">
				<div className="mx-auto max-w-md text-center">
					<div className="mb-6 flex justify-center">
						<div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
							<AlertCircle className="h-10 w-10 text-muted-foreground" />
						</div>
					</div>
					<h1 className="mb-2 text-2xl font-bold">{t('home.statusUnavailableTitle')}</h1>
					<p className="mb-6 text-muted-foreground">{t('home.statusUnavailableDescription')}</p>
					<Button asChild>
						<Link href="/">{t('common.retry')}</Link>
					</Button>
				</div>
			</main>
		)
	}

	// Convert slug to camelCase for translation key (e.g., 'spelling-bee' → 'spellingBee')
	const slugToCamelCase = (slug: string) =>
		slug.replace(/-([a-z])/g, (_, char) => char.toUpperCase())

	// Get current streak and whether user has played today
	const currentStreak = streakInfo?.currentStreak ?? 0
	const bestStreak = streakInfo?.maxStreak ?? 0
	const hasPlayedToday = streakInfo?.hasPlayedToday ?? false
	const totalGamesPlayed = streakInfo?.totalGamesPlayed ?? 0

	// Check for streak milestones
	const streakMilestones = [7, 30, 50, 100, 365]
	const recentMilestone = streakMilestones.find((m) => currentStreak === m)

	// Merge game info with completion status and free/locked status
	const gamesWithCompletion = gameMetadata.map((game) => {
		const isFreeToday = game.slug === todaysFreeGame
		const result = personalResults[game.slug]
		const score = result?.completedSession?.score
		return {
			slug: game.slug,
			name: t(`games.${slugToCamelCase(game.slug)}.name`),
			display: game.display,
			completed: personalResults[game.slug]?.hasCompleted ?? false,
			score: score === null || score === undefined ? undefined : String(score),
			// Free game is unlocked for everyone, other games locked for non-premium
			locked: !isPremium && !isFreeToday,
			isFreeToday,
		}
	})

	return (
		<main className="flex-1">
			{/* Mobile Header - hidden on desktop (TopNav handles it) */}
			<header className="sticky top-0 z-header border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
				<div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
					{/* Left: Logo */}
					<Logo size="sm" showText={true} />

					{/* Right: Streak + Settings */}
					<div className="flex items-center gap-2">
						{/* Streak indicator */}
						<div className="flex items-center gap-1 rounded-full bg-stat-streak/10 px-2.5 py-1">
							<Flame className="h-4 w-4 text-stat-streak" aria-hidden="true" />
							<span className="text-sm font-semibold text-stat-streak">{currentStreak}</span>
						</div>

						<Button asChild variant="ghost" size="icon" className="h-9 w-9">
							<Link href="/settings">
								<Settings className="h-5 w-5" />
								<span className="sr-only">{t('common.settings')}</span>
							</Link>
						</Button>
					</div>
				</div>
			</header>

			{/* Streak Warning */}
			{streakInfo && currentStreak > 0 && !hasPlayedToday && (
				<section className="px-4 pt-4">
					<div className="mx-auto max-w-4xl">
						<StreakWarning
							currentStreak={currentStreak}
							hasPlayedToday={hasPlayedToday}
							game={todaysFreeGame}
						/>
					</div>
				</section>
			)}

			{/* Daily Hero - Today's Challenge */}
			<section className="px-4 pt-6 md:pt-8">
				<div className="mx-auto max-w-4xl">
					<DailyHero
						games={gamesWithCompletion}
						dateString={dateString}
						tomorrowsFreeGameName={tomorrowsFreeGameName}
						currentStreak={currentStreak}
						isGuest={isGuest}
					/>
				</div>
			</section>

			{/* Social Proof */}
			<section className="px-4 pt-4">
				<div className="mx-auto max-w-4xl">
					<SocialProof playerCount={todayPlayerCount} locale={locale} variant="banner" />
				</div>
			</section>

			{/* Streak Milestone Celebration */}
			{recentMilestone && (
				<section className="px-4 pt-4">
					<div className="mx-auto max-w-4xl">
						<div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-stat-streak/20 via-orange-500/10 to-stat-streak/20 p-4 text-center">
							<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(251,146,60,0.15),transparent_50%)]" />
							<div className="relative">
								<div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-stat-streak/20">
									<Flame className="h-6 w-6 text-stat-streak animate-pulse" />
								</div>
								<h3 className="text-lg font-bold text-stat-streak">
									🎉 {t('home.streakMilestone', { days: recentMilestone })}
								</h3>
								<p className="mt-1 text-sm text-muted-foreground">
									{t('home.streakMilestoneDesc')}
								</p>
							</div>
						</div>
					</div>
				</section>
			)}

			{/* Quick Stats Row */}
			{totalGamesPlayed > 0 && (
				<section className="px-4 pt-4">
					<div className="mx-auto max-w-4xl">
						<div className="grid grid-cols-3 gap-3">
							<div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
								<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
									<Trophy className="h-4 w-4 text-primary" />
								</div>
								<div>
									<p className="text-lg font-bold tabular-nums">{totalGamesPlayed}</p>
									<p className="text-[10px] text-muted-foreground">{t('home.gamesPlayed')}</p>
								</div>
							</div>
							<div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
								<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stat-streak/10">
									<Flame className="h-4 w-4 text-stat-streak" />
								</div>
								<div>
									<p className="text-lg font-bold tabular-nums">{currentStreak}</p>
									<p className="text-[10px] text-muted-foreground">{t('home.streak')}</p>
								</div>
							</div>
							<div className="flex items-center gap-2 rounded-xl bg-muted/50 p-3">
								<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
									<BarChart3 className="h-4 w-4 text-amber-500" />
								</div>
								<div>
									<p className="text-lg font-bold tabular-nums">{bestStreak}</p>
									<p className="text-[10px] text-muted-foreground">{t('home.bestStreak')}</p>
								</div>
							</div>
						</div>
					</div>
				</section>
			)}

			{/* Premium Upsell - for free users */}
			{!isPremium && totalGamesPlayed >= 3 && (
				<section className="px-4 pt-4">
					<div className="mx-auto max-w-4xl">
						<Link href="/pricing">
							<div className="group relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-4 transition-all hover:border-primary/40 hover:shadow-lg">
								<div className="flex items-center gap-4">
									<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80">
										<Crown className="h-6 w-6 text-white" />
									</div>
									<div className="flex-1">
										<h3 className="font-semibold">{t('home.unlockAll')}</h3>
										<p className="text-sm text-muted-foreground">{t('home.premiumBenefits')}</p>
									</div>
									<Sparkles className="h-5 w-5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
								</div>
							</div>
						</Link>
					</div>
				</section>
			)}

			{/* Spacer for mobile bottom nav */}
			<div className="h-6 md:h-12" />
		</main>
	)
}
