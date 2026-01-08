/**
 * Security Alert Email Notifications
 *
 * Send email notifications for critical security events like
 * new device logins, password changes, and 2FA changes.
 */

import { FROM_EMAIL, getResend } from '@/features/notifications/server'
import { APP_NAME } from '@/lib/config/app'
import type { SecurityAlertType } from '@/lib/db/schema'
import { escapeHtml, getServerBaseUrl } from '@/lib/utils'
import type { SecurityAlertMetadata } from './security-alerts'

// App URL - single source of truth from utils
const APP_URL = getServerBaseUrl()

// Note: Critical alert determination is handled by ALERT_CONFIG.critical in security-alerts.ts
// This module only handles email formatting and sending

/**
 * High-risk alerts that show "Was this you?" warning
 * These are alerts where unauthorized access could be occurring
 */
const HIGH_RISK_ALERTS: readonly SecurityAlertType[] = [
	'suspicious_login', // Someone might have gained unauthorized access
	'2fa_disabled', // Attacker might be weakening account security
	'oauth_disconnected', // Attacker might be removing auth methods
] as const

/**
 * Check if alert type requires "Was this you?" warning
 */
function isHighRiskAlert(type: SecurityAlertType): boolean {
	return HIGH_RISK_ALERTS.includes(type)
}

/**
 * Email styling for each alert type
 *
 * Colors:
 * - Red (#ef4444): Security threats
 * - Amber (#f59e0b): Auth changes
 * - Green (#10b981): Security improvements
 * - Blue (#3b82f6): Informational
 */
function getAlertStyle(type: SecurityAlertType): { icon: string; color: string; bgColor: string } {
	switch (type) {
		// Security threats - Red
		case 'suspicious_login':
			return { icon: '🚨', color: '#ef4444', bgColor: '#fee2e2' }
		case '2fa_disabled':
			return { icon: '⚠️', color: '#ef4444', bgColor: '#fee2e2' }
		// Auth changes - Amber
		case 'password_changed':
			return { icon: '🔐', color: '#f59e0b', bgColor: '#fef3c7' }
		case 'email_changed':
			return { icon: '📧', color: '#f59e0b', bgColor: '#fef3c7' }
		case 'oauth_disconnected':
			return { icon: '🔓', color: '#f59e0b', bgColor: '#fef3c7' }
		// Security improvements - Green
		case '2fa_enabled':
			return { icon: '✅', color: '#10b981', bgColor: '#d1fae5' }
		case 'oauth_connected':
			return { icon: '🔗', color: '#10b981', bgColor: '#d1fae5' }
		// Informational - Blue
		case 'new_login':
			return { icon: '👋', color: '#3b82f6', bgColor: '#dbeafe' }
		case 'new_device':
			return { icon: '💻', color: '#3b82f6', bgColor: '#dbeafe' }
		case 'session_revoked':
			return { icon: '🚪', color: '#3b82f6', bgColor: '#dbeafe' }
		case 'all_sessions_revoked':
			return { icon: '🔒', color: '#3b82f6', bgColor: '#dbeafe' }
	}
}

/**
 * Format metadata for email display
 */
function formatMetadata(metadata?: SecurityAlertMetadata): string {
	if (!metadata) return ''

	const details: string[] = []

	if (metadata.device) {
		details.push(`<strong>Device:</strong> ${escapeHtml(metadata.device)}`)
	}
	if (metadata.browser) {
		details.push(`<strong>Browser:</strong> ${escapeHtml(metadata.browser)}`)
	}
	if (metadata.city && metadata.country) {
		details.push(
			`<strong>Location:</strong> ${escapeHtml(metadata.city)}, ${escapeHtml(metadata.country)}`,
		)
	} else if (metadata.country) {
		details.push(`<strong>Location:</strong> ${escapeHtml(metadata.country)}`)
	}
	if (metadata.ipAddress) {
		// Mask IP for privacy
		const parts = metadata.ipAddress.split('.')
		const masked = parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : metadata.ipAddress
		details.push(`<strong>IP Address:</strong> ${escapeHtml(masked)}`)
	}

	return details.length > 0 ? details.join('<br>') : ''
}

interface SendSecurityAlertEmailParams {
	email: string
	name: string | null
	alertType: SecurityAlertType
	title: string
	description: string
	metadata?: SecurityAlertMetadata
	locale?: string | null
}

/**
 * Send a security alert email notification
 */
export async function sendSecurityAlertEmail({
	email,
	name,
	alertType,
	title,
	description,
	metadata,
	locale,
}: SendSecurityAlertEmailParams) {
	const resend = getResend()
	if (!resend) {
		console.warn('[Email] Skipping security alert email - Resend not configured')
		return null
	}

	const style = getAlertStyle(alertType)
	const displayName = escapeHtml(name || 'there')
	const formattedMetadata = formatMetadata(metadata)
	// Use user's locale preference or fall back to en-US
	const dateLocale = locale || 'en-US'
	const timestamp = new Date().toLocaleString(dateLocale, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short',
	})

	return resend.emails.send({
		from: `${APP_NAME} Security <${FROM_EMAIL}>`,
		to: email,
		subject: `Security Alert: ${title}`,
		html: `
			<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
				<!-- Header -->
				<div style="background: ${style.bgColor}; border-left: 4px solid ${style.color}; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
					<div style="font-size: 24px; margin-bottom: 8px;">${style.icon}</div>
					<h1 style="color: ${style.color}; margin: 0; font-size: 20px;">${escapeHtml(title)}</h1>
				</div>

				<p>Hi ${displayName},</p>

				<p>${escapeHtml(description)}</p>

				<!-- Event Details -->
				<div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
					<p style="margin: 0 0 8px 0; font-weight: 600; color: #334155;">Event Details</p>
					<p style="margin: 0; color: #64748b; font-size: 14px;">
						<strong>Time:</strong> ${escapeHtml(timestamp)}
						${formattedMetadata ? `<br>${formattedMetadata}` : ''}
					</p>
				</div>

				<!-- Warning message for high-risk security alerts -->
				${
					isHighRiskAlert(alertType)
						? `
				<div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 20px 0;">
					<p style="margin: 0; color: #991b1b; font-weight: 600;">Was this you?</p>
					<p style="margin: 8px 0 0 0; color: #b91c1c; font-size: 14px;">
						If you didn't make this change, please secure your account immediately by changing your password and enabling two-factor authentication.
					</p>
				</div>
				`
						: ''
				}

				<!-- Action buttons -->
				<div style="margin: 24px 0;">
					<a href="${APP_URL}/settings/security" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">Review Security Settings</a>
				</div>

				<p style="color: #64748b; font-size: 14px;">
					If you didn't perform this action, please <a href="${APP_URL}/settings/security" style="color: #6366f1;">secure your account</a> immediately.
				</p>

				<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">

				<p style="color: #94a3b8; font-size: 12px; margin: 0;">
					This is an automated security notification from ${APP_NAME}. You're receiving this because important changes were made to your account.
				</p>
			</div>
		`,
	})
}
