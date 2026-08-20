'use client'

import { ConfirmDialog } from '@sylphx/ui'
import { AlertTriangle, CheckCircle, Clock, Loader2, Play, RefreshCw, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { useDlqList, useDlqMarkFailed, useDlqResolve, useDlqRetry } from '@/lib/api'
import { PAGINATION } from '@/lib/config/validation'
import type { deadLetterQueue } from '@/lib/db/schema'

type DLQItem = typeof deadLetterQueue.$inferSelect
type DLQStats = {
	total: number
	pending: number
	retrying: number
	resolved: number
	failed: number
	byWorkflow: Record<string, number>
}

type DLQDashboardProps = {
	initialStats: DLQStats
	initialItems: DLQItem[]
}

export function DLQDashboard({ initialStats, initialItems }: DLQDashboardProps) {
	const t = useTranslations('admin.dlq')
	const _locale = useLocale()
	const router = useRouter()
	const [filter, setFilter] = useState<string | undefined>(undefined)

	// Use dlqList with includeStats
	const { data, refetch } = useDlqList(
		{
			status: filter as 'pending' | 'retrying' | 'resolved' | 'failed' | undefined,
			limit: PAGINATION.ADMIN_MAX_LIMIT,
		},
		{
			refetchInterval: 30000,
		},
	)

	const items = data?.items ?? initialItems
	const stats = data?.stats ?? initialStats

	const handleRefresh = () => {
		refetch()
		router.refresh()
	}

	return (
		<div className="space-y-6">
			{/* Stats Cards */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<StatCard
					label={t('stats.total')}
					value={stats.total}
					icon={AlertTriangle}
					onClick={() => setFilter(undefined)}
					active={filter === undefined}
				/>
				<StatCard
					label={t('stats.pending')}
					value={stats.pending}
					icon={Clock}
					variant="warning"
					onClick={() => setFilter('pending')}
					active={filter === 'pending'}
				/>
				<StatCard
					label={t('stats.retrying')}
					value={stats.retrying}
					icon={Loader2}
					variant="info"
					onClick={() => setFilter('retrying')}
					active={filter === 'retrying'}
				/>
				<StatCard
					label={t('stats.resolved')}
					value={stats.resolved}
					icon={CheckCircle}
					variant="success"
					onClick={() => setFilter('resolved')}
					active={filter === 'resolved'}
				/>
				<StatCard
					label={t('stats.failed')}
					value={stats.failed}
					icon={XCircle}
					variant="error"
					onClick={() => setFilter('failed')}
					active={filter === 'failed'}
				/>
			</div>

			{/* Refresh Button */}
			<div className="flex justify-end">
				<button type="button" className="admin-btn admin-btn-ghost" onClick={handleRefresh}>
					<RefreshCw className="h-4 w-4" />
					{t('refresh')}
				</button>
			</div>

			{/* Items List */}
			{items.length === 0 ? (
				<div className="admin-empty-state">
					<div className="admin-empty-state-icon !bg-[var(--admin-success)]/10">
						<CheckCircle className="h-6 w-6 text-[var(--admin-success)]" />
					</div>
					<h3 className="admin-empty-state-title">{t('empty.title')}</h3>
					<p className="admin-empty-state-description">{t('empty.description')}</p>
				</div>
			) : (
				<div className="admin-card overflow-hidden">
					<div className="overflow-x-auto">
						<table className="admin-table">
							<thead>
								<tr>
									<th>{t('table.workflow')}</th>
									<th>{t('table.error')}</th>
									<th>{t('table.retries')}</th>
									<th>{t('table.status')}</th>
									<th>{t('table.created')}</th>
									<th>{t('table.actions')}</th>
								</tr>
							</thead>
							<tbody>
								{items.map((item) => (
									<DLQItemRow key={item.id} item={item} onUpdate={handleRefresh} />
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
	label,
	value,
	icon: Icon,
	variant = 'default',
	onClick,
	active,
}: {
	label: string
	value: number
	icon: typeof AlertTriangle
	variant?: 'default' | 'warning' | 'info' | 'success' | 'error'
	onClick?: () => void
	active?: boolean
}) {
	const iconVariantClass = {
		default: 'admin-stat-icon',
		warning: 'admin-stat-icon-warning',
		info: 'admin-stat-icon-info',
		success: 'admin-stat-icon-success',
		error: 'admin-stat-icon-error',
	}

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={`${label}: ${value}${active ? ' (selected)' : ''}`}
			aria-pressed={active}
			className={`admin-stat-card admin-stat-clickable p-4 text-left ${active ? 'admin-stat-active' : ''}`}
		>
			<div className={`mb-2 inline-flex rounded-lg p-2 ${iconVariantClass[variant]}`}>
				<Icon className="h-5 w-5" aria-hidden="true" />
			</div>
			<div className="admin-stat-value">{value}</div>
			<div className="admin-stat-label">{label}</div>
		</button>
	)
}

function DLQItemRow({ item, onUpdate }: { item: DLQItem; onUpdate: () => void }) {
	const t = useTranslations('admin.dlq')
	const tCommon = useTranslations('common')
	const locale = useLocale()
	const [loading, setLoading] = useState<string | null>(null)
	const [retryDialogOpen, setRetryDialogOpen] = useState(false)

	const retryMutation = useDlqRetry()
	const resolveMutation = useDlqResolve()
	const markFailedMutation = useDlqMarkFailed()

	const handleRetryClick = () => {
		setRetryDialogOpen(true)
	}

	const handleRetryConfirm = () => {
		setLoading('retry')
		retryMutation.mutate(
			{ id: item.id },
			{
				onSuccess: () => onUpdate(),
				onSettled: () => setLoading(null),
			},
		)
	}

	const handleResolve = () => {
		setLoading('resolve')
		resolveMutation.mutate(
			{ id: item.id },
			{
				onSuccess: () => onUpdate(),
				onSettled: () => setLoading(null),
			},
		)
	}

	const handleFail = () => {
		setLoading('fail')
		markFailedMutation.mutate(
			{ id: item.id },
			{
				onSuccess: () => onUpdate(),
				onSettled: () => setLoading(null),
			},
		)
	}

	const statusBadgeClass: Record<string, string> = {
		pending: 'admin-badge admin-badge-warning',
		retrying: 'admin-badge admin-badge-info',
		resolved: 'admin-badge admin-badge-success',
		failed: 'admin-badge admin-badge-error',
	}

	const statusIcons: Record<string, typeof Clock> = {
		pending: Clock,
		retrying: Loader2,
		resolved: CheckCircle,
		failed: XCircle,
	}

	const canRetry = item.status === 'pending' || item.status === 'failed'
	const canResolve = item.status === 'pending' || item.status === 'retrying'
	const exceedsRetries = item.retryCount >= item.maxRetries

	return (
		<tr>
			<td>
				<div className="font-medium text-[var(--admin-text-primary)]">{item.workflowName}</div>
				{item.workflowRunId && (
					<div className="admin-data-mono">{item.workflowRunId.slice(0, 8)}...</div>
				)}
			</td>
			<td className="max-w-xs">
				<div className="line-clamp-2 text-sm text-[var(--admin-text-secondary)]">{item.error}</div>
			</td>
			<td>
				<span
					className={`font-mono text-sm ${exceedsRetries ? 'text-[var(--admin-error)]' : 'text-[var(--admin-text-secondary)]'}`}
				>
					{item.retryCount}/{item.maxRetries}
				</span>
			</td>
			<td>
				<span className={statusBadgeClass[item.status]}>
					{(() => {
						const StatusIcon = statusIcons[item.status]
						return StatusIcon ? (
							<StatusIcon
								className={`h-3 w-3 ${item.status === 'retrying' ? 'animate-spin' : ''}`}
								aria-hidden="true"
							/>
						) : null
					})()}
					{t(`status.${item.status}`)}
				</span>
			</td>
			<td className="text-sm text-[var(--admin-text-secondary)]">
				{new Date(item.createdAt).toLocaleString(locale)}
			</td>
			<td>
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-1">
						{canRetry && (
							<button
								type="button"
								className="admin-btn admin-btn-ghost p-2"
								onClick={handleRetryClick}
								disabled={loading !== null}
								aria-label={t('actions.retry')}
							>
								{loading === 'retry' ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
								) : (
									<Play className="h-4 w-4" aria-hidden="true" />
								)}
							</button>
						)}
						{canResolve && (
							<button
								type="button"
								className="admin-btn admin-btn-ghost p-2"
								onClick={handleResolve}
								disabled={loading !== null}
								aria-label={t('actions.resolve')}
							>
								{loading === 'resolve' ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
								) : (
									<CheckCircle className="h-4 w-4 text-[var(--admin-success)]" aria-hidden="true" />
								)}
							</button>
						)}
						{canResolve && (
							<button
								type="button"
								className="admin-btn admin-btn-ghost p-2"
								onClick={handleFail}
								disabled={loading !== null}
								aria-label={t('actions.fail')}
							>
								{loading === 'fail' ? (
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
								) : (
									<XCircle className="h-4 w-4 text-[var(--admin-error)]" aria-hidden="true" />
								)}
							</button>
						)}
					</div>
					{(retryMutation.error || resolveMutation.error || markFailedMutation.error) && (
						<span className="text-xs text-[var(--admin-error)]">
							{retryMutation.error?.message ||
								resolveMutation.error?.message ||
								markFailedMutation.error?.message}
						</span>
					)}
				</div>
			</td>

			{/* Retry Confirmation Dialog */}
			<ConfirmDialog
				open={retryDialogOpen}
				onOpenChange={setRetryDialogOpen}
				title={t('confirmRetryTitle')}
				description={t('confirmRetryDescription')}
				confirmLabel={t('actions.retry')}
				cancelLabel={tCommon('cancel')}
				onConfirm={handleRetryConfirm}
				variant="default"
			/>
		</tr>
	)
}
