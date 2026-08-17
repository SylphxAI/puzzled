export const dynamic = 'force-dynamic'

import { getTranslations } from 'next-intl/server'
import { CreateAnnouncementButton } from '@/features/admin/components/announcement-editor'
import { AnnouncementsList } from '@/features/admin/components/announcements-list'

export default async function AdminAnnouncementsPage() {
	const t = await getTranslations('admin.announcements')

	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="admin-page-header">
					<h1 className="admin-page-title">{t('title')}</h1>
					<p className="admin-page-subtitle">{t('subtitle')}</p>
				</div>
				<CreateAnnouncementButton />
			</div>

			{/* Announcements List */}
			<AnnouncementsList />
		</div>
	)
}
