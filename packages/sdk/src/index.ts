/**
 * @sylphx/sdk
 *
 * State-of-the-art platform SDK with pure functions.
 *
 * ## Architecture (see ADR.md for full details)
 *
 * This SDK follows Firebase's architecture pattern:
 * - **Pure functions** - No hidden state, config passed explicitly
 * - **Tree-shakeable** - Import only what you use, bundler removes the rest
 * - **4 entry points only** - Separate only when peer dependencies differ
 *
 * ## Entry Points
 *
 * | Entry | Purpose | Peer Dependencies |
 * |-------|---------|-------------------|
 * | `@sylphx/sdk` | All pure functions | None |
 * | `@sylphx/sdk/react` | React hooks & components | react, react-dom |
 * | `@sylphx/sdk/server` | Server utilities (JWT, webhooks) | jose |
 * | `@sylphx/sdk/nextjs` | Next.js integration | next |
 *
 * ## Usage
 *
 * @example
 * ```typescript
 * // Pure functions - tree-shakeable, works anywhere
 * import { createConfig, track, signIn, getPlans } from '@sylphx/sdk'
 *
 * const config = createConfig({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 * })
 *
 * // Analytics
 * await track(config, { event: 'purchase', properties: { amount: 99 } })
 *
 * // Auth
 * const result = await signIn(config, { email, password })
 *
 * // Billing
 * const plans = await getPlans(config)
 * ```
 *
 * @example
 * ```typescript
 * // tRPC client - full type inference from server
 * import { createSylphx } from '@sylphx/sdk'
 *
 * const sylphx = createSylphx({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 * })
 *
 * // Full autocomplete from server types
 * const user = await sylphx.user.getProfile.query()
 * const plans = await sylphx.billing.getPlans.query()
 * ```
 */

// =============================================================================
// Configuration (Foundation)
// =============================================================================

export {
	createConfig,
	createPlatformConfig,
	withToken,
	type SylphxConfig,
	type SylphxConfigInput,
} from './config'

// =============================================================================
// tRPC Client (Full Type Inference)
// =============================================================================

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

// Legacy tRPC exports (deprecated, will be removed in v1.0)
export { createPlatformAPI, createDynamicPlatformAPI } from './trpc'
export type {
	PlatformAPI,
	TRPCClientConfig,
	ChallengeLevel,
	ChallengeRequirement,
	ChallengeStatus,
	IdentityMethod,
	MfaMethod,
} from './trpc'

// =============================================================================
// Error Handling
// =============================================================================

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

// =============================================================================
// Auth Functions
// =============================================================================

export {
	signIn,
	signUp,
	signOut,
	refreshToken,
	verifyEmail,
	forgotPassword,
	resetPassword,
	getSession,
	verifyTwoFactor,
	type SignInInput,
	type SignInResult,
	type SignUpInput,
	type SignUpResult,
	type TokenResult,
	type SessionResult,
} from './auth'

// =============================================================================
// Analytics Functions
// =============================================================================

export {
	track,
	page,
	identify,
	trackBatch,
	generateAnonymousId,
	createTracker,
	type TrackInput,
	type PageInput,
	type IdentifyInput,
	type BatchEvent,
} from './analytics'

// Analytics Code First (Event Schemas)
export {
	defineEvent,
	defineEventCategory,
	createAnalyticsSchema,
	hashAnalyticsSchema,
	presetEvents,
	presetCategories,
	createTypedTracker,
	type PropertyType,
	type PropertyDefinition,
	type EventCategory,
	type EventDefinition,
	type EventCategoryDefinition,
	type AnalyticsSchema,
	type AnalyticsSchemaInput,
	type ExtractEventNames,
	type TypedTracker,
} from './lib/analytics'

// =============================================================================
// AI Functions
// =============================================================================

export {
	chat,
	chatStream,
	embed,
	complete,
	streamToString,
	type ChatMessage,
	type ContentPart,
	type ToolCall,
	type Tool,
	type ChatInput,
	type ChatResult,
	type ChatStreamChunk,
	type EmbedInput,
	type EmbedResult,
} from './ai'

// =============================================================================
// Billing Functions
// =============================================================================

export {
	getPlans,
	getSubscription,
	createCheckout,
	createPortalSession,
	getBillingBalance,
	getBillingUsage,
	type Plan,
	type Subscription,
	type CheckoutInput,
} from './billing'

// =============================================================================
// Storage Functions
// =============================================================================

export {
	uploadFile,
	uploadAvatar,
	deleteFile,
	getFileUrl,
	getFileInfo,
	type UploadOptions,
	type UploadProgressEvent,
	type UploadResult,
	type FileInfo,
} from './storage'

// =============================================================================
// Notifications Functions
// =============================================================================

export {
	registerPush,
	unregisterPush,
	sendPush,
	getPushPreferences,
	updatePushPreferences,
	type PushSubscription,
	type PushNotification,
} from './notifications'

// =============================================================================
// Jobs Functions
// =============================================================================

export {
	scheduleJob,
	getJob,
	cancelJob,
	listJobs,
	createCron,
	pauseCron,
	resumeCron,
	deleteCron,
	type JobInput,
	type JobResult,
	type CronInput,
	type CronSchedule,
} from './jobs'

// =============================================================================
// Feature Flags Functions
// =============================================================================

export {
	checkFlag,
	getFlags,
	isEnabled,
	getVariant,
	getFlagPayload,
	type FlagResult,
	type FlagContext,
} from './flags'

// Feature Flags Code First (Flag Definitions)
export {
	defineBooleanFlag,
	defineStringFlag,
	defineNumberFlag,
	defineJsonFlag,
	defineVariantFlag,
	defineFlag,
	createFlagsConfig,
	hashFlagsConfig,
	presetFlags,
	createTypedFlags,
	type FlagType,
	type FlagCategory,
	type BooleanFlagDefinition,
	type StringFlagDefinition,
	type NumberFlagDefinition,
	type JsonFlagDefinition,
	type VariantFlagDefinition,
	type AnyFlagDefinition,
	type FlagsConfig,
	type ExtractFlagKeys,
	type TypedFlags,
} from './lib/flags'

// =============================================================================
// Webhooks Functions
// =============================================================================

export {
	getWebhookDeliveries,
	getWebhookDelivery,
	type WebhookDelivery,
	type WebhookDeliveriesResult,
} from './webhooks'

// =============================================================================
// Email Functions
// =============================================================================

export {
	sendEmail,
	sendTemplatedEmail,
	sendEmailToUser,
	scheduleEmail,
	cancelScheduledEmail,
	rescheduleEmail,
	listScheduledEmails,
	getScheduledEmail,
	getScheduledEmailStats,
	isEmailConfigured,
	type SendEmailOptions,
	type SendTemplatedEmailOptions,
	type SendToUserOptions,
	type ScheduleEmailOptions,
	type ScheduledEmail,
	type ScheduledEmailsResult,
	type ScheduledEmailStats,
	type ListScheduledEmailsOptions,
	type SendResult,
} from './email'

// =============================================================================
// Consent Functions (GDPR/CCPA)
// =============================================================================

export {
	// Config builders (Code First)
	defineConsentPurpose,
	createConsentConfig,
	hashConsentConfig,
	presetPurposes,
	// Runtime functions
	getConsentTypes,
	getUserConsents,
	setConsents,
	acceptAllConsents,
	declineOptionalConsents,
	linkAnonymousConsents,
	syncConsentConfig,
	// Types
	type ConsentCategory,
	type ConsentPurposeDefinition,
	type ConsentConfig,
	type ConsentConfigInput,
	type ConsentType,
	type UserConsent,
	type SetConsentsInput,
	type GetConsentsInput,
	type LinkAnonymousConsentsInput,
} from './consent'

// =============================================================================
// Referrals Functions
// =============================================================================

export {
	getMyReferralCode,
	getReferralStats,
	redeemReferralCode,
	getReferralLeaderboard,
	regenerateReferralCode,
	type ReferralCode,
	type ReferralStats,
	type RedeemReferralInput,
	type RedeemResult,
	type LeaderboardEntry,
	type LeaderboardResult,
	type LeaderboardOptions,
} from './referrals'
// Note: Referrals is Console First - config managed in dashboard, not code

// =============================================================================
// Engagement Functions (Streaks, Leaderboards, Achievements)
// =============================================================================

export {
	// Config builders (Code First)
	defineStreak,
	defineLeaderboard,
	defineAchievement,
	defineAchievementCategory,
	createEngagementConfig,
	hashEngagementConfig,
	// Streak functions
	getStreak,
	getAllStreaks,
	recordStreakActivity,
	recoverStreak,
	// Leaderboard functions
	getLeaderboard,
	submitScore,
	getUserLeaderboardRank,
	// Achievement functions
	getAchievements,
	getAchievement,
	unlockAchievement,
	incrementAchievementProgress,
	getAchievementPoints,
	// Config sync (internal)
	syncEngagementConfig,
	// Constants
	ACHIEVEMENT_TIER_CONFIG,
	// Types
	type StreakDefinition,
	type StreakState,
	type StreakFrequency,
	type RecordActivityInput,
	type RecordActivityResult,
	type LeaderboardDefinition,
	type LeaderboardEntry as EngagementLeaderboardEntry,
	type LeaderboardResult as EngagementLeaderboardResult,
	type LeaderboardQueryOptions,
	type LeaderboardSortDirection,
	type LeaderboardResetPeriod,
	type LeaderboardAggregation,
	type SubmitScoreInput,
	type SubmitScoreResult,
	type AchievementDefinition,
	type AchievementType,
	type AchievementTier,
	type AchievementCategory,
	type AchievementCriteria,
	type AchievementCriterion,
	type CriteriaOperator,
	type UserAchievement,
	type AchievementUnlockEvent,
	type EngagementConfig,
	type EngagementConfigInput,
	type AchievementCategoryInput,
} from './engagement'

// =============================================================================
// Common Types (re-exported from types.ts)
// =============================================================================

export type {
	// User & Auth
	User,
	UserProfile,
	SecuritySettings,
	LoginHistoryEntry,
	AccessTokenPayload,
	TokenResponse,
	// Organizations
	Organization,
	OrganizationMember,
	// Storage
	UploadedFile,
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
	// Common
	PaginationInput,
	PaginatedResponse,
	SuccessResponse,
	ErrorResponse,
} from './types'

// Re-export tRPC type utilities for advanced usage
export type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
