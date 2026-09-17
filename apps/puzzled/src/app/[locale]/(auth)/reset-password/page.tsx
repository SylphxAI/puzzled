import { Loader2 } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { buildPageMetadata, ogImagePath } from '@/lib/seo/metadata'
import { ResetPasswordForm } from './reset-password-form'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'auth' })

	return buildPageMetadata({
		locale,
		path: '/reset-password',
		title: t('resetPasswordTitle'),
		description: t('resetPasswordDescription'),
		imagePath: ogImagePath({
			title: t('resetPasswordTitle'),
			subtitle: t('resetPasswordDescription'),
			eyebrow: 'Puzzled',
		}),
		noindex: true,
		withAlternates: false,
	})
}

export default function ResetPasswordPage() {
	return (
		<Suspense
			fallback={
				<div className="surface-card flex h-40 items-center justify-center">
					<Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
				</div>
			}
		>
			<ResetPasswordForm />
		</Suspense>
	)
}
