'use client'

import { Bell, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { Announcement } from '@/gen/connect/puzzled/v1/admin_pb'
import { useAnnouncements } from '@/lib/api'
import { EditAnnouncementButton } from './announcement-editor'

const typeStyles: Record<string, { bg: string; text: string; label: string }> = {
	info: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'typeInfo' },
	warning: {
		bg: 'bg-amber-500/10',
		text: 'text-amber-400',
		label: 'typeWarning',
	},
	success: {
		bg: 'bg-emerald-500/10',
		text: 'text-emerald-400',
		label: 'typeSuccess',
	},
	maintenance: {
		bg: 'bg-purple-500/10',
		text: 'text-purple-400',
		label: 'typeMaintenance',
	},
}

export function AnnouncementsList() {
	const t = useTranslations('admin.announcements')
	const locale = useLocale()
	const { data, error, isLoading, refetch } = useAnnouncements()

	if (isLoading && !data) {
		return (
			<div className="admin-card flex items-center justify-center gap-3 p-12 text-[var(--admin-text-muted)]">
				<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
				<span>{t('loading')}</span>
			</div>
		)
	}

	if (error && !data) {
		return (
			<div className="admin-card p-12 text-center">
				<XCircle className="mx-auto mb-4 h-12 w-12 text-[var(--admin-error)]" />
				<h3 className="text-lg font-medium text-[var(--admin-text-primary)]">{t('error')}</h3>
				<p className="mt-1 text-sm text-[var(--admin-text-muted)]">{t('errorHint')}</p>
				<button type="button" className="admin-btn admin-btn-ghost mt-6" onClick={() => refetch()}>
					<RefreshCw className="h-4 w-4" />
					{t('refresh')}
				</button>
			</div>
		)
	}

	const announcements = data ?? []

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
				<AnnouncementCard
					key={announcement.id}
					announcement={announcement}
					delay={index}
					locale={locale}
				/>
			))}
		</div>
	)
}

function AnnouncementCard({
	announcement,
	delay = 0,
	locale,
}: {
	announcement: Announcement
	delay?: number
	locale: string
}) {
	const t = useTranslations('admin.announcements')
	const typeStyle = typeStyles[announcement.type] || typeStyles.info

	const formatDate = (date: string) => {
		if (!date) return null
		return new Date(date).toLocaleDateString(locale, {
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
						className={`admin-badge ${announcement.active ? 'admin-badge-success' : 'admin-badge-default'}`}
					>
						{announcement.active ? t('active') : t('inactive')}
					</span>
					<span
						className={`rounded-md px-2 py-0.5 text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}
					>
						{t(typeStyle.label)}
					</span>
				</div>
				<EditAnnouncementButton announcement={announcement} />
			</div>

			{/* Content */}
			<div className="p-6">
				<p className="mb-4 text-sm text-[var(--admin-text-secondary)]">{announcement.body}</p>

				{/* Metadata */}
				<div className="flex flex-wrap gap-4 text-xs text-[var(--admin-text-muted)]">
					{/* Created */}
					<div className="ml-auto flex items-center gap-1.5">
						<Clock className="h-3.5 w-3.5" />
						<span>
							{t('created')}: {formatDate(announcement.createdAt)}
						</span>
					</div>
				</div>
			</div>
		</div>
	)
}
