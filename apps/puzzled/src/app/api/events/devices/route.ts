import { NextResponse } from 'next/server'
import { destEventsJson } from '@/lib/identity/peels'
import { currentUser } from '@/lib/identity/server'

type Device = { device_id: string; user_id: string; platform: string }
type DevicePage = { devices?: Device[]; page?: { next_cursor?: string; has_more?: boolean } }
const WEB_PUSH = 'DEVICE_PLATFORM_WEB_PUSH'

// One server-operation UUIDv7 shared by the body and transport header.
function operationId(): string {
	const time = Date.now().toString(16).padStart(12, '0')
	const random = crypto.randomUUID()
	return `${time.slice(0, 8)}-${time.slice(8)}-7${random.slice(15, 18)}-${random.slice(19)}`
}

function deviceQuery(userId: string, cursor?: string, webPushOnly = false): string {
	const query = new URLSearchParams({ user_id: userId, limit: '100' })
	if (webPushOnly) query.set('platform', WEB_PUSH)
	if (cursor) query.set('cursor', cursor)
	return `/v1/devices?${query}`
}

export async function GET() {
	const user = await currentUser()
	if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
	try {
		const body = await destEventsJson<DevicePage>(deviceQuery(user.id), { method: 'GET' })
		return NextResponse.json({ devices: (body.devices ?? []).filter((d) => d.user_id === user.id) })
	} catch {
		return NextResponse.json({ error: 'events_devices_unavailable' }, { status: 502 })
	}
}

export async function POST(request: Request) {
	const user = await currentUser()
	if (!user) return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
	const body = (await request.json().catch(() => null)) as {
		token?: string
		p256dh?: string
		auth?: string
		deviceId?: string
		unregister?: boolean
	} | null
	try {
		if (body?.unregister) {
			const deviceId = body.deviceId
			if (typeof deviceId !== 'string' || deviceId.length < 1 || deviceId.length > 128) {
				return NextResponse.json({ error: 'device_id_required' }, { status: 400 })
			}
			let cursor: string | undefined
			const seen = new Set<string>()
			for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
				const page = await destEventsJson<DevicePage>(deviceQuery(user.id, cursor, true), {
					method: 'GET',
				})
				if (!Array.isArray(page.devices) || typeof page.page?.has_more !== 'boolean') {
					throw new Error('device_page_unavailable')
				}
				const owned = page.devices?.some(
					(device) =>
						device.device_id === deviceId &&
						device.user_id === user.id &&
						device.platform === WEB_PUSH,
				)
				if (owned) {
					const idempotencyKey = operationId()
					await destEventsJson(`/v1/devices/${encodeURIComponent(deviceId)}/unregister`, {
						method: 'POST',
						headers: { 'Idempotency-Key': idempotencyKey },
						body: { idempotency_key: idempotencyKey, device_id: deviceId },
					})
					return NextResponse.json({ unregistered: true })
				}
				if (!page.page?.has_more) {
					return NextResponse.json({ error: 'device_not_found' }, { status: 404 })
				}
				const next = page.page.next_cursor
				if (!next || seen.has(next) || pageNumber === 9) throw new Error('device_page_unavailable')
				seen.add(next)
				cursor = next
			}
			throw new Error('device_page_unavailable')
		}
		const token = typeof body?.token === 'string' ? body.token.trim() : undefined
		if (!token || token.length < 8) {
			return NextResponse.json({ error: 'device_token_required' }, { status: 400 })
		}
		const idempotencyKey = operationId()
		const registered = await destEventsJson<{ device?: { device_id?: string } }>('/v1/devices', {
			method: 'POST',
			headers: { 'Idempotency-Key': idempotencyKey },
			body: {
				idempotency_key: idempotencyKey,
				device: {
					platform: WEB_PUSH,
					user_id: user.id,
					token,
					web_push_p256dh: body?.p256dh ?? '',
					web_push_auth: body?.auth ?? '',
				},
			},
		})
		return NextResponse.json({ deviceId: registered.device?.device_id })
	} catch {
		return NextResponse.json({ error: 'events_devices_unavailable' }, { status: 502 })
	}
}
