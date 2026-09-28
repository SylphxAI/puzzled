/**
 * Admin API Utilities
 *
 * Helper functions for admin API routes.
 *
 * ARCHITECTURE:
 * - User data (including role) comes from platform SDK
 * - No local users table - platform is source of truth
 */

import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/identity/server'
import { logger } from '@/lib/logger'
import { isAdminRole } from '@/lib/roles'

/**
 * Log admin access attempts for security auditing
 */
async function logAdminAccess(method: 'session', success: boolean, ip: string, userId?: string) {
	const timestamp = new Date().toISOString()
	const logEntry = {
		timestamp,
		method,
		success,
		ip,
		userId: userId || 'anonymous',
	}
	logger.warn('admin.access-attempt', logEntry)
	// Record the attempt in audit_logs.
	const { logAdminAccessAttempt } = await import('@/lib/audit')
	await logAdminAccessAttempt({ method, success, ip, userId })
}

/** Admin check result */
export type AdminCheckResult =
	| { allowed: true; userId: string }
	| { allowed: false; reason: 'unauthorized' }

/**
 * Check if request is from an admin
 */
export async function checkAdminWithMfa(request: NextRequest): Promise<AdminCheckResult> {
	const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

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

	return unauthorized()
}
