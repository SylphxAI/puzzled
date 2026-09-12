#!/usr/bin/env bun

/**
 * local-stack.ts — local ingress that mirrors the `sylphx.toml` service split
 * so `scripts/verify-live.ts` can run its full check set against a local
 * stack (web + api) instead of only the Connect surface.
 *
 * Routing (must stay in sync with `sylphx.toml` `[[services]]`):
 * - `/puzzled.v1.{Admin,Gamification,Health,Jobs,Preferences,Puzzle,Stats}Service`
 *   and the probes `/healthz` / `/readyz` -> the api service.
 * - everything else -> the web (Next.js) presentation service.
 *
 * The ingress rewrites only transport concerns: it forwards the request body
 * and the caller's `Host` (plus `x-forwarded-*`) so the web layer resolves the
 * canonical origin exactly as it does behind the platform router, and it drops
 * the upstream content-encoding/length headers because the payload is
 * re-encoded on the way out.
 *
 * This is a LOCAL readback tool. It never talks to production unless the
 * upstream URLs are pointed there, and a green local run is not a Live claim:
 * the Live layer is `scripts/verify-live.ts --base https://puzzled.gg`.
 *
 * Usage (defaults match `docs/reference/local-readback.md`):
 *   bun scripts/local-stack.ts
 *   PUZZLED_WEB_PORT=3000 PUZZLED_API_PORT=8787 PUZZLED_STACK_PORT=9999 \
 *     bun scripts/local-stack.ts
 */

/** `sylphx.toml` api `path_prefixes` — the complete public API namespace. */
const API_PREFIXES = [
	'/puzzled.v1.AdminService',
	'/puzzled.v1.GamificationService',
	'/puzzled.v1.HealthService',
	'/puzzled.v1.JobsService',
	'/puzzled.v1.PreferencesService',
	'/puzzled.v1.PuzzleService',
	'/puzzled.v1.StatsService',
	'/healthz',
	'/readyz',
] as const

/** Response headers that describe the upstream framing, not the payload. */
const STRIP_RESPONSE_HEADERS = [
	'content-encoding',
	'content-length',
	'transfer-encoding',
	'connection',
] as const

function portFromEnv(key: string, fallback: number): number {
	const raw = process.env[key]?.trim()
	if (!raw) return fallback
	const port = Number(raw)
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		throw new Error(`${key} must be a TCP port: ${raw}`)
	}
	return port
}

const WEB = `http://127.0.0.1:${portFromEnv('PUZZLED_WEB_PORT', 3000)}`
const API = `http://127.0.0.1:${portFromEnv('PUZZLED_API_PORT', 8080)}`
const PORT = portFromEnv('PUZZLED_STACK_PORT', 9999)

const server = Bun.serve({
	port: PORT,
	async fetch(request) {
		const url = new URL(request.url)
		const toApi = API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))
		const headers = new Headers(request.headers)
		headers.set('host', url.host)
		headers.set('x-forwarded-host', url.host)
		headers.set('x-forwarded-proto', 'http')

		const init: RequestInit = { method: request.method, headers, redirect: 'manual' }
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			init.body = request.body
		}

		const target = `${toApi ? API : WEB}${url.pathname}${url.search}`
		try {
			const upstream = await fetch(target, init)
			const responseHeaders = new Headers(upstream.headers)
			for (const name of STRIP_RESPONSE_HEADERS) responseHeaders.delete(name)
			console.log(
				`${request.method} ${url.pathname} -> ${toApi ? 'api' : 'web'} ${upstream.status}`,
			)
			return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
		} catch (error) {
			console.log(`${request.method} ${url.pathname} -> ${toApi ? 'api' : 'web'} unreachable`)
			return new Response(`local stack: ${toApi ? API : WEB} unreachable: ${error}\n`, {
				status: 502,
			})
		}
	},
})

console.log(`local stack on http://127.0.0.1:${server.port} (web ${WEB}, api ${API})`)
