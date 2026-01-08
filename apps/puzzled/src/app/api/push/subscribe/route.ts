import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser } from '@/features/auth/server'
import {
	getVapidPublicKey,
	isPushConfigured,
	subscribeToPush,
	unsubscribeFromPush,
} from '@/features/notifications/server'

export const runtime = 'nodejs'

const subscribeSchema = z.object({
	subscription: z.object({
		endpoint: z.string().url('Invalid push endpoint URL').max(2000),
		keys: z.object({
			p256dh: z.string().min(1).max(500),
			auth: z.string().min(1).max(500),
		}),
	}),
})

const unsubscribeSchema = z.object({
	endpoint: z.string().url('Invalid push endpoint URL').max(2000),
})

export async function GET() {
	// Return the VAPID public key for client subscription
	if (!isPushConfigured()) {
		return NextResponse.json({ enabled: false }, { status: 200 })
	}

	return NextResponse.json({
		enabled: true,
		vapidPublicKey: getVapidPublicKey(),
	})
}

export async function POST(request: Request) {
	const user = await getServerUser()

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	if (!isPushConfigured()) {
		return NextResponse.json({ error: 'Push notifications not configured' }, { status: 503 })
	}

	try {
		const body = await request.json()
		const parsed = subscribeSchema.safeParse(body)

		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message || 'Invalid subscription data' },
				{ status: 400 },
			)
		}

		await subscribeToPush(user.id, parsed.data.subscription)

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('Failed to subscribe to push:', error)
		return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
	}
}

export async function DELETE(request: Request) {
	const user = await getServerUser()

	if (!user) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	try {
		const body = await request.json()
		const parsed = unsubscribeSchema.safeParse(body)

		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.issues[0]?.message || 'Missing endpoint' },
				{ status: 400 },
			)
		}

		await unsubscribeFromPush(parsed.data.endpoint)

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('Failed to unsubscribe from push:', error)
		return NextResponse.json({ error: 'Failed to unsubscribe' }, { status: 500 })
	}
}
