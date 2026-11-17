import { env } from '../env'
import { resolveSiteOrigin } from '../site-origin'
import {
	type BrowserReport,
	isBrowserReport,
	MAX_BODY_BYTES,
	RELAY_TIMEOUT_MS,
} from './browser-report'

function sameOrigin(request: Request): boolean {
	const site = request.headers.get('sec-fetch-site')
	if (site !== null && site !== 'same-origin') return false
	const origin = request.headers.get('origin')
	if (!origin || origin === 'null' || origin.includes(',')) return false
	try {
		if (new URL(origin).origin !== origin) return false
		// The public edge supplies the external authority before rewriting Host.
		// The strict resolver rejects ambiguous or malformed proxy headers.
		const authority = {
			host: request.headers.get('host'),
			forwardedHost: request.headers.get('x-forwarded-host'),
			forwardedProto: request.headers.get('x-forwarded-proto'),
			nodeEnv: env.NODE_ENV,
		}
		// Config is an additional constraint, never a substitute for the actual host.
		return (
			origin === resolveSiteOrigin(authority, 'request') &&
			origin ===
				resolveSiteOrigin({ ...authority, configuredUrl: env.SYLPHX_PUBLIC_URL }, 'request')
		)
	} catch {
		return false
	}
}

const empty = (status: number) => new Response(null, { status })
type Forward = (report: BrowserReport, signal: AbortSignal) => Promise<void>

async function readReport(
	request: Request,
	signal: AbortSignal,
): Promise<BrowserReport | 400 | 413> {
	if (!request.body) return 400
	const reader = request.body.getReader()
	const cancel = () => {
		void reader.cancel().catch(() => {})
	}
	signal.addEventListener('abort', cancel, { once: true })
	try {
		const bytes = new Uint8Array(MAX_BODY_BYTES)
		let size = 0
		while (!signal.aborted) {
			const chunk = await reader.read()
			if (chunk.done) break
			if (chunk.value.byteLength > MAX_BODY_BYTES - size) {
				cancel()
				return 413
			}
			bytes.set(chunk.value, size)
			size += chunk.value.byteLength
		}
		if (signal.aborted) return 400
		const parsed: unknown = JSON.parse(
			new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)),
		)
		return isBrowserReport(parsed) ? parsed : 400
	} catch {
		return 400
	} finally {
		signal.removeEventListener('abort', cancel)
		reader.releaseLock()
	}
}

/** Validate and acknowledge; a forwarder may only be wired behind trusted ingress rate enforcement. */
export function createBrowserErrorRelay(forward?: Forward) {
	return async function relayBrowserError(request: Request): Promise<Response> {
		if (!sameOrigin(request)) return empty(403)
		const contentType = request.headers.get('content-type') ?? ''
		const encoding = request.headers.get('content-encoding')
		if (
			!/^application\/json(?:\s*;\s*charset=(?:utf-8|"utf-8"))?$/i.test(contentType) ||
			(encoding !== null && encoding.toLowerCase() !== 'identity')
		)
			return empty(415)
		const length = request.headers.get('content-length')
		if (length !== null) {
			if (!/^\d+$/.test(length)) return empty(400)
			if (Number(length) > MAX_BODY_BYTES) return empty(413)
		}

		const controller = new AbortController()
		let accepted = false
		let timer: ReturnType<typeof setTimeout> | undefined
		const deadline = new Promise<Response>((resolve) => {
			timer = setTimeout(() => {
				resolve(empty(accepted ? 204 : 408))
				controller.abort()
			}, RELAY_TIMEOUT_MS)
		})
		try {
			return await Promise.race([
				deadline,
				(async () => {
					const result = await readReport(request, controller.signal)
					if (typeof result === 'number') return empty(result)
					accepted = true
					try {
						if (!controller.signal.aborted) await forward?.(result, controller.signal)
					} catch {
						// Optional observability must not log or fail a product request.
					}
					return empty(204)
				})(),
			])
		} finally {
			clearTimeout(timer)
		}
	}
}

// No forwarder, even when the server key exists. Hosting must enforce 20/min by
// authenticated end-user IP on both hostnames before a production forwarder is wired.
export const relayBrowserError = createBrowserErrorRelay()
