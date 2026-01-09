export const dynamic = 'force-dynamic'

import { CreditCard } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { CreatePlanButton } from '@/features/admin/components/plan-editor'
import { SeedPlansButton } from '@/features/admin/components/plans-actions'
import { PlansList } from '@/features/admin/components/plans-list'
import { db } from '@/lib/db'
import { plans } from '@/lib/db/schema'

async function getPlans() {
	return db.query.plans.findMany({
		with: { prices: true },
		orderBy: plans.sortOrder,
	})
}

export default async function AdminPlansPage() {
	const t = await getTranslations('admin.plans')
	const allPlans = await getPlans()

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="admin-page-header">
					<h1 className="admin-page-title">{t('title')}</h1>
					<p className="admin-page-subtitle">{t('subtitle')}</p>
				</div>
				<div className="flex gap-2">
					{allPlans.length === 0 && <SeedPlansButton />}
					<CreatePlanButton />
				</div>
			</div>

			{/* Plans List */}
			{allPlans.length === 0 ? (
				<div className="admin-card admin-animate-in border-dashed p-12 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-bg-surface)]">
						<CreditCard className="h-6 w-6 text-[var(--admin-text-muted)]" />
					</div>
					<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{t('noPlansYet')}
					</h3>
					<p className="mt-1 text-[var(--admin-text-muted)]">{t('noPlansHint')}</p>
				</div>
			) : (
				<PlansList plans={allPlans} />
			)}
		</div>
	)
}
