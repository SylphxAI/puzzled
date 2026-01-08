export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { AnalyticsDashboard } from '@/features/admin/components/analytics-dashboard'

export default async function AnalyticsPage() {
	// Pre-load translations for SSR
	await getTranslations('admin.analytics')

	return <AnalyticsDashboard />
}
