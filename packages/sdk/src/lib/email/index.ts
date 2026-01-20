/**
 * Email Utilities SDK
 *
 * Email validation, provider detection, and template utilities.
 *
 * ## Features
 *
 * - **Email Validation** - RFC-compliant validation with provider-specific normalization
 * - **Provider Detection** - Identify Gmail, Outlook, disposable emails, etc.
 * - **Template Engine** - Build and render email templates with variables
 * - **Common Templates** - Pre-built templates for welcome, password reset, etc.
 *
 * @example
 * ```typescript
 * import {
 *   // Validation
 *   validateEmail,
 *   isValidEmail,
 *   normalizeEmail,
 *
 *   // Provider detection
 *   detectProvider,
 *   isFreeEmail,
 *   isDisposableEmail,
 *   isWorkEmail,
 *
 *   // Templates
 *   createEmailTemplate,
 *   renderEmail,
 *   COMMON_TEMPLATES,
 * } from '@sylphx/platform-sdk/email'
 *
 * // Validate and normalize
 * const result = validateEmail('John.Doe+tag@gmail.com')
 * console.log(result.normalized) // 'johndoe@gmail.com'
 *
 * // Check provider
 * if (isDisposableEmail(email)) {
 *   throw new Error('Disposable emails not allowed')
 * }
 *
 * // Render template
 * const rendered = renderEmail(COMMON_TEMPLATES.welcome, {
 *   appName: 'Sylphx',
 *   userName: 'John',
 *   ctaUrl: 'https://app.sylphx.com/start',
 * })
 * ```
 *
 * @module @sylphx/email
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
	// Validation types
	EmailValidationResult,
	ParsedEmail,
	EmailProvider,
	ValidationOptions,

	// Template types
	TemplateVariable,
	EmailTemplate,
	RenderedEmail,

	// Email sending types
	EmailRecipient,
	EmailAttachment,
	EmailOptions,

	// Unsubscribe types
	UnsubscribeHeader,
	UnsubscribeConfig,
} from './types'

// ============================================================================
// Validation
// ============================================================================

export {
	// Core validation
	validateEmail,
	isValidEmail,
	isValidEmailQuick,
	parseEmail,
	normalizeEmail,

	// Provider detection
	detectProvider,
	isFreeEmail,
	isDisposableEmail,
	isWorkEmail,

	// Provider lists
	FREE_EMAIL_PROVIDERS,
	DISPOSABLE_EMAIL_DOMAINS,
} from './validation'

// ============================================================================
// Templates
// ============================================================================

export {
	// Template creation and rendering
	createEmailTemplate,
	renderEmail,
	renderSubject,

	// Validation
	validateTemplate,
	extractVariables,

	// Common templates
	COMMON_TEMPLATES,
} from './templates'

// ============================================================================
// Utilities
// ============================================================================

/**
 * Generate a mailto: link
 *
 * @param options - Email options
 * @returns mailto: URL
 */
export function generateMailtoLink(options: {
	to: string | string[]
	subject?: string
	body?: string
	cc?: string | string[]
	bcc?: string | string[]
}): string {
	const { to, subject, body, cc, bcc } = options

	const toList = Array.isArray(to) ? to.join(',') : to
	const params = new URLSearchParams()

	if (subject) params.set('subject', subject)
	if (body) params.set('body', body)
	if (cc) params.set('cc', Array.isArray(cc) ? cc.join(',') : cc)
	if (bcc) params.set('bcc', Array.isArray(bcc) ? bcc.join(',') : bcc)

	const query = params.toString()
	return `mailto:${encodeURIComponent(toList)}${query ? '?' + query : ''}`
}

/**
 * Format an email address with display name
 *
 * @param email - Email address
 * @param name - Display name
 * @returns Formatted address (e.g., "John Doe <john@example.com>")
 */
export function formatEmailAddress(email: string, name?: string): string {
	if (!name) return email
	// Escape special characters in name
	const escapedName = name.replace(/"/g, '\\"')
	return `"${escapedName}" <${email}>`
}

/**
 * Parse a formatted email address
 *
 * @param formatted - Formatted address
 * @returns Parsed email and name
 */
export function parseEmailAddress(
	formatted: string
): { email: string; name?: string } {
	// Match "Name" <email@example.com> or Name <email@example.com>
	const match = formatted.match(/^(?:"?([^"]*)"?\s*)?<([^>]+)>$/)

	if (match) {
		return {
			email: match[2],
			name: match[1]?.trim() || undefined,
		}
	}

	// Just an email address
	return { email: formatted.trim() }
}

/**
 * Obscure email address for display
 *
 * @param email - Email address
 * @returns Obscured email (e.g., "j***n@g***.com")
 */
export function obscureEmail(email: string): string {
	const [local, domain] = email.split('@')
	if (!local || !domain) return email

	const obscureLocal =
		local.length <= 2
			? local[0] + '*'
			: local[0] + '*'.repeat(local.length - 2) + local.slice(-1)

	const domainParts = domain.split('.')
	const obscureDomain = domainParts.map((part, i) => {
		if (i === domainParts.length - 1) return part // Keep TLD
		return part[0] + '*'.repeat(Math.min(part.length - 1, 2))
	}).join('.')

	return `${obscureLocal}@${obscureDomain}`
}

/**
 * Generate List-Unsubscribe header
 *
 * @param options - Unsubscribe options
 * @returns List-Unsubscribe header value
 */
export function generateUnsubscribeHeader(options: {
	url?: string
	mailto?: string
}): string {
	const parts: string[] = []

	if (options.url) {
		parts.push(`<${options.url}>`)
	}

	if (options.mailto) {
		parts.push(`<mailto:${options.mailto}?subject=unsubscribe>`)
	}

	return parts.join(', ')
}
