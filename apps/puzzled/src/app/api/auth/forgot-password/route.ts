import { Ratelimit } from '@upstash/ratelimit'
import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { getServerBaseUrl } from '@/lib/utils'

// Use Node.js runtime for better-auth
export const runtime = 'nodejs'

// Strict rate limiting for password reset (5 attempts per hour per IP)
const forgotPasswordRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, '1 h'),
	analytics: true,
	prefix: 'puzzled:forgot-password',
})

export async function POST(request: Request) {
	// Rate limit by IP to prevent abuse
	const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
	const { success: rateLimitOk } = await forgotPasswordRatelimit.limit(ip)

	if (!rateLimitOk) {
		// Still return success to prevent enumeration, but don't process
		// Add artificial delay to prevent timing attacks (match normal processing time)
		await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 50))
		console.warn('[Auth] Password reset rate limit exceeded for IP:', ip)
		return NextResponse.json({ success: true })
	}

	try {
		const { email } = await request.json()

		if (!email) {
			return NextResponse.json({ error: 'Email is required' }, { status: 400 })
		}

		// Use better-auth's built-in password reset endpoint
		const baseUrl = getServerBaseUrl()
		const redirectTo = `${baseUrl}/reset-password`

		// Call better-auth's request-password-reset endpoint
		const resetResponse = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				email,
				redirectTo,
			}),
		})

		if (!resetResponse.ok) {
			const errorData = await resetResponse.json().catch(() => ({}))
			console.error('[Auth] Password reset failed:', errorData)
			// Still return success to prevent email enumeration
		}

		// Always return success to prevent email enumeration
		return NextResponse.json({ success: true })
	} catch (error) {
		console.error('[Auth] Password reset error:', error)
		// Still return success to prevent email enumeration
		return NextResponse.json({ success: true })
	}
}
