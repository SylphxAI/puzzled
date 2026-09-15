import { getTranslations } from 'next-intl/server'
import { loadOAuthProviders } from '@/lib/oauth-providers'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { LoginForm } from './login-form'

// Auth pages must SSR on every request to reflect admin config changes
// (e.g. disabling OAuth providers). Never statically generate these.
export const dynamic = 'force-dynamic'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'auth' })

	return buildPageMetadata({
		locale,
		path: '/login',
		title: t('signInTitle'),
		description: t('signInDescription'),
		imagePath: ogImagePath({
			title: t('signInTitle'),
			subtitle: t('signInDescription'),
			eyebrow: 'Puzzled',
		}),
		noindex: true,
		withAlternates: false,
	})
}

export default async function LoginPage() {
	const providers = await loadOAuthProviders()

	return <LoginForm providers={providers} />
}
