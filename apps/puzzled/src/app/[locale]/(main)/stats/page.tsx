import { currentUser } from '@sylphx/sdk/nextjs'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { BarChart3, Check, Flame, Star, Target, Trophy } from 'lucide-react'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { summarizeDailyProgress } from '@/features/daily/lib/daily-progress'
import { Achievements } from '@/features/gamification/components/achievements'
import { getAllGameMetadata } from '@/games/registry'
import {
	getServerHistory,
	getServerPersonalDailyResults,
	getServerStreakInfo,
	getServerUserStats,
	type HistoryEntry,
	hasServerProgressIdentity,
	type StreakInfo,
	type UserStats,
} from '@/lib/api/server'
import { getTodaysFreeGame, hasPremiumAccess } from '@/lib/billing/server'
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
	const gameMetadata = getAllGameMetadata()
	const todaysFreeGame = getTodaysFreeGame()
	const isPremium = user?.id ? await hasPremiumAccess(user.id) : false
	const hasProgressIdentity = Boolean(user) || (await hasServerProgressIdentity())

	const [userStatsResult, historyResult, personalResult, streakResult] = await Promise.allSettled(
		hasProgressIdentity
			? [
					getServerUserStats(),
					getServerHistory({ limit: 20 }),
					getServerPersonalDailyResults({
						gameSlugs: gameMetadata.map((game) => game.slug),
						isGuest: !user,
						isPremium,
						freeGameSlug: todaysFreeGame,
					}),
					getServerStreakInfo(),
				]
			: [
					Promise.resolve({} as UserStats),
					Promise.resolve([] as HistoryEntry[]),
					getServerPersonalDailyResults({
						gameSlugs: gameMetadata.map((game) => game.slug),
						isGuest: true,
						isPremium: false,
						freeGameSlug: todaysFreeGame,
					}),
					Promise.resolve(null as StreakInfo | null),
				],
	)

	if (
		userStatsResult.status === 'rejected' ||
		historyResult.status === 'rejected' ||
		personalResult.status === 'rejected'
	) {
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

	const userStats = userStatsResult.value
	const history: HistoryEntry[] = historyResult.value
	const personalResults = personalResult.value
	const personalCompletions = Object.fromEntries(
		Object.entries(personalResults).map(([gameSlug, result]) => [gameSlug, result.hasCompleted]),
	)
	const personalCompletionsAvailable = Object.values(personalResults).every(
		(result) => result.statusAvailable,
	)

	const stats = Object.fromEntries(
		(Object.entries(userStats) as [string, UserStats[string]][]).map(([gameSlug, gameStats]) => [
			gameSlug,
			toGameStats(gameStats),
		]),
	) as Record<string, GameStats>

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
	const winRate = totalGamesPlayed > 0 ? Math.round((totalGamesWon / totalGamesPlayed) * 100) : 0
	const dailyProgress = summarizeDailyProgress(
		gameMetadata.map((game) => ({
			completed: personalCompletions[game.slug] ?? false,
			locked: !isPremium && game.slug !== todaysFreeGame,
		})),
	)
	const wordGuessStats = stats['word-guess'] ?? emptyStats
	const wordGroupsStats = stats['word-groups'] ?? emptyStats
	const streakInfo = streakResult.status === 'fulfilled' ? streakResult.value : null
	const currentStreak = streakInfo?.currentStreak ?? 0
	const maxStreak = streakInfo?.maxStreak ?? 0

	if (
		personalCompletionsAvailable &&
		totalGamesPlayed === 0 &&
		dailyProgress.completedCount === 0 &&
		history.length === 0
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

	const featuredStat =
		winRate >= 80
			? 'winRate'
			: totalGamesPlayed >= 3
				? 'games'
				: dailyProgress.completedCount > 0
					? 'today'
					: 'games'

	return (
		<>
			<Header />
			<main className="flex flex-1 flex-col px-4 py-6">
				<div className="mx-auto w-full max-w-2xl space-y-6">
					<h1 className="text-2xl font-bold">{t('title')}</h1>

					<div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 text-center">
						{featuredStat === 'winRate' && (
							<>
								<Target className="mx-auto h-10 w-10 text-stat-winrate" />
								<div className="mt-2 text-5xl font-bold text-stat-winrate">{winRate}%</div>
								<div className="mt-1 text-sm text-muted-foreground">{t('winRate')}</div>
							</>
						)}
						{featuredStat === 'today' && (
							<>
								<Check className="mx-auto h-10 w-10 text-emerald-500" />
								<div className="mt-2 text-5xl font-bold">
									{dailyProgress.completedCount}/{dailyProgress.availableCount}
								</div>
								<div className="mt-1 text-sm text-muted-foreground">{tDaily('todaysProgress')}</div>
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

					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
						<StatCard
							icon={<Trophy className="h-4 w-4" />}
							label={t('played')}
							value={totalGamesPlayed}
						/>
						<StatCard
							icon={<BarChart3 className="h-4 w-4" />}
							label={t('winRate')}
							value={`${winRate}%`}
						/>
						<StatCard
							icon={<Flame className="h-4 w-4 text-stat-streak" />}
							label={t('streak')}
							value={currentStreak}
						/>
						<StatCard
							icon={<Star className="h-4 w-4 text-amber-500" />}
							label={t('best')}
							value={maxStreak}
						/>
					</div>

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

					<Card>
						<CardHeader>
							<CardTitle>{t('historyTitle')}</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2">
							{history.length === 0 ? (
								<p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>
							) : (
								history.map((session) => {
									const gameName = tGames(`${slugToCamelCase(session.gameSlug)}.name`, {
										defaultValue: session.gameSlug,
									})
									return (
										<div
											key={`${session.gameSlug}-${session.puzzleId}-${session.puzzleDate}-${session.attempts}`}
											className="flex items-center gap-3 rounded-lg bg-muted/40 p-2 text-sm"
										>
											<GameIcon slug={session.gameSlug} size={20} aria-hidden="true" />
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium">{gameName}</p>
												<p className="text-xs text-muted-foreground">
													{session.puzzleDate} · {session.status} · {session.mode}
												</p>
											</div>
											<span className="tabular-nums">{session.score}</span>
										</div>
									)
								})
							)}
						</CardContent>
					</Card>

					<Card>
						<CardContent className="pt-6">
							<Achievements
								stats={{
									totalWins: totalGamesWon,
									maxStreak,
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
