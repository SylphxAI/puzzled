import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ConsoleHeader } from '@/features/console/components/console-chrome'
import { SettingsNav } from '@/features/console/components/settings-nav'
import { redirect } from '@/lib/i18n/routing'
import { currentUser } from '@/lib/identity/server'
import { buildPageMetadata } from '@/lib/seo/metadata'

type Props = {
	children: ReactNode
	params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
	const { locale } = await params
	const t = await getTranslations({ locale, namespace: 'settings' })

	return buildPageMetadata({
		locale,
		path: '/settings',
		title: t('title'),
		description: t('subtitle'),
		// Account surfaces stay out of search.
		noindex: true,
	})
}

/**
 * Account settings frame: one h1, one section rail, and the section the URL
 * names. Signed-in only — visitors without a session go to sign-in and come
 * back here afterwards.
 */
export default async function SettingsLayout({ children, params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const user = await currentUser()
	if (!user) {
		redirect({ href: { pathname: '/login', query: { callbackUrl: '/settings' } }, locale })
	}

	const t = await getTranslations('settings')

	return (
		<main className="page-shell-wide py-8 md:py-10">
			<ConsoleHeader eyebrow={t('eyebrow')} title={t('title')} description={t('subtitle')} />

			<div className="mt-6 flex flex-col gap-6 md:flex-row md:gap-8">
				<div className="md:w-56 md:shrink-0">
					<SettingsNav />
				</div>
				<div className="min-w-0 flex-1 space-y-6">{children}</div>
			</div>
		</main>
	)
}
