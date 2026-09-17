import { getTranslations } from 'next-intl/server'
import { loadOAuthProviders } from '@/lib/oauth-providers'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { SignUpForm } from './signup-form'

export const dynamic = 'force-dynamic'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'auth' })

	return buildPageMetadata({
		locale,
		path: '/signup',
		title: t('signUpTitle'),
		description: t('signUpDescription'),
		imagePath: ogImagePath({
			title: t('signUpTitle'),
			subtitle: t('signUpDescription'),
			eyebrow: 'Puzzled',
		}),
		noindex: true,
		withAlternates: false,
	})
}

export default async function SignUpPage() {
	const providers = await loadOAuthProviders()

	return <SignUpForm providers={providers} />
}
