'use client'

import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { AuditLogDetails } from './audit-log-details'

type AuditLog = {
	id: string
	userId: string | null
	actorId: string | null
	action: string
	resourceType: string
	resourceId: string | null
	metadata: Record<string, unknown> | null
	ipAddress: string | null
	userAgent: string | null
	createdAt: Date
	userName: string | null
	userEmail: string | null
	actorName: string | null
	actorEmail: string | null
}

type AuditLogTableProps = {
	logs: AuditLog[]
	onRefresh: () => void
}

export function AuditLogTable({ logs, onRefresh }: AuditLogTableProps) {
	const t = useTranslations('admin.auditLogs')
	const locale = useLocale()
	const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

	const toggleExpanded = (logId: string) => {
		setExpandedLogId(expandedLogId === logId ? null : logId)
	}

	const getActionBadgeClass = (action: string) => {
		switch (action) {
			case 'create':
				return 'admin-badge admin-badge-success'
			case 'update':
				return 'admin-badge admin-badge-info'
			case 'delete':
				return 'admin-badge admin-badge-error'
			case 'login':
			case 'logout':
				return 'admin-badge admin-badge-default'
			case 'role_change':
			case 'subscription_change':
				return 'admin-badge admin-badge-warning'
			case 'impersonate_start':
			case 'impersonate_end':
				return 'admin-badge admin-badge-accent'
			default:
				return 'admin-badge admin-badge-default'
		}
	}

	if (logs.length === 0) {
		return (
			<div className="admin-empty-state">
				<div className="admin-empty-state-icon">
					<ExternalLink className="h-6 w-6" aria-hidden="true" />
				</div>
				<h3 className="admin-empty-state-title">{t('empty.title')}</h3>
				<p className="admin-empty-state-description">{t('empty.description')}</p>
			</div>
		)
	}

	return (
		<div className="admin-card overflow-hidden">
			<div className="overflow-x-auto">
				<table className="admin-table">
					<thead>
						<tr>
							<th>{t('table.timestamp')}</th>
							<th>{t('table.action')}</th>
							<th>{t('table.actor')}</th>
							<th>{t('table.resource')}</th>
							<th>{t('table.ip')}</th>
							<th>
								<span className="sr-only">{t('table.details')}</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{logs.map((log) => (
							<>
								<tr key={log.id}>
									<td>
										<div className="text-sm text-[var(--admin-text-primary)]">
											{new Date(log.createdAt).toLocaleDateString(locale)}
										</div>
										<div className="admin-data-mono">
											{new Date(log.createdAt).toLocaleTimeString(locale)}
										</div>
									</td>
									<td>
										<span className={getActionBadgeClass(log.action)}>
											{t(`actions.${log.action}`)}
										</span>
									</td>
									<td>
										{log.actorId ? (
											<div>
												<div className="text-sm font-medium text-[var(--admin-text-primary)]">
													{log.actorName || 'Unknown'}
												</div>
												<div className="admin-data-mono">{log.actorEmail}</div>
											</div>
										) : (
											<div>
												<div className="text-sm font-medium text-[var(--admin-text-primary)]">
													{log.userName || 'System'}
												</div>
												<div className="admin-data-mono">{log.userEmail}</div>
											</div>
										)}
									</td>
									<td>
										<div className="text-sm font-medium text-[var(--admin-text-primary)]">
											{log.resourceType}
										</div>
										{log.resourceId && (
											<div className="admin-data-mono">{log.resourceId.slice(0, 8)}...</div>
										)}
									</td>
									<td>
										<div className="admin-data-mono">{log.ipAddress || 'N/A'}</div>
									</td>
									<td>
										<button
											type="button"
											className="admin-btn admin-btn-ghost p-2"
											onClick={() => toggleExpanded(log.id)}
											aria-expanded={expandedLogId === log.id}
											aria-label={
												expandedLogId === log.id
													? t('table.collapseDetails')
													: t('table.expandDetails')
											}
										>
											{expandedLogId === log.id ? (
												<ChevronDown className="h-4 w-4" aria-hidden="true" />
											) : (
												<ChevronRight className="h-4 w-4" aria-hidden="true" />
											)}
										</button>
									</td>
								</tr>
								{expandedLogId === log.id && (
									<tr>
										<td colSpan={6} className="bg-[var(--admin-bg-surface)] !p-0">
											<AuditLogDetails logId={log.id} onRefresh={onRefresh} />
										</td>
									</tr>
								)}
							</>
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
