import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ConsoleCard, ConsoleHeader } from '@/features/console/components/console-chrome'
import { requireMember } from '@/features/console/lib/require-member'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { NotificationsClient } from './notifications-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return buildPageMetadata({
		locale,
		path: '/settings/notifications',
		title: t('notifications.metaTitle'),
		description: t('notifications.description'),
		noindex: true,
	})
}

export default async function NotificationsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	await requireMember({ locale, returnTo: '/settings/notifications' })

	const t = await getTranslations('settings')

	return (
		<>
			<ConsoleHeader
				headingLevel={2}
				title={t('notifications.title')}
				description={t('notifications.description')}
			/>
			<ConsoleCard
				title={t('notifications.channelTitle')}
				description={t('notifications.channelDescription')}
			>
				<NotificationsClient />
			</ConsoleCard>
		</>
	)
}
