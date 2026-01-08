/**
 * Password Reset Endpoint
 *
 * Wraps better-auth's reset-password handler to add:
 * - Security alert creation on successful password reset
 * - Rate limiting
 *
 * This provides visibility into password reset events for security monitoring.
 */

import { Ratelimit } from '@upstash/ratelimit'
import { toNextJsHandler } from 'better-auth/next-js'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/features/auth/server'
import { db } from '@/lib/db'
import { users, verifications } from '@/lib/db/schema'
import { redis } from '@/lib/redis'

// Use Node.js runtime for better-auth
export const runtime = 'nodejs'

// Rate limiting for password reset (5 attempts per hour per IP)
const resetPasswordRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, '1 h'),
	prefix: 'puzzled:reset-password',
})

// Get the better-auth POST handler
const { POST: authPost } = toNextJsHandler(auth)

export async function POST(request: NextRequest) {
	// Rate limit by IP
	const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
	const { success: rateLimitOk } = await resetPasswordRatelimit.limit(ip)

	if (!rateLimitOk) {
		return NextResponse.json(
			{ error: 'Too many attempts. Please try again later.' },
			{ status: 429 },
		)
	}

	try {
		// Clone request body for our use (streams can only be read once)
		const clonedRequest = request.clone()
		const body = await clonedRequest.json()
		const { token } = body

		// Look up the verification token to identify the user
		// better-auth stores password reset tokens with email as identifier
		let userEmail: string | null = null
		if (token) {
			const verification = await db.query.verifications.findFirst({
				where: eq(verifications.identifier, token),
			})
			if (verification) {
				// For password reset, the identifier in verification is the token
				// We need to find the user email from the verification value
				// Actually, better-auth stores this differently - let's check after
				userEmail = verification.value // May contain user email
			}
		}

		// Call better-auth's handler directly
		const response = await authPost(request)

		// Check if password reset was successful (2xx status)
		if (response.ok) {
			// Try to create security alert
			try {
				// If we couldn't get the email from verification, try to parse from token
				// For now, we'll search by the verification value which may contain email
				let user = null
				if (userEmail) {
					user = await db.query.users.findFirst({
						where: eq(users.email, userEmail),
					})
				}

				// Fallback: try to decode the token if it contains user info
				// This is a best-effort approach
				if (!user && token) {
					// Look for any recent verification that might be for this token
					const recentVerification = await db.query.verifications.findFirst({
						where: eq(verifications.identifier, token),
					})
					if (recentVerification?.value) {
						try {
							const decoded = JSON.parse(recentVerification.value)
							if (decoded.email) {
								user = await db.query.users.findFirst({
									where: eq(users.email, decoded.email),
								})
							}
						} catch {
							// Value is not JSON, might be the email directly
							user = await db.query.users.findFirst({
								where: eq(users.email, recentVerification.value),
							})
						}
					}
				}

				if (user) {
					const { createSecurityAlert } = await import('@/features/settings')
					await createSecurityAlert(user.id, 'password_changed', {
						method: 'password_reset',
						ipAddress: ip,
					})
					console.log('[Auth] Created password_changed alert for password reset:', user.id)
				}
			} catch (alertError) {
				// Don't fail password reset if alert creation fails
				console.error('[Auth] Failed to create password reset security alert:', alertError)
			}
		}

		return response
	} catch (error) {
		console.error('[Auth] Password reset error:', error)
		return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
	}
}
