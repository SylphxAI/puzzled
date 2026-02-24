import { currentUser } from '@sylphx/sdk/nextjs'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SubscriptionSettingsContent } from './subscription-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('subscription.title'),
	}
}

export default async function SubscriptionSettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings/subscription`)
	}

	return <SubscriptionSettingsContent />
}
