import type { MetadataRoute } from 'next'
import { robotsDisallowPaths } from '@/lib/seo/routes'
import { getServerBaseUrl } from '@/lib/utils'

/**
 * `/robots.txt` — crawl rules for the routes the app actually serves.
 *
 * The disallow list is generated from `lib/seo/routes.ts` (the same table the
 * sitemap is built from), so "crawlable" and "listed" cannot drift apart: no
 * private surface is ever advertised, and no public surface is ever blocked.
 * Every HTML route on the private list also sets `robots: noindex` itself —
 * the block stops the crawl, the meta tag stops the *URL* from being indexed
 * without content when it is discovered through a link.
 */
export default function robots(): MetadataRoute.Robots {
	const baseUrl = getServerBaseUrl()

	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: robotsDisallowPaths(),
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	}
}
