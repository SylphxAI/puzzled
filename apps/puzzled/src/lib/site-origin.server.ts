/** Request authority and marketing URL resolution must not share semantics. */
import 'server-only'

import { headers } from 'next/headers'
import { env } from './env'
import { resolveSiteOrigin } from './site-origin'

async function originInput() {
	const requestHeaders = await headers()
	return {
		host: requestHeaders.get('host'),
		forwardedHost: requestHeaders.get('x-forwarded-host'),
		forwardedProto: requestHeaders.get('x-forwarded-proto'),
		configuredUrl: env.SYLPHX_PUBLIC_URL,
		nodeEnv: env.NODE_ENV,
		port: env.PORT,
	}
}

/** Auth URLs and browser admission retain the validated incoming origin. */
export async function getRequestSiteOrigin(): Promise<string> {
	const origin = resolveSiteOrigin(await originInput(), 'request')
	if (!origin) throw new Error('invalid_request_origin')
	return origin
}

/** Canonical, Open Graph and structured-data links advertise Tryit in production. */
export async function getCanonicalSiteOrigin(): Promise<string> {
	return resolveSiteOrigin(await originInput())
}
