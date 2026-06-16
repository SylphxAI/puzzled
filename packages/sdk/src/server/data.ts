/**
 * Server-Side Data Fetching — Config & Platform Data
 *
 * Server-first configuration and data fetchers (OAuth providers, plans, consent
 * types, feature flags, app metadata, leaderboards, database connection). These
 * share the internal infrastructure in `./fetch` and are aggregated by
 * `getAppConfig()`, the recommended way to initialize the SDK.
 */

import type { OAuthProvider } from '@sylphx/ui'
import type { Plan } from '../billing'
import type { ConsentType } from '../consent'
import { DEFAULT_PLATFORM_URL, SDK_API_PATH } from '../constants'
import { validateAndSanitizeAppId } from '../key-validation'
import type { AppConfig, OAuthProviderInfo as OAuthProviderInfoType } from '../types'
import {
	type AuthenticatedFetchOptions,
	cachedFetch,
	type PublicFetchOptions,
	sanitizeOptions,
	sdkHeaders,
} from './fetch'

// ============================================================================
// OAuth Providers (Server-Side)
// ============================================================================

export type { OAuthProvider }

/** OAuth provider with display name */
export interface OAuthProviderInfo {
	id: OAuthProvider
	name: string
}

/**
 * Get enabled OAuth providers for an app (server-side)
 *
 * The App ID identifies the app via `X-App-Id` header.
 *
 * @example
 * ```tsx
 * const providers = await getOAuthProviders({
 *   appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 * })
 * ```
 */
export async function getOAuthProviders(options: PublicFetchOptions): Promise<OAuthProvider[]> {
	const data = await fetchOAuthProviders(options)
	return (data.providers || []).map((p) => p.id)
}

/**
 * Get enabled OAuth providers with full info (server-side)
 */
export async function getOAuthProvidersWithInfo(
	options: PublicFetchOptions,
): Promise<OAuthProviderInfo[]> {
	const data = await fetchOAuthProviders(options)
	return data.providers || []
}

/** Shared fetch for OAuth providers — App ID header identifies the app */
async function fetchOAuthProviders(
	options: PublicFetchOptions,
): Promise<{ providers: OAuthProviderInfo[] }> {
	const baseURL = (options.platformUrl ?? DEFAULT_PLATFORM_URL).trim()
	// Validate and sanitize App ID - logs warning if key contains whitespace
	const appId = validateAndSanitizeAppId(options.appId)

	return cachedFetch<{ providers: OAuthProviderInfo[] }>({
		url: `${baseURL}/api/auth/providers`,
		headers: { 'X-App-Id': appId },
		fallback: { providers: [] },
		label: 'OAuth providers',
	})
}

// ============================================================================
// Plans (Server-Side)
// ============================================================================

export type { Plan }

/**
 * Get subscription plans for an app (server-side)
 *
 * Note: Prefer using `getAppConfig()` which fetches all config in parallel.
 * This function is used internally by `getAppConfig()`.
 */
export async function getPlans(options: AuthenticatedFetchOptions): Promise<Plan[]> {
	const { secretKey, platformUrl = DEFAULT_PLATFORM_URL } = sanitizeOptions(options)

	return cachedFetch<Plan[]>({
		url: `${platformUrl}${SDK_API_PATH}/billing/plans`,
		headers: sdkHeaders(secretKey),
		fallback: [],
		label: 'plans',
	})
}

// ============================================================================
// Consent Types (Server-Side)
// ============================================================================

export type { ConsentType }

/**
 * Get consent types for an app (server-side)
 *
 * Note: Prefer using `getAppConfig()` which fetches all config in parallel.
 * This function is used internally by `getAppConfig()`.
 */
export async function getConsentTypes(options: AuthenticatedFetchOptions): Promise<ConsentType[]> {
	const { secretKey, platformUrl = DEFAULT_PLATFORM_URL } = sanitizeOptions(options)

	return cachedFetch<ConsentType[]>({
		url: `${platformUrl}${SDK_API_PATH}/consent/types`,
		headers: sdkHeaders(secretKey),
		fallback: [],
		label: 'consent types',
	})
}

// ============================================================================
// Feature Flags (Server-Side)
// ============================================================================

/** Feature flag definition for SSR */
export interface FeatureFlagDefinition {
	key: string
	name: string
	description: string | null
	enabled: boolean
	rolloutPercentage: number
	targetPremiumOnly: boolean
	targetAdminOnly: boolean
}

/**
 * Get feature flag definitions for an app (server-side)
 *
 * Returns flag definitions. Evaluation (rollout, targeting) happens
 * client-side using the LocalEvaluator with user context.
 *
 * @example
 * ```tsx
 * import { getFeatureFlags } from '@sylphx/sdk/server'
 *
 * export default async function RootLayout({ children }) {
 *   const flags = await getFeatureFlags({
 *     secretKey: process.env.SYLPHX_SECRET_KEY!,
 *   })
 *   return <FeatureFlagsProvider initialFlags={flags}>{children}</FeatureFlagsProvider>
 * }
 * ```
 */
export async function getFeatureFlags(
	options: AuthenticatedFetchOptions,
): Promise<FeatureFlagDefinition[]> {
	const { secretKey, platformUrl = DEFAULT_PLATFORM_URL } = sanitizeOptions(options)

	return cachedFetch<FeatureFlagDefinition[]>({
		url: `${platformUrl}${SDK_API_PATH}/flags`,
		headers: sdkHeaders(secretKey),
		fallback: [],
		label: 'feature flags',
	})
}

// ============================================================================
// App Metadata (Server-Side)
// ============================================================================

/** App metadata returned by /api/sdk/app */
export interface AppMetadata {
	id: string
	name: string
	slug: string
}

/**
 * Get app metadata (server-side)
 *
 * @internal Used by getAppConfig() - rarely called directly
 */
export async function getAppMetadata(options: AuthenticatedFetchOptions): Promise<AppMetadata> {
	const { secretKey, platformUrl = DEFAULT_PLATFORM_URL } = sanitizeOptions(options)

	return cachedFetch<AppMetadata>({
		url: `${platformUrl}${SDK_API_PATH}/app`,
		headers: sdkHeaders(secretKey),
		fallback: { id: '', name: '', slug: '' },
		label: 'app metadata',
	})
}

// ============================================================================
// AppConfig — Server-First Configuration
// ============================================================================
// The recommended way to initialize the SDK. Fetches all config data in parallel
// from Server Components, then passes it to SylphxProvider as a required prop.

export type { AppConfig }

/**
 * Options for getAppConfig()
 */
export interface GetAppConfigOptions {
	/** Secret key for authenticated endpoints (plans, flags, consent types) */
	secretKey: string
	/** App ID for public endpoints (OAuth providers) - identifies your app */
	appId: string
	/** Platform URL (defaults to https://sylphx.com) */
	platformUrl?: string
	/** Optional cache TTL in seconds. Default: 60 */
	revalidate?: number
}

/**
 * Get complete app configuration for the SDK (server-side)
 *
 * This is the **recommended** way to initialize the Sylphx SDK. It fetches all
 * configuration data in a single call from a Server Component, eliminating the
 * need for client-side config fetching and the associated loading states.
 *
 * Returns:
 * - plans: Subscription plans for billing
 * - consentTypes: GDPR/CCPA consent configuration
 * - oauthProviders: Enabled OAuth providers for auth
 * - featureFlags: Feature flag definitions for client-side evaluation
 * - app: App metadata (id, name, slug)
 * - fetchedAt: ISO timestamp for cache debugging
 *
 * @example
 * ```tsx
 * // app/layout.tsx (Server Component)
 * import { getAppConfig } from '@sylphx/sdk/server'
 *
 * export default async function RootLayout({ children }) {
 *   const config = await getAppConfig({
 *     secretKey: process.env.SYLPHX_SECRET_KEY!,
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *   })
 *
 *   return (
 *     <html>
 *       <body>
 *         <SylphxProvider
 *           config={config}
 *           appId={process.env.NEXT_PUBLIC_SYLPHX_APP_ID!}
 *         >
 *           {children}
 *         </SylphxProvider>
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 */
export async function getAppConfig(options: GetAppConfigOptions): Promise<AppConfig> {
	const { secretKey, appId, platformUrl } = options

	// Fetch all config data in parallel for optimal performance
	const [plans, consentTypes, oauthProviders, featureFlags, app] = await Promise.all([
		getPlans({ secretKey, platformUrl }),
		getConsentTypes({ secretKey, platformUrl }),
		getOAuthProvidersWithInfo({ appId, platformUrl }),
		getFeatureFlags({ secretKey, platformUrl }),
		getAppMetadata({ secretKey, platformUrl }),
	])

	return {
		plans,
		consentTypes,
		oauthProviders: oauthProviders as OAuthProviderInfoType[],
		featureFlags,
		app,
		fetchedAt: new Date().toISOString(),
	}
}

// ============================================================================
// Referral Leaderboard (Server-Side)
// ============================================================================

/** Referral leaderboard entry */
export interface ReferralLeaderboardEntry {
	rank: number
	userId: string
	/** Masked username for privacy */
	name: string
	/** Number of successful referrals */
	referrals: number
	isCurrentUser: boolean
}

/** Referral leaderboard result */
export interface ReferralLeaderboardResult {
	entries: ReferralLeaderboardEntry[]
	total: number
	period: 'all' | 'month' | 'week'
}

/**
 * Get referral leaderboard for an app (server-side)
 *
 * @example
 * ```tsx
 * import { getReferralLeaderboard } from '@sylphx/sdk/server'
 *
 * export default async function ReferralsPage() {
 *   const leaderboard = await getReferralLeaderboard({
 *     secretKey: process.env.SYLPHX_SECRET_KEY!,
 *     limit: 10,
 *     period: 'month',
 *   })
 *   return <ReferralLeaderboard initialData={leaderboard} />
 * }
 * ```
 */
export async function getReferralLeaderboard(
	options: AuthenticatedFetchOptions & {
		limit?: number
		period?: 'all' | 'month' | 'week'
	},
): Promise<ReferralLeaderboardResult> {
	const {
		secretKey,
		platformUrl = DEFAULT_PLATFORM_URL,
		limit = 10,
		period = 'all',
	} = sanitizeOptions(options)

	const url = new URL(`${platformUrl}${SDK_API_PATH}/referrals/leaderboard`)
	url.searchParams.set('limit', String(limit))
	url.searchParams.set('period', period)

	return cachedFetch<ReferralLeaderboardResult>({
		url: url.toString(),
		headers: sdkHeaders(secretKey),
		fallback: { entries: [], total: 0, period },
		label: 'referral leaderboard',
	})
}

// ============================================================================
// Engagement Leaderboard (Server-Side)
// ============================================================================

/** Engagement leaderboard entry */
export interface EngagementLeaderboardEntry {
	rank: number
	userId: string
	name: string
	score: number
	isCurrentUser: boolean
}

/** Engagement leaderboard result */
export interface EngagementLeaderboardResult {
	leaderboardId: string
	entries: EngagementLeaderboardEntry[]
	period: string
	resetTime: string | null
	userEntry: EngagementLeaderboardEntry | null
}

/**
 * Get engagement leaderboard for an app (server-side)
 *
 * @example
 * ```tsx
 * import { getEngagementLeaderboard } from '@sylphx/sdk/server'
 *
 * export default async function LeaderboardPage() {
 *   const leaderboard = await getEngagementLeaderboard({
 *     secretKey: process.env.SYLPHX_SECRET_KEY!,
 *     leaderboardId: 'high-scores',
 *   })
 *   return <Leaderboard initialData={leaderboard} />
 * }
 * ```
 */
export async function getEngagementLeaderboard(
	options: AuthenticatedFetchOptions & {
		leaderboardId: string
		limit?: number
	},
): Promise<EngagementLeaderboardResult> {
	const {
		secretKey,
		leaderboardId,
		platformUrl = DEFAULT_PLATFORM_URL,
		limit = 10,
	} = sanitizeOptions(options)

	const url = new URL(
		`${platformUrl}${SDK_API_PATH}/engagement/leaderboards/${encodeURIComponent(leaderboardId)}`,
	)
	url.searchParams.set('limit', String(limit))

	return cachedFetch<EngagementLeaderboardResult>({
		url: url.toString(),
		headers: sdkHeaders(secretKey),
		fallback: {
			leaderboardId,
			entries: [],
			period: 'all',
			resetTime: null,
			userEntry: null,
		},
		label: 'engagement leaderboard',
	})
}

// ============================================================================
// Database Connection (Server-Side)
// ============================================================================

/** Database connection info returned by Platform */
export interface DatabaseConnectionInfo {
	connectionString: string
	databaseName: string
	roleName: string | null
	status: 'provisioning' | 'ready' | 'suspended' | 'failed' | 'deleted'
}

/** Database status info */
export interface DatabaseStatusInfo {
	status: 'provisioning' | 'ready' | 'suspended' | 'failed' | 'deleted' | 'not_provisioned'
	region: string | null
	pgVersion: number | null
	databaseName: string | null
}

/**
 * Get database connection string from Platform (server-side)
 *
 * Use this when your app's database is provisioned by the Sylphx Platform.
 * The connection string is securely stored on Platform and retrieved at startup.
 *
 * **Note:** This requires NEON_API_KEY and PLATFORM_ENCRYPTION_KEY to be
 * configured on the Platform, and your app's database to be provisioned.
 *
 * @example
 * ```typescript
 * import { getDatabaseConnection } from '@sylphx/sdk/server'
 *
 * // In your database initialization
 * const dbInfo = await getDatabaseConnection({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 *
 * if (dbInfo) {
 *   const pool = new Pool({ connectionString: dbInfo.connectionString })
 * }
 * ```
 */
export async function getDatabaseConnection(
	options: AuthenticatedFetchOptions,
): Promise<DatabaseConnectionInfo | null> {
	const { secretKey, platformUrl = DEFAULT_PLATFORM_URL } = sanitizeOptions(options)

	try {
		const response = await fetch(`${platformUrl}${SDK_API_PATH}/database/connection-string`, {
			headers: sdkHeaders(secretKey),
			cache: 'no-store', // Always fetch fresh connection string
		})

		if (!response.ok) {
			// 404 means database not provisioned - return null
			if (response.status === 404) {
				return null
			}
			// 412 means database not ready (provisioning, suspended, failed)
			if (response.status === 412) {
				console.warn('[Sylphx] Database not ready:', await response.text())
				return null
			}
			console.warn('[Sylphx] Failed to fetch database connection:', response.status)
			return null
		}

		return (await response.json()) as DatabaseConnectionInfo
	} catch (error) {
		console.warn('[Sylphx] Failed to fetch database connection:', error)
		return null
	}
}

/**
 * Get database status from Platform (server-side)
 *
 * Use this to check if your app's database is provisioned and ready.
 *
 * @example
 * ```typescript
 * import { getDatabaseStatus } from '@sylphx/sdk/server'
 *
 * const status = await getDatabaseStatus({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 *
 * if (status?.status === 'ready') {
 *   // Database is ready to use
 * }
 * ```
 */
export async function getDatabaseStatus(
	options: AuthenticatedFetchOptions,
): Promise<DatabaseStatusInfo> {
	const { secretKey, platformUrl = DEFAULT_PLATFORM_URL } = sanitizeOptions(options)

	return cachedFetch<DatabaseStatusInfo>({
		url: `${platformUrl}${SDK_API_PATH}/database/status`,
		headers: sdkHeaders(secretKey),
		fallback: {
			status: 'not_provisioned',
			region: null,
			pgVersion: null,
			databaseName: null,
		},
		label: 'database status',
	})
}
