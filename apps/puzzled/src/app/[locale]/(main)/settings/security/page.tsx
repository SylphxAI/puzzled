import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireMember } from '@/features/console/lib/require-member'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { SecuritySettingsContent } from './security-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return buildPageMetadata({
		locale,
		path: '/settings/security',
		title: t('security.title'),
		description: t('security.description'),
		noindex: true,
	})
}

export default async function SecuritySettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	await requireMember({ locale, returnTo: '/settings/security' })

	return <SecuritySettingsContent />
}
