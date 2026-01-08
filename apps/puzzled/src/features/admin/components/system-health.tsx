'use client'

import {
	Activity,
	AlertTriangle,
	CheckCircle,
	Clock,
	Database,
	HardDrive,
	RefreshCw,
	Server,
	Users,
	XCircle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { trpc } from '@/trpc/client'

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

const statusColors: Record<HealthStatus, string> = {
	healthy: 'text-emerald-400',
	degraded: 'text-amber-400',
	unhealthy: 'text-red-400',
}

const statusBg: Record<HealthStatus, string> = {
	healthy: 'bg-emerald-500/10',
	degraded: 'bg-amber-500/10',
	unhealthy: 'bg-red-500/10',
}

const StatusIcon = ({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) => {
	if (status === 'healthy') return <CheckCircle className="h-5 w-5 text-emerald-400" />
	if (status === 'degraded') return <AlertTriangle className="h-5 w-5 text-amber-400" />
	return <XCircle className="h-5 w-5 text-red-400" />
}

const ServiceIcon = ({ name }: { name: string }) => {
	if (name === 'database') return <Database className="h-5 w-5" />
	if (name === 'redis') return <HardDrive className="h-5 w-5" />
	return <Server className="h-5 w-5" />
}

export function SystemHealthDashboard() {
	const t = useTranslations('admin.system')

	const {
		data: health,
		isLoading,
		refetch,
		isFetching,
	} = trpc.admin.getSystemHealth.useQuery(
		undefined,
		{ refetchInterval: 30000 }, // Refresh every 30 seconds
	)

	const { data: tasksData } = trpc.admin.getScheduledTasks.useQuery()

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-12">
				<RefreshCw className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
			</div>
		)
	}

	if (!health) {
		return (
			<div className="admin-card p-12 text-center">
				<XCircle className="mx-auto mb-4 h-12 w-12 text-[var(--admin-error)]" />
				<h3 className="text-lg font-medium text-[var(--admin-text-primary)]">{t('error')}</h3>
				<p className="mt-1 text-sm text-[var(--admin-text-muted)]">{t('errorHint')}</p>
			</div>
		)
	}

	const formatTime = (isoString: string) => {
		return new Date(isoString).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		})
	}

	const formatRelativeTime = (isoString: string) => {
		const date = new Date(isoString)
		const now = new Date()
		const diffMs = date.getTime() - now.getTime()
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
		const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

		if (diffHours > 0) {
			return `in ${diffHours}h ${diffMinutes}m`
		}
		return `in ${diffMinutes}m`
	}

	const overallStatus = health.status as HealthStatus

	return (
		<div className="space-y-8">
			{/* Overall Status Card */}
			<div className={`admin-card admin-animate-in overflow-hidden ${statusBg[overallStatus]}`}>
				<div className="flex items-center justify-between p-6">
					<div className="flex items-center gap-4">
						<div className={`rounded-full p-3 ${statusBg[overallStatus]}`}>
							<StatusIcon status={overallStatus} />
						</div>
						<div>
							<h2 className={`text-2xl font-bold ${statusColors[overallStatus]}`}>
								{t(`status.${overallStatus}`)}
							</h2>
							<p className="text-sm text-[var(--admin-text-muted)]">
								{t('lastChecked', { time: formatTime(health.checkedAt) })} ({health.checkDuration}
								ms)
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() => refetch()}
						disabled={isFetching}
						className="admin-btn admin-btn-ghost"
					>
						<RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
						{t('refresh')}
					</button>
				</div>
			</div>

			{/* Services Grid */}
			<div>
				<h3 className="mb-4 text-lg font-semibold text-[var(--admin-text-primary)]">
					{t('services')}
				</h3>
				<div className="grid gap-4 md:grid-cols-2">
					{health.services.map((service, index) => (
						<div
							key={service.name}
							className="admin-card admin-animate-in p-4"
							style={{ animationDelay: `${index * 0.05}s` }}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className={`rounded-lg p-2 ${statusBg[service.status]}`}>
										<ServiceIcon name={service.name} />
									</div>
									<div>
										<h4 className="font-medium capitalize text-[var(--admin-text-primary)]">
											{service.name}
										</h4>
										{service.latency !== undefined && (
											<p className="text-sm text-[var(--admin-text-muted)]">
												{service.latency}ms latency
											</p>
										)}
										{service.details && (
											<p className="text-sm text-[var(--admin-error)]">{service.details}</p>
										)}
									</div>
								</div>
								<StatusIcon status={service.status} />
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Stats Grid */}
			<div>
				<h3 className="mb-4 text-lg font-semibold text-[var(--admin-text-primary)]">
					{t('stats')}
				</h3>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
					<StatCard
						icon={Users}
						label={t('totalUsers')}
						value={health.stats.totalUsers}
						delay={0}
					/>
					<StatCard
						icon={Activity}
						label={t('activeSessions')}
						value={health.stats.activeSessions}
						delay={1}
					/>
					<StatCard
						icon={Users}
						label={t('premiumUsers')}
						value={health.stats.premiumUsers}
						color="amber"
						delay={2}
					/>
					<StatCard
						icon={AlertTriangle}
						label={t('dlqPending')}
						value={health.stats.dlqPending}
						color={health.stats.dlqPending > 0 ? 'red' : 'default'}
						delay={3}
					/>
					<StatCard
						icon={Users}
						label={t('recentSignups')}
						value={health.stats.recentSignups}
						color="emerald"
						delay={4}
					/>
				</div>
			</div>

			{/* Scheduled Tasks */}
			{tasksData && (
				<div>
					<h3 className="mb-4 text-lg font-semibold text-[var(--admin-text-primary)]">
						{t('scheduledTasks')}
					</h3>
					<div className="admin-card overflow-hidden">
						<table className="w-full">
							<thead>
								<tr className="border-b border-[var(--admin-border)]">
									<th className="px-4 py-3 text-left text-sm font-medium text-[var(--admin-text-muted)]">
										{t('taskName')}
									</th>
									<th className="px-4 py-3 text-left text-sm font-medium text-[var(--admin-text-muted)]">
										{t('schedule')}
									</th>
									<th className="px-4 py-3 text-left text-sm font-medium text-[var(--admin-text-muted)]">
										{t('nextRun')}
									</th>
								</tr>
							</thead>
							<tbody>
								{tasksData.tasks.map((task, index) => (
									<tr
										key={task.path}
										className="border-b border-[var(--admin-border)] last:border-0 admin-animate-in"
										style={{ animationDelay: `${index * 0.03}s` }}
									>
										<td className="px-4 py-3">
											<div>
												<div className="font-medium text-[var(--admin-text-primary)]">
													{task.name}
												</div>
												<div className="text-xs text-[var(--admin-text-muted)]">
													{task.description}
												</div>
											</div>
										</td>
										<td className="px-4 py-3">
											<code className="rounded bg-[var(--admin-bg-surface)] px-2 py-1 font-mono text-xs text-[var(--admin-text-secondary)]">
												{task.schedule}
											</code>
										</td>
										<td className="px-4 py-3">
											<div className="flex items-center gap-2 text-sm text-[var(--admin-text-secondary)]">
												<Clock className="h-4 w-4" />
												{formatRelativeTime(task.nextRun)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	)
}

function StatCard({
	icon: Icon,
	label,
	value,
	color = 'default',
	delay = 0,
}: {
	icon: typeof Users
	label: string
	value: number
	color?: 'default' | 'amber' | 'emerald' | 'red'
	delay?: number
}) {
	const colorClasses = {
		default: 'text-[var(--admin-text-primary)]',
		amber: 'text-amber-400',
		emerald: 'text-emerald-400',
		red: 'text-red-400',
	}

	return (
		<div className="admin-card admin-animate-in p-4" style={{ animationDelay: `${delay * 0.05}s` }}>
			<div className="flex items-center gap-3">
				<div className="rounded-lg bg-[var(--admin-bg-surface)] p-2">
					<Icon className="h-4 w-4 text-[var(--admin-text-muted)]" />
				</div>
				<div>
					<div className={`text-2xl font-bold ${colorClasses[color]}`}>
						{value.toLocaleString()}
					</div>
					<div className="text-xs text-[var(--admin-text-muted)]">{label}</div>
				</div>
			</div>
		</div>
	)
}
