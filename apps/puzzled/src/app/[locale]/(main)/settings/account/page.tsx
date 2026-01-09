import { ExternalLink, UserCircle } from 'lucide-react'
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
		title: t('account.title'),
	}
}

export default async function AccountSettingsPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings/account`)
	}

	const t = await getTranslations('settings')

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20">
					<UserCircle className="h-6 w-6 text-primary" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('account.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('account.description')}</p>
				</div>
			</div>

			{/* Platform Managed Notice */}
			<div className="rounded-2xl border bg-card p-6">
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
						<UserCircle className="h-8 w-8 text-primary" />
					</div>
					<h2 className="mb-2 text-lg font-semibold">
						Account settings are managed through the Sylphx Platform
					</h2>
					<p className="mb-6 max-w-md text-sm text-muted-foreground">
						Email, password, and connected accounts are managed through the central Sylphx
						Platform for a unified experience across all applications.
					</p>
					<a
						href="https://platform.sylphx.com/settings/account"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						Open Platform Account Settings
						<ExternalLink className="h-4 w-4" />
					</a>
				</div>
			</div>
		</div>
	)
}
