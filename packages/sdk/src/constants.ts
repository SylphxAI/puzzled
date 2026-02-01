/**
 * SDK Constants — Single Source of Truth
 *
 * Shared constants used across the SDK. Centralizing these
 * prevents magic number duplication and makes changes easier.
 *
 * IMPORTANT: All time-based constants should be used consistently
 * across the SDK. Never hardcode magic numbers like 30000, 5 * 60 * 1000, etc.
 */

// =============================================================================
// API Configuration
// =============================================================================

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

/**
 * Default auth route prefix
 *
 * Used for OAuth callbacks and signout routes.
 * Must match the middleware's authPrefix config.
 */
export const DEFAULT_AUTH_PREFIX = '/auth'

// =============================================================================
// Timeouts & Durations
// =============================================================================

/** Default request timeout in milliseconds (30 seconds) */
export const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Token expiry buffer in milliseconds (30 seconds)
 *
 * Refresh tokens this many milliseconds BEFORE they expire
 * to account for network latency and clock skew.
 */
export const TOKEN_EXPIRY_BUFFER_MS = 30_000

/**
 * Session token lifetime in seconds (5 minutes)
 *
 * Matches Clerk's short-lived access token pattern.
 * Used for cookie maxAge and React Query staleTime.
 */
export const SESSION_TOKEN_LIFETIME_SECONDS = 5 * 60

/** Session token lifetime in milliseconds (for React Query staleTime) */
export const SESSION_TOKEN_LIFETIME_MS = SESSION_TOKEN_LIFETIME_SECONDS * 1000

/**
 * Refresh token lifetime in seconds (30 days)
 *
 * Long-lived token for silent refresh.
 */
export const REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60

// =============================================================================
// Feature Flags Cache
// =============================================================================

/**
 * Feature flags cache TTL in milliseconds (5 minutes)
 *
 * How long to cache flags before fetching fresh values.
 * Matches LaunchDarkly's default streaming connection behavior.
 */
export const FLAGS_CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Feature flags stale-while-revalidate window in milliseconds (1 minute)
 *
 * Allow serving stale flags while fetching fresh values.
 */
export const FLAGS_STALE_WHILE_REVALIDATE_MS = 60 * 1000

// =============================================================================
// Retry & Backoff
// =============================================================================

/** Maximum retry delay for exponential backoff (30 seconds) */
export const MAX_RETRY_DELAY_MS = 30_000

/** Base retry delay for exponential backoff (1 second) */
export const BASE_RETRY_DELAY_MS = 1_000

/** Maximum number of retries for network requests */
export const MAX_RETRIES = 3

// =============================================================================
// Analytics
// =============================================================================

/**
 * Analytics session timeout in milliseconds (30 minutes)
 *
 * After this much inactivity, a new session is started.
 */
export const ANALYTICS_SESSION_TIMEOUT_MS = 30 * 60 * 1000

// =============================================================================
// Webhooks
// =============================================================================

/**
 * Maximum age for webhook signature validation (5 minutes)
 *
 * Reject webhooks with timestamps older than this.
 */
export const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000

/**
 * Clock skew allowance for webhook validation (30 seconds)
 *
 * Allow timestamps this far in the future.
 */
export const WEBHOOK_CLOCK_SKEW_MS = 30 * 1000

// =============================================================================
// PKCE (OAuth)
// =============================================================================

/**
 * PKCE code verifier TTL in milliseconds (10 minutes)
 *
 * How long the code verifier is stored during OAuth flow.
 */
export const PKCE_CODE_TTL_MS = 10 * 60 * 1000

// =============================================================================
// Jobs
// =============================================================================

/**
 * Job dead-letter queue retention in milliseconds (7 days)
 */
export const JOBS_DLQ_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// =============================================================================
// Session Replay
// =============================================================================

/**
 * Maximum session replay recording duration in milliseconds (60 minutes)
 */
export const SESSION_REPLAY_MAX_DURATION_MS = 60 * 60 * 1000
