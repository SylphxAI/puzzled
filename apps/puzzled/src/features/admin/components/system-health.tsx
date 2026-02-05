'use client'

import { CheckCircle, Database, HardDrive, RefreshCw, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSystemHealth } from '@/lib/api'

/**
 * System Health Dashboard
 *
 * Shows the health status of core system services:
 * - Database (PostgreSQL)
 * - Redis
 */
export function SystemHealthDashboard() {
	const t = useTranslations('admin.system')

	const {
		data: health,
		isLoading,
		refetch,
		isFetching,
	} = useSystemHealth()

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

	const allHealthy = health.database && health.redis
	const overallStatus = allHealthy ? 'healthy' : 'unhealthy'

	const formatTime = (isoString: string) => {
		return new Date(isoString).toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		})
	}

	return (
		<div className="space-y-8">
			{/* Overall Status Card */}
			<div
				className={`admin-card admin-animate-in overflow-hidden ${
					allHealthy ? 'bg-emerald-500/10' : 'bg-red-500/10'
				}`}
			>
				<div className="flex items-center justify-between p-6">
					<div className="flex items-center gap-4">
						<div
							className={`rounded-full p-3 ${allHealthy ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}
						>
							{allHealthy ? (
								<CheckCircle className="h-5 w-5 text-emerald-400" />
							) : (
								<XCircle className="h-5 w-5 text-red-400" />
							)}
						</div>
						<div>
							<h2
								className={`text-2xl font-bold ${allHealthy ? 'text-emerald-400' : 'text-red-400'}`}
							>
								{t(`status.${overallStatus}`)}
							</h2>
							<p className="text-sm text-[var(--admin-text-muted)]">
								{t('lastChecked', { time: formatTime(health.timestamp) })}
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
					{/* Database Status */}
					<ServiceCard
						name="Database"
						icon={<Database className="h-5 w-5" />}
						healthy={health.database}
						delay={0}
					/>

					{/* Redis Status */}
					<ServiceCard
						name="Redis"
						icon={<HardDrive className="h-5 w-5" />}
						healthy={health.redis}
						delay={1}
					/>
				</div>
			</div>
		</div>
	)
}

function ServiceCard({
	name,
	icon,
	healthy,
	delay = 0,
}: {
	name: string
	icon: React.ReactNode
	healthy: boolean
	delay?: number
}) {
	const statusBg = healthy ? 'bg-emerald-500/10' : 'bg-red-500/10'

	return (
		<div className="admin-card admin-animate-in p-4" style={{ animationDelay: `${delay * 0.05}s` }}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className={`rounded-lg p-2 ${statusBg}`}>{icon}</div>
					<div>
						<h4 className="font-medium capitalize text-[var(--admin-text-primary)]">{name}</h4>
						<p className="text-sm text-[var(--admin-text-muted)]">
							{healthy ? 'Connected' : 'Disconnected'}
						</p>
					</div>
				</div>
				{healthy ? (
					<CheckCircle className="h-5 w-5 text-emerald-400" />
				) : (
					<XCircle className="h-5 w-5 text-red-400" />
				)}
			</div>
		</div>
	)
}
