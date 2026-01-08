/**
 * Suspicious Login Detection
 *
 * Analyzes login patterns to detect potentially compromised accounts.
 * Uses device fingerprinting, IP analysis, and location data when available.
 *
 * Industry patterns followed:
 * - Google: New device + new location = suspicious
 * - GitHub: Impossible travel detection
 * - Discord: Failed attempt tracking + new device alerts
 */

import { desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { loginHistory } from '@/lib/db/schema'

/**
 * Thresholds for suspicious login detection
 */
const DETECTION_THRESHOLDS = {
	// Time window to check for impossible travel (1 hour)
	IMPOSSIBLE_TRAVEL_WINDOW_MS: 60 * 60 * 1000,

	// Minimum distance in km to consider travel impossible within window
	// ~500km in 1 hour = 500km/h, faster than commercial flight
	IMPOSSIBLE_TRAVEL_DISTANCE_KM: 500,

	// Number of failed attempts before success to flag as brute force
	FAILED_ATTEMPTS_THRESHOLD: 3,

	// Time window to check for failed attempts (15 minutes)
	FAILED_ATTEMPTS_WINDOW_MS: 15 * 60 * 1000,

	// Number of recent logins to analyze
	HISTORY_LIMIT: 20,
}

/**
 * Result of suspicious login analysis
 */
export interface SuspiciousLoginResult {
	isSuspicious: boolean
	reasons: SuspiciousReason[]
	riskScore: number // 0-100, higher = more suspicious
}

export type SuspiciousReason =
	| 'impossible_travel'
	| 'new_ip_new_device'
	| 'failed_attempts_before_success'
	| 'first_login_from_country'

/**
 * Login context for analysis
 */
interface LoginContext {
	userId: string
	ipAddress: string | null
	device: string | null
	userAgent: string | null
	country?: string | null
	city?: string | null
}

/**
 * Detect suspicious login patterns
 *
 * Analyzes the current login against user's login history to identify
 * potentially compromised account access.
 *
 * @param context - Current login details
 * @returns Analysis result with risk assessment
 */
export async function detectSuspiciousLogin(context: LoginContext): Promise<SuspiciousLoginResult> {
	const reasons: SuspiciousReason[] = []
	let riskScore = 0

	// Get recent login history for this user
	const recentLogins = await db
		.select({
			id: loginHistory.id,
			ipAddress: loginHistory.ipAddress,
			device: loginHistory.device,
			userAgent: loginHistory.userAgent,
			country: loginHistory.country,
			city: loginHistory.city,
			success: loginHistory.success,
			createdAt: loginHistory.createdAt,
		})
		.from(loginHistory)
		.where(eq(loginHistory.userId, context.userId))
		.orderBy(desc(loginHistory.createdAt))
		.limit(DETECTION_THRESHOLDS.HISTORY_LIMIT)

	// Skip detection for first-time users (no history to compare)
	if (recentLogins.length === 0) {
		return { isSuspicious: false, reasons: [], riskScore: 0 }
	}

	// =====================
	// Check 1: New IP + New Device Combination
	// High risk: Both IP and device are new to this account
	// =====================
	if (context.ipAddress && context.device) {
		const knownIPs = new Set(recentLogins.map((l) => l.ipAddress).filter(Boolean))
		const knownDevices = new Set(recentLogins.map((l) => l.device).filter(Boolean))

		const isNewIP = !knownIPs.has(context.ipAddress)
		const isNewDevice = !knownDevices.has(context.device)

		if (isNewIP && isNewDevice) {
			reasons.push('new_ip_new_device')
			riskScore += 40
		}
	}

	// =====================
	// Check 2: Failed Attempts Before Success
	// Medium risk: Multiple failed logins before this successful one
	// =====================
	const failedAttemptsWindow = new Date(Date.now() - DETECTION_THRESHOLDS.FAILED_ATTEMPTS_WINDOW_MS)
	const recentFailedAttempts = recentLogins.filter(
		(l) => !l.success && l.createdAt > failedAttemptsWindow,
	)

	if (recentFailedAttempts.length >= DETECTION_THRESHOLDS.FAILED_ATTEMPTS_THRESHOLD) {
		reasons.push('failed_attempts_before_success')
		riskScore += 30
	}

	// =====================
	// Check 3: Impossible Travel Detection
	// High risk: Login from distant location in very short time
	// Requires geolocation data to be populated
	// =====================
	if (context.country) {
		const lastSuccessfulLogin = recentLogins.find((l) => l.success && l.country)

		if (lastSuccessfulLogin?.country && lastSuccessfulLogin.country !== context.country) {
			const timeDiff = Date.now() - lastSuccessfulLogin.createdAt.getTime()

			if (timeDiff < DETECTION_THRESHOLDS.IMPOSSIBLE_TRAVEL_WINDOW_MS) {
				// Different country within 1 hour = impossible travel
				reasons.push('impossible_travel')
				riskScore += 50
			}
		}

		// Check if this is first login from this country
		const knownCountries = new Set(
			recentLogins
				.filter((l) => l.success)
				.map((l) => l.country)
				.filter(Boolean),
		)

		if (!knownCountries.has(context.country)) {
			reasons.push('first_login_from_country')
			riskScore += 20
		}
	}

	// Cap risk score at 100
	riskScore = Math.min(riskScore, 100)

	// Flag as suspicious if risk score exceeds threshold
	const isSuspicious = riskScore >= 50

	return { isSuspicious, reasons, riskScore }
}

/**
 * Check if login should trigger suspicious_login alert
 *
 * More conservative than full detection - only fires for high-confidence cases
 * to avoid alert fatigue.
 */
export async function shouldTriggerSuspiciousAlert(
	context: LoginContext,
): Promise<{ trigger: boolean; result: SuspiciousLoginResult }> {
	const result = await detectSuspiciousLogin(context)

	// Only trigger for high-confidence suspicious logins
	// Impossible travel OR (new IP + new device with failed attempts)
	const trigger =
		result.reasons.includes('impossible_travel') ||
		(result.reasons.includes('new_ip_new_device') &&
			result.reasons.includes('failed_attempts_before_success'))

	return { trigger, result }
}
