import * as Sentry from '@sentry/nextjs'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { logSubscriptionChange } from '@/lib/audit'
import { PLAN_SLUGS } from '@/lib/config/subscription'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Helper type for Stripe API responses with snake_case properties
type StripeSubscription = Stripe.Response<Stripe.Subscription> & {
	current_period_start: number
	current_period_end: number
	cancel_at_period_end: boolean
	trial_end: number | null
}

type StripeInvoice = Stripe.Invoice & {
	subscription: string | Stripe.Subscription | null
	charge: string | Stripe.Charge | null
	payment_intent: string | Stripe.PaymentIntent | null
	hosted_invoice_url: string | null
}

// Lazy load stripe to avoid build-time initialization
async function getStripe() {
	const { stripe } = await import('@/features/subscription/server')
	return stripe
}

async function getDatabase() {
	const { db } = await import('@/lib/db')
	return db
}

async function getSchema() {
	const { subscriptions, webhookEvents, billingTransactions, users } = await import(
		'@/lib/db/schema'
	)
	return { subscriptions, webhookEvents, billingTransactions, users }
}

async function getEmailLib() {
	const { sendTrialStartedEmail, sendTrialEndingSoonEmail, sendTrialEndedEmail } = await import(
		'@/features/notifications/lib/email'
	)
	return { sendTrialStartedEmail, sendTrialEndingSoonEmail, sendTrialEndedEmail }
}

/**
 * Get user info for sending emails
 * Returns null if user not found (prevents email sending)
 */
async function getUserInfoForEmail(
	userId: string,
): Promise<{ email: string; name: string } | null> {
	const db = await getDatabase()
	const { users } = await getSchema()

	const user = await db.query.users?.findFirst({
		where: eq(users.id, userId),
		columns: { email: true, name: true },
	})

	if (!user) return null
	return { email: user.email, name: user.name || '' }
}

/**
 * Record a billing transaction to the ledger
 */
async function recordTransaction({
	userId,
	stripeCustomerId,
	stripeInvoiceId,
	stripeChargeId,
	stripePaymentIntentId,
	hostedInvoiceUrl,
	amountCents,
	currency,
	type,
	status,
	description,
	metadata,
	stripeCreatedAt,
}: {
	userId: string
	stripeCustomerId: string
	stripeInvoiceId?: string | null
	stripeChargeId?: string | null
	stripePaymentIntentId?: string | null
	/** Customer-facing invoice URL (e.g., Stripe hosted invoice) */
	hostedInvoiceUrl?: string | null
	amountCents: number
	currency: string
	type: 'charge' | 'refund' | 'dispute' | 'dispute_reversal'
	status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'disputed'
	description?: string | null
	metadata?: Record<string, unknown>
	stripeCreatedAt: Date
}) {
	const db = await getDatabase()
	const { billingTransactions } = await getSchema()

	await db.insert(billingTransactions).values({
		userId,
		stripeCustomerId,
		stripeInvoiceId: stripeInvoiceId ?? undefined,
		stripeChargeId: stripeChargeId ?? undefined,
		stripePaymentIntentId: stripePaymentIntentId ?? undefined,
		hostedInvoiceUrl: hostedInvoiceUrl ?? undefined,
		amountCents,
		currency,
		type,
		status,
		description: description ?? undefined,
		metadata,
		stripeCreatedAt,
	})
}

/**
 * Extract subscription ID from event for out-of-order handling
 */
function extractSubscriptionId(event: Stripe.Event): string | null {
	// Direct subscription events
	if (event.type.startsWith('customer.subscription.')) {
		const subscription = event.data.object as Stripe.Subscription
		return subscription.id
	}

	// Checkout session with subscription
	if (event.type === 'checkout.session.completed') {
		const session = event.data.object as Stripe.Checkout.Session
		return typeof session.subscription === 'string' ? session.subscription : null
	}

	// Invoice events
	if (event.type.startsWith('invoice.')) {
		const invoice = event.data.object as StripeInvoice
		if (invoice.subscription) {
			return typeof invoice.subscription === 'string'
				? invoice.subscription
				: invoice.subscription.id
		}
	}

	return null
}

/**
 * Check if this event type affects subscription state
 * These are the events we need to handle out-of-order
 */
function isSubscriptionStateEvent(eventType: string): boolean {
	return [
		'customer.subscription.created',
		'customer.subscription.updated',
		'customer.subscription.deleted',
		'invoice.paid',
		'invoice.payment_succeeded',
		'invoice.payment_failed',
	].includes(eventType)
}

/**
 * Map Stripe subscription status to our status enum
 * Handles all Stripe statuses correctly including trialing
 */
function mapSubscriptionStatus(
	stripeStatus: Stripe.Subscription.Status,
): 'active' | 'cancelled' | 'past_due' | 'trialing' {
	switch (stripeStatus) {
		case 'active':
			return 'active'
		case 'trialing':
			return 'trialing'
		case 'past_due':
		case 'unpaid':
			return 'past_due'
		case 'canceled':
		case 'incomplete_expired':
			return 'cancelled'
		// incomplete, paused, and any future statuses default to past_due
		default:
			return 'past_due'
	}
}

export async function POST(req: Request) {
	const body = await req.text()
	const headersList = await headers()
	const signature = headersList.get('stripe-signature')

	if (!signature) {
		// Per spec: Alert on signature failures
		Sentry.captureMessage('Stripe webhook: Missing signature header', {
			level: 'warning',
			tags: { webhook: 'stripe', failure: 'missing_signature' },
		})
		return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
	}

	const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
	if (!webhookSecret) {
		console.error('STRIPE_WEBHOOK_SECRET is not configured')
		Sentry.captureMessage('Stripe webhook: Secret not configured', {
			level: 'error',
			tags: { webhook: 'stripe', failure: 'misconfigured' },
		})
		return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
	}

	let event: Stripe.Event
	const stripe = await getStripe()

	try {
		event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
	} catch (err) {
		console.error('Webhook signature verification failed:', err)
		// Per spec: Alert on signature verification failures (potential attack)
		Sentry.captureMessage('Stripe webhook: Signature verification failed', {
			level: 'error',
			tags: { webhook: 'stripe', failure: 'invalid_signature' },
			extra: { error: err instanceof Error ? err.message : String(err) },
		})
		return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
	}

	// Webhook replay protection: Reject events older than 5 minutes
	const currentTime = Math.floor(Date.now() / 1000)
	const eventAge = currentTime - event.created
	const MAX_EVENT_AGE = 300 // 5 minutes in seconds

	if (eventAge > MAX_EVENT_AGE) {
		console.warn(`[Webhook] Event ${event.id} rejected: too old (${eventAge}s)`)
		Sentry.captureMessage('Stripe webhook: Replay attack detected', {
			level: 'warning',
			tags: { webhook: 'stripe', failure: 'replay_attack' },
			extra: {
				event_id: event.id,
				event_age: eventAge,
				max_age: MAX_EVENT_AGE,
			},
		})
		return NextResponse.json({ error: 'Event too old' }, { status: 400 })
	}

	const db = await getDatabase()
	const { subscriptions, webhookEvents } = await getSchema()

	// Extract subscription ID for ordering (if applicable)
	const subscriptionId = extractSubscriptionId(event)
	// Stripe event.created is Unix timestamp
	const stripeCreatedAt = new Date(event.created * 1000)

	try {
		// Idempotency check: Skip if event already processed
		const existingEvent = await db.query.webhookEvents?.findFirst({
			where: (events, { eq }) => eq(events.stripeEventId, event.id),
		})

		if (existingEvent) {
			console.log(`[Webhook] Event ${event.id} already processed, skipping`)
			return NextResponse.json({ received: true, skipped: true })
		}

		// Per spec: Out-of-order event handling
		// Check if we've already processed a newer event for this subscription
		if (subscriptionId && isSubscriptionStateEvent(event.type)) {
			const newerEvent = await db.query.webhookEvents?.findFirst({
				where: (events, { and, eq, gt }) =>
					and(
						eq(events.subscriptionId, subscriptionId),
						gt(events.stripeCreatedAt, stripeCreatedAt),
					),
			})

			if (newerEvent) {
				console.log(
					`[Webhook] Event ${event.id} is older than already processed event, skipping state change`,
				)
				// Still record the event for audit, but mark as skipped
				await db.insert(webhookEvents).values({
					stripeEventId: event.id,
					eventType: event.type,
					stripeCreatedAt,
					subscriptionId,
				})
				return NextResponse.json({ received: true, skipped: true, reason: 'out_of_order' })
			}
		}

		// Record event before processing to prevent duplicates
		await db.insert(webhookEvents).values({
			stripeEventId: event.id,
			eventType: event.type,
			stripeCreatedAt,
			subscriptionId,
		})

		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session
				const userId = session.metadata?.userId
				const purchaseType = session.metadata?.purchaseType

				if (!userId) {
					console.error('[Webhook] checkout.session.completed missing userId metadata')
					Sentry.captureMessage('Stripe webhook: checkout.session.completed missing userId', {
						level: 'error',
						tags: { webhook: 'stripe', failure: 'missing_metadata' },
						extra: {
							event_id: event.id,
							session_id: session.id,
							customer: session.customer,
						},
					})
					break
				}

				// Handle lifetime (one-time payment) purchase
				if (purchaseType === PLAN_SLUGS.LIFETIME || session.mode === 'payment') {
					// Lifetime purchase - no subscription, just grant lifetime access
					await db.transaction(async (tx) => {
						await tx
							.insert(subscriptions)
							.values({
								userId,
								stripeCustomerId: session.customer as string,
								stripeSubscriptionId: null, // No subscription for lifetime
								plan: PLAN_SLUGS.LIFETIME,
								status: 'active',
								currentPeriodStart: new Date(),
								currentPeriodEnd: null, // Never expires
							})
							.onConflictDoUpdate({
								target: subscriptions.userId,
								set: {
									stripeCustomerId: session.customer as string,
									stripeSubscriptionId: null,
									plan: PLAN_SLUGS.LIFETIME,
									status: 'active',
									currentPeriodStart: new Date(),
									currentPeriodEnd: null,
									updatedAt: new Date(),
								},
							})
					})

					// Record transaction to ledger
					if (session.amount_total && session.customer) {
						await recordTransaction({
							userId,
							stripeCustomerId: session.customer as string,
							stripePaymentIntentId: session.payment_intent as string | null,
							amountCents: session.amount_total,
							currency: session.currency ?? 'usd',
							type: 'charge',
							status: 'succeeded',
							description: 'Lifetime subscription purchase',
							metadata: { purchaseType: PLAN_SLUGS.LIFETIME, sessionId: session.id },
							stripeCreatedAt: new Date(event.created * 1000),
						})
					}

					// Audit log: Track lifetime purchase
					await logSubscriptionChange(userId, 'create', PLAN_SLUGS.LIFETIME, {
						plan: PLAN_SLUGS.LIFETIME,
						status: 'active',
						source: 'checkout.session.completed',
					})
				} else if (session.subscription) {
					// Recurring subscription purchase
					const subscription = (await stripe.subscriptions.retrieve(
						session.subscription as string,
					)) as StripeSubscription

					const periodStart = subscription.current_period_start
						? new Date(subscription.current_period_start * 1000)
						: new Date()
					const periodEnd = subscription.current_period_end
						? new Date(subscription.current_period_end * 1000)
						: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
					const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null

					// Use transaction to prevent race conditions in subscription upserts
					await db.transaction(async (tx) => {
						await tx
							.insert(subscriptions)
							.values({
								userId,
								stripeCustomerId: session.customer as string,
								stripeSubscriptionId: subscription.id,
								plan: PLAN_SLUGS.PREMIUM,
								status: mapSubscriptionStatus(subscription.status),
								currentPeriodStart: periodStart,
								currentPeriodEnd: periodEnd,
								trialEnd,
							})
							.onConflictDoUpdate({
								target: subscriptions.userId,
								set: {
									stripeCustomerId: session.customer as string,
									stripeSubscriptionId: subscription.id,
									plan: PLAN_SLUGS.PREMIUM,
									status: mapSubscriptionStatus(subscription.status),
									currentPeriodStart: periodStart,
									currentPeriodEnd: periodEnd,
									trialEnd,
									updatedAt: new Date(),
								},
							})
					})

					// Audit log: Track subscription creation
					await logSubscriptionChange(userId, 'create', subscription.id, {
						plan: PLAN_SLUGS.PREMIUM,
						status: mapSubscriptionStatus(subscription.status),
						source: 'checkout.session.completed',
					})

					// Send trial started email if subscription is in trial
					if (subscription.status === 'trialing') {
						const userInfo = await getUserInfoForEmail(userId)
						if (userInfo) {
							const emailLib = await getEmailLib()
							await emailLib.sendTrialStartedEmail(userInfo).catch((err) => {
								console.error('[Webhook] Failed to send trial started email:', err)
							})
						}
					}
				}
				break
			}

			case 'customer.subscription.created': {
				// Handle new subscription creation (may be from different flow than checkout)
				const subscription = event.data.object as StripeSubscription
				let resolvedUserId = subscription.metadata?.userId

				// Fallback: try to find userId by stripeCustomerId if metadata is missing
				// This handles subscriptions created outside our checkout flow
				if (!resolvedUserId) {
					const stripeCustomerId =
						typeof subscription.customer === 'string'
							? subscription.customer
							: subscription.customer?.id
					if (stripeCustomerId) {
						const existingSub = await db.query.subscriptions?.findFirst({
							where: (subs, { eq }) => eq(subs.stripeCustomerId, stripeCustomerId),
						})
						if (existingSub) {
							resolvedUserId = existingSub.userId
						}
					}
				}

				if (!resolvedUserId) {
					console.error('[Webhook] customer.subscription.created: cannot resolve userId')
					Sentry.captureMessage('Stripe webhook: subscription.created missing userId', {
						level: 'error',
						tags: { webhook: 'stripe', failure: 'missing_metadata' },
						extra: {
							event_id: event.id,
							subscription_id: subscription.id,
							customer: subscription.customer,
						},
					})
					break
				}
				const userId = resolvedUserId

				const periodStart = subscription.current_period_start
					? new Date(subscription.current_period_start * 1000)
					: new Date()
				const periodEnd = subscription.current_period_end
					? new Date(subscription.current_period_end * 1000)
					: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
				const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null

				await db.transaction(async (tx) => {
					await tx
						.insert(subscriptions)
						.values({
							userId,
							stripeCustomerId:
								typeof subscription.customer === 'string'
									? subscription.customer
									: subscription.customer.id,
							stripeSubscriptionId: subscription.id,
							plan: PLAN_SLUGS.PREMIUM,
							status: mapSubscriptionStatus(subscription.status),
							currentPeriodStart: periodStart,
							currentPeriodEnd: periodEnd,
							trialEnd,
						})
						.onConflictDoUpdate({
							target: subscriptions.userId,
							set: {
								stripeCustomerId:
									typeof subscription.customer === 'string'
										? subscription.customer
										: subscription.customer.id,
								stripeSubscriptionId: subscription.id,
								plan: PLAN_SLUGS.PREMIUM,
								status: mapSubscriptionStatus(subscription.status),
								currentPeriodStart: periodStart,
								currentPeriodEnd: periodEnd,
								trialEnd,
								updatedAt: new Date(),
							},
						})
				})

				// Audit log: Track subscription creation
				await logSubscriptionChange(userId, 'create', subscription.id, {
					plan: PLAN_SLUGS.PREMIUM,
					status: mapSubscriptionStatus(subscription.status),
					source: 'customer.subscription.created',
				})

				// Send trial started email if subscription is in trial
				if (subscription.status === 'trialing') {
					const userInfo = await getUserInfoForEmail(userId)
					if (userInfo) {
						const emailLib = await getEmailLib()
						await emailLib.sendTrialStartedEmail(userInfo).catch((err) => {
							console.error('[Webhook] Failed to send trial started email:', err)
						})
					}
				}
				break
			}

			case 'customer.subscription.updated': {
				const subscription = event.data.object as StripeSubscription
				const userId = subscription.metadata?.userId

				// Check if this is a trial-to-active transition
				const previousAttributes = (event.data as { previous_attributes?: { status?: string } })
					.previous_attributes
				const wasTrialing = previousAttributes?.status === 'trialing'
				const isNowActive = subscription.status === 'active'

				// For updates, we can also look up by subscription ID if userId is missing
				// This handles edge cases where metadata was set after creation
				let resolvedUserId = userId
				if (!resolvedUserId) {
					// Try to find existing subscription to update
					const existingSub = await db.query.subscriptions?.findFirst({
						where: (subs, { eq }) => eq(subs.stripeSubscriptionId, subscription.id),
					})
					if (!existingSub) {
						console.error('[Webhook] customer.subscription.updated: cannot find subscription')
						Sentry.captureMessage('Stripe webhook: subscription.updated missing userId', {
							level: 'warning',
							tags: { webhook: 'stripe', failure: 'missing_metadata' },
							extra: {
								event_id: event.id,
								subscription_id: subscription.id,
							},
						})
						break
					}
					resolvedUserId = existingSub.userId
				}

				await db
					.update(subscriptions)
					.set({
						status: mapSubscriptionStatus(subscription.status),
						currentPeriodStart: subscription.current_period_start
							? new Date(subscription.current_period_start * 1000)
							: undefined,
						currentPeriodEnd: subscription.current_period_end
							? new Date(subscription.current_period_end * 1000)
							: undefined,
						trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : undefined,
						cancelAtPeriodEnd: subscription.cancel_at_period_end,
						updatedAt: new Date(),
					})
					.where(eq(subscriptions.stripeSubscriptionId, subscription.id))

				// Audit log: Track subscription update
				if (resolvedUserId) {
					await logSubscriptionChange(resolvedUserId, 'update', subscription.id, {
						status: mapSubscriptionStatus(subscription.status),
						cancelAtPeriodEnd: subscription.cancel_at_period_end,
						source: 'customer.subscription.updated',
					})

					// Send trial ended email when transitioning from trial to active
					if (wasTrialing && isNowActive) {
						const userInfo = await getUserInfoForEmail(resolvedUserId)
						if (userInfo) {
							const emailLib = await getEmailLib()
							await emailLib.sendTrialEndedEmail(userInfo).catch((err) => {
								console.error('[Webhook] Failed to send trial ended email:', err)
							})
						}
					}
				}
				break
			}

			case 'customer.subscription.deleted': {
				const subscription = event.data.object as Stripe.Subscription

				// Get userId before deletion for audit logging
				const existingSubscription = await db.query.subscriptions?.findFirst({
					where: (subs, { eq }) => eq(subs.stripeSubscriptionId, subscription.id),
				})

				await db
					.update(subscriptions)
					.set({
						plan: PLAN_SLUGS.FREE,
						status: 'cancelled',
						updatedAt: new Date(),
					})
					.where(eq(subscriptions.stripeSubscriptionId, subscription.id))

				// Audit log: Track subscription deletion
				if (existingSubscription) {
					await logSubscriptionChange(existingSubscription.userId, 'delete', subscription.id, {
						plan: PLAN_SLUGS.FREE,
						status: 'cancelled',
						source: 'customer.subscription.deleted',
					})
				}
				break
			}

			case 'invoice.paid': {
				// Handle successful invoice payment - confirm subscription is active
				const invoice = event.data.object as StripeInvoice

				if (invoice.subscription) {
					const subscriptionId =
						typeof invoice.subscription === 'string'
							? invoice.subscription
							: invoice.subscription.id

					const existingSubscription = await db.query.subscriptions?.findFirst({
						where: (subs, { eq }) => eq(subs.stripeSubscriptionId, subscriptionId),
					})

					await db
						.update(subscriptions)
						.set({
							status: 'active',
							updatedAt: new Date(),
						})
						.where(eq(subscriptions.stripeSubscriptionId, subscriptionId))

					// Record transaction to ledger
					if (existingSubscription && invoice.amount_paid && invoice.customer) {
						await recordTransaction({
							userId: existingSubscription.userId,
							stripeCustomerId:
								typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id,
							stripeInvoiceId: invoice.id,
							stripeChargeId:
								typeof invoice.charge === 'string' ? invoice.charge : (invoice.charge?.id ?? null),
							stripePaymentIntentId:
								typeof invoice.payment_intent === 'string'
									? invoice.payment_intent
									: (invoice.payment_intent?.id ?? null),
							hostedInvoiceUrl: invoice.hosted_invoice_url,
							amountCents: invoice.amount_paid,
							currency: invoice.currency,
							type: 'charge',
							status: 'succeeded',
							description: invoice.description ?? `Invoice ${invoice.number ?? invoice.id}`,
							metadata: {
								invoiceNumber: invoice.number,
								billingReason: invoice.billing_reason,
								subscriptionId,
							},
							stripeCreatedAt: new Date(event.created * 1000),
						})
					}

					// Audit log: Track subscription update
					if (existingSubscription) {
						await logSubscriptionChange(existingSubscription.userId, 'update', subscriptionId, {
							status: 'active',
							source: 'invoice.paid',
						})
					}
				}
				break
			}

			case 'invoice.payment_succeeded': {
				// Handle successful payment - update period dates if renewal
				const invoice = event.data.object as StripeInvoice

				if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
					const subscriptionId =
						typeof invoice.subscription === 'string'
							? invoice.subscription
							: invoice.subscription.id

					const existingSubscription = await db.query.subscriptions?.findFirst({
						where: (subs, { eq }) => eq(subs.stripeSubscriptionId, subscriptionId),
					})

					// Period dates are updated by customer.subscription.updated event (SSOT)
					// Here we only confirm payment succeeded → mark as active
					await db
						.update(subscriptions)
						.set({
							status: 'active',
							updatedAt: new Date(),
						})
						.where(eq(subscriptions.stripeSubscriptionId, subscriptionId))

					// Audit log: Track subscription renewal
					if (existingSubscription) {
						await logSubscriptionChange(existingSubscription.userId, 'update', subscriptionId, {
							status: 'active',
							billingReason: 'subscription_cycle',
							source: 'invoice.payment_succeeded',
						})
					}
				}
				break
			}

			case 'invoice.payment_failed': {
				const invoice = event.data.object as StripeInvoice

				if (invoice.subscription) {
					const subscriptionId =
						typeof invoice.subscription === 'string'
							? invoice.subscription
							: invoice.subscription.id

					const existingSubscription = await db.query.subscriptions?.findFirst({
						where: (subs, { eq }) => eq(subs.stripeSubscriptionId, subscriptionId),
					})

					await db
						.update(subscriptions)
						.set({
							status: 'past_due',
							updatedAt: new Date(),
						})
						.where(eq(subscriptions.stripeSubscriptionId, subscriptionId))

					// Audit log: Track payment failure
					if (existingSubscription) {
						await logSubscriptionChange(existingSubscription.userId, 'update', subscriptionId, {
							status: 'past_due',
							source: 'invoice.payment_failed',
						})
					}
				}
				break
			}

			case 'customer.subscription.trial_will_end': {
				// Send trial ending soon email (Stripe sends this 3 days before trial ends)
				const subscription = event.data.object as Stripe.Subscription
				const userId = subscription.metadata?.userId

				if (userId && subscription.trial_end) {
					const userInfo = await getUserInfoForEmail(userId)
					if (userInfo) {
						// Calculate days left from now to trial end
						const trialEndDate = new Date(subscription.trial_end * 1000)
						const now = new Date()
						const daysLeft = Math.ceil(
							(trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
						)

						const emailLib = await getEmailLib()
						await emailLib
							.sendTrialEndingSoonEmail({
								...userInfo,
								daysLeft: Math.max(1, daysLeft), // At least 1 day
							})
							.catch((err) => {
								console.error('[Webhook] Failed to send trial ending soon email:', err)
							})
					}
				} else {
					console.log(
						`[Webhook] Trial ending soon for subscription ${subscription.id} - missing userId or trial_end`,
					)
				}
				break
			}

			case 'charge.refunded': {
				// Record refund transaction to ledger
				const charge = event.data.object as Stripe.Charge
				const customerId =
					typeof charge.customer === 'string' ? charge.customer : charge.customer?.id

				if (customerId) {
					// Find user by stripe customer ID
					const existingSubscription = await db.query.subscriptions?.findFirst({
						where: (subs, { eq }) => eq(subs.stripeCustomerId, customerId),
					})

					if (existingSubscription && charge.amount_refunded) {
						await recordTransaction({
							userId: existingSubscription.userId,
							stripeCustomerId: customerId,
							stripeChargeId: charge.id,
							stripePaymentIntentId:
								typeof charge.payment_intent === 'string' ? charge.payment_intent : null,
							amountCents: charge.amount_refunded,
							currency: charge.currency,
							type: 'refund',
							status: 'succeeded',
							description: `Refund for charge ${charge.id}`,
							metadata: {
								originalAmount: charge.amount,
								refundedAmount: charge.amount_refunded,
								refundReason: charge.refunds?.data?.[0]?.reason,
							},
							stripeCreatedAt: new Date(event.created * 1000),
						})
					}
				}
				break
			}

			case 'charge.dispute.created': {
				// Record dispute to ledger and alert
				const dispute = event.data.object as Stripe.Dispute
				const charge = dispute.charge
				const chargeId = typeof charge === 'string' ? charge : charge?.id

				// Fetch the charge to get customer info
				if (chargeId) {
					const fullCharge = await stripe.charges.retrieve(chargeId)
					const customerId =
						typeof fullCharge.customer === 'string' ? fullCharge.customer : fullCharge.customer?.id

					if (customerId) {
						const existingSubscription = await db.query.subscriptions?.findFirst({
							where: (subs, { eq }) => eq(subs.stripeCustomerId, customerId),
						})

						if (existingSubscription) {
							await recordTransaction({
								userId: existingSubscription.userId,
								stripeCustomerId: customerId,
								stripeChargeId: chargeId,
								amountCents: dispute.amount,
								currency: dispute.currency,
								type: 'dispute',
								status: 'disputed',
								description: `Dispute: ${dispute.reason}`,
								metadata: {
									disputeId: dispute.id,
									reason: dispute.reason,
									status: dispute.status,
								},
								stripeCreatedAt: new Date(event.created * 1000),
							})

							// Alert on disputes - this is critical for fraud detection
							Sentry.captureMessage('Stripe dispute created', {
								level: 'error',
								tags: { webhook: 'stripe', dispute: 'created' },
								extra: {
									disputeId: dispute.id,
									userId: existingSubscription.userId,
									amount: dispute.amount,
									reason: dispute.reason,
								},
							})
						}
					}
				}
				break
			}

			case 'charge.dispute.closed': {
				// Handle dispute resolution - record reversal if won, or final status if lost
				const dispute = event.data.object as Stripe.Dispute
				const charge = dispute.charge
				const chargeId = typeof charge === 'string' ? charge : charge?.id

				if (chargeId) {
					const fullCharge = await stripe.charges.retrieve(chargeId)
					const customerId =
						typeof fullCharge.customer === 'string' ? fullCharge.customer : fullCharge.customer?.id

					if (customerId) {
						const existingSubscription = await db.query.subscriptions?.findFirst({
							where: (subs, { eq }) => eq(subs.stripeCustomerId, customerId),
						})

						if (existingSubscription) {
							// Dispute status: won = merchant won (funds returned), lost = customer won (funds kept by customer)
							// Other statuses: warning_closed, charge_refunded, warning_under_review
							const merchantWon = dispute.status === 'won'
							const customerWon = dispute.status === 'lost'

							if (merchantWon) {
								// Funds returned to merchant - record reversal
								await recordTransaction({
									userId: existingSubscription.userId,
									stripeCustomerId: customerId,
									stripeChargeId: chargeId,
									amountCents: dispute.amount,
									currency: dispute.currency,
									type: 'dispute_reversal',
									status: 'succeeded',
									description: `Dispute won: ${dispute.reason}`,
									metadata: {
										disputeId: dispute.id,
										reason: dispute.reason,
										status: dispute.status,
										outcome: 'merchant_won',
									},
									stripeCreatedAt: new Date(event.created * 1000),
								})

								console.log(`[Webhook] Dispute ${dispute.id} won - funds returned`)
							} else if (customerWon) {
								// Customer won - funds kept by customer, this is a loss
								await recordTransaction({
									userId: existingSubscription.userId,
									stripeCustomerId: customerId,
									stripeChargeId: chargeId,
									amountCents: dispute.amount,
									currency: dispute.currency,
									type: 'dispute',
									status: 'failed',
									description: `Dispute lost: ${dispute.reason}`,
									metadata: {
										disputeId: dispute.id,
										reason: dispute.reason,
										status: dispute.status,
										outcome: 'customer_won',
									},
									stripeCreatedAt: new Date(event.created * 1000),
								})

								// Alert on lost disputes
								Sentry.captureMessage('Stripe dispute lost', {
									level: 'warning',
									tags: { webhook: 'stripe', dispute: 'lost' },
									extra: {
										disputeId: dispute.id,
										userId: existingSubscription.userId,
										amount: dispute.amount,
										reason: dispute.reason,
									},
								})

								console.log(`[Webhook] Dispute ${dispute.id} lost - funds lost to customer`)
							} else {
								// Other close reasons (warning_closed, charge_refunded, etc.)
								console.log(`[Webhook] Dispute ${dispute.id} closed with status: ${dispute.status}`)
							}
						}
					}
				}
				break
			}

			case 'customer.deleted': {
				// Handle customer deletion in Stripe
				// This can happen via Stripe dashboard, API, or automatic cleanup
				const customer = event.data.object as Stripe.Customer

				// Find subscription linked to this customer
				const existingSubscription = await db.query.subscriptions?.findFirst({
					where: (subs, { eq }) => eq(subs.stripeCustomerId, customer.id),
				})

				if (existingSubscription) {
					// Clear the Stripe customer ID but keep the subscription record
					// User will get a new Stripe customer on next checkout
					await db
						.update(subscriptions)
						.set({
							stripeCustomerId: null,
							stripeSubscriptionId: null,
							plan: PLAN_SLUGS.FREE,
							status: 'cancelled',
							updatedAt: new Date(),
						})
						.where(eq(subscriptions.userId, existingSubscription.userId))

					// Alert for investigation - customer deletions should be rare
					Sentry.captureMessage('Stripe customer deleted', {
						level: 'warning',
						tags: { webhook: 'stripe', event: 'customer_deleted' },
						extra: {
							customerId: customer.id,
							userId: existingSubscription.userId,
							previousPlan: existingSubscription.plan,
						},
					})

					// Audit log
					await logSubscriptionChange(existingSubscription.userId, 'delete', customer.id, {
						plan: PLAN_SLUGS.FREE,
						status: 'cancelled',
						source: 'customer.deleted',
						reason: 'Stripe customer was deleted',
					})

					console.log(
						`[Webhook] Customer ${customer.id} deleted - cleared subscription for user ${existingSubscription.userId}`,
					)
				}
				break
			}

			default:
				// Log unhandled events for monitoring
				console.log(`[Webhook] Unhandled event type: ${event.type}`)
		}

		return NextResponse.json({ received: true })
	} catch (err) {
		console.error('Webhook handler error:', err)
		// Per spec: Alert on webhook failures for observability
		Sentry.captureException(err, {
			level: 'error',
			tags: {
				webhook: 'stripe',
				event_type: event?.type ?? 'unknown',
			},
			extra: {
				event_id: event?.id,
				subscription_id: subscriptionId,
			},
		})
		return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
	}
}
