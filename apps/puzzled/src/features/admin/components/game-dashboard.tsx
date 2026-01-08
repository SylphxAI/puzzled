'use client'

import {
	AlertCircle,
	BarChart3,
	Calendar,
	CheckCircle2,
	Clock,
	Eye,
	Gamepad2,
	History,
	RefreshCw,
	Sparkles,
	Target,
	Timer,
	Trophy,
	TrendingUp,
	Users,
} from 'lucide-react'
import { useState } from 'react'
import { GameIcon } from '@/shared/components/ui/game-icons'
import { trpc } from '@/trpc/client'

type DateRange = '7d' | '14d' | '30d' | '90d'

const dateRangeLabels: Record<DateRange, string> = {
	'7d': 'Last 7 days',
	'14d': 'Last 14 days',
	'30d': 'Last 30 days',
	'90d': 'Last 90 days',
}

function getDateRange(range: DateRange): { from: string; to: string } {
	const now = new Date()
	const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
	const from = new Date(to)

	switch (range) {
		case '7d':
			from.setDate(from.getDate() - 7)
			break
		case '14d':
			from.setDate(from.getDate() - 14)
			break
		case '30d':
			from.setDate(from.getDate() - 30)
			break
		case '90d':
			from.setDate(from.getDate() - 90)
			break
	}

	return { from: from.toISOString(), to: to.toISOString() }
}

export function GameDashboard({ slug }: { slug: string }) {
	const [dateRange, setDateRange] = useState<DateRange>('30d')
	const { from, to } = getDateRange(dateRange)

	const {
		data: analytics,
		isLoading: analyticsLoading,
		refetch: refetchAnalytics,
		isRefetching: analyticsRefetching,
	} = trpc.admin.getSingleGameAnalytics.useQuery(
		{ slug, dateFrom: from, dateTo: to },
		{ refetchInterval: 60000 },
	)

	const { data: puzzleData, isLoading: puzzleLoading } = trpc.admin.getTodayPuzzle.useQuery(
		{ slug },
		{ refetchInterval: 60000 },
	)

	const { data: puzzleHistory, isLoading: historyLoading } = trpc.admin.getGamePuzzleHistory.useQuery(
		{ slug, limit: 14 },
		{ refetchInterval: 60000 },
	)

	if (analyticsLoading) {
		return <GameDashboardSkeleton />
	}

	if (!analytics) {
		return (
			<div className="admin-card p-8 text-center">
				<AlertCircle className="mx-auto h-8 w-8 text-[var(--admin-error)]" />
				<p className="mt-2 text-[var(--admin-text-secondary)]">Failed to load game analytics</p>
			</div>
		)
	}

	const { game, overview, dailyPlays, attemptsDistribution, scoreDistribution, topPlayers } = analytics

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="admin-card p-6">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-4">
						<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--admin-bg-surface)]">
							<GameIcon slug={game.slug} size={32} className="text-[var(--admin-text-primary)]" />
						</div>
						<div>
							<h1 className="text-2xl font-bold text-[var(--admin-text-primary)]">{game.name}</h1>
							<div className="mt-1 flex items-center gap-3">
								<span className="admin-badge admin-badge-default capitalize">{game.category}</span>
								<span className="admin-badge admin-badge-default capitalize">{game.difficulty}</span>
								{game.generationStrategy === 'llm' && (
									<span className="admin-badge" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
										<Sparkles className="mr-1 h-3 w-3" />
										AI Generated
									</span>
								)}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3">
						{/* Date Range Selector */}
						<div className="admin-segment-control">
							{(['7d', '14d', '30d', '90d'] as DateRange[]).map((range) => (
								<button
									key={range}
									type="button"
									onClick={() => setDateRange(range)}
									className={`admin-segment-btn ${dateRange === range ? 'active' : ''}`}
								>
									{range}
								</button>
							))}
						</div>

						<button
							type="button"
							onClick={() => refetchAnalytics()}
							disabled={analyticsRefetching}
							className="admin-btn admin-btn-ghost"
						>
							<RefreshCw className={`h-4 w-4 ${analyticsRefetching ? 'animate-spin' : ''}`} />
						</button>
					</div>
				</div>
			</div>

			{/* Today's Puzzle Status */}
			<TodayPuzzleCard puzzle={puzzleData?.puzzle} isLoading={puzzleLoading} gameName={game.name} />

			{/* Overview Stats */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={<Gamepad2 className="h-5 w-5" />}
					label="Total Plays"
					value={overview.totalPlays.toLocaleString()}
					color="var(--admin-info)"
				/>
				<StatCard
					icon={<Target className="h-5 w-5" />}
					label="Completion Rate"
					value={`${overview.completionRate}%`}
					color="var(--admin-success)"
					subtext={`${overview.totalWins.toLocaleString()} wins`}
				/>
				<StatCard
					icon={<Users className="h-5 w-5" />}
					label="Unique Players"
					value={overview.uniquePlayers.toLocaleString()}
					color="var(--admin-accent)"
				/>
				<StatCard
					icon={<Trophy className="h-5 w-5" />}
					label="Avg Score"
					value={overview.avgScore.toString()}
					color="var(--admin-warning)"
					subtext={`${Math.round(overview.avgTimeMs / 1000)}s avg time`}
				/>
			</div>

			{/* Charts Section */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Plays Trend */}
				<div className="admin-card p-6">
					<h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--admin-text-primary)]">
						<TrendingUp className="h-5 w-5 text-[var(--admin-accent)]" />
						Plays Trend
					</h3>
					<PlaysChart data={dailyPlays} />
				</div>

				{/* Score Distribution */}
				<div className="admin-card p-6">
					<h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--admin-text-primary)]">
						<BarChart3 className="h-5 w-5 text-[var(--admin-accent)]" />
						Score Distribution
					</h3>
					<ScoreDistributionChart data={scoreDistribution} />
				</div>
			</div>

			{/* Secondary Stats */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Puzzle History */}
				<div className="admin-card">
					<div className="border-b border-[var(--admin-border)] p-4">
						<h3 className="flex items-center gap-2 font-semibold text-[var(--admin-text-primary)]">
							<History className="h-5 w-5 text-[var(--admin-accent)]" />
							Recent Puzzles
						</h3>
					</div>
					<PuzzleHistoryTable puzzles={puzzleHistory?.puzzles ?? []} isLoading={historyLoading} />
				</div>

				{/* Top Players */}
				<div className="admin-card">
					<div className="border-b border-[var(--admin-border)] p-4">
						<h3 className="flex items-center gap-2 font-semibold text-[var(--admin-text-primary)]">
							<Trophy className="h-5 w-5 text-[var(--admin-warning)]" />
							Top Players ({dateRangeLabels[dateRange]})
						</h3>
					</div>
					<TopPlayersTable players={topPlayers} />
				</div>
			</div>

			{/* Attempts Distribution (if available) */}
			{attemptsDistribution.length > 0 && (
				<div className="admin-card p-6">
					<h3 className="mb-4 flex items-center gap-2 font-semibold text-[var(--admin-text-primary)]">
						<Target className="h-5 w-5 text-[var(--admin-accent)]" />
						Attempts Distribution
					</h3>
					<AttemptsChart data={attemptsDistribution} />
				</div>
			)}
		</div>
	)
}

// ==========================================
// Sub-components
// ==========================================

function TodayPuzzleCard({
	puzzle,
	isLoading,
	gameName,
}: {
	puzzle: {
		id: string
		puzzleDate: string
		puzzleData: unknown
		solution: unknown
		difficulty: 'easy' | 'medium' | 'hard' | null
		seed: number | null
		plays: number
		wins: number
		completionRate: number
	} | null | undefined
	isLoading: boolean
	gameName: string
}) {
	const [showSolution, setShowSolution] = useState(false)

	if (isLoading) {
		return (
			<div className="admin-card p-6">
				<div className="flex items-center gap-3">
					<div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--admin-bg-surface)]" />
					<div className="space-y-2">
						<div className="h-5 w-48 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
						<div className="h-4 w-32 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
					</div>
				</div>
			</div>
		)
	}

	if (!puzzle) {
		return (
			<div className="admin-card border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/5 p-6">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--admin-warning)]/20">
						<AlertCircle className="h-5 w-5 text-[var(--admin-warning)]" />
					</div>
					<div>
						<h3 className="font-semibold text-[var(--admin-warning)]">No puzzle for today</h3>
						<p className="text-sm text-[var(--admin-warning)]/80">
							Today&apos;s {gameName} puzzle has not been generated yet
						</p>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="admin-card border-[var(--admin-success)]/30 bg-[var(--admin-success)]/5 p-6">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--admin-success)]/20">
						<CheckCircle2 className="h-5 w-5 text-[var(--admin-success)]" />
					</div>
					<div>
						<h3 className="font-semibold text-[var(--admin-success)]">Today&apos;s Puzzle Ready</h3>
						<p className="text-sm text-[var(--admin-success)]/80">
							Seed: {puzzle.seed} • Difficulty: {puzzle.difficulty ?? 'N/A'}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-4">
					<div className="text-right">
						<p className="text-lg font-semibold text-[var(--admin-text-primary)]">
							{puzzle.plays} plays
						</p>
						<p className="text-sm text-[var(--admin-text-muted)]">
							{puzzle.completionRate}% completion
						</p>
					</div>

					<button
						type="button"
						onClick={() => setShowSolution(!showSolution)}
						className="admin-btn admin-btn-ghost"
					>
						<Eye className="h-4 w-4" />
						{showSolution ? 'Hide' : 'Preview'}
					</button>
				</div>
			</div>

			{showSolution && (
				<div className="mt-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-base)] p-4">
					<p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--admin-text-muted)]">
						Solution (Admin Only)
					</p>
					<pre className="overflow-x-auto text-sm text-[var(--admin-text-primary)]">
						{JSON.stringify(puzzle.solution, null, 2)}
					</pre>
				</div>
			)}
		</div>
	)
}

function StatCard({
	icon,
	label,
	value,
	color,
	subtext,
}: {
	icon: React.ReactNode
	label: string
	value: string
	color: string
	subtext?: string
}) {
	return (
		<div className="admin-card p-5">
			<div className="flex items-start justify-between">
				<div
					className="flex h-10 w-10 items-center justify-center rounded-lg"
					style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
				>
					{icon}
				</div>
			</div>
			<p className="mt-3 text-2xl font-bold text-[var(--admin-text-primary)]">{value}</p>
			<p className="text-sm text-[var(--admin-text-muted)]">{label}</p>
			{subtext && <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{subtext}</p>}
		</div>
	)
}

function PlaysChart({
	data,
}: {
	data: { date: string; plays: number; wins: number; uniquePlayers: number }[]
}) {
	const maxPlays = Math.max(...data.map((d) => d.plays), 1)

	return (
		<div className="space-y-2">
			<div className="flex h-48 items-end gap-1">
				{data.map((day, i) => {
					const height = (day.plays / maxPlays) * 100
					const winRate = day.plays > 0 ? Math.round((day.wins / day.plays) * 100) : 0

					return (
						<div
							key={day.date}
							className="group relative flex-1"
							title={`${day.date}: ${day.plays} plays, ${winRate}% win rate`}
						>
							<div
								className="w-full rounded-t bg-[var(--admin-accent)] transition-all hover:bg-[var(--admin-accent-muted)]"
								style={{ height: `${Math.max(height, 2)}%` }}
							/>
							{/* Tooltip */}
							<div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-[var(--admin-bg-elevated)] px-2 py-1 text-xs shadow-lg group-hover:block">
								<p className="font-medium">{day.plays} plays</p>
								<p className="text-[var(--admin-text-muted)]">{winRate}% win rate</p>
							</div>
						</div>
					)
				})}
			</div>
			{/* X-axis labels (show first, middle, last) */}
			<div className="flex justify-between text-xs text-[var(--admin-text-muted)]">
				<span>{data[0]?.date.slice(5)}</span>
				<span>{data[Math.floor(data.length / 2)]?.date.slice(5)}</span>
				<span>{data[data.length - 1]?.date.slice(5)}</span>
			</div>
		</div>
	)
}

function ScoreDistributionChart({ data }: { data: { bucket: string; count: number }[] }) {
	const bucketOrder = ['90-100', '80-89', '70-79', '60-69', '50-59', '0-49']
	const sortedData = bucketOrder
		.map((bucket) => data.find((d) => d.bucket === bucket) ?? { bucket, count: 0 })
		.reverse()

	const maxCount = Math.max(...sortedData.map((d) => d.count), 1)

	return (
		<div className="space-y-3">
			{sortedData.map((item) => {
				const percentage = (item.count / maxCount) * 100

				return (
					<div key={item.bucket} className="flex items-center gap-3">
						<span className="w-16 shrink-0 text-sm text-[var(--admin-text-muted)]">{item.bucket}</span>
						<div className="relative h-6 flex-1 overflow-hidden rounded bg-[var(--admin-bg-surface)]">
							<div
								className="absolute inset-y-0 left-0 rounded bg-[var(--admin-accent)] transition-all"
								style={{ width: `${percentage}%` }}
							/>
						</div>
						<span className="w-12 shrink-0 text-right text-sm font-medium text-[var(--admin-text-primary)]">
							{item.count}
						</span>
					</div>
				)
			})}
		</div>
	)
}

function AttemptsChart({ data }: { data: { attempts: number | null; count: number }[] }) {
	const maxCount = Math.max(...data.map((d) => d.count), 1)

	return (
		<div className="flex h-32 items-end gap-2">
			{data.slice(0, 10).map((item) => {
				const height = (item.count / maxCount) * 100

				return (
					<div key={item.attempts} className="flex flex-1 flex-col items-center gap-1">
						<div
							className="w-full rounded-t bg-[var(--admin-info)] transition-all hover:bg-[var(--admin-info)]/80"
							style={{ height: `${Math.max(height, 4)}%` }}
						/>
						<span className="text-xs text-[var(--admin-text-muted)]">{item.attempts}</span>
					</div>
				)
			})}
		</div>
	)
}

function PuzzleHistoryTable({
	puzzles,
	isLoading,
}: {
	puzzles: {
		id: string
		puzzleDate: string
		difficulty: 'easy' | 'medium' | 'hard' | null
		seed: number | null
		plays: number
		wins: number
		completionRate: number
	}[]
	isLoading: boolean
}) {
	if (isLoading) {
		return (
			<div className="p-4">
				{[1, 2, 3, 4, 5].map((i) => (
					<div key={i} className="mb-3 h-10 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
				))}
			</div>
		)
	}

	if (puzzles.length === 0) {
		return (
			<div className="p-8 text-center text-[var(--admin-text-muted)]">No puzzle history available</div>
		)
	}

	return (
		<div className="max-h-80 overflow-y-auto">
			<table className="admin-table">
				<thead>
					<tr>
						<th>Date</th>
						<th>Plays</th>
						<th>Win Rate</th>
					</tr>
				</thead>
				<tbody>
					{puzzles.map((puzzle) => (
						<tr key={puzzle.id}>
							<td>
								<div className="flex items-center gap-2">
									<Calendar className="h-4 w-4 text-[var(--admin-text-muted)]" />
									{new Date(puzzle.puzzleDate).toLocaleDateString()}
								</div>
							</td>
							<td>{puzzle.plays}</td>
							<td>
								<span
									className={`font-medium ${
										puzzle.completionRate >= 70
											? 'text-[var(--admin-success)]'
											: puzzle.completionRate >= 40
												? 'text-[var(--admin-warning)]'
												: 'text-[var(--admin-error)]'
									}`}
								>
									{puzzle.completionRate}%
								</span>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function TopPlayersTable({
	players,
}: {
	players: { userId: string; userName: string | null; gamesWon: number; avgScore: number }[]
}) {
	if (players.length === 0) {
		return (
			<div className="p-8 text-center text-[var(--admin-text-muted)]">No player data available</div>
		)
	}

	return (
		<div className="max-h-80 overflow-y-auto">
			<table className="admin-table">
				<thead>
					<tr>
						<th>#</th>
						<th>Player</th>
						<th>Wins</th>
						<th>Avg Score</th>
					</tr>
				</thead>
				<tbody>
					{players.map((player, index) => (
						<tr key={player.userId}>
							<td>
								{index < 3 ? (
									<span
										className={`font-bold ${
											index === 0
												? 'text-yellow-500'
												: index === 1
													? 'text-gray-400'
													: 'text-amber-600'
										}`}
									>
										{index + 1}
									</span>
								) : (
									<span className="text-[var(--admin-text-muted)]">{index + 1}</span>
								)}
							</td>
							<td className="font-medium">{player.userName || 'Anonymous'}</td>
							<td>{player.gamesWon}</td>
							<td>{player.avgScore}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function GameDashboardSkeleton() {
	return (
		<div className="space-y-6">
			{/* Header skeleton */}
			<div className="admin-card p-6">
				<div className="flex items-center gap-4">
					<div className="h-16 w-16 animate-pulse rounded-2xl bg-[var(--admin-bg-surface)]" />
					<div className="space-y-2">
						<div className="h-8 w-48 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
						<div className="h-5 w-32 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
					</div>
				</div>
			</div>

			{/* Stats skeleton */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="admin-card p-5">
						<div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--admin-bg-surface)]" />
						<div className="mt-3 h-8 w-20 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
						<div className="mt-1 h-4 w-24 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
					</div>
				))}
			</div>

			{/* Charts skeleton */}
			<div className="grid gap-6 lg:grid-cols-2">
				{[1, 2].map((i) => (
					<div key={i} className="admin-card p-6">
						<div className="mb-4 h-6 w-32 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
						<div className="h-48 animate-pulse rounded bg-[var(--admin-bg-surface)]" />
					</div>
				))}
			</div>
		</div>
	)
}
