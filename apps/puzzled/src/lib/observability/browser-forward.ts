import 'server-only'

import { Sylphx } from '@sylphx/sdk'
import { type BrowserReport, messages, RELAY_TIMEOUT_MS } from './browser-report'
import { PARENT } from './capture'

/** Not wired to the public route until Hosting enforces the ingress rate policy. */
export async function forwardBrowserReport(
	report: BrowserReport,
	signal: AbortSignal,
	options: {
		env?: Record<string, string | undefined>
		fetch?: (url: URL, init: RequestInit) => Promise<Response>
	} = {},
): Promise<void> {
	const env = options.env ?? process.env
	const apiKey = env.SYLPHX_API_KEY?.trim()
	if (!apiKey || signal.aborted) return
	try {
		const fetch = options.fetch ?? globalThis.fetch
		const client = new Sylphx({
			apiKey,
			baseUrl: 'https://api.sylphx.com',
			timeoutMs: RELAY_TIMEOUT_MS,
			maxRetries: 0,
			fetch: (input, init) =>
				fetch(input, {
					...init,
					redirect: 'error',
					signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
				}),
		})
		const { type, selector, route, breadcrumbs } = report
		const eventTime = new Date().toISOString()
		await client.observability.errorGroups.capture({
			parent: PARENT,
			errorEvent: {
				eventTime,
				exceptionType: type,
				message: messages[type],
				serviceName: `${env.SYLPHX_SERVICE_NAME || 'web'}-browser`,
				release: env.SYLPHX_GIT_COMMIT_SHA || undefined,
				fingerprint: JSON.stringify([type, messages[type], route, selector]),
				tags: { source: 'browser', route, selector },
				breadcrumbs: breadcrumbs.map((crumb) => ({
					eventTime,
					category: crumb.kind,
					message: JSON.stringify(crumb),
				})),
			},
		})
	} catch {
		// The SDK is optional here. No fallback, logging, or retry on the public path.
	}
}
