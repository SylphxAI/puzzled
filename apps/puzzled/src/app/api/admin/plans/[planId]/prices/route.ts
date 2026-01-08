import { and, eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import {
	adminCheckResponse,
	badRequest,
	checkAdminWithMfa,
	notFound,
	validateUuidParam,
} from '@/features/admin'

export const runtime = 'nodejs'

import { stripe } from '@/features/subscription/server'
import { db } from '@/lib/db'
import { planPrices, plans } from '@/lib/db/schema'

type RouteContext = { params: Promise<{ planId: string }> }

// GET /api/admin/plans/[planId]/prices
export async function GET(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	const { planId } = await context.params

	// Validate UUID format before database query
	const uuidError = validateUuidParam(planId, 'planId')
	if (uuidError) return uuidError

	const prices = await db.query.planPrices.findMany({
		where: eq(planPrices.planId, planId),
	})

	return NextResponse.json({ prices })
}

// POST /api/admin/plans/[planId]/prices
export async function POST(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	const { planId } = await context.params

	// Validate UUID format before database query
	const uuidError = validateUuidParam(planId, 'planId')
	if (uuidError) return uuidError

	let body: unknown
	try {
		body = await request.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	const {
		interval,
		amount,
		currency = 'usd',
		syncToStripe: shouldSync,
	} = body as Record<string, unknown>

	if (!interval || !amount) {
		return badRequest('interval and amount are required')
	}

	if (!['monthly', 'annual', 'lifetime'].includes(interval as string)) {
		return badRequest('Invalid interval')
	}

	try {
		const plan = await db.query.plans.findFirst({ where: eq(plans.id, planId) })
		if (!plan) return notFound('Plan not found')

		const existing = await db.query.planPrices.findFirst({
			where: and(
				eq(planPrices.planId, planId),
				eq(planPrices.interval, interval as 'monthly' | 'annual' | 'lifetime'),
			),
		})
		if (existing) return badRequest('Price for this interval already exists')

		const [newPrice] = await db
			.insert(planPrices)
			.values({
				planId,
				interval: interval as 'monthly' | 'annual' | 'lifetime',
				amount: amount as number,
				currency: (currency as string) || 'usd',
			})
			.returning()

		if (shouldSync && plan.slug !== 'free' && plan.stripeProductId) {
			const stripePrice = await stripe.prices.create({
				product: plan.stripeProductId,
				unit_amount: amount as number,
				currency: currency as string,
				recurring:
					interval === 'lifetime'
						? undefined
						: { interval: interval === 'monthly' ? 'month' : 'year' },
				metadata: { planId: plan.id, priceId: newPrice.id, brand: 'puzzled' },
			})

			await db
				.update(planPrices)
				.set({ stripePriceId: stripePrice.id })
				.where(eq(planPrices.id, newPrice.id))
		}

		const result = await db.query.planPrices.findFirst({ where: eq(planPrices.id, newPrice.id) })
		return NextResponse.json({ price: result }, { status: 201 })
	} catch (error) {
		console.error('[Admin Prices] POST error:', error)
		return NextResponse.json({ error: 'Failed to create price' }, { status: 500 })
	}
}

// DELETE /api/admin/plans/[planId]/prices
export async function DELETE(request: NextRequest, context: RouteContext) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	const { planId } = await context.params

	// Validate UUID format before database query
	const uuidError = validateUuidParam(planId, 'planId')
	if (uuidError) return uuidError

	const { searchParams } = new URL(request.url)
	const interval = searchParams.get('interval')
	const priceId = searchParams.get('priceId')

	if (!interval && !priceId) {
		return badRequest('interval or priceId query param required')
	}

	// Validate priceId if provided
	if (priceId) {
		const priceUuidError = validateUuidParam(priceId, 'priceId')
		if (priceUuidError) return priceUuidError
	}

	const whereClause = priceId
		? eq(planPrices.id, priceId)
		: and(
				eq(planPrices.planId, planId),
				eq(planPrices.interval, interval as 'monthly' | 'annual' | 'lifetime'),
			)

	const existing = await db.query.planPrices.findFirst({ where: whereClause })
	if (!existing) return notFound('Price not found')

	if (existing.stripePriceId) {
		await stripe.prices.update(existing.stripePriceId, { active: false })
	}

	await db.delete(planPrices).where(eq(planPrices.id, existing.id))
	return NextResponse.json({ success: true })
}
