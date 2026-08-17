import { auth } from '@sylphx/sdk/nextjs'
import { AvatarIcon, Podium } from '@sylphx/ui'
import { Crown, Medal, Trophy, User } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getAllGameMetadata } from '@/games/registry'
import { admitLeaderboardViaConnect } from '@/lib/connect/stats-admission'
import { Link } from '@/lib/i18n/routing'
import { cn } from '@/lib/utils'
import { Header } from '@/shared/components/layout'
import { GameIcon } from '@/shared/components/ui/game-icons'

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
	score?: number
	isCurrentUser?: boolean
}

type LeaderboardPeriod = 'today' | 'week' | 'all'

type UserRankData = {
	rank: number
	value: number
	name: string
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
	const { user } = await auth()

	// Registry-driven game list - show leaderboards for ALL games
	const allGames = getAllGameMetadata()

	// Product authority: sole Connect Stats.GetLeaderboard admit (default connect).
	// Fail-closed under Connect: an unavailable authority renders an empty surface.
	type GameLeaderboardData = {
		slug: string
		name: string
		entries: LeaderboardEntry[]
		userRank: UserRankData | null
		authority?: 'connect' | 'connect_empty'
	}

	const gameLeaderboards: GameLeaderboardData[] = []

	try {
		const connectResults = await Promise.all(
			allGames.map((game) =>
				admitLeaderboardViaConnect({
					gameSlug: game.slug,
					type: 'score',
					period,
					limit: game.slug === allGames[0]?.slug ? 10 : 5,
				}).catch(() => null),
			),
		)

		allGames.forEach((game, idx) => {
			const connect = connectResults[idx]
			if (connect?.ok) {
				// Connect returned data → sole authority; empty is still honest.
				const entries: LeaderboardEntry[] = connect.response.entries.map(
					(e: { rank: number; userName?: string; userId?: string; value: number }) => ({
						rank: e.rank,
						name: e.userName || e.userId || 'Anonymous',
						avatarIndex: Math.max(0, e.rank - 1),
						score: e.value,
						isCurrentUser: Boolean(user?.id && e.userId === user.id),
					}),
				)
				gameLeaderboards.push({
					slug: game.slug,
					name: game.name,
					entries,
					userRank: null,
					authority: 'connect',
				})
				return
			}

			// Connect is fail-closed: unavailable authority renders empty.
			gameLeaderboards.push({
				slug: game.slug,
				name: game.name,
				entries: [],
				userRank: null,
				authority: 'connect_empty',
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
				value: entry.score ?? 0,
			}))
		: []

	const podiumMetricLabel = tLeaderboard('score')

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

					{/* Registry-driven leaderboards — sole Connect admit product surface */}
					{gameLeaderboards.map((game) => (
						<LeaderboardSection
							key={game.slug}
							title={game.name}
							icon={<GameIcon slug={game.slug} size={24} aria-hidden="true" />}
							entries={game.entries}
							metricLabel={tLeaderboard('score')}
							emptyMessage={tLeaderboard('noData')}
							unavailable={game.authority === 'connect_empty'}
							unavailableMessage={tLeaderboard('unavailable')}
							unavailableHint={tLeaderboard('unavailableHint')}
							retryLabel={tLeaderboard('retry')}
							retryHref={`/leaderboard${period === 'all' ? '' : `?period=${period}`}`}
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
	metricLabel,
	emptyMessage,
	unavailable,
	unavailableMessage,
	unavailableHint,
	retryLabel,
	retryHref,
	locale,
	userRank,
	yourRankLabel,
}: {
	title: string
	icon: React.ReactNode
	entries: LeaderboardEntry[]
	metricLabel: string
	emptyMessage: string
	unavailable: boolean
	unavailableMessage: string
	unavailableHint: string
	retryLabel: string
	retryHref: string
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

			{unavailable ? (
				<div className="space-y-2 p-6 text-center text-sm">
					<p className="font-medium text-destructive">{unavailableMessage}</p>
					<p className="text-muted-foreground">{unavailableHint}</p>
					<Link href={retryHref} className="inline-block text-primary underline">
						{retryLabel}
					</Link>
				</div>
			) : entries.length === 0 ? (
				<div className="p-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
			) : (
				<div className="divide-y">
					{entries.map((entry) => (
						<div
							key={entry.rank}
							className={cn(
								'flex items-center gap-3 p-3',
								entry.rank <= 3 && 'bg-muted/30',
								entry.isCurrentUser && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
							)}
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
									<span
										className={cn(
											'text-sm font-medium',
											entry.isCurrentUser ? 'text-primary' : 'text-muted-foreground',
										)}
									>
										{entry.rank}
									</span>
								)}
							</div>

							{/* Avatar & Name */}
							<div className="flex flex-1 items-center gap-2">
								<AvatarIcon index={entry.avatarIndex} size={24} className="text-muted-foreground" />
								<span className={cn('font-medium', entry.isCurrentUser && 'text-primary')}>
									{entry.name}
								</span>
							</div>

							{/* Score */}
							<div className="flex items-center gap-1 text-right">
								<span className="font-bold">{entry.score?.toLocaleString(locale)}</span>
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

								{/* Score */}
								<div className="flex items-center gap-1 text-right">
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
