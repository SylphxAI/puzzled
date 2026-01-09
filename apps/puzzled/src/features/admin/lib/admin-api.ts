/**
 * Admin API Utilities
 *
 * Helper functions for admin API routes.
 *
 * ARCHITECTURE:
 * - User data (including role) comes from platform SDK
 * - No local users table - platform is source of truth
 */

import { Ratelimit } from '@upstash/ratelimit'
import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@sylphx/platform-sdk/nextjs'
import { redis } from '@/lib/redis'
import { isAdminRole } from '@/lib/roles'

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
	if (typeof a !== 'string' || typeof b !== 'string') {
		return false
	}

	const encoder = new TextEncoder()
	const aBytes = encoder.encode(a)
	const bBytes = encoder.encode(b)

	const maxLen = Math.max(aBytes.length, bBytes.length)
	let result = aBytes.length === bBytes.length ? 0 : 1

	for (let i = 0; i < maxLen; i++) {
		const aByte = i < aBytes.length ? aBytes[i] : 0
		const bByte = i < bBytes.length ? bBytes[i] : 0
		result |= aByte ^ bByte
	}

	return result === 0
}

// Strict rate limiting for admin secret attempts
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
	const logEntry = { timestamp, method, success, ip, userId: userId || 'anonymous' }
	console.warn('[ADMIN ACCESS]', JSON.stringify(logEntry))
	const key = `admin-audit:${timestamp}:${method}:${ip}`
	await redis.setex(key, 30 * 24 * 60 * 60, JSON.stringify(logEntry))
}

/** Admin check result */
export type AdminCheckResult =
	| { allowed: true; userId: string }
	| { allowed: false; reason: 'unauthorized' | 'rate_limited' }

/**
 * Check if request is from an admin
 */
export async function checkAdminWithMfa(request: NextRequest): Promise<AdminCheckResult> {
	const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

	// Check header secret first (for programmatic access)
	const adminSecret = request.headers.get('x-admin-secret')
	if (adminSecret) {
		const { success: rateLimitOk } = await adminSecretRatelimit.limit(ip)
		if (!rateLimitOk) {
			await logAdminAccess('secret', false, ip)
			return { allowed: false, reason: 'rate_limited' }
		}

		if (!process.env.ADMIN_SECRET) {
			await logAdminAccess('secret', false, ip)
			return { allowed: false, reason: 'unauthorized' }
		}

		const isValidSecret = secureCompare(adminSecret, process.env.ADMIN_SECRET)
		await logAdminAccess('secret', isValidSecret, ip)

		if (!isValidSecret) {
			return { allowed: false, reason: 'unauthorized' }
		}

		return { allowed: true, userId: 'admin-secret' }
	}

	// Check session-based auth
	try {
		const { userId, user } = await auth()
		if (!userId || !user) {
			return { allowed: false, reason: 'unauthorized' }
		}

		if (!isAdminRole(user.role)) {
			return { allowed: false, reason: 'unauthorized' }
		}

		await logAdminAccess('session', true, ip, userId)
		return { allowed: true, userId }
	} catch {
		return { allowed: false, reason: 'unauthorized' }
	}
}

/** Return unauthorized response */
function unauthorized() {
	return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/** Return response based on admin check result */
export function adminCheckResponse(result: AdminCheckResult): NextResponse | null {
	if (result.allowed) return null

	switch (result.reason) {
		case 'rate_limited':
			return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
		default:
			return unauthorized()
	}
}

/** Return not found response */
export function notFound(message = 'Not found') {
	return NextResponse.json({ error: message }, { status: 404 })
}

/** Return bad request response */
export function badRequest(message: string) {
	return NextResponse.json({ error: message }, { status: 400 })
}

/** UUID validation */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUuid(value: string): boolean {
	return UUID_REGEX.test(value)
}

export function validateUuidParam(value: string, paramName: string): NextResponse | null {
	if (!isValidUuid(value)) {
		return badRequest(`Invalid ${paramName}: must be a valid UUID`)
	}
	return null
}
