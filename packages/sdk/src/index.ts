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
 * // REST client for direct API access
 * import { createRestClient } from '@sylphx/sdk'
 *
 * const client = createRestClient({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 * })
 *
 * // Type-safe REST calls
 * const { data: plans } = await client.GET('/billing/plans')
 * const { data: user } = await client.GET('/auth/me')
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
	introspectToken,
	revokeToken,
	revokeAllTokens,
	type SignInInput,
	type SignInResult,
	type SignUpInput,
	type SignUpResult,
	type TokenResult,
	type SessionResult,
	type TokenIntrospectionResult,
	type RevokeTokenOptions,
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
	getSignedUrl,
	type FileUploadOptions,
	type UploadProgressEvent,
	type UploadResult,
	type FileInfo,
	type SignedUrlOptions,
	type SignedUrlResult,
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
	type JobStatus,
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
	// Runtime functions
	getConsentTypes,
	getUserConsents,
	setConsents,
	acceptAllConsents,
	declineOptionalConsents,
	linkAnonymousConsents,
	// Types
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

// =============================================================================
// Engagement Functions (Streaks, Leaderboards, Achievements)
// =============================================================================

export {
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
} from './engagement'

// =============================================================================
// Organization Functions
// =============================================================================

export {
	// CRUD
	getOrganizations,
	getOrganization,
	createOrganization,
	updateOrganization,
	deleteOrganization,
	// Members
	getOrganizationMembers,
	inviteOrganizationMember,
	updateOrganizationMemberRole,
	removeOrganizationMember,
	leaveOrganization,
	// Invitations
	getOrganizationInvitations,
	acceptOrganizationInvitation,
	revokeOrganizationInvitation,
	// Permission helpers
	hasRole,
	canManageMembers,
	canManageSettings,
	canDeleteOrganization,
	// Types
	type Organization,
	type OrganizationMember,
	type OrganizationInvitation,
	type OrganizationMembership,
	type OrgRole,
	type CreateOrgInput,
	type UpdateOrgInput,
	type InviteMemberInput,
} from './orgs'

// =============================================================================
// Secrets Functions
// =============================================================================

export {
	getSecret,
	getSecrets,
	listSecretKeys,
	hasSecret,
	getAllSecrets,
	type GetSecretInput,
	type GetSecretResult,
	type GetSecretsInput,
	type GetSecretsResult,
	type ListSecretKeysInput,
	type SecretKeyInfo,
} from './secrets'

// =============================================================================
// Vector Search Functions
// =============================================================================

export {
	indexDocument,
	batchIndex,
	search,
	deleteDocument,
	getSearchStats,
	listDocuments,
	type IndexDocumentInput,
	type IndexDocumentResult,
	type BatchIndexInput,
	type BatchIndexResult,
	type SearchInput,
	type SearchResult,
	type SearchResponse,
	type DeleteDocumentInput,
	type SearchStatsResult,
} from './search'

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
