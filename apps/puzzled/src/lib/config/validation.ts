/**
 * Validation Configuration - Single Source of Truth
 *
 * Centralized configuration for all validation limits and rules.
 * Import these constants instead of hardcoding values.
 */

import { z } from 'zod'

// ==========================================
// File Upload Limits
// ==========================================

const FILE_LIMITS = {
	/** Maximum avatar file size in bytes (5MB) */
	AVATAR_MAX_SIZE: 5 * 1024 * 1024,

	/** Allowed avatar MIME types */
	AVATAR_ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
} as const

// ==========================================
// OTP / Verification Codes
// ==========================================

const OTP_CONFIG = {
	/** Length of OTP codes (TOTP and email verification) */
	CODE_LENGTH: 6,

	/** OTP code expiry in minutes */
	EXPIRY_MINUTES: 10,
} as const

// ==========================================
// Referral Code Rules
// ==========================================

const REFERRAL_CONFIG = {
	/** Minimum referral code length */
	CODE_MIN_LENGTH: 5,

	/** Maximum referral code length */
	CODE_MAX_LENGTH: 20,

	/** Allowed characters in referral codes */
	CODE_PATTERN: /^[A-Z0-9]+$/i,
} as const

/** Zod schema for referral code validation - SSOT */
const referralCodeSchema = z
	.string()
	.min(REFERRAL_CONFIG.CODE_MIN_LENGTH, 'Referral code too short')
	.max(REFERRAL_CONFIG.CODE_MAX_LENGTH, 'Referral code too long')
	.regex(REFERRAL_CONFIG.CODE_PATTERN, 'Invalid referral code format')

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

/** Zod schema for user-facing pagination */
const paginationSchema = z.object({
	limit: z.number().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
	offset: z.number().min(0).default(0),
})

/** Zod schema for admin pagination */
const adminPaginationSchema = z.object({
	limit: z.number().min(1).max(PAGINATION.ADMIN_MAX_LIMIT).default(PAGINATION.ADMIN_DEFAULT_LIMIT),
	offset: z.number().min(0).default(0),
})

// ==========================================
// Field Size Limits
// ==========================================

const FIELD_LIMITS = {
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
// Currency Configuration
// ==========================================

const CURRENCY_CONFIG = {
	/** Default currency code */
	DEFAULT: 'usd' as const,

	/** Currency code length (ISO 4217) */
	CODE_LENGTH: 3,
} as const

/** Zod schema for currency validation */
const currencySchema = z
	.string()
	.length(CURRENCY_CONFIG.CODE_LENGTH)
	.default(CURRENCY_CONFIG.DEFAULT)

// ==========================================
// Batch Operation Limits
// ==========================================

const BATCH_LIMITS = {
	/** Maximum items in bulk operations */
	MAX_BATCH_SIZE: 100,
} as const

// ==========================================
// Animation Timing (milliseconds)
// ==========================================

const TIMING = {
	/** Result modal delay after win */
	RESULT_MODAL_WIN_DELAY: 1500,

	/** Result modal delay after loss */
	RESULT_MODAL_LOSS_DELAY: 1000,

	/** Short animation duration */
	ANIMATION_SHORT: 300,
} as const
