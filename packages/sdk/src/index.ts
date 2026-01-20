/**
 * @sylphx/platform-sdk
 *
 * SDK for integrating apps with the Sylphx Platform.
 *
 * @example
 * ```typescript
 * import { createSylphx } from '@sylphx/platform-sdk'
 *
 * const sylphx = createSylphx({
 *   appId: 'your-app-slug',
 *   appSecret: process.env.SYLPHX_APP_SECRET!,
 * })
 *
 * // Full type inference from server - no manual types
 * const user = await sylphx.user.getProfile.query()
 * const plans = await sylphx.billing.getPlans.query()
 * await sylphx.analytics.track.mutate({ event: 'purchase', properties: {} })
 * ```
 */

// Primary exports - new tRPC-based client with full type inference
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

// Error classes and utilities
export {
	SylphxError,
	NetworkError,
	TimeoutError,
	AuthenticationError,
	AuthorizationError,
	ValidationError,
	RateLimitError,
	NotFoundError,
	isSylphxError,
	isRetryableError,
	getErrorMessage,
	getErrorCode,
	toSylphxError,
	exponentialBackoff,
	RETRYABLE_CODES,
	ERROR_CODE_STATUS,
	type SylphxErrorCode,
	type SylphxErrorOptions,
} from './errors'

// Re-export tRPC type utilities for advanced usage
export type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

// Legacy exports for backward compatibility
// @deprecated Use createSylphx instead - will be removed in next major version
export { createPlatformAPI, createDynamicPlatformAPI } from './trpc'
export type {
	PlatformAPI,
	TRPCClientConfig,
	// Challenge types for step-up authentication
	ChallengeLevel,
	ChallengeRequirement,
	ChallengeStatus,
	IdentityMethod,
	MfaMethod,
} from './trpc'

// Re-export types from api-types
export type {
	User,
	Plan,
	Subscription,
	UserProfile,
	SecuritySettings,
	LoginHistoryEntry,
	ReferralStats,
	FeatureFlagResult,
	UploadedFile,
	TokenResponse,
	AccessTokenPayload,
	Organization,
	OrganizationMember,
	TrackEventInput,
	BatchEventsInput,
	IdentifyInput,
	UpdateProfileInput,
	ChangePasswordInput,
	CheckoutInput,
	RegisterPushInput,
	RedeemReferralInput,
	CheckFeatureFlagInput,
	UploadFileInput,
	PaginationInput,
	PaginatedResponse,
	SuccessResponse,
	ErrorResponse,
	// AI Types
	AIProvider,
	AIRequestType,
	AIMessage,
	AIMessageRole,
	AITool,
	AIToolCall,
	ChatCompletionInput,
	ChatCompletionResponse,
	TextCompletionInput,
	TextCompletionResponse,
	EmbeddingInput,
	EmbeddingResponse,
	ImageGenerationInput,
	ImageGenerationResponse,
	VisionInput,
	AudioTranscriptionInput,
	AudioTranscriptionResponse,
	TextToSpeechInput,
	AIUsageStats,
	AIStreamChunk,
	AIModelInfo,
	AIAppConfig,
	AIRateLimitInfo,
} from './types'
