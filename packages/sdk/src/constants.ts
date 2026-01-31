/**
 * SDK Constants — Single Source of Truth
 *
 * Shared constants used across the SDK. Centralizing these
 * prevents magic number duplication and makes changes easier.
 */

/** Default request timeout in milliseconds (30 seconds) */
export const DEFAULT_TIMEOUT_MS = 30_000

/** Default platform URL */
export const DEFAULT_PLATFORM_URL = 'https://sylphx.com'

/**
 * SDK API major version
 *
 * Update this when the server releases a new major API version.
 * The SDK is versioned alongside the API — when we release v2,
 * we publish a new SDK version that uses /api/sdk/v2.
 */
export const SDK_API_VERSION = 'v1'

/**
 * SDK API base path
 *
 * Single Source of Truth for all API endpoint URLs.
 * All SDK code MUST use this constant, never hardcode paths.
 */
export const SDK_API_PATH = `/api/sdk/${SDK_API_VERSION}`
