/**
 * Webhook Signature Verification
 *
 * HMAC-SHA256 signature verification for webhook payloads.
 * Prevents replay attacks with timestamp validation.
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature } from '@sylphx/platform-sdk/webhooks'
 *
 * // In your webhook handler
 * export async function POST(req: Request) {
 *   const body = await req.text()
 *   const signature = req.headers.get('x-sylphx-signature')
 *   const timestamp = req.headers.get('x-sylphx-timestamp')
 *
 *   const result = await verifyWebhookSignature({
 *     payload: body,
 *     signature: signature!,
 *     timestamp: timestamp!,
 *     secret: process.env.WEBHOOK_SECRET!,
 *   })
 *
 *   if (!result.valid) {
 *     return new Response(result.error, { status: 401 })
 *   }
 *
 *   // Process the verified payload
 *   const event = result.payload!
 *   console.log(`Received ${event.type}:`, event.data)
 * }
 * ```
 */

import type {
	WebhookPayload,
	SignatureVerificationResult,
	VerifyOptions,
} from './types'
import { DEFAULT_WEBHOOKS_CONFIG } from './types'

// ============================================================================
// Crypto Utilities
// ============================================================================

/**
 * Generate HMAC-SHA256 signature
 */
async function hmacSha256(secret: string, message: string): Promise<string> {
	const encoder = new TextEncoder()
	const keyData = encoder.encode(secret)
	const messageData = encoder.encode(message)

	const key = await crypto.subtle.importKey(
		'raw',
		keyData,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)

	const signature = await crypto.subtle.sign('HMAC', key, messageData)
	return bufferToHex(signature)
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer)
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false
	}

	let result = 0
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i)
	}
	return result === 0
}

// ============================================================================
// Signature Verification
// ============================================================================

export interface VerifySignatureParams {
	/** Raw request body as string */
	payload: string
	/** Signature from x-sylphx-signature header */
	signature: string
	/** Timestamp from x-sylphx-timestamp header */
	timestamp: string
	/** Webhook signing secret */
	secret: string
	/** Verification options */
	options?: VerifyOptions
}

/**
 * Verify a webhook signature
 *
 * Uses HMAC-SHA256 with timing-safe comparison and replay protection.
 *
 * @param params - Verification parameters
 * @returns Verification result with parsed payload if valid
 *
 * @example
 * ```typescript
 * const result = await verifyWebhookSignature({
 *   payload: rawBody,
 *   signature: req.headers.get('x-sylphx-signature')!,
 *   timestamp: req.headers.get('x-sylphx-timestamp')!,
 *   secret: process.env.WEBHOOK_SECRET!,
 * })
 *
 * if (!result.valid) {
 *   console.error('Invalid webhook:', result.error)
 *   return
 * }
 *
 * // Use result.payload safely
 * handleEvent(result.payload)
 * ```
 */
export async function verifyWebhookSignature(
	params: VerifySignatureParams
): Promise<SignatureVerificationResult> {
	const {
		payload,
		signature,
		timestamp,
		secret,
		options = {},
	} = params

	const maxAgeSeconds = options.maxAgeSeconds ?? DEFAULT_WEBHOOKS_CONFIG.maxAgeSeconds
	const clockTolerance = options.clockToleranceSeconds ?? DEFAULT_WEBHOOKS_CONFIG.clockToleranceSeconds

	// Validate timestamp format
	const timestampNum = parseInt(timestamp, 10)
	if (isNaN(timestampNum)) {
		return {
			valid: false,
			error: 'Invalid timestamp format',
		}
	}

	// Check timestamp age (replay protection)
	const nowSeconds = Math.floor(Date.now() / 1000)
	const ageSeconds = nowSeconds - timestampNum

	// Allow clock skew in both directions
	if (ageSeconds > maxAgeSeconds + clockTolerance) {
		return {
			valid: false,
			error: `Webhook too old: ${ageSeconds}s (max: ${maxAgeSeconds}s)`,
			ageSeconds,
		}
	}

	if (ageSeconds < -clockTolerance) {
		return {
			valid: false,
			error: `Webhook timestamp is in the future: ${-ageSeconds}s ahead`,
			ageSeconds,
		}
	}

	// Compute expected signature
	const signedPayload = `${timestamp}.${payload}`
	const expectedSignature = await hmacSha256(secret, signedPayload)

	// Parse signature header (format: "v1=<signature>")
	const signatureParts = signature.split('=')
	if (signatureParts.length !== 2 || signatureParts[0] !== 'v1') {
		return {
			valid: false,
			error: 'Invalid signature format (expected v1=<signature>)',
		}
	}

	const providedSignature = signatureParts[1]

	// Timing-safe comparison
	if (!timingSafeEqual(expectedSignature, providedSignature)) {
		return {
			valid: false,
			error: 'Signature mismatch',
		}
	}

	// Parse payload
	try {
		const parsedPayload = JSON.parse(payload) as WebhookPayload
		return {
			valid: true,
			payload: parsedPayload,
			ageSeconds: Math.max(0, ageSeconds),
		}
	} catch {
		return {
			valid: false,
			error: 'Invalid JSON payload',
		}
	}
}

// ============================================================================
// Signature Generation (for testing)
// ============================================================================

export interface GenerateSignatureParams {
	/** Payload to sign (object or string) */
	payload: unknown
	/** Webhook signing secret */
	secret: string
	/** Optional custom timestamp (default: now) */
	timestamp?: number
}

export interface GeneratedSignature {
	/** The signature header value (v1=<signature>) */
	signature: string
	/** The timestamp used */
	timestamp: number
	/** The stringified payload */
	payload: string
}

/**
 * Generate a webhook signature
 *
 * Useful for testing webhook handlers locally.
 *
 * @param params - Generation parameters
 * @returns Generated signature and metadata
 *
 * @example
 * ```typescript
 * // For testing your webhook handler
 * const { signature, timestamp, payload } = await generateWebhookSignature({
 *   payload: { type: 'auth.user.created', data: { id: '123' } },
 *   secret: process.env.WEBHOOK_SECRET!,
 * })
 *
 * const response = await fetch('/api/webhooks', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'x-sylphx-signature': signature,
 *     'x-sylphx-timestamp': String(timestamp),
 *   },
 *   body: payload,
 * })
 * ```
 */
export async function generateWebhookSignature(
	params: GenerateSignatureParams
): Promise<GeneratedSignature> {
	const { payload, secret, timestamp = Math.floor(Date.now() / 1000) } = params

	const payloadString = typeof payload === 'string'
		? payload
		: JSON.stringify(payload)

	const signedPayload = `${timestamp}.${payloadString}`
	const signature = await hmacSha256(secret, signedPayload)

	return {
		signature: `v1=${signature}`,
		timestamp,
		payload: payloadString,
	}
}

// ============================================================================
// Webhook Handler Wrapper
// ============================================================================

export interface WebhookHandlerOptions {
	/** Webhook signing secret */
	secret: string
	/** Signature header name (default: 'x-sylphx-signature') */
	signatureHeader?: string
	/** Timestamp header name (default: 'x-sylphx-timestamp') */
	timestampHeader?: string
	/** Verification options */
	verifyOptions?: VerifyOptions
}

export interface WebhookHandlerContext {
	/** Verified webhook payload */
	event: WebhookPayload
	/** Original request */
	request: Request
	/** Raw request body */
	rawBody: string
}

export type WebhookHandler = (
	ctx: WebhookHandlerContext
) => Promise<Response> | Response

/**
 * Create a webhook handler with automatic signature verification
 *
 * Wraps your handler function with signature verification.
 *
 * @param options - Handler options
 * @param handler - Your webhook handler function
 * @returns A fetch-compatible handler function
 *
 * @example
 * ```typescript
 * // app/api/webhooks/route.ts
 * import { createWebhookHandler } from '@sylphx/platform-sdk/webhooks'
 *
 * export const POST = createWebhookHandler(
 *   { secret: process.env.WEBHOOK_SECRET! },
 *   async ({ event }) => {
 *     switch (event.type) {
 *       case 'auth.user.created':
 *         await handleNewUser(event.data)
 *         break
 *       case 'billing.subscription.created':
 *         await handleNewSubscription(event.data)
 *         break
 *     }
 *     return new Response('OK')
 *   }
 * )
 * ```
 */
export function createWebhookHandler(
	options: WebhookHandlerOptions,
	handler: WebhookHandler
): (request: Request) => Promise<Response> {
	const {
		secret,
		signatureHeader = DEFAULT_WEBHOOKS_CONFIG.signatureHeader,
		timestampHeader = DEFAULT_WEBHOOKS_CONFIG.timestampHeader,
		verifyOptions,
	} = options

	return async (request: Request): Promise<Response> => {
		// Get headers
		const signature = request.headers.get(signatureHeader)
		const timestamp = request.headers.get(timestampHeader)

		if (!signature) {
			return new Response(`Missing ${signatureHeader} header`, { status: 401 })
		}

		if (!timestamp) {
			return new Response(`Missing ${timestampHeader} header`, { status: 401 })
		}

		// Read body
		const rawBody = await request.text()

		// Verify signature
		const result = await verifyWebhookSignature({
			payload: rawBody,
			signature,
			timestamp,
			secret,
			options: verifyOptions,
		})

		if (!result.valid) {
			return new Response(result.error, { status: 401 })
		}

		// Call handler with verified payload
		return handler({
			event: result.payload!,
			request,
			rawBody,
		})
	}
}
