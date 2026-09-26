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

/**
 * The browser User-Agent the api needs: Sylphx Auth binds a session to it.
 *
 * A Kubernetes probe (`kube-probe/…`, the platform's readiness check of GET
 * `/`) is never forwarded: Knative's queue-proxy in front of the api treats
 * any request with that User-Agent as its own probe and answers 400, so every
 * read the probed page makes would fail.
 */
export function forwardableUserAgent(userAgent: string | null | undefined): string | null {
	const trimmed = userAgent?.trim()
	if (!trimmed || /^kube-probe\//i.test(trimmed)) return null
	return trimmed
}

export function mergeServerConnectInit(
	init: RequestInit | undefined,
	cookie: string,
	timeoutMs: number = SERVER_CONNECT_TIMEOUT_MS,
	userAgent?: string | null,
): RequestInit {
	const headers = new Headers(init?.headers)
	if (cookie) {
		headers.set('cookie', cookie)
	}
	const forwarded = forwardableUserAgent(userAgent)
	if (forwarded) {
		headers.set('user-agent', forwarded)
	}
	const timeout = AbortSignal.timeout(timeoutMs)
	const signal =
		init?.signal && typeof AbortSignal.any === 'function'
			? AbortSignal.any([init.signal, timeout])
			: timeout
	return { ...init, headers, signal }
}
