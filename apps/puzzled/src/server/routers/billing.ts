/**
 * Billing Router
 *
 * Billing-related procedures including transaction history.
 */

import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { PAGINATION } from '@/lib/config/validation'
import { db } from '@/lib/db'
import { billingTransactions, TRANSACTION_STATUS_VALUES } from '@/lib/db/schema'
import { protectedProcedure, router } from '../trpc'

export const billingRouter = router({
	/**
	 * Get billing history for the current user
	 * Returns paginated transactions with optional status filter
	 */
	getBillingHistory: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
				offset: z.number().min(0).default(0),
				status: z.array(z.enum(TRANSACTION_STATUS_VALUES)).optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Build where conditions
			const conditions = [eq(billingTransactions.userId, ctx.user.id)]

			if (input.status && input.status.length > 0) {
				conditions.push(inArray(billingTransactions.status, input.status))
			}

			const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]

			// Get transactions
			const transactions = await db
				.select({
					id: billingTransactions.id,
					stripeInvoiceId: billingTransactions.stripeInvoiceId,
					stripeChargeId: billingTransactions.stripeChargeId,
					hostedInvoiceUrl: billingTransactions.hostedInvoiceUrl,
					amountCents: billingTransactions.amountCents,
					currency: billingTransactions.currency,
					type: billingTransactions.type,
					status: billingTransactions.status,
					description: billingTransactions.description,
					metadata: billingTransactions.metadata,
					stripeCreatedAt: billingTransactions.stripeCreatedAt,
					createdAt: billingTransactions.createdAt,
				})
				.from(billingTransactions)
				.where(whereClause)
				.orderBy(desc(billingTransactions.stripeCreatedAt))
				.limit(input.limit)
				.offset(input.offset)

			// Get total count for pagination
			const [{ total }] = await db
				.select({ total: count() })
				.from(billingTransactions)
				.where(whereClause)

			const page = Math.floor(input.offset / input.limit) + 1
			const hasMore = input.offset + transactions.length < total

			return {
				transactions,
				total,
				page,
				hasMore,
				limit: input.limit,
				offset: input.offset,
			}
		}),
})
