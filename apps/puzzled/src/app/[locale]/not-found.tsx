import { getLocale } from 'next-intl/server'
import { defaultLocale, isValidLocale } from '@/lib/i18n/config'
import { buildNotFoundContent, NotFoundView } from '@/shared/components/not-found-view'

/**
 * 404 for a locale that exists and a path inside it that does not: rendered
 * inside `[locale]/layout.tsx`, so the visitor keeps their language, theme and
 * navigation. Next marks the response `noindex`; the status stays 404.
 */
export default async function LocaleNotFound() {
	const requestLocale = await getLocale()
	const locale = isValidLocale(requestLocale) ? requestLocale : defaultLocale
	const { labels, freeGame } = await buildNotFoundContent(locale)

	return <NotFoundView locale={locale} labels={labels} freeGame={freeGame} />
}
