import { createHash, timingSafeEqual } from 'node:crypto'

function digest(value: string): Buffer {
	return createHash('sha256').update(value).digest()
}

/** True when the request carries this environment's SYLPHX_API_KEY (constant-time). */
export function isTestTriggerAuthorized(
	header: string | null,
	key = process.env.SYLPHX_API_KEY?.trim(),
): boolean {
	if (!key || !header) return false
	return timingSafeEqual(digest(header.trim()), digest(`Bearer ${key}`))
}

/** The nonce from a test-trigger body, limited to word characters and dashes. */
export function testNonce(body: unknown): string {
	const nonce = (body as { nonce?: unknown } | null)?.nonce
	return typeof nonce === 'string' ? nonce.replace(/[^\w-]/g, '').slice(0, 64) : ''
}
