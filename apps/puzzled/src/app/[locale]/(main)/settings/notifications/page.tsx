import { Bell, ExternalLink } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { currentUser } from '@sylphx/platform-sdk/nextjs'

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

			{/* Platform Managed Notice */}
			<div className="rounded-2xl border bg-card p-6">
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
						<Bell className="h-8 w-8 text-amber-500" />
					</div>
					<h2 className="mb-2 text-lg font-semibold">Notifications coming soon</h2>
					<p className="mb-6 max-w-md text-sm text-muted-foreground">
						Notification preferences will be available soon. In the meantime, you can manage
						email preferences through the Sylphx Platform.
					</p>
					<a
						href="https://platform.sylphx.com/settings/notifications"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-700"
					>
						Open Platform Notifications
						<ExternalLink className="h-4 w-4" />
					</a>
				</div>
			</div>
		</div>
	)
}
