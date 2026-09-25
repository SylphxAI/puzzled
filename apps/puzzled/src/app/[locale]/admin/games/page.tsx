export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { requireAdmin } from '@/features/admin'
import { GamesOverview } from '@/features/admin/components/games-overview'

export default async function AdminGamesPage() {
	// Each page re-checks admin: an RSC request for the page alone skips the layout.
	await requireAdmin()
	const t = await getTranslations('admin.games')

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="admin-page-header">
				<h1 className="admin-page-title">{t('title')}</h1>
				<p className="admin-page-subtitle">{t('subtitle')}</p>
			</div>

			{/* Games Overview with live stats */}
			<GamesOverview />
		</div>
	)
}
