import { Crown, Flame, Medal, Trophy, User } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getServerSession } from '@/features/auth/server'
import { getAllGameMetadata } from '@/games/registry'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Header } from '@/shared/components/layout'
import { AvatarIcon, GameIcon, Podium } from '@/shared/components/ui'
import { createServerCaller } from '@/trpc/server'

type Props = {
	params: Promise<{ locale: string }>
	searchParams: Promise<{ period?: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'nav' })

	return {
		title: t('leaderboard'),
	}
}

type LeaderboardEntry = {
	rank: number
	name: string
	avatarIndex: number
	streak?: number
	wins?: number
	score?: number
	accuracy?: number
}

type LeaderboardPeriod = 'today' | 'week' | 'all'

type DbLeaderboardEntry = {
	rank: number
	userId: string
	userName: string | null
	userImage: string | null
	value: number
}

type UserRankData = {
	rank: number
	value: number
	name: string
}

// Convert DB leaderboard entry to display format
function mapDbEntry(
	entry: DbLeaderboardEntry,
	metric: 'streak' | 'score' | 'wins',
): LeaderboardEntry {
	return {
		rank: entry.rank,
		name: entry.userName || 'Anonymous',
		avatarIndex: entry.rank - 1, // Use rank as avatar index for variety
		streak: metric === 'streak' ? entry.value : undefined,
		score: metric === 'score' ? entry.value : undefined,
		wins: metric === 'wins' ? entry.value : undefined,
	}
}

const PERIODS: LeaderboardPeriod[] = ['today', 'week', 'all']

export default async function LeaderboardPage({ params, searchParams }: Props) {
	const { locale } = await params
	const { period: periodParam } = await searchParams
	setRequestLocale(locale)

	// Validate period parameter
	const period: LeaderboardPeriod = PERIODS.includes(periodParam as LeaderboardPeriod)
		? (periodParam as LeaderboardPeriod)
		: 'all'

	const t = await getTranslations('nav')
	const tLeaderboard = await getTranslations('leaderboard')
	const trpc = await createServerCaller()
	const session = await getServerSession()

	// Determine metric type based on period
	// For today/week, show wins (period stats). For all time, show streaks.
	const metricType = period === 'all' ? 'streak' : 'score'

	// Registry-driven game list - show leaderboards for ALL games
	const allGames = getAllGameMetadata()

	// Fetch real leaderboard data for all games
	type GameLeaderboardData = {
		slug: string
		name: string
		entries: LeaderboardEntry[]
		userRank: UserRankData | null
	}

	const gameLeaderboards: GameLeaderboardData[] = []

	try {
		// Fetch leaderboards for all games in parallel
		const leaderboardPromises = allGames.map((game) =>
			trpc.stats.getLeaderboard({
				gameSlug: game.slug,
				type: metricType,
				period,
				limit: game.slug === allGames[0].slug ? 10 : 5, // Primary game gets 10, others get 5
			}),
		)
		const leaderboardResults = await Promise.all(leaderboardPromises)

		// Fetch user ranks if logged in
		let userRankResults: (Awaited<ReturnType<typeof trpc.stats.getUserRank>> | null)[] = []
		if (session?.user) {
			const userRankPromises = allGames.map((game) =>
				trpc.stats.getUserRank({ gameSlug: game.slug, type: metricType, period }),
			)
			userRankResults = await Promise.all(userRankPromises)
		}

		// Map results to game leaderboard data
		allGames.forEach((game, idx) => {
			const leaderboardData = leaderboardResults[idx]
			const entries = leaderboardData.map((e) =>
				mapDbEntry(e, period === 'all' ? 'streak' : 'wins'),
			)

			let userRank: UserRankData | null = null
			if (session?.user && userRankResults[idx]) {
				const rank = userRankResults[idx]
				if (rank && !leaderboardData.some((e) => e.userId === session.user.id)) {
					userRank = { ...rank, name: session.user.name || 'You' }
				}
			}

			gameLeaderboards.push({
				slug: game.slug,
				name: game.name,
				entries,
				userRank,
			})
		})
	} catch {
		// Show empty state on error
	}

	// Primary game for podium (first game in sorted list)
	const primaryGame = gameLeaderboards[0]

	// Prepare podium entries from the primary leaderboard (first game in sorted order)
	const podiumEntries = primaryGame
		? primaryGame.entries.slice(0, 3).map((entry) => ({
				rank: entry.rank,
				name: entry.name,
				avatarIndex: entry.avatarIndex,
				value: entry.streak ?? entry.wins ?? entry.score ?? 0,
			}))
		: []

	const podiumMetricLabel = tLeaderboard(period === 'all' ? 'streak' : 'wins')

	return (
		<>
			<Header />
			<main className="flex flex-1 flex-col px-4 py-6">
				<div className="mx-auto w-full max-w-2xl space-y-6">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-bold">{t('leaderboard')}</h1>
					</div>

					{/* Period Tabs */}
					<div className="flex rounded-lg border bg-muted/30 p-1">
						{PERIODS.map((p) => (
							<Link
								key={p}
								href={`/leaderboard${p === 'all' ? '' : `?period=${p}`}`}
								className={cn(
									'flex-1 rounded-md px-3 py-2 text-center text-sm font-medium transition-colors',
									period === p
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground',
								)}
							>
								{tLeaderboard(`period.${p}`)}
							</Link>
						))}
					</div>

					{/* Featured Podium - Top 3 from primary game */}
					{podiumEntries.length > 0 && (
						<div className="rounded-xl border bg-gradient-to-b from-muted/50 to-transparent p-6">
							<h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
								{tLeaderboard('topPlayers')}
							</h2>
							<Podium entries={podiumEntries} metricLabel={podiumMetricLabel} locale={locale} />
						</div>
					)}

					{/* Registry-driven leaderboards - ALL games */}
					{gameLeaderboards.map((game) => (
						<LeaderboardSection
							key={game.slug}
							title={game.name}
							icon={<GameIcon slug={game.slug} size={24} aria-hidden="true" />}
							entries={game.entries}
							metric={period === 'all' ? 'streak' : 'wins'}
							metricLabel={tLeaderboard(period === 'all' ? 'streak' : 'wins')}
							emptyMessage={tLeaderboard('noData')}
							locale={locale}
							userRank={game.userRank}
							yourRankLabel={tLeaderboard('yourRank')}
						/>
					))}

					{/* Premium prompt */}
					<div className="rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-6 text-center">
						<Crown className="mx-auto mb-2 h-8 w-8 text-primary" />
						<h3 className="mb-1 font-semibold">{tLeaderboard('wantToCompete')}</h3>
						<p className="text-sm text-muted-foreground">{tLeaderboard('premiumPrompt')}</p>
					</div>
				</div>
			</main>
		</>
	)
}

function LeaderboardSection({
	title,
	icon,
	entries,
	metric,
	metricLabel,
	emptyMessage,
	locale,
	userRank,
	yourRankLabel,
}: {
	title: string
	icon: React.ReactNode
	entries: LeaderboardEntry[]
	metric: 'streak' | 'score' | 'wins'
	metricLabel: string
	emptyMessage: string
	locale: string
	userRank?: UserRankData | null
	yourRankLabel?: string
}) {
	return (
		<div className="rounded-xl border bg-card">
			<div className="flex items-center gap-2 border-b p-4">
				{icon}
				<h2 className="font-semibold">{title}</h2>
			</div>

			{entries.length === 0 ? (
				<div className="p-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
			) : (
				<div className="divide-y">
					{entries.map((entry) => (
						<div
							key={entry.rank}
							className={cn('flex items-center gap-3 p-3', entry.rank <= 3 && 'bg-muted/30')}
						>
							{/* Rank */}
							<div className="flex h-8 w-8 items-center justify-center">
								{entry.rank === 1 ? (
									<Trophy className="h-6 w-6 text-rank-gold" aria-label="1st place" />
								) : entry.rank === 2 ? (
									<Medal className="h-6 w-6 text-rank-silver" aria-label="2nd place" />
								) : entry.rank === 3 ? (
									<Medal className="h-6 w-6 text-rank-bronze" aria-label="3rd place" />
								) : (
									<span className="text-sm font-medium text-muted-foreground">{entry.rank}</span>
								)}
							</div>

							{/* Avatar & Name */}
							<div className="flex flex-1 items-center gap-2">
								<AvatarIcon index={entry.avatarIndex} size={24} className="text-muted-foreground" />
								<span className="font-medium">{entry.name}</span>
							</div>

							{/* Metric */}
							<div className="flex items-center gap-1 text-right">
								{metric === 'streak' && (
									<Flame className="h-4 w-4 text-stat-streak" aria-hidden="true" />
								)}
								<span className="font-bold">
									{metric === 'streak'
										? entry.streak
										: metric === 'wins'
											? entry.wins
											: entry.score?.toLocaleString(locale)}
								</span>
								<span className="text-xs text-muted-foreground">{metricLabel}</span>
							</div>
						</div>
					))}

					{/* User's rank (if not already in top entries) */}
					{userRank && (
						<>
							{/* Ellipsis separator */}
							<div className="flex items-center justify-center py-2 text-muted-foreground">
								<span className="text-xs">•••</span>
							</div>
							<div className="flex items-center gap-3 bg-primary/5 p-3 ring-1 ring-inset ring-primary/20">
								{/* Rank */}
								<div className="flex h-8 w-8 items-center justify-center">
									<span className="text-sm font-medium text-primary">#{userRank.rank}</span>
								</div>

								{/* Avatar & Name */}
								<div className="flex flex-1 items-center gap-2">
									<User className="h-6 w-6 text-primary" aria-hidden="true" />
									<span className="font-medium text-primary">{userRank.name}</span>
									<span className="text-xs text-muted-foreground">({yourRankLabel})</span>
								</div>

								{/* Metric */}
								<div className="flex items-center gap-1 text-right">
									{metric === 'streak' && (
										<Flame className="h-4 w-4 text-stat-streak" aria-hidden="true" />
									)}
									<span className="font-bold">{userRank.value.toLocaleString(locale)}</span>
									<span className="text-xs text-muted-foreground">{metricLabel}</span>
								</div>
							</div>
						</>
					)}
				</div>
			)}
		</div>
	)
}
