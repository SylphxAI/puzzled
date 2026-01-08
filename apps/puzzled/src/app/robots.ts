import type { MetadataRoute } from 'next'
import { getServerBaseUrl } from '@/lib/utils'

const BASE_URL = getServerBaseUrl()

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: ['/api/', '/*/checkout/', '/*/success/'],
			},
		],
		sitemap: `${BASE_URL}/sitemap.xml`,
	}
}
