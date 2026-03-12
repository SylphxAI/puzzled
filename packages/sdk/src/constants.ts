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
 * Canonical environment variable name for the platform URL.
 *
 * SDK modules MUST read from this env var (with SYLPHX_URL as legacy fallback).
 * Centralizing the name prevents the same env var being spelled differently
 * across kv.ts, streams.ts, ai.ts, middleware.ts, and server.ts.
 */
export const ENV_PLATFORM_URL = 'SYLPHX_PLATFORM_URL'

/**
 * Legacy environment variable name for the platform URL.
 *
 * Supported as a fallback for older deployments that set SYLPHX_URL.
 * New projects should use SYLPHX_PLATFORM_URL.
 */
export const ENV_PLATFORM_URL_LEGACY = 'SYLPHX_URL'

/**
 * Canonical environment variable name for the secret key.
 *
 * All server-side SDK modules read from this env var by default.
 */
export const ENV_SECRET_KEY = 'SYLPHX_SECRET_KEY'

/**
 * Resolve the platform URL from environment variables.
 *
 * Priority: explicit value > SYLPHX_PLATFORM_URL > SYLPHX_URL (legacy) > default
 */
export function resolvePlatformUrl(explicit?: string): string {
	return (
		explicit ||
		process.env[ENV_PLATFORM_URL] ||
		process.env[ENV_PLATFORM_URL_LEGACY] ||
		DEFAULT_PLATFORM_URL
	).trim()
}

/**
 * Resolve the secret key from environment variables.
 *
 * Returns the raw value before validation. Callers should pass the result
 * through `validateAndSanitizeSecretKey()`.
 */
export function resolveSecretKey(explicit?: string): string | undefined {
	return explicit || process.env[ENV_SECRET_KEY]
}

/** @deprecated No longer used for path construction. Use SDK_API_PATH directly. */
export const SDK_API_VERSION = 'v1'

/**
 * SDK API base path — unified under /api/v1/
 *
 * Single Source of Truth for all API endpoint URLs.
 * All SDK code MUST use this constant, never hardcode paths.
 */
export const SDK_API_PATH = `/api/v1`

/**
 * Default auth route prefix
 *
 * Used for OAuth callbacks and signout routes.
 * Must match the middleware's authPrefix config.
 */
export const DEFAULT_AUTH_PREFIX = '/auth'

/**
 * SDK package version
 *
 * Sent in X-SDK-Version header for debugging and analytics.
 * Update this when releasing new SDK versions.
 */
export const SDK_VERSION = '0.1.0'

/**
 * SDK platform identifier
 *
 * Sent in X-SDK-Platform header to identify the runtime environment.
 */
export const SDK_PLATFORM =
	typeof window !== 'undefined'
		? 'browser'
		: typeof process !== 'undefined' && process.versions?.node
			? 'node'
			: 'unknown'

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

/**
 * Analytics retry base delay in milliseconds (1 second)
 * Exponential backoff: delay = base * 2^retries (with jitter)
 */
export const ANALYTICS_RETRY_BASE_DELAY_MS = 1_000

/**
 * Analytics retry max delay in milliseconds (30 seconds)
 */
export const ANALYTICS_RETRY_MAX_DELAY_MS = 30_000

/**
 * Analytics retry jitter factor (±20%)
 * Prevents thundering herd when multiple clients retry simultaneously
 */
export const ANALYTICS_RETRY_JITTER = 0.2

/**
 * Analytics maximum retries before dropping event (Segment pattern: 10)
 */
export const ANALYTICS_MAX_RETRIES = 10

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

// =============================================================================
// Storage Sizes
// =============================================================================

/**
 * Multipart upload threshold (5 MB)
 *
 * Files larger than this use multipart upload for better reliability.
 */
export const STORAGE_MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024

/**
 * Default max file size for uploads (5 MB)
 */
export const STORAGE_DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024

/**
 * Avatar max file size (2 MB)
 */
export const STORAGE_AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024

/**
 * Large file max size for file uploads (10 MB)
 */
export const STORAGE_LARGE_MAX_SIZE_BYTES = 10 * 1024 * 1024

// =============================================================================
// Cache TTLs
// =============================================================================

/**
 * JWK cache TTL (1 hour)
 */
export const JWK_CACHE_TTL_MS = 60 * 60 * 1000

// =============================================================================
// Analytics Event Tracking
// =============================================================================

/**
 * Max tracked event IDs to keep in memory
 */
export const ANALYTICS_MAX_TRACKED_EVENT_IDS = 1000

/**
 * Number of event IDs to keep after cleanup
 */
export const ANALYTICS_TRACKED_IDS_KEEP = 500

/**
 * Analytics queue limit before force flush
 */
export const ANALYTICS_QUEUE_LIMIT = 100

// =============================================================================
// Session Replay (Extended)
// =============================================================================

/**
 * Session replay check interval (1 second)
 */
export const SESSION_REPLAY_CHECK_INTERVAL_MS = 1_000

/**
 * Success feedback delay for invite/account actions (1.5 seconds)
 */
export const UI_SUCCESS_REDIRECT_MS = 1_500

// =============================================================================
// String Truncation Limits
// =============================================================================

/**
 * Max message length for logging (1000 chars)
 */
export const LOG_MESSAGE_MAX_LENGTH = 1_000

/**
 * Max DOM snapshot length for debugging (1000 chars)
 */
export const DOM_SNAPSHOT_MAX_LENGTH = 1_000

/**
 * Max stack trace length for error tracking (500 chars)
 */
export const STACK_TRACE_MAX_LENGTH = 500

/**
 * Google Consent Mode wait for update timeout (500 ms)
 */
export const CONSENT_WAIT_FOR_UPDATE_MS = 500

// =============================================================================
// Time Unit Conversions
// =============================================================================

/** Milliseconds per minute (60,000) */
export const MS_PER_MINUTE = 60_000

/** Milliseconds per hour (3,600,000) */
export const MS_PER_HOUR = 3_600_000

/** Milliseconds per day (86,400,000) */
export const MS_PER_DAY = 86_400_000

/** Seconds per minute (60) */
export const SECONDS_PER_MINUTE = 60

/** Seconds per hour (3,600) */
export const SECONDS_PER_HOUR = 3_600

// =============================================================================
// Z-Index Values
// =============================================================================

/** Z-index for modal overlays (9999) */
export const Z_INDEX_OVERLAY = 9999

/** Z-index for critical overlays like feature gates (99999) */
export const Z_INDEX_CRITICAL_OVERLAY = 99999

// =============================================================================
// API Key Expiry (seconds)
// =============================================================================

/** API key expiry: 1 day (86,400 seconds) */
export const API_KEY_EXPIRY_1_DAY = 86_400

/** API key expiry: 7 days (604,800 seconds) */
export const API_KEY_EXPIRY_7_DAYS = 604_800

/** API key expiry: 30 days (2,592,000 seconds) */
export const API_KEY_EXPIRY_30_DAYS = 2_592_000

/** API key expiry: 90 days (7,776,000 seconds) */
export const API_KEY_EXPIRY_90_DAYS = 7_776_000

/** API key expiry: 1 year (31,536,000 seconds) */
export const API_KEY_EXPIRY_1_YEAR = 31_536_000

// =============================================================================
// Web Vitals Thresholds (Google standards)
// =============================================================================

/** LCP (Largest Contentful Paint) "good" threshold (2500 ms) */
export const WEB_VITALS_LCP_GOOD_MS = 2_500

/** LCP (Largest Contentful Paint) "poor" threshold (4000 ms) */
export const WEB_VITALS_LCP_POOR_MS = 4_000

/** INP (Interaction to Next Paint) "good" threshold (200 ms) */
export const WEB_VITALS_INP_GOOD_MS = 200

/** INP (Interaction to Next Paint) "poor" threshold (500 ms) */
export const WEB_VITALS_INP_POOR_MS = 500

/** TTFB (Time to First Byte) "good" threshold (800 ms) */
export const WEB_VITALS_TTFB_GOOD_MS = 800

/** TTFB (Time to First Byte) "poor" threshold (1800 ms) */
export const WEB_VITALS_TTFB_POOR_MS = 1_800

// =============================================================================
// Security
// =============================================================================

/** Minimum password length (NIST SP 800-63B recommends 12+) */
export const MIN_PASSWORD_LENGTH = 12

// =============================================================================
// AI
// =============================================================================

/** Default context window for AI models (4096 tokens) */
export const DEFAULT_CONTEXT_WINDOW = 4_096

// =============================================================================
// Circuit Breaker (AWS/Resilience4j pattern)
// =============================================================================

/**
 * Circuit breaker failure threshold
 *
 * Number of failures in the window before circuit opens.
 */
export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5

/**
 * Circuit breaker failure window in milliseconds (10 seconds)
 *
 * Time window for counting failures.
 */
export const CIRCUIT_BREAKER_WINDOW_MS = 10_000

/**
 * Circuit breaker open duration in milliseconds (30 seconds)
 *
 * How long the circuit stays open before allowing a test request.
 */
export const CIRCUIT_BREAKER_OPEN_DURATION_MS = 30_000

// =============================================================================
// ETag Cache (HTTP conditional requests)
// =============================================================================

/**
 * Maximum ETag cache entries
 *
 * LRU eviction when exceeded.
 */
export const ETAG_CACHE_MAX_ENTRIES = 100

/**
 * ETag cache TTL in milliseconds (5 minutes)
 *
 * How long cached responses are valid.
 */
export const ETAG_CACHE_TTL_MS = 5 * 60 * 1000
