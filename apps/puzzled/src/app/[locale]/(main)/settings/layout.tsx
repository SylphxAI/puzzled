import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ConsoleHeader } from '@/features/console/components/console-chrome'
import { SettingsNav } from '@/features/console/components/settings-nav'
import { CLIENT_NAMESPACES, pickMessages } from '@/lib/i18n/client-messages'
import { currentUser } from '@/lib/identity/server'
import { withPresentationDeadline } from '@/lib/presentation-document'
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
 * names. Every settings page runs its own `requireMember` guard; anonymous
 * post-payment checkout returns (`/settings/subscription?checkout=success&s=...` or `&session_id=...`)
 * render a clean claim prompt without account chrome instead of losing the checkout session id.
 */
export default async function SettingsLayout({ children, params }: Props) {
	const { locale } = await params
	setRequestLocale(locale)

	const [user, messages] = await Promise.all([
		withPresentationDeadline(currentUser(), null),
		getMessages(),
	])
	const picked = pickMessages(messages, [...CLIENT_NAMESPACES, 'settings'])

	if (!user) {
		return (
			<NextIntlClientProvider messages={picked}>
				<main className="page-shell-wide py-8 md:py-12">{children}</main>
			</NextIntlClientProvider>
		)
	}

	const t = await getTranslations('settings')

	return (
		<NextIntlClientProvider messages={picked}>
			<main className="page-shell-wide py-8 md:py-10">
				<ConsoleHeader eyebrow={t('eyebrow')} title={t('title')} description={t('subtitle')} />

				<div className="mt-6 flex flex-col gap-6 md:flex-row md:gap-8">
					<div className="md:w-56 md:shrink-0">
						<SettingsNav />
					</div>
					<div className="min-w-0 flex-1 space-y-6">{children}</div>
				</div>
			</main>
		</NextIntlClientProvider>
	)
}
