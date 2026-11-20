import type { MetadataRoute } from 'next'
import { getGameSlugs } from '@/games/registry'
import { defaultLocale, locales } from '@/lib/i18n/config'
import { canonicalUrl, hreflangLanguages } from '@/lib/seo/metadata'
import { GAME_PAGE_ROUTE, PUBLIC_ROUTES, type PublicRoute } from '@/lib/seo/routes'
import { getServerBaseUrl } from '@/lib/utils'

/**
 * `/sitemap.xml` — public indexable URLs only.
 *
 * Localised routes emit one entry per locale carrying the reciprocal hreflang
 * cluster the HTML emits (`xhtml:link` alternates). English-only editorial
 * routes (`/vs`, `/vs/*`, `/use-cases/*`) emit only the canonical `en-US` URL
 * so untranslated locale duplicates never dilute search equity. Private,
 * per-user and transactional surfaces are absent by construction;
 * `lib/seo/routes.ts` owns that split and `scripts/seo-verify.ts` asserts it
 * against a served build.
 *
 * No `lastmod`: the app has no per-URL modification date, and stamping every
 * URL with the build time would publish a freshness signal that is not real.
 */
export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = getServerBaseUrl()
	const pages: readonly PublicRoute[] = [
		...PUBLIC_ROUTES,
		...getGameSlugs().map((slug) => ({ path: `/games/${slug}`, ...GAME_PAGE_ROUTE })),
	]

	return pages.flatMap((page) => {
		if (page.englishOnly) {
			return [
				{
					url: canonicalUrl(baseUrl, defaultLocale, page.path),
					changeFrequency: page.changeFrequency,
					priority: page.priority,
				},
			]
		}
		const languages = hreflangLanguages(baseUrl, page.path)
		return locales.map((locale) => ({
			url: canonicalUrl(baseUrl, locale, page.path),
			changeFrequency: page.changeFrequency,
			priority: page.priority,
			alternates: { languages },
		}))
	})
}
