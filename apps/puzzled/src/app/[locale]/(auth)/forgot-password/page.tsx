import { getTranslations } from 'next-intl/server'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { ForgotPasswordForm } from './forgot-password-form'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'auth' })

	return buildPageMetadata({
		locale,
		path: '/forgot-password',
		title: t('forgotPasswordTitle'),
		description: t('forgotPasswordDescription'),
		imagePath: ogImagePath({
			title: t('forgotPasswordTitle'),
			subtitle: t('forgotPasswordDescription'),
			eyebrow: 'Puzzled',
		}),
		noindex: true,
		withAlternates: false,
	})
}

export default function ForgotPasswordPage() {
	return <ForgotPasswordForm />
}
