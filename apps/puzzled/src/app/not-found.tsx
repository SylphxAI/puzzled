import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { defaultLocale, isValidLocale, locales } from '@/lib/i18n/config'
import { buildNotFoundContent, NotFoundView } from '@/shared/components/not-found-view'

/**
 * 404 for every request that matches no route. `[locale]` is the only
 * top-level segment, so this is where an unknown path, an unknown locale
 * prefix or a dot-path the proxy skips ends up — outside any locale layout,
 * which means this document owns its own `<html>`/`<body>` and cannot read a
 * provider. The locale is therefore resolved from the request itself: the
 * header next-intl's middleware sets, then the visitor's chosen-locale cookie
 * (`/index.html` and friends are never rewritten), then English.
 *
 * The status stays 404 and Next renders the response `noindex`.
 */
export const metadata: Metadata = {
	title: 'Page not found',
	robots: { index: false, follow: false },
}

async function resolveRequestLocale(): Promise<string> {
	const requestHeaders = await headers()
	for (const header of ['X-NEXT-INTL-LOCALE', 'x-next-intl-locale']) {
		const value = requestHeaders.get(header)
		if (value && locales.includes(value as (typeof locales)[number])) return value
	}

	const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
	if (cookieLocale && isValidLocale(cookieLocale)) return cookieLocale

	return defaultLocale
}

export default async function RootNotFound() {
	const locale = await resolveRequestLocale()
	const { labels, freeGame } = await buildNotFoundContent(locale)

	return (
		<html lang={locale}>
			<body className="antialiased">
				<NotFoundView locale={locale} labels={labels} freeGame={freeGame} />
			</body>
		</html>
	)
}
