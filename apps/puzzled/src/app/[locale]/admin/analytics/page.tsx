import { requireAdmin } from '@/features/admin'
import { ProductMetricsReport } from '@/features/admin/components/product-metrics-report'

export default async function ProductAnalyticsPage() {
	// An RSC request can bypass the layout; the api also checks admin scope.
	await requireAdmin()
	return <ProductMetricsReport />
}
