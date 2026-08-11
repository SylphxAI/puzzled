export const dynamic = 'force-dynamic'

import { desc, sql } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { DLQDashboard } from '@/features/admin/components/dlq-dashboard'
import { PAGINATION } from '@/lib/config/validation'
import { db } from '@/lib/db'
import { deadLetterQueue } from '@/lib/db/schema'

export default async function AdminDLQPage() {
	const t = await getTranslations('admin.dlq')

	// Server-side initial data (admin layout requires admin scope); the client
	// dashboard refreshes via AdminService ListDlq (sole Connect).
	const rows = await db.query.deadLetterQueue.findMany({
		orderBy: desc(deadLetterQueue.createdAt),
		limit: PAGINATION.ADMIN_DEFAULT_LIMIT,
	})
	const statusRows: { status: string; count: number }[] = await db
		.select({
			status: deadLetterQueue.status,
			count: sql<number>`count(*)`,
		})
		.from(deadLetterQueue)
		.groupBy(deadLetterQueue.status)
	const workflowRows: { workflowName: string; count: number }[] = await db
		.select({
			workflowName: deadLetterQueue.workflowName,
			count: sql<number>`count(*)`,
		})
		.from(deadLetterQueue)
		.groupBy(deadLetterQueue.workflowName)
	const total = await db.select({ count: sql<number>`count(*)` }).from(deadLetterQueue)

	const countFor = (status: string) => statusRows.find((r) => r.status === status)?.count ?? 0
	const byWorkflow: Record<string, number> = {}
	for (const row of workflowRows) byWorkflow[row.workflowName] = row.count

	const stats = {
		total: total[0]?.count ?? 0,
		pending: countFor('pending'),
		retrying: countFor('retrying'),
		resolved: countFor('resolved'),
		failed: countFor('failed'),
		byWorkflow,
	}

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t('title')}</h1>
				<p className="admin-page-subtitle">{t('subtitle')}</p>
			</div>

			{/* DLQ Dashboard */}
			<DLQDashboard initialStats={stats} initialItems={rows} />
		</div>
	)
}
