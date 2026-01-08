import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminCheckResponse, badRequest, checkAdminWithMfa } from '@/features/admin'
import { syncPlanToStripe } from '@/features/subscription/server'
import { logAdminAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { planPrices, plans } from '@/lib/db/schema'

export const runtime = 'nodejs'

const createPlanSchema = z.object({
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/),
	name: z.string().min(1).max(100),
	description: z.string().optional(),
	features: z.array(z.string()).optional(),
	prices: z
		.array(
			z.object({
				interval: z.enum(['monthly', 'annual', 'lifetime']),
				amount: z.number().positive(),
				currency: z.string().default('usd'),
			}),
		)
		.optional(),
	syncToStripe: z.boolean().optional(),
})

// GET /api/admin/plans - List all plans
export async function GET(request: NextRequest) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	try {
		const allPlans = await db.query.plans.findMany({
			with: { prices: true },
			orderBy: plans.sortOrder,
		})

		return NextResponse.json({ plans: allPlans })
	} catch (error) {
		console.error('[Admin Plans] GET all error:', error)
		return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 })
	}
}

// POST /api/admin/plans - Create a new plan
export async function POST(request: NextRequest) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse || !authResult.allowed) return errorResponse!

	const actorId = authResult.userId

	try {
		const body = await request.json()

		// Validate request body
		const validationResult = createPlanSchema.safeParse(body)
		if (!validationResult.success) {
			return NextResponse.json(
				{
					error: 'Invalid request body',
					details: validationResult.error.flatten(),
				},
				{ status: 400 },
			)
		}

		const {
			slug,
			name,
			description,
			features,
			prices: pricesData,
			syncToStripe,
		} = validationResult.data

		// Check if slug already exists
		const existing = await db.query.plans.findFirst({
			where: eq(plans.slug, slug),
		})
		if (existing) {
			return badRequest('Plan with this slug already exists')
		}

		// Create plan
		const [newPlan] = await db
			.insert(plans)
			.values({
				slug,
				name,
				description,
				features: features || [],
			})
			.returning()

		// Create prices if provided
		if (pricesData && Array.isArray(pricesData)) {
			for (const price of pricesData) {
				await db.insert(planPrices).values({
					planId: newPlan.id,
					interval: price.interval,
					amount: price.amount,
					currency: price.currency || 'usd',
				})
			}
		}

		// Optionally sync to Stripe
		if (syncToStripe && slug !== 'free') {
			await syncPlanToStripe(newPlan.id)
		}

		// Log admin action
		await logAdminAction(actorId, 'create', 'plan', newPlan.id, {
			slug,
			name,
			priceCount: pricesData?.length || 0,
			syncedToStripe: syncToStripe && slug !== 'free',
		})

		const result = await db.query.plans.findFirst({
			where: eq(plans.id, newPlan.id),
			with: { prices: true },
		})

		return NextResponse.json({ plan: result }, { status: 201 })
	} catch (error) {
		console.error('[Admin Plans] POST create error:', error)
		return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
	}
}
