export const dynamic = 'force-dynamic'

import { Globe, Settings } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { currentUser } from '@sylphx/platform-sdk/nextjs'
import { LanguageSwitcher } from '@/shared/components/layout'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return {
		title: t('preferences.title'),
	}
}

export default async function PreferencesPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings/preferences`)
	}

	const t = await getTranslations('settings')

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20">
					<Settings className="h-6 w-6 text-violet-500" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">{t('preferences.title')}</h1>
					<p className="text-sm text-muted-foreground">{t('preferences.description')}</p>
				</div>
			</div>

			{/* Language Section */}
			<div className="rounded-2xl border bg-card p-6">
				<div className="flex items-start gap-4">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
						<Globe className="h-5 w-5 text-primary" />
					</div>
					<div className="flex-1">
						<h2 className="font-semibold">{t('preferences.language.title')}</h2>
						<p className="mb-4 text-sm text-muted-foreground">
							{t('preferences.language.description')}
						</p>
						<LanguageSwitcher />
					</div>
				</div>
			</div>

			{/* Coming Soon Notice */}
			<div className="rounded-xl border bg-muted/30 p-4">
				<p className="text-sm text-muted-foreground">
					More preferences like appearance settings and regional formats will be available soon.
				</p>
			</div>
		</div>
	)
}
