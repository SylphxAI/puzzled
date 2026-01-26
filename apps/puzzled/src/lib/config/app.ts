/**
 * App Configuration - Single Source of Truth
 *
 * Centralized configuration for app-wide constants.
 * Import this instead of hardcoding app name, URLs, etc.
 */

/** Application name used across the app */
export const APP_NAME = 'Puzzled' as const

/** Application domain (without protocol) */
const APP_DOMAIN = 'puzzled.gg' as const

/** Default sender email name */
const APP_EMAIL_NAME = APP_NAME

/** Support email */
export const SUPPORT_EMAIL = `support@${APP_DOMAIN}`

/** Legal email */
export const LEGAL_EMAIL = `legal@${APP_DOMAIN}`

/** Privacy email */
export const PRIVACY_EMAIL = `privacy@${APP_DOMAIN}`

/** Default from email (fallback when env not set) */
const DEFAULT_FROM_EMAIL = `hello@${APP_DOMAIN}`
