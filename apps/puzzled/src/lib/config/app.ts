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

/**
 * The one public contact address: a live mailbox. support@, privacy@ and
 * legal@ are aliases of it, so every public surface quotes this address only.
 */
export const CONTACT_EMAIL = `hi@${APP_DOMAIN}`

/** Support, legal and privacy all land in the one mailbox. */
export const SUPPORT_EMAIL = CONTACT_EMAIL
export const LEGAL_EMAIL = CONTACT_EMAIL
export const PRIVACY_EMAIL = CONTACT_EMAIL

/** Company telephone (Sylphx Limited), shown in the footer and legal pages. */
export const COMPANY_PHONE = '+44 333 335 7935'

/** Default from email (fallback when env not set) */
const _DEFAULT_FROM_EMAIL = `hello@${APP_DOMAIN}`
