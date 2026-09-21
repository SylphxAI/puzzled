/**
 * Validation Configuration - Single Source of Truth
 *
 * Centralized configuration for all validation limits and rules.
 * Import these constants instead of hardcoding values.
 */

// ==========================================
// File Upload Limits
// ==========================================

const _FILE_LIMITS = {
	/** Maximum avatar file size in bytes (5MB) */
	AVATAR_MAX_SIZE: 5 * 1024 * 1024,

	/** Allowed avatar MIME types */
	AVATAR_ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
} as const

// ==========================================
// OTP / Verification Codes
// ==========================================

const _OTP_CONFIG = {
	/** Length of OTP codes (TOTP and email verification) */
	CODE_LENGTH: 6,

	/** OTP code expiry in minutes */
	EXPIRY_MINUTES: 10,
} as const

// ==========================================
// Pagination Defaults
// ==========================================

export const PAGINATION = {
	/** Default page size */
	DEFAULT_LIMIT: 10,

	/** Maximum items per page for user-facing APIs */
	MAX_LIMIT: 50,

	/** Maximum items per page for admin APIs */
	ADMIN_MAX_LIMIT: 100,

	/** Default admin page size */
	ADMIN_DEFAULT_LIMIT: 50,
} as const

// ==========================================
// Field Size Limits
// ==========================================

const _FIELD_LIMITS = {
	/** Name fields (user name, plan name, etc.) */
	NAME_MAX: 100,

	/** Short description fields */
	DESCRIPTION_MAX: 500,

	/** Title fields (announcements, etc.) */
	TITLE_MAX: 200,

	/** Content fields (announcement content, etc.) */
	CONTENT_MAX: 2000,

	/** Username limits */
	USERNAME_MIN: 3,
	USERNAME_MAX: 30,

	/** Bio limit */
	BIO_MAX: 500,
} as const

// ==========================================
// Batch Operation Limits
// ==========================================

const _BATCH_LIMITS = {
	/** Maximum items in bulk operations */
	MAX_BATCH_SIZE: 100,
} as const
