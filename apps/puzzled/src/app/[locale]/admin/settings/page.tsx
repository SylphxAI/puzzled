export const dynamic = 'force-dynamic'

import { Settings } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

/**
 * Admin Settings Page
 *
 * App settings are managed through appSettings table.
 * Platform settings (billing, auth) are managed in the platform admin.
 */
export default async function AdminSettingsPage() {
	const t = await getTranslations('admin.settings')

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t('title')}</h1>
				<p className="admin-page-subtitle">{t('subtitle')}</p>
			</div>

			{/* Info Card */}
			<div className="admin-card p-6">
				<div className="flex items-start gap-4">
					<div className="rounded-lg bg-[var(--admin-bg-surface)] p-3">
						<Settings className="h-6 w-6 text-[var(--admin-text-muted)]" />
					</div>
					<div>
						<h3 className="font-semibold text-[var(--admin-text-primary)]">App Settings</h3>
						<p className="mt-1 text-sm text-[var(--admin-text-secondary)]">
							App-specific settings are configured through feature flags and announcements. For user
							management, billing, and authentication settings, use the platform admin.
						</p>
					</div>
				</div>
			</div>

			{/* Quick Links */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<a
					href="/admin/feature-flags"
					className="admin-card p-4 transition-colors hover:border-[var(--admin-accent)]"
				>
					<h4 className="font-medium text-[var(--admin-text-primary)]">Feature Flags</h4>
					<p className="mt-1 text-sm text-[var(--admin-text-muted)]">
						Control feature rollouts and experiments
					</p>
				</a>
				<a
					href="/admin/announcements"
					className="admin-card p-4 transition-colors hover:border-[var(--admin-accent)]"
				>
					<h4 className="font-medium text-[var(--admin-text-primary)]">Announcements</h4>
					<p className="mt-1 text-sm text-[var(--admin-text-muted)]">
						Manage in-app announcements and alerts
					</p>
				</a>
				<a
					href="/admin/dlq"
					className="admin-card p-4 transition-colors hover:border-[var(--admin-accent)]"
				>
					<h4 className="font-medium text-[var(--admin-text-primary)]">Dead Letter Queue</h4>
					<p className="mt-1 text-sm text-[var(--admin-text-muted)]">
						Monitor and retry failed workflows
					</p>
				</a>
			</div>
		</div>
	)
}
