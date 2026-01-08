import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { billingTransactions } from '@/lib/db/schema'

export type BillingTransaction = {
	id: string
	stripeInvoiceId: string | null
	amountCents: number
	currency: string
	type: 'charge' | 'refund' | 'dispute' | 'dispute_reversal'
	status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'disputed'
	description: string | null
	stripeCreatedAt: Date
}

/**
 * Get billing transaction history for a user
 * Returns transactions in reverse chronological order (newest first)
 */
export async function getBillingHistory(userId: string, limit = 10): Promise<BillingTransaction[]> {
	const transactions = await db
		.select({
			id: billingTransactions.id,
			stripeInvoiceId: billingTransactions.stripeInvoiceId,
			amountCents: billingTransactions.amountCents,
			currency: billingTransactions.currency,
			type: billingTransactions.type,
			status: billingTransactions.status,
			description: billingTransactions.description,
			stripeCreatedAt: billingTransactions.stripeCreatedAt,
		})
		.from(billingTransactions)
		.where(eq(billingTransactions.userId, userId))
		.orderBy(desc(billingTransactions.stripeCreatedAt))
		.limit(limit)

	return transactions
}
