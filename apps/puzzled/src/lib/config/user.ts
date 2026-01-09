/**
 * User Profile Configuration
 *
 * SSOT for user profile validation limits.
 */

export const USER_LIMITS = {
	/** Minimum username length */
	USERNAME_MIN_LENGTH: 3,
	/** Maximum username length */
	USERNAME_MAX_LENGTH: 20,
	/** Maximum bio length */
	BIO_MAX_LENGTH: 160,
	/** Maximum display name length */
	NAME_MAX_LENGTH: 100,
} as const

// Legacy export for backward compatibility
export const LIMITS = USER_LIMITS
