/**
 * Node fetch helpers for server-side Connect (API_INTERNAL_URL).
 *
 * connect-web passes a Headers instance. Spreading it as a plain object
 * drops Content-Type / Connect-Protocol-Version and the RPC 415s or 404s.
 *
 * GET `/` SSR must not wait forever: same-origin or a blackhole api hangs
 * Knative queue-proxy probes (user-container Ready, GET / never completes).
 */

/** Bound for presentation document SSR Connect. Probe GET `/` must finish. */
export const SERVER_CONNECT_TIMEOUT_MS = 1000

export function mergeServerConnectInit(
	init: RequestInit | undefined,
	cookie: string,
	timeoutMs: number = SERVER_CONNECT_TIMEOUT_MS,
): RequestInit {
	const headers = new Headers(init?.headers)
	if (cookie) {
		headers.set('cookie', cookie)
	}
	const timeout = AbortSignal.timeout(timeoutMs)
	const signal =
		init?.signal && typeof AbortSignal.any === 'function'
			? AbortSignal.any([init.signal, timeout])
			: timeout
	return { ...init, headers, signal }
}
