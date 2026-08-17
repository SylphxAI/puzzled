import { currentUser } from '@sylphx/sdk/nextjs'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { BarChart3, Check, Flame, LogIn, Sparkles, Star, Target, Trophy } from 'lucide-react'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { summarizeDailyProgress } from '@/features/daily/lib/daily-progress'
import { Achievements } from '@/features/gamification/components/achievements'
import { getAllGameMetadata } from '@/games/registry'
import {
	getServerPersonalDailyResults,
	getServerStreakInfo,
	getServerUserStats,
	type StreakInfo,
	type UserStats,
} from '@/lib/api/server'
import { getPremiumAccessStatus, getTodaysFreeGame } from '@/lib/billing/server'
import { cn } from '@/lib/utils'
import { Header } from '@/shared/components/layout'
import { GameIcon } from '@/shared/components/ui/game-icons'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'stats' })

	return {
		title: t('title'),
	}
}

type GameStats = {
	gamesPlayed: number
	gamesWon: number
	currentStreak: number
	maxStreak: number
	totalScore: number
	averageAttempts: number | null
	guessDistribution: Record<string, number> | null
	perfectGames: number
}

// Empty stats for new users or games not played
const emptyStats: GameStats = {
	gamesPlayed: 0,
	gamesWon: 0,
	currentStreak: 0,
	maxStreak: 0,
	totalScore: 0,
	averageAttempts: null,
	guessDistribution: null,
	perfectGames: 0,
}

type StatsData = {
	[gameSlug: string]: GameStats
}

const slugToCamelCase = (slug: string) => slug.replace(/-([a-z])/g, (_, char) => char.toUpperCase())

function toGameStats(stats: UserStats[string] | undefined): GameStats {
	if (!stats) return emptyStats
	return {
		gamesPlayed: stats.gamesPlayed,
		gamesWon: stats.gamesWon,
		currentStreak: stats.currentStreak,
		maxStreak: stats.maxStreak,
		totalScore: stats.totalScore,
		averageAttempts: stats.averageAttempts,
		guessDistribution: stats.guessDistribution as Record<string, number> | null,
		perfectGames: stats.perfectGames,
	}
}

export default async function StatsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('stats')
	const tDaily = await getTranslations('daily')
	const tGames = await getTranslations('games')
	const tHome = await getTranslations('home')
	const user = await currentUser()

	// Logged-out users see login prompt, not fake data
	if (!user) {
		return (
			<>
				<Header />
				<main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
					<div className="mx-auto max-w-md text-center">
						<div className="mb-6 flex justify-center">
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
								<BarChart3 className="h-10 w-10 text-muted-foreground" />
							</div>
						</div>
						<h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
						<p className="mb-6 text-muted-foreground">{t('signInToSeeStats')}</p>
						<Button asChild>
							<Link href={`/${locale}/login?callbackUrl=/${locale}/stats`}>
								<LogIn className="mr-2 h-4 w-4" />
								{t('signIn')}
							</Link>
						</Button>
					</div>
				</main>
			</>
		)
	}

	const gameMetadata = getAllGameMetadata()
	const todaysFreeGame = getTodaysFreeGame()

	// All personal stats and completion state remain server-derived through Connect.
	let stats: StatsData = {}
	let streakInfo: StreakInfo | null = null
	const [userStatsResult, streakResult] = await Promise.allSettled([
		getServerUserStats(),
		getServerStreakInfo(),
	])
	if (userStatsResult.status === 'fulfilled') {
		const userStats = userStatsResult.value
		stats = Object.fromEntries(
			(Object.entries(userStats) as [string, UserStats[string]][]).map(([gameSlug, gameStats]) => [
				gameSlug,
				toGameStats(gameStats),
			]),
		) as StatsData
	}
	if (streakResult.status === 'fulfilled') streakInfo = streakResult.value
	if (userStatsResult.status === 'rejected' || streakResult.status === 'rejected') {
		return (
			<>
				<Header />
				<main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
					<div className="mx-auto max-w-md text-center">
						<div className="mb-6 flex justify-center">
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
								<BarChart3 className="h-10 w-10 text-muted-foreground" />
							</div>
						</div>
						<h1 className="mb-2 text-2xl font-bold">{t('unavailableTitle')}</h1>
						<p className="mb-6 text-muted-foreground">{t('unavailableDescription')}</p>
						<Button asChild>
							<Link href={`/${locale}/stats`}>{t('retry')}</Link>
						</Button>
					</div>
				</main>
			</>
		)
	}
	const premiumAccessStatus = await getPremiumAccessStatus(user.id)
	const isPremium = premiumAccessStatus === 'premium'
	const billingStatusAvailable = premiumAccessStatus !== 'unavailable'

	let personalCompletions: Record<string, boolean> = {}
	let personalCompletionsAvailable = true
	try {
		const personalResults = await getServerPersonalDailyResults({
			gameSlugs: gameMetadata.map((game) => game.slug),
			isGuest: false,
			isPremium,
			freeGameSlug: todaysFreeGame,
		})
		personalCompletions = Object.fromEntries(
			Object.entries(personalResults).map(([gameSlug, result]) => [gameSlug, result.hasCompleted]),
		)
		personalCompletionsAvailable = Object.values(personalResults).every(
			(result) => result.statusAvailable,
		)
	} catch {
		// Missing completion proof is not a completion and remains visible as unknown.
		personalCompletionsAvailable = false
	}

	const gameStats = gameMetadata.map((game) => ({
		game,
		stats: stats[game.slug] ?? emptyStats,
	}))
	const playedGameStats = gameStats.filter(({ stats: gameStat }) => gameStat.gamesPlayed > 0)
	const totalGamesPlayed = gameStats.reduce(
		(sum, { stats: gameStat }) => sum + gameStat.gamesPlayed,
		0,
	)
	const totalGamesWon = gameStats.reduce((sum, { stats: gameStat }) => sum + gameStat.gamesWon, 0)
	const currentStreak = streakInfo?.currentStreak ?? 0
	const bestStreak = streakInfo?.maxStreak ?? 0
	const winRate = totalGamesPlayed > 0 ? Math.round((totalGamesWon / totalGamesPlayed) * 100) : 0
	const totalPerfectGames = gameStats.reduce(
		(sum, { stats: gameStat }) => sum + gameStat.perfectGames,
		0,
	)
	const dailyProgress = summarizeDailyProgress(
		gameMetadata.map((game) => ({
			completed: personalCompletions[game.slug] ?? false,
			locked: !isPremium && game.slug !== todaysFreeGame,
		})),
	)
	const wordGuessStats = stats['word-guess'] ?? emptyStats
	const wordGroupsStats = stats['word-groups'] ?? emptyStats

	// Show empty state if user hasn't played any games yet
	if (
		personalCompletionsAvailable &&
		totalGamesPlayed === 0 &&
		dailyProgress.completedCount === 0
	) {
		return (
			<>
				<Header />
				<main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
					<div className="mx-auto max-w-md text-center">
						<div className="mb-6 flex justify-center">
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
								<Trophy className="h-10 w-10 text-muted-foreground" />
							</div>
						</div>
						<h1 className="mb-2 text-2xl font-bold">{t('noStatsYet')}</h1>
						<p className="mb-6 text-muted-foreground">{t('playFirstGame')}</p>
						<Button asChild>
							<Link href={`/${locale}`}>{t('startPlaying')}</Link>
						</Button>
					</div>
				</main>
			</>
		)
	}

	// Determine which stat to feature based on what's impressive
	const featuredStat =
		currentStreak >= 7
			? 'streak'
			: winRate >= 80
				? 'winRate'
				: totalPerfectGames >= 3
					? 'perfect'
					: 'games'

	return (
		<>
			<Header />
			<main className="flex flex-1 flex-col px-4 py-6">
				<div className="mx-auto w-full max-w-2xl space-y-6">
					<h1 className="text-2xl font-bold">{t('title')}</h1>

					{!billingStatusAvailable && (
						<div
							className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
							role="alert"
						>
							<div className="min-w-0 flex-1">
								<p className="font-medium">{t('billingUnavailableTitle')}</p>
								<p className="text-sm text-muted-foreground">
									{t('billingUnavailableDescription')}
								</p>
							</div>
							<Button asChild variant="outline" size="sm">
								<Link href={`/${locale}/stats`}>{t('billingUnavailableRetry')}</Link>
							</Button>
						</div>
					)}

					{/* Featured Hero Stat */}
					<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 text-center">
						<div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
						<div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-primary/5 blur-xl" />

						{featuredStat === 'streak' && (
							<>
								<Flame className="mx-auto h-10 w-10 text-stat-streak animate-pulse" />
								<div className="mt-2 text-5xl font-bold text-stat-streak">{currentStreak}</div>
								<div className="mt-1 text-sm text-muted-foreground">{t('dayStreak')}</div>
								{currentStreak >= 7 && (
									<div className="mt-2 inline-flex items-center gap-1 rounded-full bg-stat-streak/10 px-3 py-1 text-xs font-medium text-stat-streak">
										<Sparkles className="h-3 w-3" />
										{t('onFire')}
									</div>
								)}
							</>
						)}
						{featuredStat === 'winRate' && (
							<>
								<Target className="mx-auto h-10 w-10 text-stat-winrate" />
								<div className="mt-2 text-5xl font-bold text-stat-winrate">{winRate}%</div>
								<div className="mt-1 text-sm text-muted-foreground">{t('winRate')}</div>
								<div className="mt-2 inline-flex items-center gap-1 rounded-full bg-stat-winrate/10 px-3 py-1 text-xs font-medium text-stat-winrate">
									<Star className="h-3 w-3" />
									{t('sharpshooter')}
								</div>
							</>
						)}
						{featuredStat === 'perfect' && (
							<>
								<Trophy className="mx-auto h-10 w-10 text-amber-500" />
								<div className="mt-2 text-5xl font-bold text-amber-500">{totalPerfectGames}</div>
								<div className="mt-1 text-sm text-muted-foreground">{t('perfectGames')}</div>
								<div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
									<Sparkles className="h-3 w-3" />
									{t('perfectionist')}
								</div>
							</>
						)}
						{featuredStat === 'games' && (
							<>
								<Trophy className="mx-auto h-10 w-10 text-primary" />
								<div className="mt-2 text-5xl font-bold">{totalGamesPlayed}</div>
								<div className="mt-1 text-sm text-muted-foreground">{t('gamesPlayed')}</div>
							</>
						)}
					</div>

					{/* Secondary Stats Grid */}
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
						<StatCard
							icon={<Trophy className="h-4 w-4" />}
							label={t('played')}
							value={totalGamesPlayed}
							variant={featuredStat !== 'games' ? 'default' : 'muted'}
						/>
						<StatCard
							icon={<BarChart3 className="h-4 w-4" />}
							label={t('winRate')}
							value={`${winRate}%`}
							variant={featuredStat !== 'winRate' ? 'default' : 'muted'}
						/>
						<StatCard
							icon={<Flame className="h-4 w-4 text-stat-streak" />}
							label={t('streak')}
							value={currentStreak}
							variant={featuredStat !== 'streak' ? 'default' : 'muted'}
						/>
						<StatCard
							icon={<Star className="h-4 w-4 text-amber-500" />}
							label={t('best')}
							value={bestStreak}
						/>
					</div>

					{/* Today's personal suite depth */}
					<Card>
						<CardHeader>
							<CardTitle>{tHome('todaysPuzzles')}</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{personalCompletionsAvailable ? (
								<>
									<div className="flex items-end justify-between gap-3">
										<div>
											<p className="text-3xl font-bold tabular-nums">
												{dailyProgress.completedCount}/{dailyProgress.availableCount}
											</p>
											<p className="text-sm text-muted-foreground">{tDaily('todaysProgress')}</p>
										</div>
										{dailyProgress.allCompleted && (
											<div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
												<Check className="h-4 w-4" />
												{tDaily('completed')}
											</div>
										)}
									</div>
									<div className="h-2 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all"
											style={{
												width: `${dailyProgress.availableCount > 0 ? (dailyProgress.completedCount / dailyProgress.availableCount) * 100 : 0}%`,
											}}
										/>
									</div>
									<div className="grid gap-2 sm:grid-cols-2">
										{gameMetadata.map((game) => {
											const locked = !isPremium && game.slug !== todaysFreeGame
											if (locked) return null
											const completed = personalCompletions[game.slug] ?? false
											const gameName = tGames(`${slugToCamelCase(game.slug)}.name`, {
												defaultValue: game.name,
											})
											return (
												<Link
													key={game.slug}
													href={`/${locale}/games/${game.slug}`}
													className="flex items-center gap-2 rounded-lg bg-muted/40 p-2 text-sm hover:bg-muted"
												>
													<GameIcon slug={game.slug} size={20} aria-hidden="true" />
													<span className="min-w-0 flex-1 truncate">{gameName}</span>
													{completed && <Check className="h-4 w-4 text-emerald-500" />}
												</Link>
											)
										})}
									</div>
								</>
							) : (
								<div
									className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"
									role="alert"
								>
									<p className="font-medium">{t('dailyStatusUnavailableTitle')}</p>
									<p className="mt-1 text-sm text-muted-foreground">
										{t('dailyStatusUnavailableDescription')}
									</p>
									<Button asChild variant="outline" size="sm" className="mt-3">
										<Link href={`/${locale}/stats`}>{t('dailyStatusRetry')}</Link>
									</Button>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Current registry module stats */}
					{playedGameStats.map(({ game, stats: gameStat }) => {
						const gameName = tGames(`${slugToCamelCase(game.slug)}.name`, {
							defaultValue: game.name,
						})
						const moduleWinRate = Math.round((gameStat.gamesWon / gameStat.gamesPlayed) * 100)
						return (
							<Card key={game.slug}>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<GameIcon slug={game.slug} size={24} aria-hidden="true" />
										{gameName}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
										<div>
											<div className="text-2xl font-bold">{gameStat.gamesPlayed}</div>
											<div className="text-xs text-muted-foreground">{t('gamesPlayed')}</div>
										</div>
										<div>
											<div className="text-2xl font-bold">{moduleWinRate}%</div>
											<div className="text-xs text-muted-foreground">{t('winRate')}</div>
										</div>
										<div>
											<div className="text-2xl font-bold">{gameStat.totalScore}</div>
											<div className="text-xs text-muted-foreground">{t('best')}</div>
										</div>
									</div>
								</CardContent>
							</Card>
						)
					})}

					{/* Achievements */}
					<Card>
						<CardContent className="pt-6">
							<Achievements
								stats={{
									totalWins: totalGamesWon,
									maxStreak: bestStreak,
									wordleWins: wordGuessStats.gamesWon,
									connectionsWins: wordGroupsStats.gamesWon,
									wordleBestAttempts: wordGuessStats.guessDistribution?.['1']
										? 1
										: wordGuessStats.guessDistribution?.['2']
											? 2
											: undefined,
									connectionsPerfectGames: wordGroupsStats.perfectGames,
								}}
							/>
						</CardContent>
					</Card>
				</div>
			</main>
		</>
	)
}

function StatCard({
	icon,
	label,
	value,
	variant = 'default',
}: {
	icon: React.ReactNode
	label: string
	value: string | number
	variant?: 'default' | 'muted'
}) {
	return (
		<div
			className={cn(
				'flex flex-col items-center rounded-xl p-3 transition-all',
				variant === 'default' ? 'bg-muted/50 hover:bg-muted' : 'bg-muted/20 opacity-60',
			)}
		>
			{icon}
			<span className="mt-1.5 text-xl font-bold tabular-nums">{value}</span>
			<span className="text-[10px] text-muted-foreground">{label}</span>
		</div>
	)
}
