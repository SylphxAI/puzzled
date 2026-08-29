import { NextResponse } from 'next/server'
import { destEventsJson } from '@/lib/identity/peels'
import { currentUser } from '@/lib/identity/server'

export async function GET() {
	const user = await currentUser()
	if (!user) {
		return NextResponse.json({ authority: 'sylphx-events', devices: [] })
	}
	try {
		const body = await destEventsJson<{ devices?: unknown[] }>('/v1/devices', {
			method: 'GET',
		})
		return NextResponse.json({ authority: 'sylphx-events', devices: body.devices ?? [] })
	} catch (error) {
		const message = error instanceof Error ? error.message : 'events_devices_failed'
		return NextResponse.json({ error: message }, { status: 502 })
	}
}

export async function POST(request: Request) {
	const user = await currentUser()
	if (!user) {
		return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
	}
	const body = (await request.json().catch(() => null)) as {
		token?: string
		p256dh?: string
		auth?: string
		deviceId?: string
		unregister?: boolean
	} | null
	try {
		if (body?.unregister && body.deviceId) {
			await destEventsJson(`/v1/devices/${encodeURIComponent(body.deviceId)}/unregister`, {
				method: 'POST',
				body: { device_id: body.deviceId },
			})
			return NextResponse.json({ authority: 'sylphx-events', unregistered: true })
		}
		const token = body?.token?.trim()
		if (!token || token.length < 8) {
			return NextResponse.json({ error: 'device_token_required' }, { status: 400 })
		}
		const registered = await destEventsJson<{ device?: { device_id?: string } }>('/v1/devices', {
			method: 'POST',
			headers: { 'Idempotency-Key': crypto.randomUUID() },
			body: {
				idempotency_key: crypto.randomUUID(),
				device: {
					platform: 'DEVICE_PLATFORM_WEB_PUSH',
					user_id: user.id,
					token,
					web_push_p256dh: body?.p256dh ?? '',
					web_push_auth: body?.auth ?? '',
				},
			},
		})
		return NextResponse.json({
			authority: 'sylphx-events',
			deviceId: registered.device?.device_id,
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : 'events_devices_failed'
		return NextResponse.json({ error: message }, { status: 502 })
	}
}
