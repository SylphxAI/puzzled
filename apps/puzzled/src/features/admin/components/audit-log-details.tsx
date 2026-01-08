'use client'

import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { trpc } from '@/trpc/client'

type AuditLogDetailsProps = {
	logId: string
	onRefresh: () => void
}

export function AuditLogDetails({ logId }: AuditLogDetailsProps) {
	const t = useTranslations('admin.auditLogs')
	const locale = useLocale()
	const { data: log, isLoading } = trpc.admin.getAuditLogDetails.useQuery({ id: logId })

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="h-6 w-6 animate-spin text-[var(--admin-text-muted)]" />
			</div>
		)
	}

	if (!log) {
		return (
			<div className="p-8 text-center text-[var(--admin-text-muted)]">{t('details.notFound')}</div>
		)
	}

	return (
		<div className="space-y-6 p-6">
			{/* Header */}
			<div>
				<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">
					{t('details.title')}
				</h3>
				<p className="text-sm text-[var(--admin-text-secondary)]">{t('details.subtitle')}</p>
			</div>

			{/* Basic Info */}
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				{/* User Info */}
				{log.user && (
					<div className="space-y-2">
						<h4 className="admin-data-label">{t('details.user')}</h4>
						<div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-elevated)] p-4">
							<div className="flex items-center gap-3">
								{log.user.image && (
									<Image
										src={log.user.image}
										width={40}
										height={40}
										alt={log.user.name || 'User'}
										className="h-10 w-10 rounded-full"
									/>
								)}
								<div>
									<div className="font-medium text-[var(--admin-text-primary)]">
										{log.user.name || 'Unknown'}
									</div>
									<div className="text-sm text-[var(--admin-text-muted)]">{log.user.email}</div>
									<div className="mt-1 text-xs text-[var(--admin-text-muted)]">
										Role: {log.user.role}
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* Actor Info (if different from user) */}
				{log.actor && log.actorId !== log.userId && (
					<div className="space-y-2">
						<h4 className="admin-data-label">{t('details.actor')}</h4>
						<div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-elevated)] p-4">
							<div className="flex items-center gap-3">
								{log.actor.image && (
									<Image
										src={log.actor.image}
										width={40}
										height={40}
										alt={log.actor.name || 'Actor'}
										className="h-10 w-10 rounded-full"
									/>
								)}
								<div>
									<div className="font-medium text-[var(--admin-text-primary)]">
										{log.actor.name || 'Unknown'}
									</div>
									<div className="text-sm text-[var(--admin-text-muted)]">{log.actor.email}</div>
									<div className="mt-1 text-xs text-[var(--admin-text-muted)]">
										Role: {log.actor.role}
									</div>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Resource Info */}
			<div className="space-y-2">
				<h4 className="admin-data-label">{t('details.resource')}</h4>
				<div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-elevated)] p-4">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<div className="admin-data-label">{t('details.resourceType')}</div>
							<div className="admin-data-value">{log.resourceType}</div>
						</div>
						{log.resourceId && (
							<div>
								<div className="admin-data-label">{t('details.resourceId')}</div>
								<div className="admin-data-mono">{log.resourceId}</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Technical Details */}
			<div className="space-y-2">
				<h4 className="admin-data-label">{t('details.technical')}</h4>
				<div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-elevated)] p-4">
					<div className="space-y-3">
						{log.ipAddress && (
							<div>
								<div className="admin-data-label">{t('details.ipAddress')}</div>
								<div className="admin-data-mono">{log.ipAddress}</div>
							</div>
						)}
						{log.userAgent && (
							<div>
								<div className="admin-data-label">{t('details.userAgent')}</div>
								<div className="admin-data-value">{log.userAgent}</div>
							</div>
						)}
						<div>
							<div className="admin-data-label">{t('details.timestamp')}</div>
							<div className="admin-data-value">
								{new Date(log.createdAt).toLocaleString(locale)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Metadata */}
			{log.metadata && Object.keys(log.metadata).length > 0 && (
				<div className="space-y-2">
					<h4 className="admin-data-label">{t('details.metadata')}</h4>
					<div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg-elevated)] p-4">
						<pre className="overflow-x-auto text-xs text-[var(--admin-text-secondary)]">
							{JSON.stringify(log.metadata, null, 2)}
						</pre>
					</div>
				</div>
			)}
		</div>
	)
}
