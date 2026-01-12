import { Bell } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { currentUser } from '@sylphx/platform-sdk/nextjs'
import { NotificationsClient } from './notifications-client'

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

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings/notifications`)
	}

	const t = await getTranslations('settings')

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

			{/* Notification Preferences */}
			<div className="rounded-2xl border bg-card p-6">
				<NotificationsClient />
			</div>
		</div>
	)
}
