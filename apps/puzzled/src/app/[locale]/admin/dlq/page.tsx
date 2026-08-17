export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { DLQDashboard } from '@/features/admin/components/dlq-dashboard'

export default async function AdminDLQPage() {
	const t = await getTranslations('admin.dlq')

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t('title')}</h1>
				<p className="admin-page-subtitle">{t('subtitle')}</p>
			</div>

			{/* DLQ Dashboard */}
			<DLQDashboard />
		</div>
	)
}
