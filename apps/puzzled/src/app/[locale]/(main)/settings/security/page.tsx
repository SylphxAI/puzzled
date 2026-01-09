import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { currentUser } from '@sylphx/platform-sdk/nextjs'
import { SecuritySettingsContent } from './security-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('security.title'),
	}
}

export default async function SecuritySettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings/security`)
	}

	return <SecuritySettingsContent />
}
