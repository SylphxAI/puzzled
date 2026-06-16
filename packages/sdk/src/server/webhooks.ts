/**
 * Webhook Signature Verification
 *
 * Verifies HMAC-signed webhooks sent by the Sylphx Platform and provides a
 * ready-made request handler with automatic verification.
 */

import { WEBHOOK_CLOCK_SKEW_MS, WEBHOOK_MAX_AGE_MS } from '../constants'

export interface WebhookPayload {
	event: string
	data: unknown
	timestamp: number
	id: string
}

export interface WebhookVerifyResult {
	valid: boolean
	payload?: WebhookPayload
	error?: string
}

export interface WebhookVerifyOptions {
	/** Maximum age of webhook in milliseconds (default: 5 minutes) */
	maxAge?: number
	/** Allow clock skew in milliseconds (default: 30 seconds) */
	clockSkew?: number
}

/**
 * Verify webhook signature from Sylphx Platform
 *
 * The platform sends `X-Webhook-Signature` in `t={unix_seconds},v1={hmac_hex}`
 * format. This function accepts either:
 * - The raw header value (auto-parsed)
 * - Pre-extracted `signature` + `timestamp` strings
 *
 * @example
 * ```typescript
 * import { verifyWebhook } from '@sylphx/sdk/server'
 *
 * export async function POST(request: Request) {
 *   const body = await request.text()
 *   const result = await verifyWebhook({
 *     payload: body,
 *     signatureHeader: request.headers.get('x-webhook-signature'),
 *     secret: process.env.SYLPHX_SECRET_KEY!,
 *   })
 *
 *   if (!result.valid) {
 *     return new Response('Invalid signature', { status: 401 })
 *   }
 *
 *   console.log('Received webhook:', result.payload)
 * }
 * ```
 */
export async function verifyWebhook(options: {
	payload: string
	/** Raw X-Webhook-Signature header value: "t={seconds},v1={hex}" */
	signatureHeader?: string | null
	/** Pre-extracted HMAC hex (if parsing header yourself) */
	signature?: string | null
	/** Pre-extracted timestamp in unix seconds (if parsing header yourself) */
	timestamp?: string | null
	secret: string
	verifyOptions?: WebhookVerifyOptions
}): Promise<WebhookVerifyResult> {
	const { payload, secret, verifyOptions = {} } = options
	const { maxAge = WEBHOOK_MAX_AGE_MS, clockSkew = WEBHOOK_CLOCK_SKEW_MS } = verifyOptions

	// Parse the combined header format: "t={seconds},v1={hex}"
	let signatureHex = options.signature ?? null
	let timestampStr = options.timestamp ?? null

	if (options.signatureHeader) {
		const tMatch = options.signatureHeader.match(/t=(\d+)/)
		const vMatch = options.signatureHeader.match(/v1=([a-f0-9]+)/)
		if (tMatch) timestampStr = tMatch[1]
		if (vMatch) signatureHex = vMatch[1]
	}

	if (!signatureHex) {
		return { valid: false, error: 'Missing signature' }
	}
	if (!timestampStr) {
		return { valid: false, error: 'Missing timestamp' }
	}

	const webhookTimeSeconds = Number.parseInt(timestampStr, 10)
	if (Number.isNaN(webhookTimeSeconds)) {
		return { valid: false, error: 'Invalid timestamp format' }
	}

	// Convert seconds → milliseconds for comparison with Date.now()
	const webhookTimeMs = webhookTimeSeconds * 1000
	const now = Date.now()
	const age = now - webhookTimeMs

	if (age > maxAge) {
		return { valid: false, error: `Webhook too old: ${age}ms` }
	}

	if (age < -clockSkew) {
		return { valid: false, error: 'Webhook timestamp is in the future' }
	}

	// Reconstruct the signed payload: "{seconds}.{body}"
	const signedPayload = `${timestampStr}.${payload}`

	try {
		const expectedSignature = await computeHmacSha256(signedPayload, secret)

		if (!timingSafeEqual(signatureHex, expectedSignature)) {
			return { valid: false, error: 'Invalid signature' }
		}

		const parsedPayload = JSON.parse(payload) as WebhookPayload
		return { valid: true, payload: parsedPayload }
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : 'Verification failed',
		}
	}
}

async function computeHmacSha256(message: string, secret: string): Promise<string> {
	const encoder = new TextEncoder()
	const keyData = encoder.encode(secret)
	const messageData = encoder.encode(message)

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		keyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	)

	const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
	return Buffer.from(signature).toString('hex')
}

function timingSafeEqual(a: string, b: string): boolean {
	// Compare against b if lengths match, otherwise compare a against itself.
	// This prevents timing side-channel leaks: the loop always runs a.length
	// iterations regardless of whether lengths match, so an attacker cannot
	// infer b's length from response time.
	const target = a.length === b.length ? b : a
	let result = a.length ^ b.length // Non-zero if lengths differ
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ target.charCodeAt(i)
	}
	return result === 0
}

/**
 * Create a webhook handler with automatic verification
 *
 * @example
 * ```typescript
 * import { createWebhookHandler } from '@sylphx/sdk/server'
 *
 * const handler = createWebhookHandler({
 *   secret: process.env.SYLPHX_SECRET_KEY!,
 *   handlers: {
 *     'user.created': async (data) => {
 *       console.log('New user:', data)
 *     },
 *     'subscription.updated': async (data) => {
 *       console.log('Subscription changed:', data)
 *     },
 *   },
 * })
 *
 * export { handler as POST }
 * ```
 */
export function createWebhookHandler(config: {
	secret: string
	handlers: Record<string, (data: unknown) => Promise<void> | void>
	verifyOptions?: WebhookVerifyOptions
}): (request: Request) => Promise<Response> {
	return async (request: Request) => {
		const signatureHeader = request.headers.get('x-webhook-signature')
		const body = await request.text()

		const result = await verifyWebhook({
			payload: body,
			signatureHeader,
			secret: config.secret,
			verifyOptions: config.verifyOptions,
		})

		if (!result.valid) {
			return new Response(JSON.stringify({ error: result.error }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		if (!result.payload) {
			return new Response(JSON.stringify({ error: 'Missing payload' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		const { event, data } = result.payload
		const handler = config.handlers[event]

		if (!handler) {
			return new Response(JSON.stringify({ received: true, handled: false }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		}

		try {
			await handler(data)
			return new Response(JSON.stringify({ received: true, handled: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})
		} catch (error) {
			return new Response(
				JSON.stringify({
					error: 'Handler failed',
					message: error instanceof Error ? error.message : 'Unknown error',
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				},
			)
		}
	}
}
