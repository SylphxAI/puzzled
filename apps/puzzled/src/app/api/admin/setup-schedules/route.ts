import { Client } from '@upstash/qstash'
import { type NextRequest, NextResponse } from 'next/server'
import { adminCheckResponse, checkAdminWithMfa } from '@/features/admin'

export const runtime = 'nodejs'

/**
 * QStash Schedule Admin (Diagnostic/Cleanup Only)
 *
 * ARCHITECTURE: Vercel Cron → Upstash Workflow
 * - Schedules are defined in vercel.json (auto-activated on deploy)
 * - Vercel Cron triggers lightweight /api/cron/* endpoints
 * - Cron endpoints fire Upstash Workflows (fire-and-forget)
 * - Upstash Workflows handle: no timeout, retry, DLQ
 *
 * This endpoint is for DIAGNOSTICS ONLY:
 * - GET: List any existing QStash schedules (should be empty after migration)
 * - DELETE: Clean up old QStash schedules from before migration
 *
 * DO NOT use QStash schedules in production - use vercel.json crons instead.
 */
const qstash = new Client({ token: process.env.QSTASH_TOKEN! })

// List existing QStash schedules (diagnostic)
export async function GET(request: NextRequest) {
	// Require admin authentication with MFA
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	try {
		const schedules = await qstash.schedules.list()
		return NextResponse.json({ schedules })
	} catch (error) {
		console.error('Failed to list schedules:', error)
		return NextResponse.json(
			{ error: 'Failed to list schedules', details: String(error) },
			{ status: 500 },
		)
	}
}

// Delete all schedules
export async function DELETE(request: NextRequest) {
	// Require admin authentication with MFA
	const authResult = await checkAdminWithMfa(request)
	const errorResponse = adminCheckResponse(authResult)
	if (errorResponse) return errorResponse

	try {
		// Delete specific schedules - track which ones fail
		const results: Record<string, { deleted: boolean; error?: string }> = {}

		await qstash.schedules.delete('generate-daily-puzzles').then(
			() => {
				results['generate-daily-puzzles'] = { deleted: true }
			},
			(err) => {
				const isNotFound = String(err).includes('404') || String(err).includes('not found')
				results['generate-daily-puzzles'] = {
					deleted: false,
					error: isNotFound ? 'not found' : String(err),
				}
				if (!isNotFound) {
					console.warn('Failed to delete generate-daily-puzzles:', err)
				}
			},
		)

		await qstash.schedules.delete('daily-puzzle-reminder').then(
			() => {
				results['daily-puzzle-reminder'] = { deleted: true }
			},
			(err) => {
				// 404 is expected if schedule doesn't exist, only log actual errors
				const isNotFound = String(err).includes('404') || String(err).includes('not found')
				results['daily-puzzle-reminder'] = {
					deleted: false,
					error: isNotFound ? 'not found' : String(err),
				}
				if (!isNotFound) {
					console.warn('Failed to delete daily-puzzle-reminder:', err)
				}
			},
		)

		await qstash.schedules.delete('streak-at-risk-reminder').then(
			() => {
				results['streak-at-risk-reminder'] = { deleted: true }
			},
			(err) => {
				const isNotFound = String(err).includes('404') || String(err).includes('not found')
				results['streak-at-risk-reminder'] = {
					deleted: false,
					error: isNotFound ? 'not found' : String(err),
				}
				if (!isNotFound) {
					console.warn('Failed to delete streak-at-risk-reminder:', err)
				}
			},
		)

		return NextResponse.json({
			success: true,
			message: 'Schedules deleted',
			details: results,
		})
	} catch (error) {
		console.error('Failed to delete schedules:', error)
		return NextResponse.json(
			{ error: 'Failed to delete schedules', details: String(error) },
			{ status: 500 },
		)
	}
}
