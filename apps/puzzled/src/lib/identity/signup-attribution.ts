import 'server-only'

import { create } from '@bufbuild/protobuf'
import { createClient } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import {
	PreferencesService,
	RecordSignupAttributionRequestSchema,
} from '@/gen/connect/puzzled/v1/preferences_pb'
import { mergeServerConnectInit } from '@/lib/api/connect-fetch'
import { ATTRIBUTION_COOKIE, hasAttributionCookie } from '@/lib/attribution'
import { resolveServerConnectBaseUrl } from '@/lib/connect/transport'
import { logger } from '@/lib/logger'

/**
 * After a new account's first sign-in, ask the api to store the landing's campaign tags on the new
 * account (first touch). Only the attribution cookie is forwarded. A failure
 * is logged and never fails the sign-up.
 */
export async function recordSignupAttribution(
	accessToken: string | undefined,
	cookieHeader: string | null,
	userAgent: string,
): Promise<void> {
	if (!accessToken || !cookieHeader || !hasAttributionCookie(cookieHeader)) return
	const cookie = cookieHeader
		.split(';')
		.map((pair) => pair.trim())
		.filter((pair) => pair.startsWith(`${ATTRIBUTION_COOKIE}=`))
		.join('; ')
	try {
		const transport = createConnectTransport({
			baseUrl: resolveServerConnectBaseUrl(),
			useBinaryFormat: false,
			fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
				const merged = mergeServerConnectInit(init, cookie, 3000)
				const headers = new Headers(merged.headers)
				headers.set('authorization', `Bearer ${accessToken}`)
				// Auth binds the session to the browser's User-Agent.
				headers.set('user-agent', userAgent)
				return fetch(input, { ...merged, headers })
			}) as typeof fetch,
		})
		await createClient(PreferencesService, transport).recordSignupAttribution(
			create(RecordSignupAttributionRequestSchema, {}),
		)
	} catch (error) {
		logger.warn('signup.attribution-failed', { error })
	}
}
