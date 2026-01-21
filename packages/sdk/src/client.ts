/**
 * @sylphx/platform-sdk/client
 *
 * Type-safe client for the Sylphx Platform.
 *
 * ## Recommended: REST Client
 *
 * @example
 * ```typescript
 * import { createRestClient } from '@sylphx/platform-sdk/client'
 *
 * const client = createRestClient({
 *   appId: 'your-app-slug',
 *   appSecret: process.env.SYLPHX_APP_SECRET!,
 * })
 *
 * // Type-safe REST calls
 * const { data: plans } = await client.GET('/billing/plans')
 * const { data: user } = await client.GET('/auth/me')
 * const { data: result } = await client.POST('/auth/login', {
 *   body: { email, password }
 * })
 * ```
 *
 * ## Legacy: tRPC Client (being phased out)
 *
 * @example
 * ```typescript
 * import { createSylphx } from '@sylphx/platform-sdk/client'
 *
 * const sylphx = createSylphx({
 *   appId: 'your-app-slug',
 *   appSecret: process.env.SYLPHX_APP_SECRET!,
 * })
 *
 * // tRPC-style calls
 * const plans = await sylphx.billing.getPlans.query()
 * ```
 */

// =============================================================================
// REST Client (Recommended)
// =============================================================================

export {
	createRestClient,
	createDynamicRestClient,
	hasError,
	getRestErrorMessage,
	type RestClient,
	type DynamicRestClient,
	type RestClientConfig,
	type RestDynamicConfig,
	type RetryConfig,
	type paths as RestPaths,
} from './rest-client'

// =============================================================================
// tRPC Client (Legacy - being phased out)
// =============================================================================

/**
 * @deprecated Use `createRestClient` instead.
 */
export {
	createSylphx,
	createDynamicSylphx,
	isTRPCError,
	getTRPCErrorMessage,
	type SylphxClient,
	type SylphxClientConfig,
	type SylphxDynamicConfig,
	type AppRouter,
} from './trpc-client'

// Re-export tRPC type utilities for advanced usage
export type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

// Legacy exports for backward compatibility
// TODO: Remove in next major version
export {
	createPlatformAPI,
	createDynamicPlatformAPI,
	type PlatformAPI,
	type TRPCClientConfig,
	type ChallengeLevel,
	type ChallengeRequirement,
	type ChallengeStatus,
	type IdentityMethod,
	type MfaMethod,
} from './trpc'

// Re-export types needed for client usage
export type {
	// User & Auth types
	User,
	UserProfile,
	SecuritySettings,
	LoginHistoryEntry,
	TokenResponse,
	AccessTokenPayload,

	// Billing types
	Plan,
	Subscription,

	// Analytics types
	TrackEventInput,
	BatchEventsInput,
	IdentifyInput,

	// Feature flags
	FeatureFlagResult,

	// Storage
	UploadedFile,

	// Referrals
	ReferralStats,

	// Organizations
	Organization,
	OrganizationMember,

	// Common input/output types
	UpdateProfileInput,
	ChangePasswordInput,
	CheckoutInput,
	RegisterPushInput,
	RedeemReferralInput,
	CheckFeatureFlagInput,
	PaginationInput,
	PaginatedResponse,
	SuccessResponse,
	ErrorResponse,
} from './types'
