import { NextResponse } from 'next/server'
import { destEventsJson } from '@/lib/identity/peels'
import { currentUser } from '@/lib/identity/server'

export async function GET() {
	const user = await currentUser()
	if (!user) {
		return NextResponse.json({ authority: 'sylphx-events', messages: [] })
	}
	try {
		const body = await destEventsJson<{ messages?: unknown[] }>('/v1/inbox', {
			method: 'GET',
		})
		return NextResponse.json({ authority: 'sylphx-events', messages: body.messages ?? [] })
	} catch (error) {
		const message = error instanceof Error ? error.message : 'events_inbox_failed'
		return NextResponse.json({ error: message }, { status: 502 })
	}
}
