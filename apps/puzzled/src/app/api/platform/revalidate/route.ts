/**
 * POST /api/platform/revalidate
 *
 * Webhook handler for cache invalidation from Sylphx platform.
 * When admin changes config (flags, plans, OAuth, consent), the platform
 * sends a `config.changed` webhook here. We verify the signature and
 * call `revalidateTag()` for each tag in the payload.
 */

import { revalidateTag } from 'next/cache'
import { verifyWebhook } from '@sylphx/sdk/server'

export async function POST(request: Request) {
	const secret = process.env.SYLPHX_WEBHOOK_SECRET
	if (!secret) {
		return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	const signature = request.headers.get('x-webhook-signature')
	const timestamp = request.headers.get('x-webhook-timestamp')
	const body = await request.text()

	// Extract signature value from "t=...,v1=..." format
	const signatureParts = signature?.match(/v1=([a-f0-9]+)/)
	const signatureValue = signatureParts?.[1] ?? null
	const timestampValue = signature?.match(/t=(\d+)/)?.[1] ?? null

	const result = await verifyWebhook({
		payload: body,
		signature: signatureValue,
		timestamp: timestampValue,
		secret,
	})

	if (!result.valid) {
		return new Response(JSON.stringify({ error: 'Invalid signature', detail: result.error }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	const payload = result.payload!
	if (payload.event !== 'config.changed') {
		return new Response(JSON.stringify({ received: true, handled: false }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	const data = payload.data as { tags?: string[] }
	const tags = data?.tags ?? []

	for (const tag of tags) {
		revalidateTag(tag, { expire: 0 })
	}

	return new Response(
		JSON.stringify({ received: true, handled: true, tagsRevalidated: tags.length }),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		},
	)
}
