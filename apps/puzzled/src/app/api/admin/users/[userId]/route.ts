import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
	adminCheckResponse,
	badRequest,
	checkAdminWithMfa,
	notFound,
	validateUuidParam,
} from '@/features/admin'
import { hasSuperAdminRole } from '@/features/admin/lib/admin'
import { logAdminAction, logRoleChange } from '@/lib/audit'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { isAdminRole, ROLE_ADMIN, ROLE_USER } from '@/lib/roles'

export const runtime = 'nodejs'

// Only user and admin roles can be assigned via API (super_admin requires direct database access)
const updateUserSchema = z.object({
	role: z.enum([ROLE_USER, ROLE_ADMIN]).optional(),
	name: z.string().min(1).max(100).optional(),
	emailVerified: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ userId: string }> }

// GET /api/admin/users/[userId]
export async function GET(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	try {
		const { userId } = await context.params

		// Validate UUID format before database query
		const uuidError = validateUuidParam(userId, 'userId')
		if (uuidError) return uuidError

		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
			with: { subscription: true, stats: true },
		})

		if (!user) return notFound('User not found')
		return NextResponse.json({ user })
	} catch (error) {
		console.error('[Admin Users] GET by ID error:', error)
		return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
	}
}

// PUT /api/admin/users/[userId]
export async function PUT(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse || !authResult.allowed) return errorResponse!

	const actorId = authResult.userId
	const { userId } = await context.params

	// Validate UUID format before database query
	const uuidError = validateUuidParam(userId, 'userId')
	if (uuidError) return uuidError

	try {
		const body = await request.json()

		// Validate request body with Zod
		const validationResult = updateUserSchema.safeParse(body)
		if (!validationResult.success) {
			return NextResponse.json(
				{ error: 'Invalid request body', details: validationResult.error.flatten() },
				{ status: 400 },
			)
		}

		const { role, name, emailVerified } = validationResult.data

		const existing = await db.query.users.findFirst({ where: eq(users.id, userId) })
		if (!existing) return notFound('User not found')

		// Check if role promotion requires super_admin privilege
		if (role !== undefined && role !== existing.role) {
			// Only super_admin can promote users to admin role
			if (role === ROLE_ADMIN) {
				const actor = await db.query.users.findFirst({ where: eq(users.id, actorId) })
				if (!hasSuperAdminRole(actor?.role)) {
					return NextResponse.json(
						{ error: 'Forbidden: Only super_admin can promote users to admin role' },
						{ status: 403 },
					)
				}
			}

			// Log role change separately for compliance
			await logRoleChange(actorId, userId, existing.role, role)
		}

		await db
			.update(users)
			.set({
				...(role !== undefined && { role }),
				...(name !== undefined && { name }),
				...(emailVerified !== undefined && { emailVerified }),
				updatedAt: new Date(),
			})
			.where(eq(users.id, userId))

		// Log admin action
		await logAdminAction(actorId, 'update', 'user', userId, {
			changes: { role, name, emailVerified },
		})

		const result = await db.query.users.findFirst({
			where: eq(users.id, userId),
			with: { subscription: true },
		})

		return NextResponse.json({ user: result })
	} catch (error) {
		console.error('[Admin Users] PUT error:', error)
		return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
	}
}

// DELETE /api/admin/users/[userId]
export async function DELETE(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse || !authResult.allowed) return errorResponse!

	try {
		const actorId = authResult.userId
		const { userId } = await context.params

		// Validate UUID format before database query
		const uuidError = validateUuidParam(userId, 'userId')
		if (uuidError) return uuidError

		const existing = await db.query.users.findFirst({ where: eq(users.id, userId) })

		if (!existing) return notFound('User not found')

		// Prevent deleting admin or super_admin users
		if (isAdminRole(existing.role)) {
			return badRequest('Cannot delete admin users from API. Use database directly.')
		}

		await db.delete(users).where(eq(users.id, userId))

		// Log admin action
		await logAdminAction(actorId, 'delete', 'user', userId, {
			deletedUserEmail: existing.email,
		})

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('[Admin Users] DELETE error:', error)
		return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
	}
}
