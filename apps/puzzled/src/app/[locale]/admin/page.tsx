export const dynamic = 'force-dynamic'

import { and, count, desc, eq, gte, sql } from 'drizzle-orm'
import { daysAgo } from '@/lib/constants/time'
import {
	Activity,
	AlertTriangle,
	ArrowDownRight,
	ArrowUpRight,
	CreditCard,
	Gamepad2,
	Plus,
	Server,
	Settings,
	TrendingUp,
	UserPlus,
	Users,
	Zap,
} from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { db } from '@/lib/db'
import {
	auditLogs,
	deadLetterQueue,
	gameSessions,
	plans,
	subscriptions,
	users,
} from '@/lib/db/schema'

// Get comprehensive dashboard stats
async function getDashboardStats() {
	const now = new Date()
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const sevenDaysAgo = daysAgo(7, today)
	const fourteenDaysAgo = daysAgo(14, today)

	// Total counts
	const [userCount] = await db.select({ count: count() }).from(users)
	const [premiumCount] = await db
		.select({ count: count() })
		.from(subscriptions)
		.where(eq(subscriptions.plan, 'premium'))
	const [sessionCount] = await db.select({ count: count() }).from(gameSessions)
	const [planCount] = await db.select({ count: count() }).from(plans)

	// This week's stats
	const [usersThisWeek] = await db
		.select({ count: count() })
		.from(users)
		.where(gte(users.createdAt, sevenDaysAgo))

	const [usersLastWeek] = await db
		.select({ count: count() })
		.from(users)
		.where(and(gte(users.createdAt, fourteenDaysAgo), sql`${users.createdAt} < ${sevenDaysAgo}`))

	const [sessionsThisWeek] = await db
		.select({ count: count() })
		.from(gameSessions)
		.where(gte(gameSessions.completedAt, sevenDaysAgo))

	const [sessionsLastWeek] = await db
		.select({ count: count() })
		.from(gameSessions)
		.where(
			and(
				gte(gameSessions.completedAt, fourteenDaysAgo),
				sql`${gameSessions.completedAt} < ${sevenDaysAgo}`,
			),
		)

	// DLQ stats for system health
	const [dlqPending] = await db
		.select({ count: count() })
		.from(deadLetterQueue)
		.where(eq(deadLetterQueue.status, 'pending'))

	const [dlqFailed] = await db
		.select({ count: count() })
		.from(deadLetterQueue)
		.where(eq(deadLetterQueue.status, 'failed'))

	// Daily signups for sparkline (last 14 days)
	const dailySignups = await db
		.select({
			date: sql<string>`DATE(${users.createdAt})`,
			count: count(),
		})
		.from(users)
		.where(gte(users.createdAt, fourteenDaysAgo))
		.groupBy(sql`DATE(${users.createdAt})`)
		.orderBy(sql`DATE(${users.createdAt})`)

	// Revenue this month
	const premiumUsers = premiumCount?.count || 0
	const estimatedMRR = premiumUsers * 4.99

	// Calculate week-over-week changes
	const userGrowth = usersLastWeek?.count
		? ((usersThisWeek?.count || 0) - usersLastWeek.count) / usersLastWeek.count
		: 0
	const sessionGrowth = sessionsLastWeek?.count
		? ((sessionsThisWeek?.count || 0) - sessionsLastWeek.count) / sessionsLastWeek.count
		: 0

	return {
		users: userCount?.count || 0,
		premium: premiumUsers,
		sessions: sessionCount?.count || 0,
		plans: planCount?.count || 0,
		mrr: estimatedMRR,
		usersThisWeek: usersThisWeek?.count || 0,
		sessionsThisWeek: sessionsThisWeek?.count || 0,
		userGrowth: Math.round(userGrowth * 100),
		sessionGrowth: Math.round(sessionGrowth * 100),
		dlqPending: dlqPending?.count || 0,
		dlqFailed: dlqFailed?.count || 0,
		dailySignups: dailySignups.map((d) => d.count),
	}
}

// Get recent activity from audit logs
async function getRecentActivity() {
	return db.query.auditLogs.findMany({
		orderBy: desc(auditLogs.createdAt),
		limit: 8,
		with: {
			user: true,
		},
	})
}

// Get recent users
async function getRecentUsers() {
	return db.query.users.findMany({
		orderBy: desc(users.createdAt),
		limit: 5,
	})
}

export default async function AdminDashboard() {
	const locale = await getLocale()
	const t = await getTranslations('admin.dashboard')
	const [stats, recentActivity, recentUsers] = await Promise.all([
		getDashboardStats(),
		getRecentActivity(),
		getRecentUsers(),
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
					change={stats.userGrowth}
					icon={Users}
					sparklineData={stats.dailySignups}
					delay={0}
				/>
				<EnhancedStatCard
					title={t('premiumUsers')}
					value={stats.premium}
					change={12}
					icon={CreditCard}
					accentColor="emerald"
					delay={1}
				/>
				<EnhancedStatCard
					title={t('gameSessions')}
					value={stats.sessions}
					change={stats.sessionGrowth}
					icon={Gamepad2}
					accentColor="purple"
					delay={2}
				/>
				<EnhancedStatCard
					title={t('estMRR')}
					value={`$${stats.mrr.toFixed(0)}`}
					change={15}
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
					<Link href="/admin/users" className="admin-quick-action">
						<div className="admin-quick-action-icon">
							<UserPlus className="h-5 w-5" aria-hidden="true" />
						</div>
						<span className="admin-quick-action-label">{t('viewUsers')}</span>
					</Link>

					<Link href="/admin/plans" className="admin-quick-action">
						<div className="admin-quick-action-icon">
							<Plus className="h-5 w-5" aria-hidden="true" />
						</div>
						<span className="admin-quick-action-label">{t('managePlans')}</span>
					</Link>

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

			{/* Two Column Layout: Activity + Recent Users */}
			<div className="grid gap-6 lg:grid-cols-2">
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

				{/* Recent Users */}
				<div className="admin-card admin-animate-in" style={{ animationDelay: '0.3s' }}>
					<div className="admin-panel-header">
						<span className="admin-panel-title">
							<Users className="h-4 w-4" aria-hidden="true" />
							{t('recentUsers')}
						</span>
						<Link href="/admin/users" className="admin-btn admin-btn-ghost text-xs">
							{t('viewAll')}
						</Link>
					</div>
					<div className="divide-y divide-[var(--admin-border)]">
						{recentUsers.length === 0 ? (
							<div className="px-6 py-12 text-center text-[var(--admin-text-muted)]">
								{t('noUsersYet')}
							</div>
						) : (
							recentUsers.map((user) => (
								<div
									key={user.id}
									className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-[var(--admin-bg-surface)]"
								>
									<div className="flex items-center gap-3">
										<div className="admin-avatar h-9 w-9 text-sm">
											{user.name?.[0] || user.email[0].toUpperCase()}
										</div>
										<div>
											<div className="text-sm font-medium text-[var(--admin-text-primary)]">
												{user.name || t('unnamed')}
											</div>
											<div className="text-xs text-[var(--admin-text-muted)]">{user.email}</div>
										</div>
									</div>
									<div className="text-xs text-[var(--admin-text-muted)]">
										{formatRelativeTime(user.createdAt, locale)}
									</div>
								</div>
							))
						)}
					</div>
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
						<span className="admin-metric-value">{stats.usersThisWeek}</span>
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

// Enhanced Stat Card with Sparkline
function EnhancedStatCard({
	title,
	value,
	change,
	icon: Icon,
	sparklineData,
	accentColor = 'default',
	delay = 0,
}: {
	title: string
	value: string | number
	change: number
	icon: typeof Users
	sparklineData?: number[]
	accentColor?: 'default' | 'emerald' | 'purple' | 'amber'
	delay?: number
}) {
	const isPositive = change >= 0
	const maxSparkline = sparklineData ? Math.max(...sparklineData, 1) : 1

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
				<span
					className={`admin-stat-change ${isPositive ? 'admin-stat-change-up' : 'admin-stat-change-down'}`}
				>
					{isPositive ? (
						<ArrowUpRight className="h-3 w-3" aria-hidden="true" />
					) : (
						<ArrowDownRight className="h-3 w-3" aria-hidden="true" />
					)}
					{Math.abs(change)}%
				</span>
			</div>

			<div className="admin-stat-main">
				<span className="admin-stat-value-lg">{value}</span>
			</div>
			<div className="admin-stat-label mt-1">{title}</div>

			{sparklineData && sparklineData.length > 0 && (
				<div className="admin-stat-footer">
					<div className="admin-sparkline">
						{sparklineData.slice(-14).map((val, i) => (
							<div
								key={i}
								className="admin-sparkline-bar"
								style={{ height: `${(val / maxSparkline) * 100}%` }}
							/>
						))}
					</div>
				</div>
			)}
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
		metadata: unknown
		createdAt: Date
		user: { name: string | null; email: string } | null
	}
	locale: string
}) {
	const iconMap: Record<string, { icon: typeof Activity; className: string }> = {
		user: { icon: UserPlus, className: 'admin-activity-icon-user' },
		subscription: { icon: CreditCard, className: 'admin-activity-icon-payment' },
		payment: { icon: CreditCard, className: 'admin-activity-icon-payment' },
		game: { icon: Gamepad2, className: 'admin-activity-icon-game' },
		system: { icon: Zap, className: 'admin-activity-icon-system' },
	}

	const actionType = log.action.split('_')[0] || 'system'
	const { icon: ActivityIcon, className: iconClass } = iconMap[actionType] || iconMap.system

	return (
		<div className="admin-activity-item">
			<div className={`admin-activity-icon ${iconClass}`}>
				<ActivityIcon className="h-4 w-4" aria-hidden="true" />
			</div>
			<div className="admin-activity-content">
				<div className="admin-activity-text">
					<span className="font-medium">{log.user?.name || log.user?.email || 'System'}</span>
					{' • '}
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
