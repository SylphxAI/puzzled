export const dynamic = 'force-dynamic'

import { desc } from 'drizzle-orm'
import { Bell } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { CreateAnnouncementButton } from '@/features/admin/components/announcement-editor'
import { AnnouncementsList } from '@/features/admin/components/announcements-list'
import { db } from '@/lib/db'
import { announcements } from '@/lib/db/schema'

async function getAnnouncements() {
	return db.query.announcements.findMany({
		orderBy: desc(announcements.createdAt),
	})
}

export default async function AdminAnnouncementsPage() {
	const t = await getTranslations('admin.announcements')
	const allAnnouncements = await getAnnouncements()

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
			{allAnnouncements.length === 0 ? (
				<div className="admin-card admin-animate-in border-dashed p-12 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-bg-surface)]">
						<Bell className="h-6 w-6 text-[var(--admin-text-muted)]" />
					</div>
					<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{t('noAnnouncementsYet')}
					</h3>
					<p className="mt-1 text-[var(--admin-text-muted)]">{t('noAnnouncementsHint')}</p>
				</div>
			) : (
				<AnnouncementsList announcements={allAnnouncements} />
			)}
		</div>
	)
}
