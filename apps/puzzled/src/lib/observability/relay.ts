/**
 * The browser error relay: `POST <relay path>` on this app's own origin.
 *
 * The browser holds no Observability key (there is no publishable-key ingest
 * yet), so it posts a small report here and the server captures it with the
 * environment key. The report is bounded, same-origin only, rate limited per
 * client, and scrubbed again by `captureException`.
 */

import { type Breadcrumb, captureException } from './capture'

const MAX_BODY_BYTES = 16_384
const WINDOW_MS = 60_000
const PER_WINDOW = 20
const recent = new Map<string, { start: number; count: number }>()

export type BrowserErrorReport = {
	type?: string
	message?: string
	stack?: string
	/** Page path without query string. */
	path?: string
	breadcrumbs?: Breadcrumb[]
	/** Free-form tags from the page (boundary name, digest). */
	tags?: Record<string, string>
}

function limited(client: string, now = Date.now()): boolean {
	if (recent.size > 5000) recent.clear()
	const entry = recent.get(client)
	if (!entry || now - entry.start > WINDOW_MS) {
		recent.set(client, { start: now, count: 1 })
		return false
	}
	entry.count += 1
	return entry.count > PER_WINDOW
}

function text(value: unknown, max: number): string | undefined {
	return typeof value === 'string' && value.trim() ? value.slice(0, max) : undefined
}

function sameOrigin(request: Request): boolean {
	const site = request.headers.get('sec-fetch-site')
	if (site) return site === 'same-origin'
	const origin = request.headers.get('origin')
	const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
	if (!origin || !host) return false
	try {
		return new URL(origin).host === host
	} catch {
		return false
	}
}

/** Handles one relay request; the route file only exports `POST = relayBrowserError`. */
export async function relayBrowserError(request: Request): Promise<Response> {
	if (!sameOrigin(request)) return new Response(null, { status: 403 })
	const client =
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		request.headers.get('x-real-ip') ||
		'unknown'
	if (limited(client)) return new Response(null, { status: 429 })
	const raw = await request.text().catch(() => '')
	if (!raw || raw.length > MAX_BODY_BYTES) return new Response(null, { status: 413 })
	let report: BrowserErrorReport
	try {
		report = JSON.parse(raw) as BrowserErrorReport
	} catch {
		return new Response(null, { status: 400 })
	}
	const message = text(report.message, 2000)
	if (!message) return new Response(null, { status: 400 })
	const tags: Record<string, string> = { source: 'browser' }
	for (const [key, value] of Object.entries(report.tags ?? {}).slice(0, 8)) {
		const clean = text(value, 200)
		if (clean) tags[key.slice(0, 64)] = clean
	}
	const breadcrumbs = Array.isArray(report.breadcrumbs)
		? report.breadcrumbs.slice(-30).flatMap((crumb) => {
				const crumbMessage = text(crumb?.message, 500)
				return crumbMessage
					? [
							{
								category: text(crumb.category, 64),
								message: crumbMessage,
								timestamp: text(crumb.timestamp, 40),
							},
						]
					: []
			})
		: []
	const error = new Error(message)
	await captureException(error, {
		service: `${process.env.SYLPHX_SERVICE_NAME || 'web'}-browser`,
		exceptionType: text(report.type, 200) ?? 'Error',
		stack: text(report.stack, 8000) ?? '',
		route: text(report.path, 500),
		breadcrumbs,
		tags,
	})
	return new Response(null, { status: 204 })
}
