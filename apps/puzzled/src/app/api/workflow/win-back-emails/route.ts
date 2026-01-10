// Node.js runtime required for Resend emails
export const runtime = 'nodejs'

import { serve } from '@upstash/workflow/nextjs'
import {
	getNewFeaturesSince,
	getUsersForWinBackEmail,
} from '@/features/notifications/lib/churn-detection'
import {
	sendWinBackDay7Email,
	sendWinBackDay14Email,
	sendWinBackDay30Email,
} from '@/features/notifications/server'
// Note: Promo codes now handled by platform billing
import { db } from '@/lib/db'
import { winBackEmails } from '@/lib/db/schema'
import { handleWorkflowFailure } from '@/lib/dlq'
import { sleep } from '@/lib/utils'

/**
 * Generate a placeholder promo code for win-back emails
 * TODO: Replace with platform billing SDK when available
 */
function generateWinBackPromoCode(userId: string): string {
	// Generate a simple code based on user ID
	const shortId = userId.slice(0, 8).toUpperCase()
	return `WINBACK-${shortId}`
}

// Rate limiting: 500ms delay between emails to avoid hitting Resend limits
const EMAIL_DELAY_MS = 500

type WinBackEmailPayload = Record<string, never> // Empty payload

export const { POST } = serve<WinBackEmailPayload>(
	async (context) => {
		console.log('[WinBack] Starting win-back email workflow')

		// Step 1: Send Day 7 emails
		const day7Users = await context.run('get-day7-users', async () => {
			return getUsersForWinBackEmail(7)
		})

		console.log(`[WinBack] Found ${day7Users.length} users for day 7 emails`)

		const day7Sent = await context.run('send-day7-emails', async () => {
			let sent = 0
			let failed = 0
			let skipped = 0
			for (const user of day7Users) {
				try {
					// Skip users without email (can't send win-back emails)
					if (!user.email) {
						skipped++
						continue
					}

					// Check if we've already sent this email type
					const existing = await db.query.winBackEmails.findFirst({
						where: (winBackEmails, { and, eq }) =>
							and(eq(winBackEmails.userId, user.id), eq(winBackEmails.emailType, 'day7')),
					})

					if (existing) {
						console.log(`[WinBack] Already sent day7 email to user ${user.id}`)
						continue
					}

					// Send email
					await sendWinBackDay7Email({
						email: user.email,
						name: user.displayName,
						userId: user.id,
					})

					// Track in database
					await db.insert(winBackEmails).values({
						userId: user.id,
						emailType: 'day7',
					})

					sent++

					// Rate limiting: delay between emails
					if (sent < day7Users.length) {
						await sleep(EMAIL_DELAY_MS)
					}
				} catch (error) {
					failed++
					console.error(`[WinBack] Failed to send day7 email to ${user.email}:`, error)
				}
			}
			if (failed > 0 || skipped > 0) {
				console.warn(`[WinBack] Day 7 emails: ${sent} sent, ${failed} failed, ${skipped} skipped (no email)`)
			}
			return sent
		})

		// Step 2: Send Day 14 emails
		const day14Users = await context.run('get-day14-users', async () => {
			return getUsersForWinBackEmail(14)
		})

		console.log(`[WinBack] Found ${day14Users.length} users for day 14 emails`)

		// Get new features since 14 days ago for email content
		const newFeatures = await context.run('get-new-features', async () => {
			const fourteenDaysAgo = new Date()
			fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
			return getNewFeaturesSince(fourteenDaysAgo)
		})

		const day14Sent = await context.run('send-day14-emails', async () => {
			let sent = 0
			let failed = 0
			let skipped = 0
			for (const user of day14Users) {
				try {
					// Skip users without email (can't send win-back emails)
					if (!user.email) {
						skipped++
						continue
					}

					// Check if we've already sent this email type
					const existing = await db.query.winBackEmails.findFirst({
						where: (winBackEmails, { and, eq }) =>
							and(eq(winBackEmails.userId, user.id), eq(winBackEmails.emailType, 'day14')),
					})

					if (existing) {
						console.log(`[WinBack] Already sent day14 email to user ${user.id}`)
						continue
					}

					// Send email
					await sendWinBackDay14Email({
						email: user.email,
						name: user.displayName,
						userId: user.id,
						newFeatures,
					})

					// Track in database
					await db.insert(winBackEmails).values({
						userId: user.id,
						emailType: 'day14',
					})

					sent++

					// Rate limiting: delay between emails
					if (sent < day14Users.length) {
						await sleep(EMAIL_DELAY_MS)
					}
				} catch (error) {
					failed++
					console.error(`[WinBack] Failed to send day14 email to ${user.email}:`, error)
				}
			}
			if (failed > 0 || skipped > 0) {
				console.warn(`[WinBack] Day 14 emails: ${sent} sent, ${failed} failed, ${skipped} skipped (no email)`)
			}
			return sent
		})

		// Step 3: Send Day 30 emails with discount code
		const day30Users = await context.run('get-day30-users', async () => {
			return getUsersForWinBackEmail(30)
		})

		console.log(`[WinBack] Found ${day30Users.length} users for day 30 emails`)

		const day30Sent = await context.run('send-day30-emails', async () => {
			let sent = 0
			let failed = 0
			let skipped = 0
			for (const user of day30Users) {
				try {
					// Skip users without email (can't send win-back emails)
					if (!user.email) {
						skipped++
						continue
					}

					// Check if we've already sent this email type
					const existing = await db.query.winBackEmails.findFirst({
						where: (winBackEmails, { and, eq }) =>
							and(eq(winBackEmails.userId, user.id), eq(winBackEmails.emailType, 'day30')),
					})

					if (existing) {
						console.log(`[WinBack] Already sent day30 email to user ${user.id}`)
						continue
					}

					// Create promo code for this user
					// Note: This is a placeholder - real promo validation happens in platform billing
					const promotionCode = generateWinBackPromoCode(user.id)

					// Send email
					await sendWinBackDay30Email({
						email: user.email,
						name: user.displayName,
						userId: user.id,
						discountCode: promotionCode,
					})

					// Track in database
					await db.insert(winBackEmails).values({
						userId: user.id,
						emailType: 'day30',
						promotionCode,
					})

					sent++

					// Rate limiting: delay between emails
					if (sent < day30Users.length) {
						await sleep(EMAIL_DELAY_MS)
					}
				} catch (error) {
					failed++
					console.error(`[WinBack] Failed to send day30 email to ${user.email}:`, error)
				}
			}
			if (failed > 0 || skipped > 0) {
				console.warn(`[WinBack] Day 30 emails: ${sent} sent, ${failed} failed, ${skipped} skipped (no email)`)
			}
			return sent
		})

		// Step 4: Log results
		const summary = await context.run('log-results', () => {
			const result = {
				day7: { total: day7Users.length, sent: day7Sent },
				day14: { total: day14Users.length, sent: day14Sent },
				day30: { total: day30Users.length, sent: day30Sent },
				totalSent: day7Sent + day14Sent + day30Sent,
			}

			console.log('[WinBack] Workflow completed:', result)
			return result
		})

		return summary
	},
	{
		// Exponential backoff retry with 3 attempts
		retries: 3,

		failureFunction: async ({ context, failResponse }) => {
			console.error('Win-back email workflow failed:', {
				payload: context.requestPayload,
				error: failResponse,
			})

			// Add to Dead Letter Queue for later retry/analysis
			await handleWorkflowFailure(
				'win-back-emails',
				context.requestPayload,
				failResponse,
				context.workflowRunId,
			)
		},
	},
)
