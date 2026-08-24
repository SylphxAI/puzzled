/**
 * Presentation document (GET `/`) must return application HTTP even when
 * Connect or Platform never answers. Knative probes GET `/`; a hang keeps
 * queue-proxy not Ready and `puzzled.gg/` at 0 bytes.
 */

import { SERVER_CONNECT_TIMEOUT_MS } from '@/lib/api/connect-fetch'

export { SERVER_CONNECT_TIMEOUT_MS as PRESENTATION_DOCUMENT_TIMEOUT_MS }

export async function withPresentationDeadline<T>(
	promise: Promise<T>,
	fallback: T,
	timeoutMs: number = SERVER_CONNECT_TIMEOUT_MS,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined
	const settled = promise.then(
		(value) => value,
		() => fallback,
	)
	try {
		return await Promise.race([
			settled,
			new Promise<T>((resolve) => {
				timer = setTimeout(() => resolve(fallback), timeoutMs)
			}),
		])
	} finally {
		if (timer !== undefined) clearTimeout(timer)
	}
}

export function isHtmlDocument(contentType: string | null | undefined, body: string): boolean {
	if (!body) return false
	const ct = contentType ?? ''
	return (
		ct.toLowerCase().includes('text/html') ||
		body.includes('<html') ||
		body.trimStart().toLowerCase().startsWith('<!doctype html')
	)
}
