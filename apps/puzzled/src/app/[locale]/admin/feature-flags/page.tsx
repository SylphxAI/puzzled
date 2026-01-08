export const dynamic = 'force-dynamic'

import { desc } from 'drizzle-orm'
import { Flag } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { CreateFeatureFlagButton } from '@/features/admin/components/feature-flag-editor'
import { FeatureFlagsList } from '@/features/admin/components/feature-flags-list'
import { db } from '@/lib/db'
import { featureFlags } from '@/lib/db/schema'

async function getFeatureFlags() {
	return db.query.featureFlags.findMany({
		orderBy: desc(featureFlags.createdAt),
	})
}

export default async function AdminFeatureFlagsPage() {
	const t = await getTranslations('admin.featureFlags')
	const allFlags = await getFeatureFlags()

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="admin-page-header">
					<h1 className="admin-page-title">{t('title')}</h1>
					<p className="admin-page-subtitle">{t('subtitle')}</p>
				</div>
				<CreateFeatureFlagButton />
			</div>

			{/* Feature Flags List */}
			{allFlags.length === 0 ? (
				<div className="admin-card admin-animate-in border-dashed p-12 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-bg-surface)]">
						<Flag className="h-6 w-6 text-[var(--admin-text-muted)]" />
					</div>
					<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{t('noFlagsYet')}
					</h3>
					<p className="mt-1 text-[var(--admin-text-muted)]">{t('noFlagsHint')}</p>
				</div>
			) : (
				<FeatureFlagsList flags={allFlags} />
			)}
		</div>
	)
}
