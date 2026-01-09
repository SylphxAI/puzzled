import { Ratelimit } from '@upstash/ratelimit'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@sylphx/platform-sdk/nextjs'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { redis } from '@/lib/redis'
import { isAdminRole } from '@/lib/roles'

/**
 * Constant-time string comparison to prevent timing attacks
 * Edge-runtime compatible implementation without node:crypto
 * Returns true if strings are equal, false otherwise
 */
function secureCompare(a: string, b: string): boolean {
	if (typeof a !== 'string' || typeof b !== 'string') {
		return false
	}

	// Use TextEncoder for consistent byte representation (Edge compatible)
	const encoder = new TextEncoder()
	const aBytes = encoder.encode(a)
	const bBytes = encoder.encode(b)

	// Pad to same length to prevent length-based timing attacks
	const maxLen = Math.max(aBytes.length, bBytes.length)
	let result = aBytes.length === bBytes.length ? 0 : 1

	// Constant-time comparison: always iterate through all bytes
	for (let i = 0; i < maxLen; i++) {
		const aByte = i < aBytes.length ? aBytes[i] : 0
		const bByte = i < bBytes.length ? bBytes[i] : 0
		result |= aByte ^ bByte
	}

	return result === 0
}

// Strict rate limiting for admin secret attempts (3 attempts per hour per IP)
const adminSecretRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(3, '1 h'),
	analytics: true,
	prefix: 'puzzled:admin-secret',
})

/**
 * Log admin access attempts for security auditing
 */
async function logAdminAccess(
	method: 'secret' | 'session',
	success: boolean,
	ip: string,
	userId?: string,
) {
	const timestamp = new Date().toISOString()
	const logEntry = {
		timestamp,
		method,
		success,
		ip,
		userId: userId || 'anonymous',
	}

	// Log to console for immediate visibility
	console.warn('[ADMIN ACCESS]', JSON.stringify(logEntry))

	// Store in Redis for audit trail (keep for 30 days)
	const key = `admin-audit:${timestamp}:${method}:${ip}`
	await redis.setex(key, 30 * 24 * 60 * 60, JSON.stringify(logEntry))
}

/**
 * Check admin result type for detailed error handling
 */
export type AdminCheckResult =
	| { allowed: true; userId: string }
	| {
			allowed: false
			reason: 'unauthorized' | 'mfa_required' | 'mfa_not_verified' | 'rate_limited'
	  }

/**
 * Check if request is from an admin with MFA enforcement
 * Returns detailed result for appropriate error responses
 */
export async function checkAdminWithMfa(request: NextRequest): Promise<AdminCheckResult> {
	const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

	// Check header secret first (for programmatic access - no MFA needed)
	const adminSecret = request.headers.get('x-admin-secret')
	if (adminSecret) {
		// Apply strict rate limiting for admin secret attempts
		const { success: rateLimitOk } = await adminSecretRatelimit.limit(ip)
		if (!rateLimitOk) {
			await logAdminAccess('secret', false, ip)
			console.error('[SECURITY] Admin secret rate limit exceeded from IP:', ip)
			return { allowed: false, reason: 'rate_limited' }
		}

		// SECURITY: Require ADMIN_SECRET to be configured - never allow empty string comparison
		if (!process.env.ADMIN_SECRET) {
			console.error('[SECURITY] ADMIN_SECRET not configured - secret auth disabled')
			await logAdminAccess('secret', false, ip)
			return { allowed: false, reason: 'unauthorized' }
		}

		const isValidSecret = secureCompare(adminSecret, process.env.ADMIN_SECRET)
		await logAdminAccess('secret', isValidSecret, ip)

		if (!isValidSecret) {
			console.error('[SECURITY] Invalid admin secret attempt from IP:', ip)
			return { allowed: false, reason: 'unauthorized' }
		}

		return { allowed: true, userId: 'admin-secret' }
	}

	// Check session-based auth (MFA is now handled by the platform SDK)
	try {
		const { userId } = await auth()
		if (!userId) {
			return { allowed: false, reason: 'unauthorized' }
		}

		const user = await db.query.users.findFirst({
			where: eq(users.id, userId),
		})

		if (!user) {
			return { allowed: false, reason: 'unauthorized' }
		}

		// Check if user has admin role
		if (!isAdminRole(user.role)) {
			return { allowed: false, reason: 'unauthorized' }
		}

		// TODO: MFA enforcement is now handled by the platform SDK
		// The platform should handle MFA requirements for sensitive operations

		await logAdminAccess('session', true, ip, user.id)
		return { allowed: true, userId: user.id }
	} catch {
		return { allowed: false, reason: 'unauthorized' }
	}
}

/**
 * Return unauthorized response (internal use only)
 */
function unauthorized() {
	return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Return MFA required response
 * Per spec: Admin roles require MFA to be set up
 */
export function mfaRequired() {
	return NextResponse.json(
		{
			error: 'MFA Required',
			code: 'MFA_REQUIRED',
			message:
				'Two-factor authentication must be enabled for admin access. Please set up MFA in your account settings.',
		},
		{ status: 403 },
	)
}

/**
 * Return MFA not verified response
 * Per spec: Admin sessions require MFA verification
 */
export function mfaNotVerified() {
	return NextResponse.json(
		{
			error: 'MFA Not Verified',
			code: 'MFA_NOT_VERIFIED',
			message: 'Please verify your two-factor authentication to access admin features.',
		},
		{ status: 403 },
	)
}

/**
 * Return response based on admin check result
 */
export function adminCheckResponse(result: AdminCheckResult): NextResponse | null {
	if (result.allowed) return null

	switch (result.reason) {
		case 'mfa_required':
			return mfaRequired()
		case 'mfa_not_verified':
			return mfaNotVerified()
		case 'rate_limited':
			return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
		default:
			return unauthorized()
	}
}

/**
 * Return not found response
 */
export function notFound(message = 'Not found') {
	return NextResponse.json({ error: message }, { status: 404 })
}

/**
 * Return bad request response
 */
export function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 })
}

/**
 * UUID v4 validation regex
 * Matches format: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Validate that a string is a valid UUID v4
 * Used for route parameter validation to ensure type safety
 */
export function isValidUuid(value: string): boolean {
	return UUID_REGEX.test(value)
}

/**
 * Validate UUID and return error response if invalid
 * Use in route handlers for early validation of ID parameters
 *
 * @param value - The string to validate
 * @param paramName - Name of the parameter for error message
 * @returns null if valid, NextResponse if invalid
 */
export function validateUuidParam(value: string, paramName: string): NextResponse | null {
	if (!isValidUuid(value)) {
		return badRequest(`Invalid ${paramName}: must be a valid UUID`)
	}
	return null
}
