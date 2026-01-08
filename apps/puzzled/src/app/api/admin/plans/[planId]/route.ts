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
import { syncPlanToStripe } from '@/features/subscription/server'
import { logAdminAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { plans } from '@/lib/db/schema'

export const runtime = 'nodejs'

const updatePlanSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	description: z.string().max(500).optional(),
	features: z.array(z.string().max(200)).max(20).optional(),
	isActive: z.boolean().optional(),
	sortOrder: z.number().int().min(0).max(100).optional(),
	syncToStripe: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ planId: string }> }

// GET /api/admin/plans/[planId]
export async function GET(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	try {
		const { planId } = await context.params

		// Validate UUID format before database query
		const uuidError = validateUuidParam(planId, 'planId')
		if (uuidError) return uuidError

		const plan = await db.query.plans.findFirst({
			where: eq(plans.id, planId),
			with: { prices: true },
		})

		if (!plan) return notFound('Plan not found')
		return NextResponse.json({ plan })
	} catch (error) {
		console.error('[Admin Plans] GET error:', error)
		return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 })
	}
}

// PUT /api/admin/plans/[planId]
export async function PUT(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse || !authResult.allowed) return errorResponse!

	try {
		const actorId = authResult.userId
		const { planId } = await context.params

		// Validate UUID format before database query
		const uuidError = validateUuidParam(planId, 'planId')
		if (uuidError) return uuidError

		const body = await request.json()
		const parsed = updatePlanSchema.safeParse(body)

		if (!parsed.success) {
			return badRequest(parsed.error.issues[0]?.message || 'Invalid input')
		}

		const { name, description, features, isActive, sortOrder, syncToStripe } = parsed.data

		const existing = await db.query.plans.findFirst({ where: eq(plans.id, planId) })
		if (!existing) return notFound('Plan not found')

		await db
			.update(plans)
			.set({
				...(name !== undefined && { name }),
				...(description !== undefined && { description }),
				...(features !== undefined && { features }),
				...(isActive !== undefined && { isActive }),
				...(sortOrder !== undefined && { sortOrder }),
				updatedAt: new Date(),
			})
			.where(eq(plans.id, planId))

		if (syncToStripe && existing.slug !== 'free') {
			await syncPlanToStripe(planId)
		}

		// Log admin action
		await logAdminAction(actorId, 'update', 'plan', planId, {
			planSlug: existing.slug,
			changes: { name, description, features, isActive, sortOrder },
			syncedToStripe: syncToStripe && existing.slug !== 'free',
		})

		const result = await db.query.plans.findFirst({
			where: eq(plans.id, planId),
			with: { prices: true },
		})

		return NextResponse.json({ plan: result })
	} catch (error) {
		console.error('[Admin Plans] PUT error:', error)
		return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
	}
}

// DELETE /api/admin/plans/[planId]
export async function DELETE(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse || !authResult.allowed) return errorResponse!

	try {
		const actorId = authResult.userId
		const { planId } = await context.params

		// Validate UUID format before database query
		const uuidError = validateUuidParam(planId, 'planId')
		if (uuidError) return uuidError

		const existing = await db.query.plans.findFirst({ where: eq(plans.id, planId) })

		if (!existing) return notFound('Plan not found')
		if (existing.slug === 'free') return badRequest('Cannot delete the free plan')

		await db.delete(plans).where(eq(plans.id, planId))

		// Log admin action
		await logAdminAction(actorId, 'delete', 'plan', planId, {
			deletedPlanSlug: existing.slug,
			deletedPlanName: existing.name,
		})

		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('[Admin Plans] DELETE error:', error)
		return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
	}
}

// POST /api/admin/plans/[planId] - Sync to Stripe
export async function POST(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse || !authResult.allowed) return errorResponse!

	try {
		const actorId = authResult.userId
		const { planId } = await context.params

		// Validate UUID format before database query
		const uuidError = validateUuidParam(planId, 'planId')
		if (uuidError) return uuidError

		const existing = await db.query.plans.findFirst({ where: eq(plans.id, planId) })

		if (!existing) return notFound('Plan not found')
		if (existing.slug === 'free') return badRequest('Free plan does not need Stripe sync')

		const synced = await syncPlanToStripe(planId)

		// Log admin action
		await logAdminAction(actorId, 'update', 'plan', planId, {
			planSlug: existing.slug,
			action: 'stripe_sync',
		})

		return NextResponse.json({ plan: synced })
	} catch (error) {
		console.error('[Admin Plans] POST (Stripe sync) error:', error)
		return NextResponse.json({ error: 'Failed to sync plan to Stripe' }, { status: 500 })
	}
}
