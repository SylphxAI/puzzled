/**
 * Platform SDK Essential Types
 *
 * Only types that are NOT derivable from the tRPC router.
 * All other types should be inferred using inferRouterOutputs<AppRouter>.
 *
 * @see trpc.ts for router-derived types
 */

// ==========================================
// OAuth Provider Types
// ==========================================

export const OAUTH_PROVIDERS = [
	'google',
	'github',
	'apple',
	'microsoft',
	'facebook',
	'twitter',
	'discord',
	'linkedin',
	'slack',
	'gitlab',
	'bitbucket',
	'twitch',
	'spotify',
] as const

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]

// ==========================================
// Core User Type
//
// Used for auth state in React provider.
// This shape is specific to the SDK, not from tRPC.
// ==========================================

export interface User {
	id: string
	email: string
	name: string | null
	image: string | null
	emailVerified: boolean
	role?: string
	createdAt?: string
}

// ==========================================
// Token Types
//
// Used for auth flows (token exchange, refresh).
// These shapes are specific to the OAuth token endpoint.
// ==========================================

export interface TokenResponse {
	accessToken: string
	refreshToken: string
	expiresIn: number
	user: User
}

export interface TokenResponseOAuth {
	access_token: string
	refresh_token: string
	token_type: 'Bearer'
	expires_in: number
	user: {
		id: string
		email: string
		name: string | null
		image: string | null
	}
}

export interface AccessTokenPayload {
	sub: string
	email: string
	name?: string
	picture?: string
	email_verified: boolean
	app_id: string
	role?: string
	iat: number
	exp: number
}

// ==========================================
// Re-exports from trpc.ts (for backward compat)
//
// These are all derived from AppRouter now.
// ==========================================

export type {
	// User & Profile
	UserProfile,
	SecuritySettings,
	LoginHistoryEntry,
	DeviceSession,
	// Billing
	Plan,
	Subscription,
	BillingBalance,
	BillingUsage,
	// Referrals
	ReferralStats,
	LeaderboardResult,
	LeaderboardPeriod,
	// Feature Flags
	FeatureFlagResult,
	FeatureFlagDetailResult,
	EvaluationReason,
	// AI Output Types
	AIUsageStats,
	AIRateLimitStatus,
	AIModelsResponse,
	// AI SDK Types
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
	AIStreamChunk,
	AIModelInfo,
	AIAppConfig,
	AIRateLimitInfo,
	AIListModelsOptions,
	AIListModelsResponse,
	// Jobs
	JobStatusEnum as JobStatus,
	Job,
	JobsListResult as JobsList,
	// Storage
	StorageFile,
	StorageUsage,
	UploadedFile,
	// Webhooks
	WebhookConfig,
	WebhookDeliveriesResult as WebhookDeliveries,
	WebhookStats,
	// Consent
	ConsentType,
	UserConsent,
	// In-App Messages
	InAppMessageType,
	InAppMessagePriority,
	InAppMessageWithReadStatus,
	// Challenge
	ChallengeLevel,
	ChallengeRequirement,
	ChallengeStatus,
	IdentityMethod,
	MfaMethod,
	// Organizations
	Organization,
	OrganizationMember,
	OrgRole,
	// Input Types
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
	// Mobile Push Types (API types - for SDK consumers, use types from platform-context.ts)
	RegisterMobileDeviceInput,
	// Note: MobilePushPreferences and MobilePushConfig are SDK-specific types
	// exported from react/platform-context.ts, not the raw API types
	// Utility Types
	PaginationInput,
	PaginatedResponse,
	SuccessResponse,
	ErrorResponse,
} from './trpc'
