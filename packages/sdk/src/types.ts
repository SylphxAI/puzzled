/**
 * Platform SDK Types
 *
 * Type definitions for the SDK. Domain-specific types are re-exported from
 * their respective modules (SSOT). Additional UI/React types are defined here.
 *
 * ## Naming Conventions
 *
 * | Suffix | Purpose | Example |
 * |--------|---------|---------|
 * | `Input` | Function parameters | `SignInInput`, `TrackInput` |
 * | `Result` | SDK function return values | `SignInResult`, `TokenResult` |
 * | `Response` | API response payloads | `TokenResponse`, `ChatCompletionResponse` |
 * | `Options` | Optional function parameters | `FileUploadOptions`, `RevokeTokenOptions` |
 * | `Config` | Runtime configuration objects | `SylphxConfig`, `AnalyticsConfig` |
 *
 * ## Type Location Guidelines
 *
 * - **Domain types**: Defined in their module (auth.ts, analytics.ts, etc.)
 * - **Shared types**: Defined here in types.ts
 * - **React-specific**: Defined in react/services-context.ts or react/hooks.ts
 *
 * ## Sdk* Prefix (services-context.ts)
 *
 * Types prefixed with `Sdk` (e.g., `SdkUserProfile`) are SDK internal representations
 * with Date objects instead of ISO strings. API types use strings, SDK transforms to Date.
 */

// ==========================================
// Re-exports from Domain Modules (SSOT)
// ==========================================

// Consent types - SSOT: consent.ts
// Import for local use, then re-export
import type {
	ConsentType as ConsentTypeBase,
	UserConsent as UserConsentBase,
	ConsentCategory,
	SetConsentsInput,
	GetConsentsInput,
	LinkAnonymousConsentsInput,
	ConsentPurposeDefaults,
} from './consent'

export type {
	ConsentTypeBase as ConsentType,
	UserConsentBase as UserConsent,
	ConsentCategory,
	SetConsentsInput,
	GetConsentsInput,
	LinkAnonymousConsentsInput,
	ConsentPurposeDefaults,
}

// Webhook types - SSOT: webhooks.ts
// Import for local use, then re-export
import type {
	WebhookConfig as WebhookConfigBase,
	WebhookEnvironment as WebhookEnvironmentBase,
	WebhookDelivery as WebhookDeliveryBase,
	WebhookDeliveriesResult,
	WebhookStats as WebhookStatsBase,
	WebhookConfigUpdate,
	ListDeliveriesOptions,
} from './webhooks'

export type {
	WebhookConfigBase as WebhookConfig,
	WebhookEnvironmentBase as WebhookEnvironment,
	WebhookDeliveryBase as WebhookDelivery,
	WebhookDeliveriesResult,
	WebhookStatsBase as WebhookStats,
	WebhookConfigUpdate,
	ListDeliveriesOptions,
}

// Billing types - SSOT: billing.ts
export type { Plan, Subscription, CheckoutInput } from './billing'

// Storage types - SSOT: lib/storage/types.ts


// Feature Flags - SSOT: lib/flags/types.ts
export type { EvaluationReason } from './lib/flags/types'

// ==========================================
// AppConfig — Server-First SDK Configuration
// ==========================================
// Fetched once in Server Components via getAppConfig(), passed to SylphxProvider.
// This eliminates client-side config fetching and ensures instant, fresh data.

import type { Plan } from './billing'
import type { ConsentType } from './consent'

// Note: OAuthProviderId is defined below in OAuth Provider Types section

/**
 * OAuth provider with display info
 */
export interface OAuthProviderInfo {
	id: OAuthProviderId
	name: string
}

/**
 * Feature flag definition for client-side evaluation
 */
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
 * App metadata
 */
export interface AppMetadata {
	id: string
	name: string
	slug: string
}

/**
 * Complete app configuration — fetched server-side and passed to SylphxProvider.
 *
 * This is the Single Source of Truth for all SDK configuration data.
 * By fetching in Server Components, we get:
 * - Instant data on page load (no client-side loading states)
 * - Fresh data on every request (no staleTime tuning)
 * - Simpler architecture (no React Query for config)
 *
 * @example
 * ```tsx
 * // layout.tsx (Server Component)
 * import { getAppConfig } from '@sylphx/sdk/server'
 *
 * export default async function RootLayout({ children }) {
 *   const config = await getAppConfig({
 *     secretKey: process.env.SYLPHX_SECRET_KEY!,
 *     appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID!,
 *   })
 *
 *   return (
 *     <SylphxProvider config={config} appId={...}>
 *       {children}
 *     </SylphxProvider>
 *   )
 * }
 * ```
 */
export interface AppConfig {
	/** Available subscription plans */
	plans: Plan[]
	/** Consent types for GDPR/CCPA compliance */
	consentTypes: ConsentType[]
	/** Enabled OAuth providers */
	oauthProviders: OAuthProviderInfo[]
	/** Feature flag definitions for client-side evaluation */
	featureFlags: FeatureFlagDefinition[]
	/** App metadata */
	app: AppMetadata
	/** ISO timestamp when config was fetched */
	fetchedAt: string
}

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
// User Type Hierarchy
// ==========================================
//
// User Types at a Glance:
// - User           → Base type (cookie data, token responses)
// - AuthUser       → From auth.me() (adds twoFactorEnabled) — see services-context.ts
// - UserProfile    → Full profile (adds twoFactorEnabled, createdAt)
// - UserCookieData → Cookie wrapper (User + expiresAt)
//
// When to Use Which:
// - User: Client-side state, cookie hydration, token responses
// - AuthUser: After authentication, when you need 2FA status
// - UserProfile: Full account settings page
// ==========================================

/**
 * Base user type for SDK operations.
 *
 * Used in:
 * - Token responses (login, refresh)
 * - Cookie data for client hydration
 * - Basic user state in React context
 *
 * For authenticated user with security fields (twoFactorEnabled),
 * see AuthUser in services-context.ts.
 */
export interface User {
	id: string
	email: string
	name: string | null
	image: string | null
	emailVerified: boolean
	role?: string
	createdAt?: string
}

/**
 * User cookie data (JS-readable for client hydration)
 *
 * Single Source of Truth for the user cookie shape.
 * Used by both server-side (nextjs/cookies.ts) and client-side (react/storage-utils.ts).
 *
 * Note: This contains NO sensitive data.
 * Tokens are stored separately in HttpOnly cookies.
 */
export interface UserCookieData {
	user: User
	/** Timestamp when session expires (for client-side expiry check) */
	expiresAt: number
}

// ==========================================
// Token Types
// ==========================================

export interface TokenResponse {
	accessToken: string
	refreshToken: string
	expiresIn: number
	user: User
}

// Note: OAuth token response uses platform-specific shape, not SDK types

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
// User Profile Types
// ==========================================

/**
 * Full user profile from /user/profile endpoint.
 *
 * Includes all User fields plus:
 * - twoFactorEnabled: Security status for account settings
 * - createdAt: Required (vs optional in User)
 *
 * Use for account settings pages where full profile is needed.
 */
export interface UserProfile {
	id: string
	email: string
	name: string | null
	image: string | null
	emailVerified: boolean
	twoFactorEnabled: boolean
	createdAt: string
}

export interface SecuritySettings {
	twoFactorEnabled: boolean
	backupCodesRemaining: number
	passwordSet: boolean
	lastPasswordChange: string | null
}

export interface LoginHistoryEntry {
	id: string
	ipAddress: string | null
	userAgent: string | null
	location: string | null
	device: string | null
	browser: string | null
	os: string | null
	loginAt: string
	/** Whether login was successful (matches API field) */
	success: boolean
}

export interface DeviceSession {
	id: string
	device: string | null
	browser: string | null
	os: string | null
	ipAddress: string | null
	location: string | null
	lastActive: string
	current: boolean
}

// ==========================================
// Billing Types
// Note: Plan, Subscription, CheckoutInput are exported from billing.ts (SSOT)
// Note: getBillingBalance/getBillingUsage return inline types from billing.ts
// ==========================================

// ==========================================
// Referrals Types - SSOT: referrals.ts
// ==========================================

export type {
	ReferralStats,
} from './referrals'

// ==========================================
// Feature Flags Types
// Note: EvaluationReason is re-exported from lib/flags/types.ts at top of file
// ==========================================

// Import for local use in FeatureFlagDetailResult
import type { EvaluationReason } from './lib/flags/types'

export interface FeatureFlagDetailResult {
	enabled: boolean
	value: unknown
	reason: EvaluationReason
}

// ==========================================
// AI Types
// ==========================================
//
// Type Architecture:
// - Generated API types: AIUsageResponse, AIRateLimitResponse, AIModelsResponse, AIModel
//   → Re-exported from ai.ts (SSOT: generated/api.d.ts)
// - SDK pure function types: ChatInput, ChatResult, EmbedInput, EmbedResult, etc.
//   → Defined in ai.ts for the pure functions (chat, embed, chatStream, etc.)
// - React layer types: AIMessage, AITool, ChatCompletionResponse, AIModelInfo, etc.
//   → Defined here for services-context.ts and hooks (different shape for React)
//
// The React layer uses a different interface than the pure functions because
// it wraps the REST client (tRPC-like pattern) vs direct API calls.
// ==========================================

// Re-export generated types from ai.ts (SSOT)
// Note: AIModelsResponse is NOT re-exported here because the React layer uses AIListModelsResponse
// which has AIModelInfo[] (SDK type) instead of AIModel[] (generated type)
export type {
	AIUsageResponse,
	AIRateLimitResponse,
	AIModel,
} from './ai'

// SDK convenience types
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'groq' | 'together'
export type AIRequestType = 'chat' | 'completion' | 'embedding' | 'image' | 'vision' | 'audio' | 'tts'
export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool'

// React layer AI types (used by services-context.ts and ai-hooks.ts)
export interface AIMessage {
	role: AIMessageRole
	content: string
	name?: string
	tool_calls?: AIToolCall[]
	tool_call_id?: string
}

export interface AITool {
	type: 'function'
	function: {
		name: string
		description?: string
		parameters?: Record<string, unknown>
	}
}

export interface AIToolCall {
	id: string
	type: 'function'
	function: {
		name: string
		arguments: string
	}
}

export interface ChatCompletionInput {
	model?: string
	messages: AIMessage[]
	temperature?: number
	maxTokens?: number
	topP?: number
	stop?: string | string[]
	tools?: AITool[]
	toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
	stream?: boolean
	frequencyPenalty?: number
	presencePenalty?: number
}

export interface ChatCompletionResponse {
	id: string
	model: string
	choices: Array<{
		index: number
		message: AIMessage
		finishReason: string | null
	}>
	usage: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
}

export interface TextCompletionInput {
	model?: string
	prompt: string
	maxTokens?: number
	temperature?: number
	topP?: number
	stop?: string[]
}

export interface TextCompletionResponse {
	id: string
	model: string
	choices: Array<{
		index: number
		text: string
		finishReason: string | null
	}>
	usage: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
}

export interface EmbeddingInput {
	model?: string
	input: string | string[]
	dimensions?: number
}

export interface EmbeddingResponse {
	model: string
	embeddings: number[][]
	data: Array<{
		embedding: number[]
		index: number
	}>
	usage: {
		promptTokens: number
		totalTokens: number
	}
}

export interface VisionInput {
	model?: string
	messages: Array<{
		role: AIMessageRole
		content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
	}>
	maxTokens?: number
}

export interface AIStreamChunk {
	id: string
	model: string
	delta?: {
		content?: string
		tool_calls?: AIToolCall[]
	}
	finishReason?: string | null
	choices?: Array<{
		index: number
		delta: {
			content?: string
			tool_calls?: AIToolCall[]
		}
		finishReason: string | null
	}>
}

// React layer model info (different from generated AIModel - includes SDK-specific fields)
export interface AIModelInfo {
	id: string
	name: string
	description?: string
	provider: AIProvider
	capabilities: string[]
	contextWindow: number
	maxOutputTokens: number
	inputCostPer1M?: number
	outputCostPer1M?: number
}

export interface AIUsageStats {
	period: { start: string; end: string }
	totalRequests: number
	totalTokens: number
	totalCostMicrodollars: number
	byModel: Record<string, { requests: number; tokens: number; cost: number }>
}

export interface AIRateLimitInfo {
	requestsRemaining: number
	requestsLimit: number
	tokensRemaining: number
	tokensLimit: number
	resetAt: string
}

export interface AIListModelsOptions {
	provider?: AIProvider
	capability?: string
	search?: string
	limit?: number
	offset?: number
}

export interface AIListModelsResponse {
	models: AIModelInfo[]
	total: number
	hasMore: boolean
}

// ==========================================
// Jobs Types
// Note: Job/JobsListResult are defined in services-context.ts for React layer
// ==========================================

export type JobStatusEnum = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type JobTypeEnum = 'one-time' | 'cron'

// ==========================================
// Storage Types (Additional)
// Note: StorageFile and other core types are re-exported from lib/storage/types.ts
// ==========================================

// ==========================================
// Webhooks Types
// Note: WebhookConfig, WebhookDelivery, WebhookStats, etc. are exported from webhooks.ts (SSOT)
// ==========================================

// ==========================================
// Consent Types
// Note: ConsentType, UserConsent, SetConsentsInput, etc. are exported from consent.ts (SSOT)
// ==========================================

// ==========================================
// In-App Message Types
// ==========================================

export type InAppMessageType = 'info' | 'success' | 'warning' | 'error' | 'promotion' | 'announcement' | 'system' | 'action'
export type InAppMessagePriority = 'low' | 'normal' | 'high' | 'urgent'

export interface InAppMessageWithReadStatus {
	id: string
	type: InAppMessageType
	priority: InAppMessagePriority
	title: string
	body: string
	actionUrl: string | null
	actionText: string | null
	secondaryActionUrl?: string | null
	secondaryActionText?: string | null
	imageUrl: string | null
	icon?: string | null
	topic: string | null
	expiresAt: string | null
	createdAt: string
	/** Whether the message has been read (matches API field) */
	isRead: boolean
	readAt: string | null
	isDismissed?: boolean
}

// ==========================================
// Challenge / Step-up Auth Types
// Note: Challenge types are defined in auth service when needed
// ==========================================

// ==========================================
// Organizations Types - SSOT: orgs.ts
// Import types from orgs.ts if needed locally
// ==========================================

// ==========================================
// Input Types
// Note: Most input types are defined and exported from their respective modules:
// - TrackInput, PageInput, IdentifyInput from analytics.ts
// - CheckoutInput from billing.ts
// - PushSubscription from notifications.ts
// - FlagContext from flags.ts
// - FileUploadOptions from storage.ts
// ==========================================

// ==========================================
// Pagination Types
// ==========================================

export interface PaginationInput {
	limit?: number
	offset?: number
	cursor?: string
}

export interface PaginatedResponse<T> {
	items: T[]
	total: number
	hasMore: boolean
	nextCursor?: string
}

// ==========================================
// Response Types
// ==========================================

export interface SuccessResponse {
	success: boolean
	message?: string
}

export interface ErrorResponse {
	error: {
		code: string
		message: string
		details?: unknown
	}
}

// Jobs additional types
export interface ScheduleJobInput {
	name?: string
	callbackUrl: string
	payload?: unknown
	scheduledFor?: string
	delay?: number
	maxRetries?: number
	/**
	 * Idempotency key for safe retries (Stripe/Inngest pattern).
	 *
	 * When provided, prevents duplicate job execution if the same
	 * key is used within a 24-hour window. Useful for:
	 * - Network retry safety
	 * - At-most-once delivery guarantee
	 * - Webhook deduplication
	 */
	idempotencyKey?: string
}

export interface ScheduleJobResult {
	id: string
	jobId: string
	scheduledFor: string
	/** Whether this was a duplicate (idempotency key matched existing job) */
	duplicate?: boolean
}

export interface CreateCronInput {
	name?: string
	callbackUrl: string
	schedule?: string  // Either schedule or cron
	cron?: string      // Either schedule or cron
	payload?: unknown
	timezone?: string
	/**
	 * Idempotency key for safe cron creation (Stripe/Inngest pattern).
	 *
	 * When provided, prevents duplicate cron schedule creation if
	 * the same key is used. Useful for deployment scripts that
	 * may run multiple times.
	 */
	idempotencyKey?: string
}

export interface CreateCronResult {
	id: string
	scheduleId: string
	schedule: string
	nextRunAt: string
	/** Whether this was a duplicate (idempotency key matched existing cron) */
	duplicate?: boolean
}

export interface JobsStatusResult {
	enabled: boolean
	available: boolean
	quotaUsed: number
	quotaLimit: number
}

// Webhooks additional types (React layer)
// Note: Core types re-exported from webhooks.ts above
export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'delivered'
export type WebhookStatsPeriod = 'day' | 'week' | 'month'

/** Extended webhook config update for React context (includes regenerateSecret) */
export interface UpdateWebhookConfigInput {
	environmentId: string
	webhookUrl: string | null
	regenerateSecret?: boolean
	enabled?: boolean
	url?: string
	secret?: string
	events?: string[]
}

export interface UpdateWebhookConfigResult {
	success: boolean
	webhookUrl: string | null
	secretGenerated: boolean
	webhookSecret?: string
	config?: WebhookConfigBase
}

export interface ReplayDeliveryResult {
	success: boolean
	deliveryId: string
}

/** Extended delivery query options for React context */
export interface GetDeliveriesInput {
	limit?: number
	offset?: number
	status?: WebhookDeliveryStatus
	event?: string
	environmentId?: string
}

// Consent additional types (React layer)
// Note: Core types re-exported from consent.ts above
export interface SetConsentsResult {
	success: boolean
	consents: UserConsentBase[]
}

// Monitoring types
export type MonitoringLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal'

export interface CaptureExceptionResult {
	eventId: string
}

export interface CaptureMessageResult {
	eventId: string
}

// Auth types
export interface AuthLoginResult {
	requiresTwoFactor: boolean
	userId?: string
	accessToken?: string
	refreshToken?: string
	expiresIn?: number
	user?: User
}

export interface AuthRegisterResult {
	requiresVerification: boolean
	message: string
	user: {
		id: string
		email: string
		name: string | null
	}
}

export interface AuthVerify2FAResult {
	accessToken: string
	refreshToken: string
	expiresIn: number
	user: User
}

export interface AuthMeResult {
	id: string
	email: string
	name: string | null
	image: string | null
	emailVerified: boolean
	twoFactorEnabled: boolean
}

// User types
export interface UserSessionInfo {
	id: string
	device?: string | null
	deviceType?: string
	browser?: string | null
	os?: string | null
	ipAddress?: string | null
	location?: string | null
	country?: string
	city?: string
	lastActiveAt?: string
	isCurrent?: boolean
	createdAt?: string
}

export interface ConnectedAccount {
	provider: string
	accountId: string
	email: string | null
	name: string | null
	image: string | null
	connectedAt: string
}

// Security types
export interface TwoFactorStatus {
	enabled: boolean
	backupCodesRemaining: number
}

export interface TwoFactorSetupResult {
	secret: string
	qrCode: string
}

export interface TwoFactorVerifyResult {
	success: boolean
	backupCodes?: string[]
}

export interface PasskeyInfo {
	id: string
	name?: string
	deviceType?: string
	createdAt: string
	lastUsedAt: string | null
}

export interface SecurityScoreResult {
	score: number
	maxScore: number
	factors: Array<{
		name: string
		score: number
		maxScore: number
		recommendation?: string
	}>
}

export interface PasswordStatus {
	hasPassword: boolean
}

// AI additional types
export type AIUsagePeriod = 'day' | 'week' | 'month'

// Newsletter types
export interface NewsletterSubscribeInput {
	email: string
	name?: string
	preferences?: Record<string, boolean>
	source?: string
	metadata?: Record<string, unknown>
}

export interface NewsletterSubscribeResult {
	success: boolean
	requiresVerification: boolean
	message: string
	alreadySubscribed?: boolean
}

export interface NewsletterVerifyResult {
	success: boolean
	email: string
	message: string
}

export interface NewsletterUnsubscribeResult {
	success: boolean
	message: string
	email: string
}

export interface NewsletterUnsubscribeInfo {
	email: string
	name?: string
	subscribedAt?: string
	isUnsubscribed: boolean
}

// Can be either the structured format or a simple Record
export type NewsletterPreferences = Record<string, boolean>

// Email types
export interface SendEmailResult {
	success: boolean
	messageId?: string
}

export interface SendTemplatedResult {
	success: boolean
	template: string
}
