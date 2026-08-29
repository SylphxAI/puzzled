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
	hasServerProgressIdentity,
	type PersonalDailyResult,
	type StreakInfo,
} from '@/lib/api/server'
import { getFreeGameRotation, getTodaysFreeGame, hasPremiumAccess } from '@/lib/billing/server'
import { Link } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
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

	const user = await withPresentationDeadline(currentUser(), null)

	// Get user's premium status from platform
	const isPremium = user?.id
		? await withPresentationDeadline(hasPremiumAccess(user.id), false)
		: false

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

	// Social proof is the public aggregate. Personal today-state is GetDaily.
	// Personal streak is GetStreakInfo from accepted ritual sessions.
	const hasIdentity = Boolean(user) || (await hasServerProgressIdentity())
	const gameMetadata = getAllGameMetadata()
	let streakInfo: StreakInfo | null = null
	let todayPlayerCount = 0
	const [overviewResult, streakResult, personalResult] = await Promise.allSettled([
		getServerTodayOverview(),
		hasIdentity ? getServerStreakInfo() : Promise.resolve(null),
		getServerPersonalDailyResults({
			gameSlugs: gameMetadata.map((game) => game.slug),
			isGuest: !user,
			isPremium,
			freeGameSlug: todaysFreeGame,
		}),
	])
	if (overviewResult.status === 'fulfilled') {
		todayPlayerCount = overviewResult.value.playerCount
	} else {
		console.error('[HomePage] Failed to fetch today overview:', overviewResult.reason)
	}
	if (streakResult.status === 'fulfilled') {
		streakInfo = streakResult.value
	} else {
		console.error('[HomePage] Failed to fetch streak info:', streakResult.reason)
	}
	const personalResults: Record<string, PersonalDailyResult> =
		personalResult.status === 'fulfilled'
			? personalResult.value
			: Object.fromEntries(
					gameMetadata.map((game) => [
						game.slug,
						{ hasCompleted: false, completedSession: null, statusAvailable: false },
					]),
				)
	if (personalResult.status === 'rejected') {
		console.error('[HomePage] Failed to fetch personal daily results:', personalResult.reason)
	}

	return (
		<HomeContent
			streakInfo={streakInfo}
			locale={locale}
			todaysFreeGame={todaysFreeGame}
			tomorrowsFreeGameName={tomorrowsFreeGameName}
			isPremium={isPremium}
			todayPlayerCount={todayPlayerCount}
			personalResults={personalResults}
		/>
	)
}

type HomeContentProps = {
	streakInfo: StreakInfo | null
	locale: string
	todaysFreeGame: string
	tomorrowsFreeGameName: string
	isPremium: boolean
	todayPlayerCount: number
	personalResults: Record<string, PersonalDailyResult>
}

async function HomeContent({
	streakInfo,
	locale,
	todaysFreeGame,
	tomorrowsFreeGameName,
	isPremium,
	todayPlayerCount,
	personalResults,
}: HomeContentProps) {
	const t = await getTranslations()
	const today = new Date()
	const dateString = getPuzzleDateString(today, locale)

	// Get all games from registry (SSOT) - sorted by sortOrder
	const gameMetadata = getAllGameMetadata()
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

	// Get current streak and whether user has played today.
	// A missing payload is not a zero streak.
	const streakKnown = streakInfo !== null
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
			completed: result?.hasCompleted ?? false,
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
						{streakKnown && (
							<div className="flex items-center gap-1 rounded-full bg-stat-streak/10 px-2.5 py-1">
								<Flame className="h-4 w-4 text-stat-streak" aria-hidden="true" />
								<span className="text-sm font-semibold text-stat-streak">{currentStreak}</span>
							</div>
						)}

						<Link href="/settings">
							<Button variant="ghost" size="icon" className="h-9 w-9">
								<Settings className="h-5 w-5" />
								<span className="sr-only">{t('common.settings')}</span>
							</Button>
						</Link>
					</div>
				</div>
			</header>

			{/* Streak Warning */}
			{streakInfo && currentStreak > 0 && !hasPlayedToday && (
				<section className="px-4 pt-4">
					<div className="mx-auto max-w-4xl">
						<StreakWarning currentStreak={currentStreak} hasPlayedToday={hasPlayedToday} />
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
			{streakKnown && recentMilestone && (
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
			{streakKnown && totalGamesPlayed > 0 && (
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
