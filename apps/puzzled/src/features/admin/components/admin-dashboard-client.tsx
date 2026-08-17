'use client'

import {
	AlertTriangle,
	ArrowRight,
	Gamepad2,
	RefreshCw,
	Server,
	Settings,
	TrendingUp,
	Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useAuditLogs, useDlqList, useGamesOverview, useSystemHealth } from '@/lib/api'
import { MINUTE_MS } from '@/lib/constants/time'

type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown'

export function AdminDashboardClient() {
	const t = useTranslations('admin.dashboard')
	const locale = useLocale()
	const gamesQuery = useGamesOverview({ refetchInterval: MINUTE_MS })
	const dlqQuery = useDlqList({ limit: 1 }, { refetchInterval: MINUTE_MS })
	const auditQuery = useAuditLogs({ limit: 8 }, { refetchInterval: MINUTE_MS })
	const healthQuery = useSystemHealth()

	const games = gamesQuery.data
	const dlq = dlqQuery.data
	const auditLogs = auditQuery.data?.logs
	const totalGames = games?.reduce((sum, game) => sum + game.allTimeGamesPlayed, 0)
	const gamesToday = games?.reduce((sum, game) => sum + game.todayGamesPlayed, 0)
	const pendingDlq = dlq?.stats.pending
	const failedDlq = dlq?.stats.failed
	const refreshAll = () => {
		void Promise.all([
			gamesQuery.refetch(),
			dlqQuery.refetch(),
			auditQuery.refetch(),
			healthQuery.refetch(),
		])
	}
	const isRefreshing =
		gamesQuery.isFetching || dlqQuery.isFetching || auditQuery.isFetching || healthQuery.isFetching

	return (
		<div className="space-y-8">
			{/* System Health Bar */}
			<div className="admin-health-bar">
				<div className="flex items-center gap-2">
					<Server className="h-4 w-4 text-[var(--admin-text-muted)]" aria-hidden="true" />
					<span className="text-sm font-medium text-[var(--admin-text-primary)]">
						{t('systemStatus')}
					</span>
				</div>

				<div className="flex flex-1 items-center gap-4">
					<HealthIndicator
						status={
							healthQuery.data ? (healthQuery.data.database ? 'healthy' : 'error') : 'unknown'
						}
						label={t('database')}
					/>
					<HealthIndicator
						status={
							dlq
								? failedDlq && failedDlq > 0
									? 'error'
									: pendingDlq && pendingDlq > 0
										? 'warning'
										: 'healthy'
								: 'unknown'
						}
						label={`${t('dlq')}: ${pendingDlq === undefined ? t('unavailable') : pendingDlq}`}
					/>
				</div>

				<div className="flex items-center gap-3">
					<span className="text-xs text-[var(--admin-text-muted)]">{t('source')}</span>
					<button
						type="button"
						className="admin-btn admin-btn-ghost p-2"
						onClick={refreshAll}
						disabled={isRefreshing}
						aria-label={t('refresh')}
					>
						<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
					</button>
				</div>
			</div>

			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t('title')}</h1>
				<p className="admin-page-subtitle">{t('subtitle')}</p>
			</div>

			{/* App Stats Grid */}
			<div className="admin-metrics-grid admin-metrics-grid-4">
				<EnhancedStatCard
					title={t('gameSessions')}
					value={formatMetric(totalGames, locale, t('unavailable'))}
					icon={Gamepad2}
					accentColor="purple"
					delay={0}
				/>
				<EnhancedStatCard
					title={t('gamesPlayedToday')}
					value={formatMetric(gamesToday, locale, t('unavailable'))}
					icon={TrendingUp}
					accentColor="emerald"
					delay={1}
				/>
				<EnhancedStatCard
					title={t('dlqPending')}
					value={formatMetric(pendingDlq, locale, t('unavailable'))}
					icon={AlertTriangle}
					accentColor="amber"
					delay={2}
				/>
				<EnhancedStatCard
					title={t('dlqFailed')}
					value={formatMetric(failedDlq, locale, t('unavailable'))}
					icon={AlertTriangle}
					accentColor="default"
					delay={3}
				/>
			</div>

			{/* Quick Actions */}
			<div className="admin-dashboard-section">
				<div className="admin-section-header">
					<div>
						<h2 className="admin-section-title">{t('quickActions')}</h2>
						<p className="admin-section-subtitle">{t('quickActionsDescription')}</p>
					</div>
				</div>

				<div className="admin-quick-actions">
					<QuickAction
						href="/admin/dlq"
						icon={AlertTriangle}
						label={t('reviewDLQ')}
						color="amber"
					/>
					<QuickAction href="/admin/games" icon={Gamepad2} label={t('gameStats')} color="purple" />
					<QuickAction
						href="/admin/audit-logs"
						icon={TrendingUp}
						label={t('auditLogs')}
						color="blue"
					/>
					<QuickAction href="/admin/settings" icon={Settings} label={t('settings')} color="muted" />
				</div>
			</div>

			{/* Activity Feed */}
			<div className="admin-activity-feed admin-animate-in" style={{ animationDelay: '0.25s' }}>
				<div className="admin-activity-header">
					<span className="admin-activity-title">{t('recentActivity')}</span>
					<Link href="/admin/audit-logs" className="admin-btn admin-btn-ghost text-xs">
						{t('viewAll')}
					</Link>
				</div>
				<div className="admin-activity-list">
					{auditQuery.isLoading && !auditLogs ? (
						<LoadingState label={t('loading')} />
					) : auditQuery.error && !auditLogs ? (
						<InlineError label={t('error')} onRetry={() => auditQuery.refetch()} t={t} />
					) : auditLogs && auditLogs.length > 0 ? (
						auditLogs.map((log) => <ActivityItem key={log.id} log={log} locale={locale} />)
					) : (
						<div className="px-5 py-12 text-center text-[var(--admin-text-muted)]">
							{t('noActivity')}
						</div>
					)}
				</div>
			</div>

			{/* Key Metrics Summary */}
			<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.35s' }}>
				<div className="mb-4 flex items-center justify-between">
					<h3 className="font-semibold text-[var(--admin-text-primary)]">{t('keyMetrics')}</h3>
					<span className="text-xs text-[var(--admin-text-muted)]">{t('source')}</span>
				</div>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="admin-metric-row border-none py-0">
						<span className="admin-metric-label">{t('gamesPlayedToday')}</span>
						<span className="admin-metric-value">
							{formatMetric(gamesToday, locale, t('unavailable'))}
						</span>
					</div>
					<div className="admin-metric-row border-none py-0">
						<span className="admin-metric-label">{t('failedJobs')}</span>
						<span className="admin-metric-value">
							{formatMetric(failedDlq, locale, t('unavailable'))}
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}

function formatMetric(value: number | undefined, locale: string, unavailable: string) {
	return value === undefined ? unavailable : value.toLocaleString(locale)
}

function QuickAction({
	href,
	icon: Icon,
	label,
	color,
}: {
	href: string
	icon: typeof AlertTriangle
	label: string
	color: 'amber' | 'purple' | 'blue' | 'muted'
}) {
	const colors = {
		amber: { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
		purple: { background: 'rgba(168, 85, 247, 0.15)', color: '#a78bfa' },
		blue: { background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
		muted: { background: 'var(--admin-bg-surface)', color: 'var(--admin-text-secondary)' },
	}

	return (
		<Link href={href} className="admin-quick-action">
			<div className="admin-quick-action-icon" style={colors[color]}>
				<Icon className="h-5 w-5" aria-hidden="true" />
			</div>
			<span className="admin-quick-action-label">{label}</span>
			<ArrowRight className="ml-auto h-4 w-4 text-[var(--admin-text-muted)]" aria-hidden="true" />
		</Link>
	)
}

function LoadingState({ label }: { label: string }) {
	return (
		<div className="flex items-center justify-center gap-3 px-5 py-12 text-[var(--admin-text-muted)]">
			<RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
			<span>{label}</span>
		</div>
	)
}

function InlineError({
	label,
	onRetry,
	t,
}: {
	label: string
	onRetry: () => void
	t: ReturnType<typeof useTranslations<'admin.dashboard'>>
}) {
	return (
		<div className="space-y-2 px-5 py-10 text-center">
			<p className="text-sm font-medium text-[var(--admin-error)]">{label}</p>
			<p className="text-xs text-[var(--admin-text-muted)]">{t('errorHint')}</p>
			<button type="button" className="admin-btn admin-btn-ghost" onClick={() => onRetry()}>
				<RefreshCw className="h-4 w-4" />
				{t('retry')}
			</button>
		</div>
	)
}

function HealthIndicator({ status, label }: { status: HealthStatus; label: string }) {
	const dotClass = {
		healthy: 'admin-health-dot-success',
		warning: 'admin-health-dot-warning',
		error: 'admin-health-dot-error',
		unknown: 'bg-[var(--admin-text-muted)]',
	}

	return (
		<div className="admin-health-indicator">
			<span className={`admin-health-dot ${dotClass[status]}`} />
			<span className="text-[var(--admin-text-secondary)]">{label}</span>
		</div>
	)
}

function EnhancedStatCard({
	title,
	value,
	icon: Icon,
	accentColor = 'default',
	delay = 0,
}: {
	title: string
	value: string | number
	icon: typeof Gamepad2
	accentColor?: 'default' | 'emerald' | 'purple' | 'amber'
	delay?: number
}) {
	const iconColors = {
		default: 'admin-stat-icon',
		emerald: 'admin-stat-icon-success',
		purple: 'bg-purple-500/15 text-purple-400',
		amber: 'admin-stat-icon-warning',
	}

	return (
		<div
			className="admin-stat-card-enhanced admin-animate-in"
			style={{ animationDelay: `${delay * 0.05}s` }}
		>
			<div className="admin-stat-header">
				<div className={`rounded-lg p-2.5 ${iconColors[accentColor]}`}>
					<Icon className="h-5 w-5" aria-hidden="true" />
				</div>
			</div>

			<div className="admin-stat-main">
				<span className="admin-stat-value-lg">{value}</span>
			</div>
			<div className="admin-stat-label mt-1">{title}</div>
		</div>
	)
}

function ActivityItem({
	log,
	locale,
}: {
	log: { id: string; action: string; actorId: string | null; createdAt: Date }
	locale: string
}) {
	const iconMap: Record<string, { icon: typeof Gamepad2; className: string }> = {
		game: { icon: Gamepad2, className: 'admin-activity-icon-game' },
		achievement: { icon: TrendingUp, className: 'admin-activity-icon-payment' },
		streak: { icon: Zap, className: 'admin-activity-icon-system' },
		admin: { icon: Settings, className: 'admin-activity-icon-user' },
	}

	const actionType = log.action.split('_')[0] || 'admin'
	const { icon: ActivityIcon, className: iconClass } = iconMap[actionType] || iconMap.admin

	return (
		<div className="admin-activity-item">
			<div className={`admin-activity-icon ${iconClass}`}>
				<ActivityIcon className="h-4 w-4" aria-hidden="true" />
			</div>
			<div className="admin-activity-content">
				<div className="admin-activity-text">
					<span className="text-[var(--admin-text-secondary)]">{formatAction(log.action)}</span>
				</div>
				<div className="admin-activity-time">{formatRelativeTime(log.createdAt, locale)}</div>
			</div>
		</div>
	)
}

function formatAction(action: string): string {
	return action.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatRelativeTime(date: Date, locale: string): string {
	const diffMs = Date.now() - new Date(date).getTime()
	const diffSeconds = Math.floor(diffMs / 1000)
	const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })

	if (Math.abs(diffSeconds) < 60) return relative.format(-diffSeconds, 'second')
	const diffMinutes = Math.floor(diffSeconds / 60)
	if (Math.abs(diffMinutes) < 60) return relative.format(-diffMinutes, 'minute')
	const diffHours = Math.floor(diffMinutes / 60)
	if (Math.abs(diffHours) < 24) return relative.format(-diffHours, 'hour')
	const diffDays = Math.floor(diffHours / 24)
	if (Math.abs(diffDays) < 7) return relative.format(-diffDays, 'day')

	return new Date(date).toLocaleDateString(locale)
}
