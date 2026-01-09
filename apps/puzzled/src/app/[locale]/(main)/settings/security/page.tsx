import { ExternalLink, Shield } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { currentUser } from '@sylphx/platform-sdk/nextjs'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('security.title'),
	}
}

export default async function SecuritySettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings/security`)
	}

	const t = await getTranslations('settings')

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
					<Shield className="h-6 w-6 text-emerald-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('security.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('security.description')}</p>
				</div>
			</div>

			{/* Platform Managed Notice */}
			<div className="rounded-2xl border bg-card p-6">
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
						<Shield className="h-8 w-8 text-emerald-500" />
					</div>
					<h2 className="mb-2 text-lg font-semibold">
						Security settings are managed through the Sylphx Platform
					</h2>
					<p className="mb-6 max-w-md text-sm text-muted-foreground">
						For your security, account protection features like two-factor authentication,
						password management, and session controls are managed centrally through the Sylphx
						Platform.
					</p>
					<a
						href="https://platform.sylphx.com/settings/security"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
					>
						Open Platform Security Settings
						<ExternalLink className="h-4 w-4" />
					</a>
				</div>
			</div>
		</div>
	)
}
