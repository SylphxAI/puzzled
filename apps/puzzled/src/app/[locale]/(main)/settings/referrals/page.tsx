import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ConsoleHeader } from '@/features/console/components/console-chrome'
import { requireMember } from '@/features/console/lib/require-member'
import { buildPageMetadata } from '@/lib/seo/metadata'
import { ReferralsContent } from './referrals-client'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'referrals' })

	return buildPageMetadata({
		locale,
		path: '/settings/referrals',
		title: t('title'),
		description: t('description'),
		noindex: true,
	})
}

export default async function ReferralsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	await requireMember({ locale, returnTo: '/settings/referrals' })

	const t = await getTranslations('referrals')

	return (
		<>
			<ConsoleHeader headingLevel={2} title={t('title')} description={t('description')} />
			<ReferralsContent />
		</>
	)
}
