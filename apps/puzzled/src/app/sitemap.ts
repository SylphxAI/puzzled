import type { MetadataRoute } from 'next'
import { getGameSlugs } from '@/games/registry'
import { defaultLocale, locales } from '@/lib/i18n/config'
import { getServerBaseUrl } from '@/lib/utils'

const BASE_URL = getServerBaseUrl()

/**
 * Build URL respecting locale prefix strategy (as-needed)
 * Default locale (en) has no prefix, others are prefixed
 */
function buildLocalizedUrl(basePath: string, locale: string): string {
	if (locale === defaultLocale) {
		// Default locale: no prefix (e.g., /games, /pricing)
		return `${BASE_URL}${basePath}`
	}
	// Non-default locales: prefixed (e.g., /zh-Hans/games)
	return `${BASE_URL}/${locale}${basePath}`
}

export default function sitemap(): MetadataRoute.Sitemap {
	// Use registry as SSOT for all games
	const games = getGameSlugs()

	const routes: MetadataRoute.Sitemap = []

	// Static pages for each locale
	const staticPages = [
		{ path: '', changeFrequency: 'daily' as const, priority: 1 },
		{ path: '/games', changeFrequency: 'daily' as const, priority: 0.9 },
		{ path: '/pricing', changeFrequency: 'monthly' as const, priority: 0.7 },
		{ path: '/stats', changeFrequency: 'daily' as const, priority: 0.8 },
		{ path: '/leaderboard', changeFrequency: 'hourly' as const, priority: 0.8 },
		{ path: '/support', changeFrequency: 'monthly' as const, priority: 0.6 },
		{ path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.3 },
		{ path: '/terms', changeFrequency: 'yearly' as const, priority: 0.3 },
		{ path: '/login', changeFrequency: 'yearly' as const, priority: 0.5 },
		{ path: '/signup', changeFrequency: 'yearly' as const, priority: 0.5 },
		{ path: '/settings', changeFrequency: 'yearly' as const, priority: 0.4 },
	]

	// Generate URLs for all 16 locales
	// Per spec: localePrefix 'as-needed' means default locale has no prefix
	for (const locale of locales) {
		// Add static pages
		for (const page of staticPages) {
			routes.push({
				url: buildLocalizedUrl(page.path || '/', locale),
				lastModified: new Date(),
				changeFrequency: page.changeFrequency,
				priority: page.priority,
			})
		}

		// Add game pages (high priority, daily updates)
		for (const game of games) {
			routes.push({
				url: buildLocalizedUrl(`/games/${game}`, locale),
				lastModified: new Date(),
				changeFrequency: 'daily',
				priority: 0.95,
			})
		}
	}

	return routes
}
