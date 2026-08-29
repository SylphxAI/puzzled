/**
 * Experiments Admin Page
 *
 * Dest Observability has no flags/evaluate door. Do not hardcode control.
 */

import { FlaskConical } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function ExperimentsPage() {
	const t = await getTranslations('admin.experiments')

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<div className="admin-page-header">
					<h1 className="admin-page-title">{t('title')}</h1>
					<p className="admin-page-subtitle">{t('subtitle')}</p>
				</div>
			</div>

			<div className="admin-card">
				<div className="flex flex-col items-center justify-center p-12 text-center">
					<div className="mb-4 rounded-full bg-purple-500/10 p-4">
						<FlaskConical className="h-8 w-8 text-purple-400" />
					</div>
					<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{t('emptyState.title')}
					</h3>
					<p className="mt-2 max-w-md text-sm text-[var(--admin-text-secondary)]">
						{t('emptyState.description')}
					</p>
				</div>
			</div>
		</div>
	)
}
