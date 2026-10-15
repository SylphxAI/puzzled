/**
 * First-party funnel counter (browser side). Posts anonymous events to the
 * api's `/v1/funnel/event`: no cookie, no user id, no third party, so it runs
 * without a consent choice. Never throws and never blocks the page.
 */
import { resolveConnectBaseUrl } from '@/lib/connect/transport'

export type FunnelEvent =
	| { event: 'landing'; path: string }
	| { event: 'game_start'; game_slug: string; path?: string }
	| {
			event: 'web_vitals'
			metric: 'LCP' | 'CLS' | 'INP' | 'FCP' | 'TTFB'
			value: number
			rating?: string
			path?: string
	  }

export const FUNNEL_PATH = '/v1/funnel/event'

/** The path without locale prefix is not needed: the raw pathname is stored, query and hash dropped. */
export function funnelUrl(base: string): string {
	return `${base.replace(/\/+$/, '')}${FUNNEL_PATH}`
}

export function sendFunnel(
	payload: FunnelEvent,
	send: typeof fetch | undefined = typeof fetch === 'function' ? fetch : undefined,
): void {
	if (!send || typeof window === 'undefined') return
	try {
		void send(funnelUrl(resolveConnectBaseUrl()), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
			keepalive: true,
			credentials: 'omit',
		}).catch(() => {})
	} catch {
		// A counter never breaks a page.
	}
}
