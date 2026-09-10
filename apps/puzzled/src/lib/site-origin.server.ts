/**
 * Request-derived site origin (server-only).
 *
 * Canonical / Open Graph / JSON-LD must use the origin actually serving the
 * request (preview deployments included), falling back to configured env and
 * then the deterministic production origin — never localhost from production.
 */

import 'server-only'

import { headers } from 'next/headers'
import { resolveSiteOrigin } from './site-origin'

export async function getRequestSiteOrigin(): Promise<string> {
	const requestHeaders = await headers()
	return resolveSiteOrigin({
		host: requestHeaders.get('host'),
		forwardedHost: requestHeaders.get('x-forwarded-host'),
		forwardedProto: requestHeaders.get('x-forwarded-proto'),
		configuredUrl: process.env.NEXT_PUBLIC_APP_URL,
		vercelUrl: process.env.VERCEL_URL,
		nodeEnv: process.env.NODE_ENV,
		port: process.env.PORT,
	})
}
