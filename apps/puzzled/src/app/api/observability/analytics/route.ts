import { NextResponse } from 'next/server'
import { destObservabilityJson } from '@/lib/identity/peels'
import { currentUser } from '@/lib/identity/server'

export async function POST(request: Request) {
	const user = await currentUser()
	const body = (await request.json().catch(() => null)) as {
		event?: string
		properties?: Record<string, unknown>
		kind?: string
		sessionId?: string
		marketingConsent?: boolean
	} | null
	const event = body?.event?.trim()
	if (!event) {
		return NextResponse.json({ error: 'event_required' }, { status: 400 })
	}
	try {
		await destObservabilityJson('/v1/analytics:track', {
			method: 'POST',
			body: {
				idempotency_key: crypto.randomUUID(),
				event: {
					kind: 'ANALYTICS_EVENT_KIND_TRACK',
					event,
					name: event,
					user_id: user?.id ?? '',
					session_id: body?.sessionId ?? '',
					marketing_consent: body?.marketingConsent === true,
					properties: Object.entries(body?.properties ?? {}).map(([key, value]) => ({
						key,
						value: { string_value: String(value) },
					})),
				},
			},
		})
		return NextResponse.json({ authority: 'sylphx-observability' })
	} catch (error) {
		const message = error instanceof Error ? error.message : 'observability_track_failed'
		return NextResponse.json({ error: message }, { status: 502 })
	}
}
