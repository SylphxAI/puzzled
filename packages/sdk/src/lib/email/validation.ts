/**
 * Email Validation Utilities
 *
 * Comprehensive email address validation with provider detection.
 *
 * @example
 * ```typescript
 * import { validateEmail, isValidEmail, normalizeEmail } from '@sylphx/platform-sdk/email'
 *
 * // Simple validation
 * if (isValidEmail('user@example.com')) {
 *   console.log('Valid!')
 * }
 *
 * // Detailed validation
 * const result = validateEmail('User+Tag@Gmail.com')
 * console.log(result.normalized) // 'usertag@gmail.com' (Gmail strips dots and +tags)
 *
 * // With options
 * const result = validateEmail('user@tempmail.com', {
 *   blockDisposable: true,
 * })
 * if (!result.valid) {
 *   console.log(result.error) // 'Disposable email addresses not allowed'
 * }
 * ```
 */

import type {
	EmailValidationResult,
	ParsedEmail,
	ValidationOptions,
	EmailProvider,
} from './types'

// ============================================================================
// Email Regex
// ============================================================================

/**
 * RFC 5322 compliant email regex
 * Balances strictness with real-world compatibility
 */
const EMAIL_REGEX =
	/^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i

/**
 * Simpler regex for quick checks
 */
const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ============================================================================
// Provider Lists
// ============================================================================

/**
 * Major free email providers
 */
export const FREE_EMAIL_PROVIDERS = new Set([
	'gmail.com',
	'googlemail.com',
	'yahoo.com',
	'yahoo.co.uk',
	'yahoo.fr',
	'yahoo.de',
	'yahoo.it',
	'yahoo.es',
	'hotmail.com',
	'hotmail.co.uk',
	'hotmail.fr',
	'hotmail.de',
	'outlook.com',
	'outlook.fr',
	'outlook.de',
	'live.com',
	'msn.com',
	'icloud.com',
	'me.com',
	'mac.com',
	'aol.com',
	'protonmail.com',
	'proton.me',
	'zoho.com',
	'yandex.com',
	'yandex.ru',
	'mail.com',
	'gmx.com',
	'gmx.de',
	'web.de',
	'fastmail.com',
	'tutanota.com',
	'pm.me',
])

/**
 * Known disposable email domains
 */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
	'tempmail.com',
	'temp-mail.org',
	'guerrillamail.com',
	'guerrillamail.org',
	'mailinator.com',
	'10minutemail.com',
	'throwaway.email',
	'trashmail.com',
	'fakeinbox.com',
	'getnada.com',
	'mailnesia.com',
	'sharklasers.com',
	'dispostable.com',
	'maildrop.cc',
	'yopmail.com',
	'mytemp.email',
	'tempr.email',
	'discard.email',
	'tempail.com',
	'mohmal.com',
	'minuteinbox.com',
	'emailondeck.com',
	'incognitomail.com',
	'burnermail.io',
	'spamgourmet.com',
])

// ============================================================================
// Core Validation
// ============================================================================

/**
 * Parse email address into parts
 */
export function parseEmail(email: string): ParsedEmail | null {
	const trimmed = email.trim().toLowerCase()
	const atIndex = trimmed.lastIndexOf('@')

	if (atIndex === -1) return null

	const local = trimmed.slice(0, atIndex)
	const domain = trimmed.slice(atIndex + 1)

	if (!local || !domain) return null

	// Parse domain
	const domainParts = domain.split('.')
	if (domainParts.length < 2) return null

	const tld = domainParts[domainParts.length - 1]
	const subdomain = domainParts.length > 2 ? domainParts.slice(0, -2).join('.') : undefined

	return {
		local,
		domain,
		subdomain,
		tld,
	}
}

/**
 * Validate an email address
 *
 * @param email - Email address to validate
 * @param options - Validation options
 * @returns Validation result with normalized email and parsed parts
 *
 * @example
 * ```typescript
 * const result = validateEmail('John.Doe+newsletter@gmail.com')
 * // {
 * //   valid: true,
 * //   normalized: 'johndoe@gmail.com', // Gmail normalization
 * //   parsed: { local: 'johndoe', domain: 'gmail.com', tld: 'com' }
 * // }
 * ```
 */
export function validateEmail(
	email: string,
	options: ValidationOptions = {}
): EmailValidationResult {
	const {
		allowPlusAddressing = true,
		allowSubdomains = true,
		blockDisposable = false,
		blockFree = false,
		allowedDomains,
		blockedDomains,
		maxLocalLength = 64,
		maxDomainLength = 255,
	} = options

	const warnings: string[] = []

	// Basic validation
	if (!email || typeof email !== 'string') {
		return { valid: false, error: 'Email is required' }
	}

	const trimmed = email.trim()

	if (!trimmed) {
		return { valid: false, error: 'Email is required' }
	}

	// Length checks
	if (trimmed.length > 254) {
		return { valid: false, error: 'Email is too long' }
	}

	// Parse email
	const parsed = parseEmail(trimmed)
	if (!parsed) {
		return { valid: false, error: 'Invalid email format' }
	}

	// Part length checks
	if (parsed.local.length > maxLocalLength) {
		return { valid: false, error: `Local part exceeds ${maxLocalLength} characters` }
	}

	if (parsed.domain.length > maxDomainLength) {
		return { valid: false, error: `Domain exceeds ${maxDomainLength} characters` }
	}

	// Regex validation
	if (!EMAIL_REGEX.test(trimmed)) {
		return { valid: false, error: 'Invalid email format' }
	}

	// TLD validation
	if (parsed.tld.length < 2) {
		return { valid: false, error: 'Invalid top-level domain' }
	}

	// Plus addressing check
	if (!allowPlusAddressing && parsed.local.includes('+')) {
		return { valid: false, error: 'Plus addressing not allowed' }
	}

	// Subdomain check
	if (!allowSubdomains && parsed.subdomain) {
		return { valid: false, error: 'Subdomain not allowed' }
	}

	// Domain whitelist
	if (allowedDomains && allowedDomains.length > 0) {
		const allowed = allowedDomains.some(
			(d) => parsed.domain === d.toLowerCase() || parsed.domain.endsWith('.' + d.toLowerCase())
		)
		if (!allowed) {
			return { valid: false, error: 'Domain not in allowed list' }
		}
	}

	// Domain blacklist
	if (blockedDomains && blockedDomains.length > 0) {
		const blocked = blockedDomains.some(
			(d) => parsed.domain === d.toLowerCase() || parsed.domain.endsWith('.' + d.toLowerCase())
		)
		if (blocked) {
			return { valid: false, error: 'Domain is blocked' }
		}
	}

	// Disposable check
	if (blockDisposable && DISPOSABLE_EMAIL_DOMAINS.has(parsed.domain)) {
		return { valid: false, error: 'Disposable email addresses not allowed' }
	}

	// Free email check
	if (blockFree && FREE_EMAIL_PROVIDERS.has(parsed.domain)) {
		return { valid: false, error: 'Free email providers not allowed' }
	}

	// Normalize the email
	const normalized = normalizeEmail(trimmed)

	// Add warnings
	if (parsed.local.includes('+')) {
		warnings.push('Email uses plus addressing')
	}

	if (DISPOSABLE_EMAIL_DOMAINS.has(parsed.domain)) {
		warnings.push('Email may be from a disposable provider')
	}

	return {
		valid: true,
		normalized,
		parsed,
		warnings: warnings.length > 0 ? warnings : undefined,
	}
}

/**
 * Quick email validation (boolean result)
 *
 * @param email - Email address to check
 * @returns Whether email is valid
 */
export function isValidEmail(email: string): boolean {
	if (!email || typeof email !== 'string') return false
	const trimmed = email.trim()
	if (!trimmed || trimmed.length > 254) return false
	return EMAIL_REGEX.test(trimmed)
}

/**
 * Quick email validation with simple regex (fastest)
 */
export function isValidEmailQuick(email: string): boolean {
	if (!email || typeof email !== 'string') return false
	return SIMPLE_EMAIL_REGEX.test(email.trim())
}

// ============================================================================
// Email Normalization
// ============================================================================

/**
 * Normalize an email address
 *
 * Applies provider-specific normalization:
 * - Gmail: removes dots, strips + tags
 * - Outlook/Hotmail: strips + tags
 * - Others: lowercase only
 *
 * @param email - Email to normalize
 * @returns Normalized email
 */
export function normalizeEmail(email: string): string {
	const trimmed = email.trim().toLowerCase()
	const parsed = parseEmail(trimmed)

	if (!parsed) return trimmed

	let { local, domain } = parsed

	// Gmail normalization
	if (domain === 'gmail.com' || domain === 'googlemail.com') {
		// Remove dots from local part
		local = local.replace(/\./g, '')
		// Remove + tag
		const plusIndex = local.indexOf('+')
		if (plusIndex !== -1) {
			local = local.slice(0, plusIndex)
		}
		// Normalize googlemail.com to gmail.com
		domain = 'gmail.com'
	}

	// Outlook/Hotmail normalization
	if (
		domain === 'outlook.com' ||
		domain === 'hotmail.com' ||
		domain === 'live.com' ||
		domain === 'msn.com'
	) {
		// Remove + tag
		const plusIndex = local.indexOf('+')
		if (plusIndex !== -1) {
			local = local.slice(0, plusIndex)
		}
	}

	// Yahoo normalization
	if (domain.startsWith('yahoo.')) {
		// Yahoo uses - for tags, but we don't strip them as they're less common
	}

	return `${local}@${domain}`
}

// ============================================================================
// Provider Detection
// ============================================================================

/**
 * Detect email provider from domain
 *
 * @param email - Email address or domain
 * @returns Provider info or undefined
 */
export function detectProvider(email: string): EmailProvider | undefined {
	const domain = email.includes('@') ? email.split('@')[1].toLowerCase() : email.toLowerCase()

	// Gmail
	if (domain === 'gmail.com' || domain === 'googlemail.com') {
		return {
			name: 'Gmail',
			domains: ['gmail.com', 'googlemail.com'],
			isFree: true,
			isDisposable: false,
		}
	}

	// Outlook/Microsoft
	if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com'].includes(domain)) {
		return {
			name: 'Outlook',
			domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
			isFree: true,
			isDisposable: false,
		}
	}

	// Yahoo
	if (domain.startsWith('yahoo.')) {
		return {
			name: 'Yahoo',
			domains: ['yahoo.com'],
			isFree: true,
			isDisposable: false,
		}
	}

	// iCloud
	if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) {
		return {
			name: 'iCloud',
			domains: ['icloud.com', 'me.com', 'mac.com'],
			isFree: true,
			isDisposable: false,
		}
	}

	// Proton
	if (['protonmail.com', 'proton.me', 'pm.me'].includes(domain)) {
		return {
			name: 'ProtonMail',
			domains: ['protonmail.com', 'proton.me', 'pm.me'],
			isFree: true,
			isDisposable: false,
		}
	}

	// Check disposable
	if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
		return {
			name: 'Disposable',
			domains: [domain],
			isFree: true,
			isDisposable: true,
		}
	}

	return undefined
}

/**
 * Check if email is from a free provider
 */
export function isFreeEmail(email: string): boolean {
	const domain = email.includes('@') ? email.split('@')[1].toLowerCase() : email.toLowerCase()
	return FREE_EMAIL_PROVIDERS.has(domain)
}

/**
 * Check if email is from a disposable provider
 */
export function isDisposableEmail(email: string): boolean {
	const domain = email.includes('@') ? email.split('@')[1].toLowerCase() : email.toLowerCase()
	return DISPOSABLE_EMAIL_DOMAINS.has(domain)
}

/**
 * Check if email is a work/business email (not free)
 */
export function isWorkEmail(email: string): boolean {
	return !isFreeEmail(email) && !isDisposableEmail(email)
}
