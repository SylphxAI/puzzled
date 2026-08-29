import { NextResponse } from 'next/server'
import { destObservabilityJson } from '@/lib/identity/peels'

export async function POST(request: Request) {
	const body = (await request.json().catch(() => null)) as {
		message?: string
		service?: string
	} | null
	const message = body?.message?.trim()
	if (!message) {
		return NextResponse.json({ error: 'message_required' }, { status: 400 })
	}
	try {
		const captured = await destObservabilityJson<{ event?: { event_id?: string } }>(
			'/v1/error-events:captureException',
			{
				method: 'POST',
				body: {
					event: {
						service: body?.service?.trim() || 'puzzled-web',
						message,
					},
				},
			},
		)
		return NextResponse.json({
			authority: 'sylphx-observability',
			eventId: captured.event?.event_id,
		})
	} catch (error) {
		const err = error instanceof Error ? error.message : 'observability_capture_failed'
		return NextResponse.json({ error: err }, { status: 502 })
	}
}
