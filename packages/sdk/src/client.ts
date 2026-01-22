/**
 * @sylphx/sdk/client
 *
 * Type-safe REST client for the Sylphx Platform.
 *
 * @example
 * ```typescript
 * import { createRestClient } from '@sylphx/sdk/client'
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
 */

// =============================================================================
// REST Client
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
// Types
// =============================================================================

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
