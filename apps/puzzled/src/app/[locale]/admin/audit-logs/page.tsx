'use client'

import { Button } from '@sylphx/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
	AuditLogFilters,
	type AuditLogFiltersType,
} from '@/features/admin/components/audit-log-filters'
import { AuditLogTable } from '@/features/admin/components/audit-log-table'
import { PAGINATION } from '@/lib/config/validation'
import { trpc } from '@/trpc/client'

export default function AdminAuditLogsPage() {
	const t = useTranslations('admin.auditLogs')
	const [page, setPage] = useState(1)
	const [filters, setFilters] = useState<AuditLogFiltersType>({})

	// Convert page to offset
	const limit = PAGINATION.ADMIN_DEFAULT_LIMIT
	const offset = (page - 1) * limit

	// Convert date filters to Date objects for tRPC
	const dateFrom = filters.startDate ? new Date(filters.startDate) : undefined
	const dateTo = filters.endDate
		? new Date(new Date(filters.endDate).setHours(23, 59, 59, 999))
		: undefined

	const { data, isLoading, refetch } = trpc.admin.getAuditLogs.useQuery({
		limit,
		offset,
		action: filters.action as
			| 'create'
			| 'update'
			| 'delete'
			| 'game_complete'
			| 'streak_update'
			| 'achievement_unlock'
			| 'admin_action'
			| undefined,
		resourceType: filters.resourceType,
		dateFrom,
		dateTo,
	})

	const handleFiltersChange = (newFilters: AuditLogFiltersType) => {
		setFilters(newFilters)
		setPage(1) // Reset to first page when filters change
	}

	const handleRefresh = () => {
		refetch()
	}

	const total = data?.total ?? 0
	const totalPages = Math.ceil(total / limit) || 1

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t('title')}</h1>
				<p className="admin-page-subtitle">{t('subtitle')}</p>
			</div>

			{/* Stats */}
			{data && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="admin-stat-card p-4">
						<div className="admin-stat-value text-xl">{total}</div>
						<div className="admin-stat-label">{t('stats.totalLogs')}</div>
					</div>
					<div className="admin-stat-card p-4">
						<div className="admin-stat-value text-xl">{data.logs.length}</div>
						<div className="admin-stat-label">{t('stats.onThisPage')}</div>
					</div>
					<div className="admin-stat-card p-4">
						<div className="admin-stat-value text-xl">{totalPages}</div>
						<div className="admin-stat-label">{t('stats.totalPages')}</div>
					</div>
					<div className="admin-stat-card p-4">
						<div className="admin-stat-value text-xl">
							{data.logs.filter((log) => log.actorId).length}
						</div>
						<div className="admin-stat-label">{t('stats.adminActions')}</div>
					</div>
				</div>
			)}

			{/* Filters */}
			<AuditLogFilters
				filters={filters}
				onFiltersChange={handleFiltersChange}
				onRefresh={handleRefresh}
			/>

			{/* Loading State */}
			{isLoading && (
				<div className="flex items-center justify-center py-12">
					<div className="text-center">
						<div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
						<p className="text-muted-foreground">{t('loading')}</p>
					</div>
				</div>
			)}

			{/* Audit Logs Table */}
			{!isLoading && data && (
				<>
					<AuditLogTable logs={data.logs} onRefresh={handleRefresh} />

					{/* Pagination */}
					{totalPages > 1 && (
						<div className="flex items-center justify-between">
							<div className="text-sm text-muted-foreground">
								{t('pagination.showing', {
									from: offset + 1,
									to: Math.min(offset + limit, total),
									total,
								})}
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={page === 1}
								>
									<ChevronLeft className="h-4 w-4" />
									{t('pagination.previous')}
								</Button>
								<div className="flex items-center gap-2 px-4">
									<span className="text-sm">
										{t('pagination.page', { page, total: totalPages })}
									</span>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									disabled={page === totalPages}
								>
									{t('pagination.next')}
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	)
}
