/**
 * ADR-168 S2 — thin proxy from the Next.js web service to the Rust `api`
 * authority. Platform injects `API_INTERNAL_URL` when `sylphx.toml` declares
 * `connect = { services = ["api"] }` on the web service.
 *
 * Local dev:
 * - `PUZZLED_USE_RUST_HEALTH=1` — proxy `/api/v1/health` → Rust `/healthz`
 * - `PUZZLED_USE_RUST_LEADERBOARD=1` — proxy `/api/v1/stats/leaderboard` to Rust
 * - `PUZZLED_USE_RUST_PUZZLE_GRID=1` — proxy `/api/v1/puzzles/grid` to Rust
 * - `PUZZLED_USE_RUST_PUZZLE_SUBMIT=1` — proxy `/api/v1/puzzles/submit` to Rust
 */

const DEV_FALLBACK_API_URL = 'http://127.0.0.1:8080'

const HOP_BY_HOP = new Set([
	'connection',
	'keep-alive',
	'proxy-authenticate',
	'proxy-authorization',
	'te',
	'trailers',
	'transfer-encoding',
	'upgrade',
])

/** True when platform connect injects the Rust API base URL (production). */
export function shouldProxyToRustInProd(): boolean {
	return Boolean(process.env.API_INTERNAL_URL?.trim())
}

/** True when health should proxy to Rust (prod connect or local dev flag). */
export function shouldProxyHealthToRust(): boolean {
	if (shouldProxyToRustInProd()) return true
	return process.env.PUZZLED_USE_RUST_HEALTH === '1'
}

/** True when leaderboard read should proxy to Rust (prod connect or local dev flag). */
export function shouldProxyLeaderboardToRust(): boolean {
	if (shouldProxyToRustInProd()) return true
	return process.env.PUZZLED_USE_RUST_LEADERBOARD === '1'
}

/** True when puzzle grid generation should proxy to Rust (prod connect or local dev flag). */
export function shouldProxyPuzzleGridToRust(): boolean {
	if (shouldProxyToRustInProd()) return true
	return process.env.PUZZLED_USE_RUST_PUZZLE_GRID === '1'
}

/** True when puzzle solution submit/scoring should proxy to Rust (prod connect or local dev flag). */
export function shouldProxyPuzzleSubmitToRust(): boolean {
	if (shouldProxyToRustInProd()) return true
	return process.env.PUZZLED_USE_RUST_PUZZLE_SUBMIT === '1'
}

/** Resolve the Rust API base URL (no trailing slash). */
export function resolveRustApiBaseUrl(): string {
	const configured = process.env.API_INTERNAL_URL?.trim()
	if (configured) return configured.replace(/\/+$/, '')
	return DEV_FALLBACK_API_URL
}

function buildTargetUrl(request: Request, rustPath?: string): string {
	const incoming = new URL(request.url)
	const path = rustPath ?? incoming.pathname
	return `${resolveRustApiBaseUrl()}${path}${incoming.search}`
}

function forwardHeaders(request: Request): Headers {
	const headers = new Headers()
	for (const [name, value] of request.headers.entries()) {
		if (HOP_BY_HOP.has(name.toLowerCase())) continue
		headers.append(name, value)
	}
	return headers
}

/**
 * Proxy an incoming edge request to the Rust API service unchanged.
 * Response status, body, and slice headers pass through.
 */
export async function proxyToRustApi(
	request: Request,
	options?: { rustPath?: string },
): Promise<Response> {
	const targetUrl = buildTargetUrl(request, options?.rustPath)
	const method = request.method.toUpperCase()
	const headers = forwardHeaders(request)

	const init: RequestInit & { duplex?: 'half' } = {
		method,
		headers,
		redirect: 'manual',
	}

	if (method !== 'GET' && method !== 'HEAD') {
		init.body = request.body
		init.duplex = 'half'
	}

	let upstream: Response
	try {
		upstream = await fetch(targetUrl, init)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		return new Response(
			JSON.stringify({
				error: 'Rust API authority unavailable',
				detail: message,
				slice: 'S2-proxy',
			}),
			{
				status: 503,
				headers: {
					'Content-Type': 'application/json',
					'x-puzzled-slice': 'S2-proxy',
				},
			},
		)
	}

	const outHeaders = new Headers(upstream.headers)
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: outHeaders,
	})
}