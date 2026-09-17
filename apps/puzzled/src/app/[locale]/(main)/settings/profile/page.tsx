import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireMember } from '@/features/console/lib/require-member'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ProfileSettingsContent } from './profile-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return buildPageMetadata({
		locale,
		path: '/settings/profile',
		title: t('profile.title'),
		description: t('profile.description'),
		noindex: true,
	})
}

export default async function ProfileSettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	await requireMember({ locale, returnTo: '/settings/profile' })

	return <ProfileSettingsContent />
}
