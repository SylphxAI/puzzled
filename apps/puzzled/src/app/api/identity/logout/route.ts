import { NextResponse } from 'next/server'
import { revokeCurrentSessions } from '@/lib/identity/server'

export async function POST() {
	await revokeCurrentSessions()
	return NextResponse.json({ authority: 'sylphx-identity' })
}
