import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireMember } from '@/features/console/lib/require-member'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { AccountSettingsContent } from './account-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return buildPageMetadata({
		locale,
		path: '/settings/account',
		title: t('account.title'),
		description: t('account.description'),
		noindex: true,
	})
}

export default async function AccountSettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	await requireMember({ locale, returnTo: '/settings/account' })

	return <AccountSettingsContent />
}
