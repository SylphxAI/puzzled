export const dynamic = 'force-dynamic'

import { count, desc, eq, gte, sql } from 'drizzle-orm'
import { daysAgo } from '@/lib/constants/time'
import {
	Activity,
	AlertTriangle,
	ArrowDownRight,
	ArrowUpRight,
	Gamepad2,
	Server,
	Settings,
	TrendingUp,
	Users,
	Zap,
} from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { createServerClient } from '@sylphx/platform-sdk/server'
import { env } from '@/lib/env'
import { db } from '@/lib/db'
import { auditLogs, deadLetterQueue, gameSessions } from '@/lib/db/schema'

/**
 * Admin Dashboard
 *
 * Shows app-specific metrics (games, DLQ) and platform metrics (users, revenue).
 * Platform handles user/billing management; this page provides overview only.
 */

// Get comprehensive dashboard stats
async function getDashboardStats() {
	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const sevenDaysAgo = daysAgo(7, today)

	// Platform metrics (users, billing) from SDK
	const sylphx = createServerClient({
		appId: env.SYLPHX_APP_ID,
		secretKey: env.SYLPHX_SECRET_KEY,
	})

	// App-specific metrics from local database
	const [
		sessionCount,
		sessionsThisWeek,
		dlqPending,
		dlqFailed,
		platformOverview,
	] = await Promise.all([
		db.select({ count: count() }).from(gameSessions),
		db
			.select({ count: count() })
			.from(gameSessions)
			.where(gte(gameSessions.completedAt, sevenDaysAgo)),
		db
			.select({ count: count() })
			.from(deadLetterQueue)
			.where(eq(deadLetterQueue.status, 'pending')),
		db
			.select({ count: count() })
			.from(deadLetterQueue)
			.where(eq(deadLetterQueue.status, 'failed')),
		sylphx.analytics.overview().catch(() => null),
	])

	return {
		// Platform stats (from SDK)
		users: platformOverview?.totalUsers ?? 0,
		premium: platformOverview?.subscriptions.active ?? 0,
		mrr: platformOverview?.revenue.month ?? 0,
		newUsersThisWeek: platformOverview?.newUsers.week ?? 0,
		// App-specific stats (from local DB)
		sessions: sessionCount[0]?.count ?? 0,
		sessionsThisWeek: sessionsThisWeek[0]?.count ?? 0,
		dlqPending: dlqPending[0]?.count ?? 0,
		dlqFailed: dlqFailed[0]?.count ?? 0,
	}
}

// Get recent activity from audit logs
async function getRecentActivity() {
	const logs = await db.query.auditLogs.findMany({
		orderBy: desc(auditLogs.createdAt),
		limit: 8,
	})

	return logs
}

export default async function AdminDashboard() {
	const locale = await getLocale()
	const t = await getTranslations('admin.dashboard')
	const [stats, recentActivity] = await Promise.all([
		getDashboardStats(),
		getRecentActivity(),
	])

	// System health status
	const systemHealth = stats.dlqFailed > 0 ? 'error' : stats.dlqPending > 5 ? 'warning' : 'healthy'

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
					<HealthIndicator status={systemHealth} label={t('services')} />
					<HealthIndicator
						status={stats.dlqPending > 0 ? 'warning' : 'healthy'}
						label={`DLQ: ${stats.dlqPending}`}
					/>
					<HealthIndicator status="healthy" label={t('database')} />
				</div>

				<div className="admin-live-indicator">
					<span className="admin-live-dot" />
					{t('live')}
				</div>
			</div>

			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t('title')}</h1>
				<p className="admin-page-subtitle">{t('subtitle')}</p>
			</div>

			{/* Enhanced Stats Grid */}
			<div className="admin-metrics-grid admin-metrics-grid-4">
				<EnhancedStatCard
					title={t('totalUsers')}
					value={stats.users}
					icon={Users}
					delay={0}
				/>
				<EnhancedStatCard
					title={t('gameSessions')}
					value={stats.sessions}
					icon={Gamepad2}
					accentColor="purple"
					delay={1}
				/>
				<EnhancedStatCard
					title={t('premiumUsers')}
					value={stats.premium}
					icon={TrendingUp}
					accentColor="emerald"
					delay={2}
				/>
				<EnhancedStatCard
					title={t('estMRR')}
					value={`$${stats.mrr.toFixed(0)}`}
					icon={TrendingUp}
					accentColor="amber"
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
					<Link href="/admin/dlq" className="admin-quick-action">
						<div
							className="admin-quick-action-icon"
							style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}
						>
							<AlertTriangle className="h-5 w-5" aria-hidden="true" />
						</div>
						<span className="admin-quick-action-label">{t('reviewDLQ')}</span>
					</Link>

					<Link href="/admin/games" className="admin-quick-action">
						<div
							className="admin-quick-action-icon"
							style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a78bfa' }}
						>
							<Gamepad2 className="h-5 w-5" aria-hidden="true" />
						</div>
						<span className="admin-quick-action-label">{t('gameStats')}</span>
					</Link>

					<Link href="/admin/audit-logs" className="admin-quick-action">
						<div
							className="admin-quick-action-icon"
							style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}
						>
							<Activity className="h-5 w-5" aria-hidden="true" />
						</div>
						<span className="admin-quick-action-label">{t('auditLogs')}</span>
					</Link>

					<Link href="/admin/settings" className="admin-quick-action">
						<div
							className="admin-quick-action-icon"
							style={{
								background: 'var(--admin-bg-surface)',
								color: 'var(--admin-text-secondary)',
							}}
						>
							<Settings className="h-5 w-5" aria-hidden="true" />
						</div>
						<span className="admin-quick-action-label">{t('settings')}</span>
					</Link>
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
					{recentActivity.length === 0 ? (
						<div className="px-5 py-12 text-center text-[var(--admin-text-muted)]">
							{t('noActivity')}
						</div>
					) : (
						recentActivity.map((log) => <ActivityItem key={log.id} log={log} locale={locale} />)
					)}
				</div>
			</div>

			{/* Key Metrics Summary */}
			<div className="admin-card admin-animate-in p-6" style={{ animationDelay: '0.35s' }}>
				<div className="mb-4 flex items-center justify-between">
					<h3 className="font-semibold text-[var(--admin-text-primary)]">{t('keyMetrics')}</h3>
					<span className="text-xs text-[var(--admin-text-muted)]">{t('last7Days')}</span>
				</div>
				<div className="grid gap-4 sm:grid-cols-3">
					<div className="admin-metric-row border-none py-0">
						<span className="admin-metric-label">{t('newUsers')}</span>
						<span className="admin-metric-value">{stats.newUsersThisWeek}</span>
					</div>
					<div className="admin-metric-row border-none py-0">
						<span className="admin-metric-label">{t('gamesPlayed')}</span>
						<span className="admin-metric-value">{stats.sessionsThisWeek}</span>
					</div>
					<div className="admin-metric-row border-none py-0">
						<span className="admin-metric-label">{t('conversionRate')}</span>
						<span className="admin-metric-value">
							{stats.users > 0 ? ((stats.premium / stats.users) * 100).toFixed(1) : 0}%
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}

// System Health Indicator
function HealthIndicator({
	status,
	label,
}: {
	status: 'healthy' | 'warning' | 'error'
	label: string
}) {
	const dotClass = {
		healthy: 'admin-health-dot-success',
		warning: 'admin-health-dot-warning',
		error: 'admin-health-dot-error',
	}

	return (
		<div className="admin-health-indicator">
			<span className={`admin-health-dot ${dotClass[status]}`} />
			<span className="text-[var(--admin-text-secondary)]">{label}</span>
		</div>
	)
}

// Enhanced Stat Card
function EnhancedStatCard({
	title,
	value,
	icon: Icon,
	accentColor = 'default',
	delay = 0,
}: {
	title: string
	value: string | number
	icon: typeof Users
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

// Activity Item
function ActivityItem({
	log,
	locale,
}: {
	log: {
		id: string
		action: string
		actorId: string | null
		metadata: unknown
		createdAt: Date
	}
	locale: string
}) {
	const iconMap: Record<string, { icon: typeof Activity; className: string }> = {
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

// Helper: Format action string
function formatAction(action: string): string {
	return action.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

// Helper: Format relative time
function formatRelativeTime(date: Date, locale: string): string {
	const now = new Date()
	const diffMs = now.getTime() - new Date(date).getTime()
	const diffMins = Math.floor(diffMs / 60000)
	const diffHours = Math.floor(diffMins / 60)
	const diffDays = Math.floor(diffHours / 24)

	if (diffMins < 1) return locale === 'zh' ? '刚刚' : 'Just now'
	if (diffMins < 60) return locale === 'zh' ? `${diffMins}分钟前` : `${diffMins}m ago`
	if (diffHours < 24) return locale === 'zh' ? `${diffHours}小时前` : `${diffHours}h ago`
	if (diffDays < 7) return locale === 'zh' ? `${diffDays}天前` : `${diffDays}d ago`

	return new Date(date).toLocaleDateString(locale)
}
