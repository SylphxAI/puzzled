/**
 * API Key Validation
 *
 * Industry-standard key validation following Stripe, Clerk, and Firebase patterns.
 * Validates key format at initialization and provides clear error messages.
 *
 * Principles:
 * 1. Fail fast - Invalid input rejected immediately with clear errors
 * 2. Helpful errors - Tell users exactly what's wrong and how to fix it
 * 3. Development warnings - Warn about issues that would fail in production
 * 4. No silent fixes in production - Transparency over convenience
 */

/**
 * Expected publishable key format:
 * - pk_dev_[32 hex chars] - Development environment
 * - pk_stg_[32 hex chars] - Staging environment
 * - pk_prod_[32 hex chars] - Production environment
 */
const PUBLISHABLE_KEY_PATTERN = /^pk_(dev|stg|prod|deve|stge|prde)_[a-f0-9]+$/

/**
 * Validation result with clear error information
 */
export interface KeyValidationResult {
	/** Whether the key is valid (possibly after sanitization) */
	valid: boolean
	/** The sanitized key to use (only if valid) */
	sanitizedKey: string
	/** Error message if invalid */
	error?: string
	/** Warning message if key was auto-fixed */
	warning?: string
	/** Detected issues for debugging */
	issues?: string[]
}

/**
 * Validate a publishable key and return detailed results
 *
 * This follows the industry-standard "fail fast" pattern:
 * 1. Check if key exists
 * 2. Validate against expected format
 * 3. If format fails, check if sanitization would fix it
 * 4. Return appropriate error/warning
 *
 * @example
 * ```typescript
 * const result = validatePublishableKey(process.env.NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY)
 * if (!result.valid) {
 *   throw new Error(result.error)
 * }
 * if (result.warning) {
 *   console.warn(result.warning)
 * }
 * ```
 */
export function validatePublishableKey(key: string | undefined | null): KeyValidationResult {
	const issues: string[] = []

	// Check if key is provided
	if (!key) {
		return {
			valid: false,
			sanitizedKey: '',
			error:
				'[Sylphx] Publishable key is required. ' +
				'Set NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY in your environment variables.',
			issues: ['missing'],
		}
	}

	// Check for common issues before validation
	if (key !== key.trim()) {
		issues.push('whitespace')
	}
	if (key.includes('\n')) {
		issues.push('newline')
	}
	if (key.includes('\r')) {
		issues.push('carriage-return')
	}

	// First, check if the key matches the expected format exactly
	if (PUBLISHABLE_KEY_PATTERN.test(key)) {
		return {
			valid: true,
			sanitizedKey: key,
			issues: [],
		}
	}

	// Key doesn't match - check if sanitization would fix it
	const sanitized = key.trim()

	if (PUBLISHABLE_KEY_PATTERN.test(sanitized)) {
		// Sanitization fixes the issue - this is the Vercel CLI bug case
		const warningMessage =
			`[Sylphx] Publishable key contains ${issues.join(', ')}. ` +
			`This is commonly caused by Vercel CLI's 'env pull' command.\n\n` +
			`To fix permanently:\n` +
			`1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables\n` +
			`2. Edit NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY\n` +
			`3. Remove any trailing whitespace or newline characters\n` +
			`4. Redeploy your application\n\n` +
			`The SDK will automatically sanitize the key, but fixing the source is recommended.`

		return {
			valid: true,
			sanitizedKey: sanitized,
			warning: warningMessage,
			issues,
		}
	}

	// Sanitization doesn't fix it - the key format is genuinely wrong
	const maskedKey = key.length > 20 ? `${key.slice(0, 20)}...` : key
	return {
		valid: false,
		sanitizedKey: '',
		error:
			`[Sylphx] Invalid publishable key format.\n\n` +
			`Expected format: pk_(dev|stg|prod)_[hex]\n` +
			`Received: "${maskedKey}"\n\n` +
			`Please check your NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY environment variable.\n` +
			`You can find your publishable key in the Sylphx Console under API Keys.`,
		issues: [...issues, 'invalid-format'],
	}
}

/**
 * Validate and sanitize publishable key, logging warnings in development
 *
 * This is the main entry point for key validation in the SDK.
 * It validates the key, logs appropriate warnings/errors, and returns
 * the sanitized key to use.
 *
 * @throws Error if the key is invalid and cannot be sanitized
 * @returns The sanitized publishable key
 */
export function validateAndSanitizePublishableKey(key: string | undefined | null): string {
	const result = validatePublishableKey(key)

	if (!result.valid) {
		// Always throw for invalid keys - fail fast
		throw new Error(result.error)
	}

	if (result.warning) {
		// Log warning in development, but don't throw
		// This helps users discover and fix the issue without breaking their app
		console.warn(result.warning)
	}

	return result.sanitizedKey
}

/**
 * Check if we're in development mode
 * Used to adjust strictness of validation
 */
export function isDevelopment(): boolean {
	if (typeof process !== 'undefined' && process.env) {
		return process.env.NODE_ENV === 'development'
	}
	// In browser without process.env, check for localhost
	if (typeof window !== 'undefined') {
		return (
			window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
		)
	}
	return false
}
