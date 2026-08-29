import { locales } from '@/lib/i18n/config'
import { inboundModulePublicRoutes } from '@/lib/module-routes'

const inboundPublicRoutes = new Set(inboundModulePublicRoutes(locales))

export function isProxySkippedPath(pathname: string): boolean {
	return (
		pathname.includes('.') ||
		pathname.startsWith('/_next') ||
		pathname.startsWith('/api') ||
		pathname.startsWith('/monitoring') ||
		pathname === '/healthz' ||
		pathname === '/readyz'
	)
}

export function isInboundPublicPath(pathname: string): boolean {
	return inboundPublicRoutes.has(pathname)
}
