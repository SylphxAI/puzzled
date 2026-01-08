import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { getServerUser } from '@/features/auth/server'
import { SettingsHeader, SettingsSidebar } from '@/features/settings'
import { Header } from '@/shared/components/layout'

type Props = {
	children: ReactNode
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'common' })

	return {
		title: t('settings'),
	}
}

export default async function SettingsLayout({ children, params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await getServerUser()

	// Redirect to login if not authenticated
	if (!user) {
		redirect(`/${locale}/login`)
	}

	return (
		<>
			<Header />
			<main className="flex flex-1 flex-col px-4 py-6">
				<div className="mx-auto w-full max-w-6xl">
					<div className="mb-6">
						<SettingsHeader />
					</div>

					<div className="flex flex-col gap-6 md:flex-row md:gap-8">
						<SettingsSidebar />

						{/* Main Content Area - Full width on mobile, constrained on desktop */}
						<div className="w-full flex-1 space-y-6 md:max-w-[800px]">{children}</div>
					</div>
				</div>
			</main>
		</>
	)
}
