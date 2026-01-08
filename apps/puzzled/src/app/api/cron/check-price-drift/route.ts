import { NextResponse } from 'next/server'
import { detectPriceDrift, formatPriceDrift } from '@/lib/billing/drift-detection'
import { captureError, captureMessage } from '@/lib/sentry'
import { verifyCronAuth } from '@/lib/api/cron'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[PriceDrift]'

/**
 * Cron job to check for price drift between database and Stripe
 *
 * This endpoint should be called by a cron service (e.g., Vercel Cron, Upstash QStash)
 * to periodically check if prices in the database match prices in Stripe.
 *
 * Schedule: Run daily at 9 AM UTC
 */
async function handlePriceDriftCheck(request: Request): Promise<Response> {
	const authError = verifyCronAuth(request, LOG_PREFIX)
	if (authError) return authError

	console.log(`${LOG_PREFIX} Starting price drift check...`)

	try {
		const drifts = await detectPriceDrift()

		if (drifts.length === 0) {
			console.log(`${LOG_PREFIX} No price drift detected`)
			return NextResponse.json({
				success: true,
				message: 'No price drift detected',
				drifts: [],
			})
		}

		// Price drift detected - alert via Sentry
		console.error(`${LOG_PREFIX} Detected ${drifts.length} price drift(s)`)

		const driftDetails = drifts.map(formatPriceDrift).join('\n')
		const message = `Price drift detected between database and Stripe:\n\n${driftDetails}`

		// Send alert to Sentry
		captureMessage(message, 'error', {
			drift_count: drifts.length,
			drifts: drifts.map((d) => ({
				plan: d.planSlug,
				interval: d.interval,
				db_amount: d.dbAmount,
				stripe_amount: d.stripeAmount,
				difference: d.difference,
			})),
		})

		// Also capture as error for better visibility
		captureError(new Error('Price drift detected'), {
			level: 'error',
			tags: {
				category: 'billing',
				type: 'price_drift',
			},
			extra: {
				drift_count: drifts.length,
				drifts,
			},
		})

		// Return drift information (200 so cron doesn't retry)
		return NextResponse.json({
			success: false,
			message: `Detected ${drifts.length} price drift(s)`,
			drifts: drifts.map((d) => ({
				plan: d.planName,
				slug: d.planSlug,
				interval: d.interval,
				dbAmount: d.dbAmount,
				stripeAmount: d.stripeAmount,
				difference: d.difference,
				formatted: formatPriceDrift(d),
			})),
		})
	} catch (error) {
		console.error(`${LOG_PREFIX} Error checking price drift:`, error)

		captureError(error instanceof Error ? error : new Error(String(error)), {
			level: 'error',
			tags: {
				category: 'billing',
				type: 'price_drift_check_error',
			},
		})

		return NextResponse.json(
			{
				success: false,
				error: 'Failed to check price drift',
				message: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		)
	}
}

// Both GET (Vercel Cron) and POST (QStash) use the same handler
export const GET = handlePriceDriftCheck
export const POST = handlePriceDriftCheck
