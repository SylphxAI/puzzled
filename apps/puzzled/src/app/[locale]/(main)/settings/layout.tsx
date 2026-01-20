import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { currentUser } from '@sylphx/sdk/nextjs'
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

const settingsLinks = [
	{ href: '/settings', label: 'Overview' },
	{ href: '/settings/profile', label: 'Profile' },
	{ href: '/settings/account', label: 'Account' },
	{ href: '/settings/preferences', label: 'Preferences' },
	{ href: '/settings/notifications', label: 'Notifications' },
	{ href: '/settings/security', label: 'Security' },
	{ href: '/settings/subscription', label: 'Subscription' },
	{ href: '/settings/referrals', label: 'Referrals' },
	{ href: '/settings/privacy', label: 'Privacy' },
]

export default async function SettingsLayout({ children, params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()

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
						<h1 className="text-2xl font-bold tracking-tight">Settings</h1>
						<p className="text-muted-foreground">Manage your account settings and preferences</p>
					</div>

					<div className="flex flex-col gap-6 md:flex-row md:gap-8">
						{/* Sidebar */}
						<nav className="w-full shrink-0 md:w-48">
							<ul className="flex flex-row gap-2 overflow-x-auto md:flex-col md:gap-1">
								{settingsLinks.map((link) => (
									<li key={link.href}>
										<Link
											href={`/${locale}${link.href}`}
											className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
										>
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</nav>

						{/* Main Content Area */}
						<div className="w-full flex-1 space-y-6 md:max-w-[800px]">{children}</div>
					</div>
				</div>
			</main>
		</>
	)
}
