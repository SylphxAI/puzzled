import { Settings } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { currentUser } from '@sylphx/platform-sdk/nextjs'

type Props = {
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'common' })
	return {
		title: t('settings'),
	}
}

export default async function SettingsOverviewPage({ params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

	if (!user) {
		redirect(`/${locale}/login?callbackUrl=/settings`)
	}

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex items-center gap-3">
				<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20">
					<Settings className="h-6 w-6 text-primary" />
				</div>
				<div>
					<h1 className="text-xl font-semibold tracking-tight">Settings Overview</h1>
					<p className="text-sm text-muted-foreground">
						Welcome back, {user.name || user.email}
					</p>
				</div>
			</div>

			{/* Placeholder Card */}
			<div className="rounded-2xl border bg-card p-6">
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
						<Settings className="h-8 w-8 text-muted-foreground" />
					</div>
					<h2 className="mb-2 text-lg font-semibold">Settings coming soon</h2>
					<p className="max-w-md text-sm text-muted-foreground">
						We are working on bringing you a comprehensive settings experience. In the meantime,
						use the navigation to explore available options.
					</p>
				</div>
			</div>
		</div>
	)
}
