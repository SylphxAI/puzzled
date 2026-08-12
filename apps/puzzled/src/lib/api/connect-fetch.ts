/**
 * Node fetch helpers for server-side Connect (API_INTERNAL_URL).
 *
 * connect-web passes a Headers instance. Spreading it as a plain object
 * drops Content-Type / Connect-Protocol-Version and the RPC 415s or 404s.
 */

export function mergeServerConnectInit(init: RequestInit | undefined, cookie: string): RequestInit {
	const headers = new Headers(init?.headers)
	if (cookie) {
		headers.set('cookie', cookie)
	}
	return { ...init, headers }
}
