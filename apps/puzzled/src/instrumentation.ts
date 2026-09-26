import { validateEnv } from '@/lib/env'
import { captureException } from '@/lib/observability/capture'

export async function register() {
	// Presentation boot: do not fail-close on api-owned or Platform root secrets.
	// DATABASE_URL / REDIS_URL belong to api. SYLPHX_SECRET_KEY is not injected
	// without an explicit BaaS binding (ADR-3418). HTTP listen is the postcondition.
	validateEnv()
	// Browser source maps for this release, fire and forget (docs/observability.md).
	if (process.env.NEXT_RUNTIME === 'nodejs') {
		const { uploadSourceMaps } = await import('@/lib/observability/source-maps')
		void uploadSourceMaps()
	}
}

/**
 * Server errors from route handlers, server components, server actions and
 * the proxy go to Sylphx Observability (docs/observability.md). Only the route
 * template and digest are attached, never request bodies or headers.
 */
export async function onRequestError(
	error: unknown,
	_request: { path: string; method: string },
	context: { routePath: string; routeType: string },
) {
	await captureException(error, {
		route: context.routePath,
		tags: {
			routeType: context.routeType,
			digest: (error as { digest?: string } | undefined)?.digest,
		},
	})
}
