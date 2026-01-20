import { ExternalLink, Shield } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { currentUser } from '@sylphx/sdk/nextjs'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings.privacy' })

	return {
		title: t('title'),
	}
}

export default async function PrivacySettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings/privacy`)
	}

	const t = await getTranslations()

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20">
					<Shield className="h-6 w-6 text-teal-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('settings.privacy.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('settings.privacy.description')}</p>
				</div>
			</div>

			{/* Platform Managed Notice */}
			<div className="rounded-2xl border bg-card p-6">
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10">
						<Shield className="h-8 w-8 text-teal-500" />
					</div>
					<h2 className="mb-2 text-lg font-semibold">
						Privacy settings are managed through the Sylphx Platform
					</h2>
					<p className="mb-6 max-w-md text-sm text-muted-foreground">
						Data privacy, profile visibility, and account deletion options are managed through
						the central Sylphx Platform to ensure consistent privacy controls across all
						applications.
					</p>
					<a
						href="https://platform.sylphx.com/settings/privacy"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-teal-700"
					>
						Open Platform Privacy Settings
						<ExternalLink className="h-4 w-4" />
					</a>
				</div>
			</div>
		</div>
	)
}
