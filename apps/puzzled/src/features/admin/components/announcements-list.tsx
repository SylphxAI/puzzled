'use client'

import { Bell, Calendar, Clock, Crown, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Announcement } from '@/lib/db/schema'
import { EditAnnouncementButton } from './announcement-editor'

const typeStyles: Record<string, { bg: string; text: string; label: string }> = {
	info: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Info' },
	warning: {
		bg: 'bg-amber-500/10',
		text: 'text-amber-400',
		label: 'Warning',
	},
	success: {
		bg: 'bg-emerald-500/10',
		text: 'text-emerald-400',
		label: 'Success',
	},
	maintenance: {
		bg: 'bg-purple-500/10',
		text: 'text-purple-400',
		label: 'Maintenance',
	},
}

export function AnnouncementsList({ announcements }: { announcements: Announcement[] }) {
	const t = useTranslations('admin.announcements')

	if (announcements.length === 0) {
		return (
			<div className="admin-card p-12 text-center">
				<Bell className="mx-auto mb-4 h-12 w-12 text-[var(--admin-text-muted)]" />
				<h3 className="text-lg font-medium text-[var(--admin-text-primary)]">
					{t('noAnnouncementsYet')}
				</h3>
				<p className="mt-1 text-sm text-[var(--admin-text-muted)]">{t('noAnnouncementsHint')}</p>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			{announcements.map((announcement, index) => (
				<AnnouncementCard key={announcement.id} announcement={announcement} delay={index} />
			))}
		</div>
	)
}

function AnnouncementCard({
	announcement,
	delay = 0,
}: {
	announcement: Announcement
	delay?: number
}) {
	const t = useTranslations('admin.announcements')
	const typeStyle = typeStyles[announcement.type] || typeStyles.info

	const formatDate = (date: Date | null) => {
		if (!date) return null
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
	}

	return (
		<div className="admin-card admin-animate-in" style={{ animationDelay: `${delay * 0.05}s` }}>
			{/* Header */}
			<div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4">
				<div className="flex items-center gap-3">
					<h3 className="text-lg font-semibold text-[var(--admin-text-primary)]">
						{announcement.title}
					</h3>
					<span
						className={`admin-badge ${announcement.isActive ? 'admin-badge-success' : 'admin-badge-default'}`}
					>
						{announcement.isActive ? t('active') : t('inactive')}
					</span>
					<span
						className={`rounded-md px-2 py-0.5 text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}
					>
						{typeStyle.label}
					</span>
				</div>
				<EditAnnouncementButton announcement={announcement} />
			</div>

			{/* Content */}
			<div className="p-6">
				<p className="mb-4 text-sm text-[var(--admin-text-secondary)]">{announcement.content}</p>

				{/* Metadata */}
				<div className="flex flex-wrap gap-4 text-xs text-[var(--admin-text-muted)]">
					{/* Targeting */}
					<div className="flex items-center gap-1.5">
						{announcement.targetPremiumOnly ? (
							<>
								<Crown className="h-3.5 w-3.5" />
								<span>{t('premiumOnly')}</span>
							</>
						) : (
							<>
								<Users className="h-3.5 w-3.5" />
								<span>{t('allUsers')}</span>
							</>
						)}
					</div>

					{/* Dismissible */}
					{announcement.dismissible && (
						<div className="flex items-center gap-1.5">
							<span className="admin-badge admin-badge-default text-xs">{t('dismissible')}</span>
						</div>
					)}

					{/* Show once */}
					{announcement.showOnce && (
						<div className="flex items-center gap-1.5">
							<span className="admin-badge admin-badge-default text-xs">{t('showOnce')}</span>
						</div>
					)}

					{/* Schedule */}
					{(announcement.startsAt || announcement.endsAt) && (
						<div className="flex items-center gap-1.5">
							<Calendar className="h-3.5 w-3.5" />
							{announcement.startsAt && <span>{formatDate(announcement.startsAt)}</span>}
							{announcement.startsAt && announcement.endsAt && <span>→</span>}
							{announcement.endsAt && <span>{formatDate(announcement.endsAt)}</span>}
						</div>
					)}

					{/* Created */}
					<div className="flex items-center gap-1.5 ml-auto">
						<Clock className="h-3.5 w-3.5" />
						<span>Created {formatDate(announcement.createdAt)}</span>
					</div>
				</div>
			</div>
		</div>
	)
}
