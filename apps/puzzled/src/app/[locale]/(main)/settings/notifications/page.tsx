import { Bell } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { NotificationSettings } from '@/features/settings/components'
import { getNotificationPreferences } from '@/features/settings/server'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('notifications.metaTitle'),
	}
}

export default async function NotificationsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	// Auth is handled by layout - no need to check here
	const t = await getTranslations('settings')

	// Get notification preferences
	const notificationPrefs = await getNotificationPreferences()

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
					<Bell className="h-6 w-6 text-amber-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('notifications.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('notifications.description')}</p>
				</div>
			</div>

			{/* Notification Settings */}
			{notificationPrefs ? (
				<NotificationSettings initialPreferences={notificationPrefs} />
			) : (
				<div className="rounded-xl border bg-muted/30 p-6 text-center">
					<p className="text-sm text-muted-foreground">{t('notifications.loadError')}</p>
				</div>
			)}
		</div>
	)
}
