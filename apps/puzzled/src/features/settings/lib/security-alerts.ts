/**
 * Security Alerts Service
 *
 * Functions for creating and managing security alerts for important account events.
 * Alerts are triggered on security-relevant actions like logins, password changes, etc.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
	type NewSecurityAlert,
	type SecurityAlert,
	type SecurityAlertType,
	securityAlerts,
	users,
} from '@/lib/db/schema'
import { captureError } from '@/lib/sentry'
import { sendSecurityAlertEmail } from './security-alert-emails'

/**
 * Metadata structure for security alerts
 */
export interface SecurityAlertMetadata {
	// Device/browser info
	device?: string
	browser?: string
	userAgent?: string
	// Location info
	ipAddress?: string
	city?: string
	country?: string
	// Provider info (for OAuth)
	provider?: string
	// Session info
	sessionId?: string
	// Additional context
	[key: string]: unknown
}

/**
 * Alert type configuration with titles and descriptions
 */
const ALERT_CONFIG: Record<
	SecurityAlertType,
	{
		title: string
		description: (metadata?: SecurityAlertMetadata) => string
		critical: boolean // Whether to send email notification
	}
> = {
	new_login: {
		title: 'New Sign In',
		description: (m) =>
			m?.city && m?.country
				? `New sign in from ${m.city}, ${m.country}`
				: 'Your account was signed in from a new location',
		critical: false,
	},
	password_changed: {
		title: 'Password Changed',
		description: () => 'Your account password was changed',
		critical: true,
	},
	email_changed: {
		title: 'Email Address Changed',
		description: (m) =>
			m?.oldEmail && m?.newEmail
				? `Email changed from ${m.oldEmail} to ${m.newEmail}`
				: 'Your account email address was changed',
		critical: true,
	},
	'2fa_enabled': {
		title: 'Two-Factor Authentication Enabled',
		description: () => 'Two-factor authentication was enabled on your account',
		critical: false,
	},
	'2fa_disabled': {
		title: 'Two-Factor Authentication Disabled',
		description: () => 'Two-factor authentication was disabled on your account',
		critical: true,
	},
	new_device: {
		title: 'New Device Detected',
		description: (m) =>
			m?.device
				? `Sign in from a new device: ${m.device}`
				: 'Your account was accessed from a new device',
		// Not critical by default - reduces email fatigue for legitimate device changes
		// Use suspicious_login for truly concerning logins (impossible travel, etc.)
		critical: false,
	},
	suspicious_login: {
		title: 'Suspicious Login Attempt',
		description: (m) =>
			m?.city && m?.country
				? `Suspicious login attempt from ${m.city}, ${m.country}`
				: 'A suspicious login attempt was detected',
		critical: true,
	},
	oauth_connected: {
		title: 'Account Connected',
		description: (m) =>
			m?.provider ? `${m.provider} account was connected` : 'A new OAuth account was connected',
		// Critical: OAuth connections are authentication method changes
		// Users must be notified when auth methods are added to their account
		critical: true,
	},
	oauth_disconnected: {
		title: 'Account Disconnected',
		description: (m) =>
			m?.provider ? `${m.provider} account was disconnected` : 'An OAuth account was disconnected',
		// Critical: OAuth disconnections are authentication method changes
		// Users must be notified when auth methods are removed from their account
		critical: true,
	},
	session_revoked: {
		title: 'Session Revoked',
		description: (m) =>
			m?.device ? `Session on ${m.device} was revoked` : 'A session was signed out remotely',
		critical: false,
	},
	all_sessions_revoked: {
		title: 'Signed Out All Devices',
		description: (m) =>
			m?.revokedCount
				? `Signed out from ${m.revokedCount} other ${m.revokedCount === 1 ? 'device' : 'devices'}`
				: 'All other sessions were signed out',
		critical: false,
	},
}

/**
 * Create a security alert for a user
 *
 * @param userId - The user ID to create the alert for
 * @param type - The type of security alert
 * @param metadata - Optional metadata about the event (device, location, etc.)
 * @returns The created security alert
 */
export async function createSecurityAlert(
	userId: string,
	type: SecurityAlertType,
	metadata?: SecurityAlertMetadata,
): Promise<SecurityAlert> {
	const config = ALERT_CONFIG[type]

	const alertData: NewSecurityAlert = {
		userId,
		type,
		title: config.title,
		description: config.description(metadata),
		metadata: metadata as Record<string, unknown>,
		read: false,
	}

	const [alert] = await db.insert(securityAlerts).values(alertData).returning()

	// Send email notification for critical alerts
	if (config.critical) {
		// Get user email and locale for notification
		const [user] = await db
			.select({ email: users.email, name: users.name, locale: users.locale })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)

		if (user?.email) {
			// Fire and forget - don't block on email sending
			sendSecurityAlertEmail({
				email: user.email,
				name: user.name,
				alertType: type,
				title: config.title,
				description: config.description(metadata),
				metadata,
				locale: user.locale,
			}).catch((error) => {
				captureError(error instanceof Error ? error : new Error(String(error)), {
					tags: { operation: 'security-alert', step: 'send-email-notification' },
					extra: { alertType: type },
					level: 'warning',
				})
			})
		}
	}

	return alert
}

// Note: Alert queries (getAlertHistory, markAlertAsRead, etc.) are handled
// directly in the security router for optimal query composition.
