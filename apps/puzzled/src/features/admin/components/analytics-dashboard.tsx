'use client'

import {
	Activity,
	ArrowDownRight,
	ArrowUpRight,
	BarChart3,
	Clock,
	Crown,
	DollarSign,
	Download,
	Flame,
	Gamepad2,
	RefreshCw,
	TrendingUp,
	Users,
	Zap,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { daysAgo } from '@/lib/constants/time'
import { GameIcon } from '@/shared/components/ui/game-icons'
import { trpc } from '@/trpc/client'

type DateRange = '7d' | '14d' | '30d' | '90d'

export function AnalyticsDashboard() {
	const t = useTranslations('admin.analytics')
	const [dateRange, setDateRange] = useState<DateRange>('30d')

	// Calculate dates based on range
	const getDateRange = (range: DateRange) => {
		const now = new Date()
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
		const days = range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : 90
		return { dateFrom: daysAgo(days, today).toISOString(), dateTo: today.toISOString() }
	}

	const { dateFrom, dateTo } = getDateRange(dateRange)

	// Fetch all analytics data
	const {
		data: analytics,
		isLoading: analyticsLoading,
		refetch: refetchAnalytics,
	} = trpc.admin.getAnalytics.useQuery(
		{ dateFrom, dateTo },
		{ refetchInterval: 60000 }, // Auto refresh every minute
	)
	const { data: gameAnalytics, isLoading: gamesLoading } = trpc.admin.getGameAnalytics.useQuery({
		dateFrom,
		dateTo,
	})
	const { data: revenueAnalytics, isLoading: revenueLoading } =
		trpc.admin.getRevenueAnalytics.useQuery({ dateFrom, dateTo })
	const { data: streakAnalytics, isLoading: streaksLoading } =
		trpc.admin.getStreakAnalytics.useQuery()
	const { data: peakHours, isLoading: peakHoursLoading } =
		trpc.admin.getPeakHoursAnalytics.useQuery({ dateFrom, dateTo })
	const { data: realTime, refetch: refetchRealTime } = trpc.admin.getRealTimeStats.useQuery(
		undefined,
		{ refetchInterval: 10000 }, // Refresh every 10 seconds
	)
	const { data: retention, isLoading: retentionLoading } =
		trpc.admin.getRetentionAnalytics.useQuery({ weeks: 4 })

	const isLoading =
		analyticsLoading ||
		gamesLoading ||
		revenueLoading ||
		streaksLoading ||
		peakHoursLoading ||
		retentionLoading

	// Use server-calculated metrics (SSOT)
	const todayDau = analytics?.todayDau ?? 0
	const dauChange = analytics?.dauChange ?? 0

	// Max values for chart scaling (client-side is OK for UI rendering)
	const maxDau = Math.max(...(analytics?.dau?.map((d) => d.count) ?? [1]), 1)
	const maxGames = Math.max(...(analytics?.gamesPlayed?.map((d) => d.count) ?? [1]), 1)

	// CSV Export
	const exportToCsv = () => {
		if (!analytics) return

		const rows = [
			['Date', 'DAU', 'Signups', 'Games Played'],
			...analytics.dau.map((day, i) => [
				new Date(day.date).toLocaleDateString(),
				day.count,
				analytics.signups[i]?.count ?? 0,
				analytics.gamesPlayed[i]?.count ?? 0,
			]),
		]

		const csvContent = rows.map((row) => row.join(',')).join('\n')
		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
		const link = document.createElement('a')
		link.href = URL.createObjectURL(blob)
		link.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`
		link.click()
	}

	return (
		<div className="space-y-8">
			{/* Header with Controls */}
			<div className="admin-animate-in flex items-center justify-between">
				<div>
					<h1 className="admin-page-title">{t('title')}</h1>
					<p className="admin-page-subtitle">{t('subtitle')}</p>
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

					{/* Export Button */}
					<button
						type="button"
						onClick={exportToCsv}
						disabled={isLoading}
						className="admin-btn admin-btn-secondary"
					>
						<Download className="h-4 w-4" />
						{t('export')}
					</button>

					{/* Refresh Button */}
					<button
						type="button"
						onClick={() => {
							refetchAnalytics()
							refetchRealTime()
						}}
						disabled={isLoading}
						className="admin-btn admin-btn-ghost"
					>
						<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
					</button>
				</div>
			</div>

			{/* Real-time Stats Bar */}
			{realTime && (
				<div
					className="admin-card admin-animate-in flex items-center justify-between p-4"
					style={{ animationDelay: '0.05s' }}
				>
					<div className="flex items-center gap-6">
						<div className="flex items-center gap-2">
							<span className="relative flex h-3 w-3">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
								<span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
							</span>
							<span className="text-sm font-medium text-[var(--admin-text-primary)]">
								{t('liveStats')}
							</span>
						</div>
						<div className="flex items-center gap-4 text-sm">
							<span className="text-[var(--admin-text-muted)]">
								<Zap className="mr-1 inline h-4 w-4 text-amber-400" />
								{realTime.activePlayers} {t('activePlayers')}
							</span>
							<span className="text-[var(--admin-text-muted)]">
								<Gamepad2 className="mr-1 inline h-4 w-4 text-purple-400" />
								{realTime.gamesLastHour} {t('gamesLastHour')}
							</span>
							<span className="text-[var(--admin-text-muted)]">
								<Users className="mr-1 inline h-4 w-4 text-blue-400" />
								{realTime.today.signups} {t('signupsToday')}
							</span>
						</div>
					</div>
					<span className="text-xs text-[var(--admin-text-muted)]">
						{t('lastUpdated')}: {new Date(realTime.timestamp).toLocaleTimeString()}
					</span>
				</div>
			)}

			{/* Key Metrics */}
			<div className="admin-metrics-grid-4">
				<MetricCard
					title={t('dau')}
					value={todayDau.toLocaleString()}
					change={dauChange}
					icon={Users}
					loading={analyticsLoading}
					delay={0}
				/>
				<MetricCard
					title={t('wau')}
					value={(analytics?.wau ?? 0).toLocaleString()}
					icon={Activity}
					loading={analyticsLoading}
					delay={1}
				/>
				<MetricCard
					title={t('mau')}
					value={(analytics?.mau ?? 0).toLocaleString()}
					icon={TrendingUp}
					loading={analyticsLoading}
					delay={2}
				/>
				<MetricCard
					title={t('mrr')}
					value={`$${((revenueAnalytics?.mrr ?? 0) / 100).toFixed(0)}`}
					change={revenueAnalytics?.churnRate ? -revenueAnalytics.churnRate : undefined}
					icon={DollarSign}
					loading={revenueLoading}
					accentColor="emerald"
					delay={3}
				/>
			</div>

			{/* Charts Row */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* DAU Chart */}
				<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.2s' }}>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">
							{t('dauChart')}
						</h2>
						<span className="text-sm text-[var(--admin-text-muted)]">
							{t('last')} {dateRange}
						</span>
					</div>
					{analyticsLoading ? (
						<div className="flex h-48 items-center justify-center">
							<RefreshCw className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
						</div>
					) : (
						<div className="admin-chart-container">
							<div className="admin-bar-chart">
								{analytics?.dau?.slice(-14).map((day, i) => (
									<div
										key={day.date}
										className="admin-bar"
										style={{ height: `${(day.count / maxDau) * 100}%` }}
									>
										<span className="admin-bar-value">{day.count}</span>
										{i % 2 === 0 && (
											<span className="admin-bar-label">
												{new Date(day.date).toLocaleDateString('en', {
													month: 'short',
													day: 'numeric',
												})}
											</span>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Games Played Chart */}
				<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.25s' }}>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">
							{t('gamesChart')}
						</h2>
						<span className="text-sm text-[var(--admin-text-muted)]">
							{t('last')} {dateRange}
						</span>
					</div>
					{analyticsLoading ? (
						<div className="flex h-48 items-center justify-center">
							<RefreshCw className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
						</div>
					) : (
						<div className="admin-chart-container">
							<div className="admin-bar-chart">
								{analytics?.gamesPlayed?.slice(-14).map((day, i) => (
									<div
										key={day.date}
										className="admin-bar"
										style={{
											height: `${(day.count / maxGames) * 100}%`,
											background: 'var(--admin-info)',
										}}
									>
										<span className="admin-bar-value">{day.count}</span>
										{i % 2 === 0 && (
											<span className="admin-bar-label">
												{new Date(day.date).toLocaleDateString('en', {
													month: 'short',
													day: 'numeric',
												})}
											</span>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Game Analytics */}
			<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.3s' }}>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">
						<Gamepad2 className="mr-2 inline h-5 w-5" />
						{t('gameAnalytics')}
					</h2>
				</div>
				{gamesLoading ? (
					<div className="flex h-32 items-center justify-center">
						<RefreshCw className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="admin-table w-full">
							<thead>
								<tr>
									<th>{t('game')}</th>
									<th className="text-right">{t('plays')}</th>
									<th className="text-right">{t('completions')}</th>
									<th className="text-right">{t('completionRate')}</th>
									<th className="text-right">{t('uniquePlayers')}</th>
									<th className="text-right">{t('avgScore')}</th>
								</tr>
							</thead>
							<tbody>
								{gameAnalytics?.games?.map((game) => (
									<tr key={game.slug}>
										<td>
											<div className="flex items-center gap-2">
												<GameIcon
													slug={game.slug}
													size={20}
													className="text-[var(--admin-text-secondary)]"
												/>
												<span className="font-medium">{game.name}</span>
											</div>
										</td>
										<td className="text-right font-mono">{game.plays.toLocaleString()}</td>
										<td className="text-right font-mono">{game.completions.toLocaleString()}</td>
										<td className="text-right">
											<span
												className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
													game.completionRate >= 70
														? 'bg-emerald-500/20 text-emerald-400'
														: game.completionRate >= 40
															? 'bg-amber-500/20 text-amber-400'
															: 'bg-red-500/20 text-red-400'
												}`}
											>
												{game.completionRate}%
											</span>
										</td>
										<td className="text-right font-mono">{game.uniquePlayers.toLocaleString()}</td>
										<td className="text-right font-mono">{game.avgScore}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Revenue & Streaks Row */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Revenue Analytics */}
				<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.35s' }}>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">
							<DollarSign className="mr-2 inline h-5 w-5 text-emerald-400" />
							{t('revenue')}
						</h2>
					</div>
					{revenueLoading ? (
						<div className="flex h-32 items-center justify-center">
							<RefreshCw className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
						</div>
					) : (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="rounded-lg bg-[var(--admin-bg-surface)] p-4">
									<div className="text-2xl font-bold text-emerald-400">
										${((revenueAnalytics?.mrr ?? 0) / 100).toFixed(0)}
									</div>
									<div className="text-sm text-[var(--admin-text-muted)]">MRR</div>
								</div>
								<div className="rounded-lg bg-[var(--admin-bg-surface)] p-4">
									<div className="text-2xl font-bold text-emerald-400">
										${((revenueAnalytics?.arr ?? 0) / 100).toFixed(0)}
									</div>
									<div className="text-sm text-[var(--admin-text-muted)]">ARR</div>
								</div>
							</div>
							<div className="flex justify-between border-t border-[var(--admin-border)] pt-4">
								<div>
									<div className="text-lg font-semibold text-[var(--admin-text-primary)]">
										{revenueAnalytics?.activeSubscriptions ?? 0}
									</div>
									<div className="text-xs text-[var(--admin-text-muted)]">
										{t('activeSubscribers')}
									</div>
								</div>
								<div>
									<div className="text-lg font-semibold text-red-400">
										{revenueAnalytics?.churned ?? 0}
									</div>
									<div className="text-xs text-[var(--admin-text-muted)]">{t('churned')}</div>
								</div>
								<div>
									<div className="text-lg font-semibold text-amber-400">
										{revenueAnalytics?.churnRate ?? 0}%
									</div>
									<div className="text-xs text-[var(--admin-text-muted)]">{t('churnRate')}</div>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Streak Analytics */}
				<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.4s' }}>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">
							<Flame className="mr-2 inline h-5 w-5 text-orange-400" />
							{t('streakAnalytics')}
						</h2>
					</div>
					{streaksLoading ? (
						<div className="flex h-32 items-center justify-center">
							<RefreshCw className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
						</div>
					) : (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="rounded-lg bg-[var(--admin-bg-surface)] p-4">
									<div className="text-2xl font-bold text-orange-400">
										{streakAnalytics?.averageStreak.toFixed(1) ?? 0}
									</div>
									<div className="text-sm text-[var(--admin-text-muted)]">{t('avgStreak')}</div>
								</div>
								<div className="rounded-lg bg-[var(--admin-bg-surface)] p-4">
									<div className="text-2xl font-bold text-orange-400">
										{streakAnalytics?.activeStreaks ?? 0}
									</div>
									<div className="text-sm text-[var(--admin-text-muted)]">{t('activeStreaks')}</div>
								</div>
							</div>
							<div className="space-y-2">
								<div className="text-sm font-medium text-[var(--admin-text-secondary)]">
									{t('distribution')}
								</div>
								{streakAnalytics?.distribution?.map((bucket) => (
									<div key={bucket.range} className="flex items-center gap-2">
										<span className="w-16 text-xs text-[var(--admin-text-muted)]">
											{bucket.range}
										</span>
										<div className="flex-1 rounded-full bg-[var(--admin-bg-surface)] h-2">
											<div
												className="h-2 rounded-full bg-orange-400"
												style={{
													width: `${(bucket.count / (streakAnalytics?.activeStreaks || 1)) * 100}%`,
												}}
											/>
										</div>
										<span className="w-12 text-right text-xs font-mono text-[var(--admin-text-muted)]">
											{bucket.count}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Peak Hours & Retention Row */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Peak Hours Heatmap */}
				<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.45s' }}>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">
							<Clock className="mr-2 inline h-5 w-5 text-blue-400" />
							{t('peakHours')}
						</h2>
					</div>
					{peakHoursLoading ? (
						<div className="flex h-32 items-center justify-center">
							<RefreshCw className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
						</div>
					) : (
						<div className="space-y-4">
							{/* By Day of Week */}
							<div>
								<div className="mb-2 text-sm text-[var(--admin-text-muted)]">
									{t('byDayOfWeek')}
								</div>
								<div className="flex gap-1">
									{peakHours?.byDayOfWeek?.map((day) => {
										const maxCount = Math.max(
											...(peakHours?.byDayOfWeek?.map((d) => d.count) ?? [1]),
											1,
										)
										const intensity = day.count / maxCount
										return (
											<div
												key={day.day}
												className="flex-1 rounded p-2 text-center"
												style={{
													background: `rgba(59, 130, 246, ${0.1 + intensity * 0.5})`,
												}}
												title={`${day.count} games`}
											>
												<div className="text-xs font-medium text-[var(--admin-text-primary)]">
													{day.day}
												</div>
												<div className="text-xs text-[var(--admin-text-muted)]">{day.count}</div>
											</div>
										)
									})}
								</div>
							</div>
							{/* Peak Hour */}
							<div className="flex items-center justify-between rounded-lg bg-[var(--admin-bg-surface)] p-4">
								<div>
									<div className="text-sm text-[var(--admin-text-muted)]">{t('peakHour')}</div>
									<div className="text-lg font-semibold text-[var(--admin-text-primary)]">
										{peakHours?.peakHour?.hour}:00 - {peakHours?.peakHour?.hour}:59 UTC
									</div>
								</div>
								<div className="text-right">
									<div className="text-sm text-[var(--admin-text-muted)]">{t('peakDay')}</div>
									<div className="text-lg font-semibold text-[var(--admin-text-primary)]">
										{peakHours?.peakDay?.day}
									</div>
								</div>
							</div>
						</div>
					)}
				</div>

				{/* Retention Cohorts */}
				<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.5s' }}>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">
							<TrendingUp className="mr-2 inline h-5 w-5 text-purple-400" />
							{t('retentionCohorts')}
						</h2>
					</div>
					{retentionLoading ? (
						<div className="flex h-32 items-center justify-center">
							<RefreshCw className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="admin-table w-full text-sm">
								<thead>
									<tr>
										<th>{t('cohort')}</th>
										<th className="text-right">{t('size')}</th>
										<th className="text-right">D1</th>
										<th className="text-right">D7</th>
										<th className="text-right">D14</th>
										<th className="text-right">D30</th>
									</tr>
								</thead>
								<tbody>
									{retention?.cohorts?.map((cohort, i) => (
										<tr key={cohort.weekOffset}>
											<td className="text-[var(--admin-text-muted)]">
												{i === 0
													? t('thisWeek')
													: i === 1
														? t('lastWeek')
														: `${cohort.weekOffset}w ago`}
											</td>
											<td className="text-right font-mono">{cohort.size}</td>
											<td className="text-right">
												<RetentionCell value={cohort.d1} />
											</td>
											<td className="text-right">
												<RetentionCell value={cohort.d7} />
											</td>
											<td className="text-right">
												<RetentionCell value={cohort.d14} />
											</td>
											<td className="text-right">
												<RetentionCell value={cohort.d30} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			</div>

			{/* Conversion Funnel */}
			<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.55s' }}>
				<h2 className="mb-4 text-lg font-semibold text-[var(--admin-text-primary)]">
					<BarChart3 className="mr-2 inline h-5 w-5" />
					{t('conversionFunnel')}
				</h2>
				{analyticsLoading ? (
					<div className="flex h-24 items-center justify-center">
						<RefreshCw className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
					</div>
				) : (
					<div className="admin-funnel">
						<FunnelStep
							label={t('signups')}
							value={analytics?.funnel?.signups ?? 0}
							percentage={100}
						/>
						<FunnelStep
							label={t('playedGame')}
							value={analytics?.funnel?.playedGame ?? 0}
							percentage={
								analytics?.funnel?.signups
									? Math.round((analytics.funnel.playedGame / analytics.funnel.signups) * 100)
									: 0
							}
						/>
						<FunnelStep
							label={t('subscribed')}
							value={analytics?.funnel?.subscribed ?? 0}
							percentage={
								analytics?.funnel?.signups
									? Math.round((analytics.funnel.subscribed / analytics.funnel.signups) * 100)
									: 0
							}
							color="var(--admin-success)"
						/>
					</div>
				)}
			</div>

			{/* Top Streakers */}
			{streakAnalytics?.topStreakers && streakAnalytics.topStreakers.length > 0 && (
				<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.6s' }}>
					<div className="mb-4 flex items-center justify-between">
						<h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">
							<Crown className="mr-2 inline h-5 w-5 text-amber-400" />
							{t('topStreakers')}
						</h2>
					</div>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
						{streakAnalytics.topStreakers.slice(0, 5).map((user, i) => (
							<div
								key={user.id}
								className="flex items-center gap-3 rounded-lg bg-[var(--admin-bg-surface)] p-3"
							>
								<div
									className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
										i === 0
											? 'bg-amber-500/20 text-amber-400'
											: i === 1
												? 'bg-gray-400/20 text-gray-400'
												: i === 2
													? 'bg-orange-700/20 text-orange-600'
													: 'bg-[var(--admin-bg-elevated)] text-[var(--admin-text-muted)]'
									}`}
								>
									{i + 1}
								</div>
								<div className="flex-1 min-w-0">
									<div className="truncate text-sm font-medium text-[var(--admin-text-primary)]">
										{user.name || user.email}
									</div>
									<div className="flex items-center gap-1 text-xs text-[var(--admin-text-muted)]">
										<Flame className="h-3 w-3 text-orange-400" />
										{user.currentStreak} days
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

// Metric Card Component
function MetricCard({
	title,
	value,
	change,
	icon: Icon,
	loading = false,
	accentColor = 'default',
	delay = 0,
}: {
	title: string
	value: string
	change?: number
	icon: typeof Users
	loading?: boolean
	accentColor?: 'default' | 'emerald' | 'purple' | 'amber'
	delay?: number
}) {
	const isPositive = change !== undefined && change >= 0
	const hasChange = change !== undefined

	const iconColors = {
		default: 'bg-[var(--admin-accent-subtle)] text-[var(--admin-accent)]',
		emerald: 'bg-emerald-500/15 text-emerald-400',
		purple: 'bg-purple-500/15 text-purple-400',
		amber: 'bg-amber-500/15 text-amber-400',
	}

	return (
		<div
			className="admin-stat-card-enhanced admin-animate-in"
			style={{ animationDelay: `${delay * 0.05}s` }}
		>
			{loading ? (
				<div className="flex h-20 items-center justify-center">
					<RefreshCw className="h-5 w-5 animate-spin text-[var(--admin-text-muted)]" />
				</div>
			) : (
				<>
					<div className="admin-stat-header">
						<div>
							<div className="text-sm text-[var(--admin-text-muted)]">{title}</div>
							<div className="mt-1 text-2xl font-bold text-[var(--admin-text-primary)]">
								{value}
							</div>
						</div>
						<div
							className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconColors[accentColor]}`}
						>
							<Icon className="h-5 w-5" />
						</div>
					</div>
					{hasChange && (
						<div className="mt-2 flex items-center gap-1">
							{isPositive ? (
								<ArrowUpRight className="h-4 w-4 text-[var(--admin-success)]" />
							) : (
								<ArrowDownRight className="h-4 w-4 text-[var(--admin-error)]" />
							)}
							<span
								className={`text-sm font-medium ${isPositive ? 'text-[var(--admin-success)]' : 'text-[var(--admin-error)]'}`}
							>
								{isPositive ? '+' : ''}
								{change}%
							</span>
						</div>
					)}
				</>
			)}
		</div>
	)
}

// Retention Cell Component
function RetentionCell({ value }: { value: number }) {
	let bgColor = 'bg-red-500/20 text-red-400'
	if (value >= 40) bgColor = 'bg-emerald-500/20 text-emerald-400'
	else if (value >= 20) bgColor = 'bg-amber-500/20 text-amber-400'
	else if (value >= 10) bgColor = 'bg-blue-500/20 text-blue-400'

	return (
		<span
			className={`inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-medium ${bgColor}`}
		>
			{value}%
		</span>
	)
}

// Funnel Step Component
function FunnelStep({
	label,
	value,
	percentage,
	color = 'var(--admin-accent)',
}: {
	label: string
	value: number
	percentage: number
	color?: string
}) {
	return (
		<div className="admin-funnel-step">
			<span className="admin-funnel-label">{label}</span>
			<div className="admin-funnel-bar" style={{ width: `${percentage}%`, background: color }}>
				{percentage}%
			</div>
			<span className="admin-funnel-value">{value.toLocaleString()}</span>
		</div>
	)
}
