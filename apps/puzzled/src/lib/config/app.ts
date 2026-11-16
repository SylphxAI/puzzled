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

/** Public product contact and support mailbox. */
export const CONTACT_EMAIL = `hi@${APP_DOMAIN}`

/** Routine product, account, and billing customer support mailbox. */
export const SUPPORT_EMAIL = CONTACT_EMAIL

/**
 * Formal legal notices, statutory data-rights requests (DSAR/erasure/rectification),
 * IP/copyright notices, and pre-action dispute notices route exclusively here.
 */
export const LEGAL_EMAIL = 'legal@sylphx.com' as const
export const PRIVACY_EMAIL = LEGAL_EMAIL

/** Published Terms of Service revision / clickwrap version (ISO date). */
export const TERMS_VERSION = '2026-11-14' as const

/** Published Privacy Policy revision / clickwrap version (ISO date). */
export const PRIVACY_VERSION = '2026-11-14' as const

/** Company telephone (Sylphx Limited), shown in the footer and legal pages. */
export const COMPANY_PHONE = '+44 7537 188 188'

/** Default from email (fallback when env not set) */
const _DEFAULT_FROM_EMAIL = `hello@${APP_DOMAIN}`
