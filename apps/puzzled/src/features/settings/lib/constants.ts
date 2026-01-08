/**
 * Settings Feature Constants
 *
 * Centralized configuration for validation limits.
 * Only actively used constants are defined here.
 */

// ==========================================
// Validation Limits
// ==========================================

export const LIMITS = {
	/** Maximum length for user bio */
	BIO_MAX_LENGTH: 500,

	/** Maximum length for username */
	USERNAME_MAX_LENGTH: 30,

	/** Minimum length for username */
	USERNAME_MIN_LENGTH: 3,
} as const
