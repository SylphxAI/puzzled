import { type NextRequest, NextResponse } from 'next/server'
import { adminCheckResponse, badRequest, checkAdminWithMfa } from '@/features/admin'

export const runtime = 'nodejs'

import { syncAllPlansToStripe } from '@/features/subscription/server'
import { db } from '@/lib/db'
import { planPrices, plans } from '@/lib/db/schema'

// POST /api/admin/plans/seed
export async function POST(request: NextRequest) {
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	const { searchParams } = new URL(request.url)
	const syncToStripe = searchParams.get('sync') === 'true'

	// Check if plans already exist
	const existingPlans = await db.query.plans.findMany()
	if (existingPlans.length > 0) {
		return badRequest('Plans already exist. Use /api/admin/plans to manage them.')
	}

	// Create Free plan
	const [_freePlan] = await db
		.insert(plans)
		.values({
			slug: 'free',
			name: 'Free',
			description: 'Get started with daily puzzles',
			features: ['1 free game daily', 'Basic statistics', '7 days history'],
			sortOrder: 0,
		})
		.returning()

	// Create Premium plan
	const [premiumPlan] = await db
		.insert(plans)
		.values({
			slug: 'premium',
			name: 'Premium',
			description: 'Unlimited access to all games',
			features: [
				'All games unlimited',
				'Full statistics',
				'Permanent history',
				'Leaderboards',
				'Push notifications',
				'Early access to new games',
				'No ads',
			],
			sortOrder: 1,
		})
		.returning()

	// Create Premium prices
	await db.insert(planPrices).values([
		{ planId: premiumPlan.id, interval: 'monthly', amount: 499, currency: 'usd' }, // $4.99/month
		{ planId: premiumPlan.id, interval: 'annual', amount: 3999, currency: 'usd' }, // $39.99/year
	])

	// Optionally sync to Stripe
	let stripeSynced = false
	if (syncToStripe) {
		await syncAllPlansToStripe()
		stripeSynced = true
	}

	const result = await db.query.plans.findMany({
		with: { prices: true },
		orderBy: plans.sortOrder,
	})

	return NextResponse.json({ success: true, stripeSynced, plans: result }, { status: 201 })
}
