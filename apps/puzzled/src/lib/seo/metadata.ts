import type { Metadata } from 'next'
import { defaultLocale, type Locale, locales } from '@/lib/i18n/config'
import { getRequestSiteOrigin } from '@/lib/site-origin.server'

/**
 * Request-scoped metadata builder.
 *
 * Next.js replaces `alternates`, `openGraph` and `twitter` object-by-object
 * when a child route sets any of them, so a page that only sets a title would
 * silently lose the layout's hreflang cluster. Every public route therefore
 * builds its metadata here, and canonical + hreflang + social cards are always
 * emitted together and self-referential.
 */

/** Open Graph locale codes for the supported locales. */
const OG_LOCALES: Record<Locale, string> = {
	'en-US': 'en_US',
	'en-GB': 'en_GB',
	'zh-HK': 'zh_HK',
	'zh-TW': 'zh_TW',
	'zh-CN': 'zh_CN',
}

/** BCP 47 tags used by `<html lang>` and the hreflang cluster. */
export const HREFLANG: Record<Locale, string> = {
	'en-US': 'en-US',
	'en-GB': 'en-GB',
	'zh-HK': 'zh-HK',
	'zh-TW': 'zh-TW',
	'zh-CN': 'zh-CN',
}

/** Locale-prefixed pathname; the default locale has no prefix. */
export function localizedPath(locale: Locale | string, path = '/'): string {
	const normalized = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`
	if (locale === defaultLocale) return normalized || '/'
	return `/${locale}${normalized}`
}

/** Absolute self-referencing URL for one page. */
export function canonicalUrl(baseUrl: string, locale: Locale | string, path = '/'): string {
	const localized = localizedPath(locale, path)
	// The site root is the bare origin: `https://puzzled.gg` and
	// `https://puzzled.gg/` are one URL to a crawler, and the served canonical
	// for the home page is the origin itself.
	return localized === '/' ? baseUrl : `${baseUrl}${localized}`
}

/**
 * The hreflang cluster for one locale-agnostic path: every supported locale
 * plus `x-default` pointing at the default-locale URL.
 *
 * Canonical and cluster are always derived from the same base URL + path, so a
 * page can never advertise alternates that point at a different route — and
 * the sitemap can reuse the exact cluster the HTML emits.
 */
export function hreflangLanguages(baseUrl: string, path = '/'): Record<string, string> {
	return Object.fromEntries([
		['x-default', canonicalUrl(baseUrl, defaultLocale, path)],
		...locales.map((entry) => [HREFLANG[entry], canonicalUrl(baseUrl, entry, path)]),
	])
}

export type BuildPageMetadataInput = {
	locale: Locale | string
	/** Route path without locale prefix, e.g. `/games/sudoku`. */
	path?: string
	title: string
	description: string
	/** Absolute or root-relative social image; defaults to the OG route. */
	imagePath?: string
	/** Extra alt text for the social image. */
	imageAlt?: string
	type?: 'website' | 'article'
	/** Private or thin surfaces opt out of search indexing. */
	noindex?: boolean
	/** Set false for post-auth or utility routes that need no language cluster. */
	withAlternates?: boolean
	/** Override the request origin (tests, cron-built artifacts). */
	baseUrl?: string
}

/**
 * Full metadata for one public page: canonical, hreflang cluster, Open Graph
 * and Twitter card stay consistent by construction.
 */
export async function buildPageMetadata({
	locale,
	path = '/',
	title,
	description,
	imagePath,
	imageAlt,
	type = 'website',
	noindex = false,
	withAlternates = true,
	baseUrl: baseUrlOverride,
}: BuildPageMetadataInput): Promise<Metadata> {
	const baseUrl = baseUrlOverride ?? (await getRequestSiteOrigin())
	const canonical = canonicalUrl(baseUrl, locale, path)
	// Default to a card carrying this page's own title: a shared static banner
	// makes every shared link look the same.
	const image = imagePath?.startsWith('http')
		? imagePath
		: `${baseUrl}${imagePath ?? ogImagePath({ title })}`
	const alt = imageAlt ?? title

	const languages = withAlternates ? hreflangLanguages(baseUrl, path) : undefined

	return {
		title,
		description,
		...(noindex ? { robots: { index: false, follow: false } } : {}),
		alternates: withAlternates ? { languages } : {},
		openGraph: {
			type,
			siteName: 'Puzzled',
			url: canonical,
			locale: OG_LOCALES[locale as Locale] ?? 'en_US',
			alternateLocale: locales
				.filter((entry) => entry !== locale)
				.map((entry) => OG_LOCALES[entry]),
			title,
			description,
			images: [{ url: image, width: 1200, height: 630, alt }],
		},
		twitter: {
			card: 'summary_large_image',
			title,
			description,
			images: [image],
		},
	}
}

/** URL for the dynamic Open Graph image of a page. */
export function ogImagePath(params: {
	title: string
	subtitle?: string
	eyebrow?: string
	badge?: string
	theme?: string
}): string {
	const search = new URLSearchParams({ title: params.title })
	if (params.subtitle) search.set('subtitle', params.subtitle)
	if (params.eyebrow) search.set('eyebrow', params.eyebrow)
	if (params.badge) search.set('badge', params.badge)
	if (params.theme) search.set('theme', params.theme)
	return `/og?${search.toString()}`
}
