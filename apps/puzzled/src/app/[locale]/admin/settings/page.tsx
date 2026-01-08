export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { ModelSettings } from '@/features/admin/components/model-settings'

export default async function AdminSettingsPage() {
	const t = await getTranslations('admin.settings')

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t('title')}</h1>
				<p className="admin-page-subtitle">{t('subtitle')}</p>
			</div>

			{/* Model Settings */}
			<ModelSettings />
		</div>
	)
}
