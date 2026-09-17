import { locales } from '@/lib/i18n/config'
import { inboundModulePublicRoutes } from '@/lib/module-routes'

const inboundPublicRoutes = new Set(inboundModulePublicRoutes(locales))

/**
 * Documents the app serves at the root, outside locale routing.
 * `next.config.ts` declares no rewrites for them; the metadata routes own them.
 */
const STATIC_DOCUMENT_PATHS = new Set(['/robots.txt', '/sitemap.xml', '/manifest.webmanifest'])

/**
 * Real static asset types served from `public/` or the build.
 *
 * Skipping is decided by extension rather than by "the path contains a dot":
 * everything that is not an asset has to reach the i18n rewrite, or a request
 * like `/index.html` lands on the app with an invalid locale segment and never
 * renders the localised 404. Add a new public asset type here when one is
 * introduced — a document (`.txt`, `.xml`, …) belongs in
 * `STATIC_DOCUMENT_PATHS` instead.
 */
const ASSET_EXTENSIONS = new Set([
	'ico',
	'png',
	'jpg',
	'jpeg',
	'gif',
	'webp',
	'avif',
	'svg',
	'css',
	'js',
	'mjs',
	'map',
	'woff',
	'woff2',
	'ttf',
	'otf',
	'eot',
	'mp3',
	'ogg',
	'wav',
	'mp4',
	'webm',
	'pdf',
	'zip',
	'wasm',
])

/** Lowercase extension of the last path segment, or null when it has none. */
function assetExtensionOf(pathname: string): string | null {
	const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1)
	const dot = lastSegment.lastIndexOf('.')
	if (dot <= 0 || dot === lastSegment.length - 1) return null
	return lastSegment.slice(dot + 1).toLowerCase()
}

export function isProxySkippedPath(pathname: string): boolean {
	if (
		pathname.startsWith('/_next') ||
		pathname.startsWith('/api') ||
		pathname.startsWith('/monitoring') ||
		pathname === '/healthz' ||
		pathname === '/readyz' ||
		STATIC_DOCUMENT_PATHS.has(pathname)
	) {
		return true
	}

	const extension = assetExtensionOf(pathname)
	return extension !== null && ASSET_EXTENSIONS.has(extension)
}

export function isInboundPublicPath(pathname: string): boolean {
	return inboundPublicRoutes.has(pathname)
}
