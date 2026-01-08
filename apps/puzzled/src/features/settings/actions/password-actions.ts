'use server'

import { Ratelimit } from '@upstash/ratelimit'
import { headers } from 'next/headers'
import { validatePassword } from '@/features/auth'
import {
	CREDENTIAL_PROVIDER_ID,
	canSetPassword,
	getAuthState,
	getServerSession,
} from '@/features/auth/server'
import { logUserAction } from '@/lib/audit'
import { db } from '@/lib/db'
import { accounts } from '@/lib/db/schema'
import { redis } from '@/lib/redis'
import { captureError } from '@/lib/sentry'
import { getClientIpAddress } from '@/lib/user-agent'
import { isIdentityVerified } from '@/server/lib/challenge'
import { createSecurityAlert } from '../lib/security-alerts'

// Rate limiter specifically for password operations
// More restrictive: 3 attempts per 15 minutes
const passwordRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(3, '15 m'),
	prefix: 'puzzled:password-set',
})

export type SetPasswordResult = {
	success: boolean
	error?: string
}

/**
 * Set a password for an OAuth-only user.
 *
 * Security considerations:
 * 1. User must be authenticated (session proves identity)
 * 2. Session must be re-authenticated (verified within 15 minutes)
 * 3. Permission check via auth-state.ts SSOT (canSetPassword)
 * 4. Password must meet strength requirements
 * 5. Rate limited to prevent abuse
 * 6. Action is logged for security audit
 */
export async function setPasswordForOAuthUser(newPassword: string): Promise<SetPasswordResult> {
	try {
		// 1. Verify user is authenticated
		const session = await getServerSession()
		if (!session?.user) {
			return { success: false, error: 'unauthorized' }
		}
		const user = session.user

		// 2. Require identity verification for this sensitive operation
		const verified = await isIdentityVerified(session.session.token)
		if (!verified) {
			return { success: false, error: 'verificationRequired' }
		}

		// 3. Rate limit by user ID
		const { success: rateLimitPassed } = await passwordRatelimit.limit(user.id)
		if (!rateLimitPassed) {
			return { success: false, error: 'rateLimited' }
		}

		// 4. Check permission via SSOT
		const authState = await getAuthState(user.id)
		if (!canSetPassword(authState)) {
			// Determine specific error
			if (authState.hasCredential) {
				return { success: false, error: 'alreadyHasPassword' }
			}
			if (authState.oauthProviders.length === 0) {
				return { success: false, error: 'noOAuthAccount' }
			}
			return { success: false, error: 'unauthorized' }
		}

		// 5. Validate password strength
		const validation = validatePassword(newPassword)
		if (!validation.isValid) {
			return { success: false, error: 'invalidPassword' }
		}

		// 6. Hash password using better-auth's method
		const { hashPassword } = await import('better-auth/crypto')
		const hashedPassword = await hashPassword(newPassword)

		// 7. Create credential account entry
		await db.insert(accounts).values({
			userId: user.id,
			providerId: CREDENTIAL_PROVIDER_ID,
			accountId: user.email,
			password: hashedPassword,
		})

		// 8. Log the security event
		const headersList = await headers()
		const ipAddress = getClientIpAddress(headersList) ?? 'unknown'

		await logUserAction(user.id, 'update', 'account', user.id, {
			action: 'password_set',
			method: 'oauth_session',
			ipAddress,
		})

		// 9. Create security alert for password change (sends email notification)
		await createSecurityAlert(user.id, 'password_changed', {
			ipAddress,
		})

		return { success: true }
	} catch (error) {
		captureError(error instanceof Error ? error : new Error(String(error)), {
			tags: { operation: 'set-password-oauth-user' },
		})
		return { success: false, error: 'serverError' }
	}
}
