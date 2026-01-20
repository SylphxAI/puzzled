/**
 * @sylphx/platform-sdk/client
 *
 * Type-safe client for the Sylphx Platform.
 * Uses tRPC with full type inference from the server.
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
 * // Full type inference - no manual types needed
 * const user = await sylphx.user.getProfile.query()
 * const plans = await sylphx.billing.getPlans.query()
 * await sylphx.analytics.track.mutate({ event: 'page_view', properties: {} })
 * ```
 */

// Primary exports - new tRPC-based client
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
