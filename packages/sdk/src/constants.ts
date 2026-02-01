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

/**
 * Session replay upload interval in milliseconds (5 seconds)
 */
export const SESSION_REPLAY_UPLOAD_INTERVAL_MS = 5_000

/**
 * Session replay scroll event throttle interval (150 ms)
 */
export const SESSION_REPLAY_SCROLL_THROTTLE_MS = 150

/**
 * Session replay media time update throttle interval (800 ms)
 */
export const SESSION_REPLAY_MEDIA_THROTTLE_MS = 800

/**
 * Session replay rage click detection window (1 second)
 */
export const SESSION_REPLAY_RAGE_CLICK_WINDOW_MS = 1_000

/**
 * Session replay dead click detection timeout (500 ms)
 */
export const SESSION_REPLAY_DEAD_CLICK_TIMEOUT_MS = 500

/**
 * Session replay scroll heat detection window (2 seconds)
 */
export const SESSION_REPLAY_SCROLL_HEAT_WINDOW_MS = 2_000

/**
 * Session replay status check interval (5 seconds)
 */
export const SESSION_REPLAY_STATUS_CHECK_MS = 5_000

// =============================================================================
// Analytics (Extended)
// =============================================================================

/**
 * Analytics event flush interval in milliseconds (5 seconds)
 */
export const ANALYTICS_FLUSH_INTERVAL_MS = 5_000

/**
 * Analytics maximum text length for autocapture (100 characters)
 */
export const ANALYTICS_MAX_TEXT_LENGTH = 100

/**
 * Analytics flush timeout in milliseconds (1 second)
 */
export const ANALYTICS_FLUSH_TIMEOUT_MS = 1_000

/**
 * Analytics interval check in milliseconds (1 second)
 */
export const ANALYTICS_INTERVAL_CHECK_MS = 1_000

// =============================================================================
// Feature Flags (Extended)
// =============================================================================

/**
 * Feature flags exposure deduplication window (1 hour)
 *
 * Prevents duplicate exposure events for A/B tests within this window.
 */
export const FLAGS_EXPOSURE_DEDUPE_WINDOW_MS = 60 * 60 * 1000

/**
 * Flag stream initial reconnection delay (1 second)
 */
export const FLAGS_STREAM_INITIAL_RECONNECT_MS = 1_000

/**
 * Flag stream maximum reconnection delay (30 seconds)
 */
export const FLAGS_STREAM_MAX_RECONNECT_MS = 30_000

/**
 * Flag stream heartbeat timeout (45 seconds)
 */
export const FLAGS_STREAM_HEARTBEAT_TIMEOUT_MS = 45_000

/**
 * Flag HTTP polling interval fallback (60 seconds)
 */
export const FLAGS_HTTP_POLLING_INTERVAL_MS = 60_000

// =============================================================================
// Jobs (Extended)
// =============================================================================

/**
 * Default retry delay sequence for exponential backoff (ms)
 */
export const DEFAULT_RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 30_000, 60_000] as const

/**
 * Default job timeout in milliseconds (60 seconds)
 */
export const JOB_DEFAULT_TIMEOUT_MS = 60_000

/**
 * Default job status polling interval (2 seconds)
 */
export const JOB_POLL_INTERVAL_MS = 2_000

// =============================================================================
// Storage Keys & Prefixes
// =============================================================================

/**
 * Storage key prefix for SDK data
 */
export const STORAGE_KEY_PREFIX = 'sylphx_'

/**
 * localStorage key for cached feature flags
 */
export const FLAGS_CACHE_KEY = 'sylphx_feature_flags'

/**
 * localStorage key for feature flags cache timestamp
 */
export const FLAGS_CACHE_TIMESTAMP_KEY = 'sylphx_feature_flags_ts'

/**
 * localStorage key for feature flags overrides
 */
export const FLAGS_OVERRIDES_KEY = 'sylphx_feature_flags_overrides'

/**
 * localStorage key for active organization
 */
export const ORG_STORAGE_KEY = 'sylphx_active_org'

/**
 * BroadcastChannel name for cross-tab org sync
 */
export const ORG_BROADCAST_CHANNEL = 'sylphx_org_sync'

/**
 * Storage prefix for PKCE verifiers
 */
export const PKCE_STORAGE_PREFIX = 'sylphx_pkce_'

/**
 * Test key for checking storage availability
 */
export const STORAGE_TEST_KEY = '__sylphx_test__'

/**
 * Cookie/storage name for analytics sessions
 */
export const ANALYTICS_SESSION_KEY = 'sylphx_session'

/**
 * Default storage key for flags persistence
 */
export const FLAGS_STORAGE_KEY = 'sylphx_flags'

// =============================================================================
// Click ID & Attribution
// =============================================================================

/**
 * Click ID attribution window in milliseconds (90 days)
 *
 * How long click IDs are stored for conversion attribution.
 */
export const CLICK_ID_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000

// =============================================================================
// React Query Stale Times
// =============================================================================

/**
 * React Query staleTime for frequently-changing data (1 minute)
 *
 * Use for: real-time metrics, live feeds, active sessions
 */
export const STALE_TIME_FREQUENT_MS = 60 * 1_000

/**
 * React Query staleTime for moderately-changing data (2 minutes)
 *
 * Use for: subscriptions, user profiles, preferences
 */
export const STALE_TIME_MODERATE_MS = 2 * 60 * 1_000

/**
 * React Query staleTime for stable/config data (5 minutes)
 *
 * Use for: plans, feature flags, app config
 */
export const STALE_TIME_STABLE_MS = 5 * 60 * 1_000

/**
 * React Query staleTime for webhook stats (30 seconds)
 */
export const STALE_TIME_STATS_MS = 30 * 1_000

// =============================================================================
// UI Component Timeouts
// =============================================================================

/**
 * Copy-to-clipboard feedback display duration (2 seconds)
 */
export const UI_COPY_FEEDBACK_MS = 2_000

/**
 * Form success message display duration (3 seconds)
 */
export const UI_FORM_SUCCESS_MS = 3_000

/**
 * General notification display duration (5 seconds)
 */
export const UI_NOTIFICATION_MS = 5_000

/**
 * Prompt auto-show delay (3 seconds)
 */
export const UI_PROMPT_DELAY_MS = 3_000

/**
 * Redirect delay after action (3 seconds)
 */
export const UI_REDIRECT_DELAY_MS = 3_000

/**
 * Animation out duration (200 ms)
 */
export const UI_ANIMATION_OUT_MS = 200

/**
 * Animation in duration (300 ms)
 */
export const UI_ANIMATION_IN_MS = 300

// =============================================================================
// Email & Verification
// =============================================================================

/**
 * Email resend cooldown tick interval (1 second)
 */
export const EMAIL_RESEND_COOLDOWN_TICK_MS = 1_000

/**
 * New user detection threshold (1 minute)
 *
 * Users created within this window are considered "new" for signup tracking.
 */
export const NEW_USER_THRESHOLD_MS = 60 * 1_000

// =============================================================================
// Web Vitals Thresholds
// =============================================================================

/**
 * FCP (First Contentful Paint) "good" threshold (1800 ms)
 */
export const WEB_VITALS_FCP_GOOD_MS = 1_800

/**
 * FCP (First Contentful Paint) "poor" threshold (3000 ms)
 */
export const WEB_VITALS_FCP_POOR_MS = 3_000
