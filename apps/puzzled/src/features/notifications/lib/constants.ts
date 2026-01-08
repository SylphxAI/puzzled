/**
 * Notification Constants - Single Source of Truth
 *
 * All notification-related magic numbers and configuration.
 */

// ==========================================
// Win-Back Email Schedule
// ==========================================

/**
 * Days since last activity to trigger win-back emails
 * Must match the pgEnum in schema.ts: ['day7', 'day14', 'day30']
 */
export const WIN_BACK_DAYS = [7, 14, 30] as const

export type WinBackDay = (typeof WIN_BACK_DAYS)[number]

/**
 * Convert day number to database enum value
 */
export function getWinBackEnumValue(day: WinBackDay): `day${WinBackDay}` {
	return `day${day}` as `day${WinBackDay}`
}

// ==========================================
// Email Timing
// ==========================================

export const EMAIL_CONFIG = {
	/** Delay between batch emails (ms) - prevents rate limiting */
	BATCH_DELAY_MS: 500,

	/** Maximum emails to send in one workflow run */
	BATCH_SIZE: 100,
} as const

// ==========================================
// Email Theme Colors
// ==========================================

export const EMAIL_THEME = {
	/** Primary brand color (Indigo 500) */
	PRIMARY_COLOR: '#6366f1',

	/** Warning color (Amber 500) */
	WARNING_COLOR: '#f59e0b',

	/** Danger/Error color */
	DANGER_COLOR: '#dc2626',

	/** Success color */
	SUCCESS_COLOR: '#22c55e',

	/** Neutral text color */
	TEXT_MUTED: '#666',

	/** Light neutral text */
	TEXT_LIGHT: '#999',

	/** Background for highlights */
	BG_HIGHLIGHT: '#f3f4f6',

	/** Border color */
	BORDER_COLOR: '#e5e7eb',
} as const

// ==========================================
// Push Notification Configuration
// ==========================================

export const PUSH_CONFIG = {
	/** VAPID TTL in seconds (24 hours) */
	TTL: 24 * 60 * 60,

	/** Default notification icon path */
	ICON_PATH: '/icons/icon-192.png',

	/** Default badge icon path */
	BADGE_PATH: '/icons/badge-72.png',
} as const
