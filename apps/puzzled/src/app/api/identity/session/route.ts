import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/identity/server'

export async function GET() {
	const user = await currentUser()
	return NextResponse.json({ authority: 'sylphx-identity', user })
}
