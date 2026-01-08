import { desc, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { adminCheckResponse, checkAdminWithMfa } from '@/features/admin'
import { db } from '@/lib/db'
import { subscriptions, users } from '@/lib/db/schema'

export const runtime = 'nodejs'

// GET /api/admin/users
// Returns limited user fields to prevent data exposure
export async function GET(request: NextRequest) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	try {
		const allUsers = await db
			.select({
				id: users.id,
				name: users.name,
				email: users.email,
				emailVerified: users.emailVerified,
				role: users.role,
				twoFactorEnabled: users.twoFactorEnabled,
				createdAt: users.createdAt,
				// Subscription info (limited fields)
				subscription: {
					id: subscriptions.id,
					status: subscriptions.status,
					plan: subscriptions.plan,
					currentPeriodEnd: subscriptions.currentPeriodEnd,
				},
			})
			.from(users)
			.leftJoin(subscriptions, eq(subscriptions.userId, users.id))
			.orderBy(desc(users.createdAt))

		return NextResponse.json({ users: allUsers })
	} catch (error) {
		console.error('[Admin Users] GET error:', error)
		return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
	}
}
