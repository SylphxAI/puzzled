import { NextResponse } from 'next/server'
import { destObservabilityJson } from '@/lib/identity/peels'
import { currentUser } from '@/lib/identity/server'

export async function POST(request: Request) {
	const user = await currentUser()
	const body = (await request.json().catch(() => null)) as {
		sessionId?: string
		consent?: boolean
		masked?: boolean
		chunk?: { sequence?: number; payload?: string }
	} | null
	const sessionId = body?.sessionId?.trim()
	if (!sessionId) {
		return NextResponse.json({ error: 'session_id_required' }, { status: 400 })
	}
	try {
		if (body?.chunk?.payload) {
			await destObservabilityJson(`/v1/session-replays/${encodeURIComponent(sessionId)}/chunks`, {
				method: 'POST',
				body: {
					session_id: sessionId,
					writes: [
						{
							idempotency_key: crypto.randomUUID(),
							chunk: {
								sequence: body.chunk.sequence ?? 1,
								payload: body.chunk.payload,
								event_time: new Date().toISOString(),
							},
						},
					],
				},
			})
		} else {
			await destObservabilityJson('/v1/session-replays', {
				method: 'POST',
				body: {
					idempotency_key: crypto.randomUUID(),
					session: {
						session_id: sessionId,
						user_id: user?.id ?? '',
						consent: body?.consent === true,
						masked: body?.masked !== false,
						started_at: new Date().toISOString(),
					},
				},
			})
		}
		return NextResponse.json({ authority: 'sylphx-observability', sessionId })
	} catch (error) {
		const message = error instanceof Error ? error.message : 'observability_replay_failed'
		return NextResponse.json({ error: message }, { status: 502 })
	}
}
