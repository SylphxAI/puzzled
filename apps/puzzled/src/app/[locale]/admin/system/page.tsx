export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { requireAdmin } from '@/features/admin'
import { SystemHealthDashboard } from '@/features/admin/components/system-health'

export default async function AdminSystemPage() {
	// Each page re-checks admin: an RSC request for the page alone skips the layout.
	await requireAdmin()
	const t = await getTranslations('admin.system')

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="admin-page-header">
					<h1 className="admin-page-title">{t('title')}</h1>
					<p className="admin-page-subtitle">{t('subtitle')}</p>
				</div>
			</div>

			{/* Health Dashboard */}
			<SystemHealthDashboard />
		</div>
	)
}
