import { currentUser } from '@sylphx/sdk/nextjs'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sylphx/ui'
import { BarChart3, Flame, LogIn, Sparkles, Star, Target, Trophy } from 'lucide-react'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Achievements } from '@/features/gamification/components/achievements'
import { createServerApi, type UserStats } from '@/lib/api/server'
import { cn } from '@/lib/utils'
import { Header } from '@/shared/components/layout'
import { ConnectionsIcon, WordleIcon } from '@/shared/components/ui/game-icons'

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
	wordle: GameStats
	connections: GameStats
}

export default async function StatsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const t = await getTranslations('stats')
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

	const { stats: statsApi } = await createServerApi()

	// Get user's real stats
	let stats: StatsData = { wordle: emptyStats, connections: emptyStats }

	try {
		const userStatsRes = await statsApi['user-stats'].$get()
		const userStats = (await userStatsRes.json()) as UserStats
		stats = {
			wordle: userStats.wordle
				? {
						gamesPlayed: userStats.wordle.gamesPlayed,
						gamesWon: userStats.wordle.gamesWon,
						currentStreak: userStats.wordle.currentStreak,
						maxStreak: userStats.wordle.maxStreak,
						totalScore: userStats.wordle.totalScore,
						averageAttempts: userStats.wordle.averageAttempts,
						guessDistribution: userStats.wordle.guessDistribution as Record<string, number> | null,
						perfectGames: userStats.wordle.perfectGames,
					}
				: emptyStats,
			connections: userStats.connections
				? {
						gamesPlayed: userStats.connections.gamesPlayed,
						gamesWon: userStats.connections.gamesWon,
						currentStreak: userStats.connections.currentStreak,
						maxStreak: userStats.connections.maxStreak,
						totalScore: userStats.connections.totalScore,
						averageAttempts: userStats.connections.averageAttempts,
						guessDistribution: userStats.connections.guessDistribution as Record<
							string,
							number
						> | null,
						perfectGames: userStats.connections.perfectGames,
					}
				: emptyStats,
		}
	} catch {
		// Use empty stats on error
	}

	const totalGamesPlayed = stats.wordle.gamesPlayed + stats.connections.gamesPlayed
	const totalGamesWon = stats.wordle.gamesWon + stats.connections.gamesWon
	const currentStreak = Math.max(stats.wordle.currentStreak, stats.connections.currentStreak)
	const bestStreak = Math.max(stats.wordle.maxStreak, stats.connections.maxStreak)
	const winRate = totalGamesPlayed > 0 ? Math.round((totalGamesWon / totalGamesPlayed) * 100) : 0
	const totalPerfectGames = stats.wordle.perfectGames + stats.connections.perfectGames

	// Show empty state if user hasn't played any games yet
	if (totalGamesPlayed === 0) {
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

					{/* Wordle Stats */}
					{stats.wordle.gamesPlayed > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<WordleIcon size={24} className="text-game-wordle" aria-hidden="true" />
									Wordle
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
									<div>
										<div className="text-2xl font-bold">{stats.wordle.gamesPlayed}</div>
										<div className="text-xs text-muted-foreground">{t('gamesPlayed')}</div>
									</div>
									<div>
										<div className="text-2xl font-bold">
											{stats.wordle.gamesPlayed > 0
												? Math.round((stats.wordle.gamesWon / stats.wordle.gamesPlayed) * 100)
												: 0}
											%
										</div>
										<div className="text-xs text-muted-foreground">{t('winRate')}</div>
									</div>
									<div>
										<div className="text-2xl font-bold">{stats.wordle.currentStreak}</div>
										<div className="text-xs text-muted-foreground">{t('currentStreak')}</div>
									</div>
									<div>
										<div className="text-2xl font-bold">{stats.wordle.maxStreak}</div>
										<div className="text-xs text-muted-foreground">{t('maxStreak')}</div>
									</div>
								</div>

								{/* Guess Distribution */}
								{stats.wordle.guessDistribution && (
									<div>
										<h4 className="mb-2 text-sm font-medium">{t('guessDistribution')}</h4>
										<div className="space-y-1">
											{Object.entries(stats.wordle.guessDistribution).map(([guess, count]) => {
												const maxCount = Math.max(
													...Object.values(
														stats.wordle.guessDistribution as Record<string, number>,
													),
												)
												const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0
												return (
													<div key={guess} className="flex items-center gap-2">
														<span className="w-4 text-sm font-medium">{guess}</span>
														<div className="flex-1">
															<div
																className="flex h-5 items-center rounded bg-primary px-2"
																style={{ width: `${Math.max(percentage, 10)}%` }}
															>
																<span className="text-xs font-medium text-primary-foreground">
																	{count}
																</span>
															</div>
														</div>
													</div>
												)
											})}
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					)}

					{/* Connections Stats */}
					{stats.connections.gamesPlayed > 0 && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<ConnectionsIcon size={24} className="text-game-connections" aria-hidden="true" />
									Connections
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
									<div>
										<div className="text-2xl font-bold">{stats.connections.gamesPlayed}</div>
										<div className="text-xs text-muted-foreground">{t('gamesPlayed')}</div>
									</div>
									<div>
										<div className="text-2xl font-bold">
											{stats.connections.gamesPlayed > 0
												? Math.round(
														(stats.connections.gamesWon / stats.connections.gamesPlayed) * 100,
													)
												: 0}
											%
										</div>
										<div className="text-xs text-muted-foreground">{t('winRate')}</div>
									</div>
									<div>
										<div className="text-2xl font-bold">{stats.connections.currentStreak}</div>
										<div className="text-xs text-muted-foreground">{t('currentStreak')}</div>
									</div>
									<div>
										<div className="text-2xl font-bold">{stats.connections.maxStreak}</div>
										<div className="text-xs text-muted-foreground">{t('maxStreak')}</div>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Achievements */}
					<Card>
						<CardContent className="pt-6">
							<Achievements
								stats={{
									totalWins: totalGamesWon,
									maxStreak: Math.max(stats.wordle.maxStreak, stats.connections.maxStreak),
									wordleWins: stats.wordle.gamesWon,
									connectionsWins: stats.connections.gamesWon,
									wordleBestAttempts: stats.wordle.guessDistribution?.['1']
										? 1
										: stats.wordle.guessDistribution?.['2']
											? 2
											: undefined,
									connectionsPerfectGames: stats.connections.perfectGames,
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
