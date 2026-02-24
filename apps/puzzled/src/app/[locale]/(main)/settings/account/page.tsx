import { currentUser } from '@sylphx/sdk/nextjs'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AccountSettingsContent } from './account-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('account.title'),
	}
}

export default async function AccountSettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings/account`)
	}

	return <AccountSettingsContent />
}
