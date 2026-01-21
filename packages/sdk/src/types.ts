/**
 * Platform SDK Types
 *
 * Type definitions for the SDK. Domain-specific types are re-exported from
 * their respective modules (SSOT). Additional UI/React types are defined here.
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
// Note: CheckoutInput is also exported directly from billing.ts
export type { Plan, Subscription } from './billing'

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
// User Profile Types
// ==========================================

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
	successful: boolean
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
// ==========================================

export interface BillingBalance {
	current: number
	currentFormatted: string
}

export interface BillingUsage {
	period: { type: string; start: string; end: string }
	metrics: {
		aiCostMicrodollars: number
		storageBytesUsed: number
		storageEgressBytes: number
		storageUploads: number
		dbStorageBytes: number
		dbComputeSeconds: number
		emailSentCount: number
		jobInvocationCount: number
		cronActiveCount: number
		pushSentCount?: number
		analyticsEventCount: number
		webhookDeliveryCount: number
		errorEventCount: number
		authMau: number
	} | null
}

// ==========================================
// Referrals Types
// ==========================================

export interface ReferralStats {
	code: string
	totalReferrals: number
	completedReferrals: number
	pendingReferrals: number
	totalRewards: number
	rewardsEarned: number
}

export interface LeaderboardResult {
	period: 'all' | 'month' | 'week'
	entries: LeaderboardEntry[]
	currentUserRank: number | null
}

export interface LeaderboardEntry {
	rank: number
	userId: string | null
	displayName: string
	avatarUrl: string | null
	completedReferrals: number
	totalReferrals: number
	isCurrentUser: boolean
}

export type LeaderboardPeriod = 'all' | 'month' | 'week'

// ==========================================
// Feature Flags Types
// ==========================================

export interface FeatureFlagResult {
	enabled: boolean
	value: unknown
}

export interface FeatureFlagDetailResult {
	enabled: boolean
	value: unknown
	reason: EvaluationReason
}

export type EvaluationReason =
	| 'flag_not_found'
	| 'targeting_match'
	| 'default_value'
	| 'percentage_rollout'
	| 'error'
	| { rolloutBucket?: number; [key: string]: unknown }

// ==========================================
// AI Types
// ==========================================

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'groq' | 'together'
export type AIRequestType = 'chat' | 'completion' | 'embedding' | 'image' | 'vision' | 'audio' | 'tts'
export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool'

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

export interface ImageGenerationInput {
	model?: string
	prompt: string
	n?: number
	size?: string
	quality?: string
	style?: string
}

export interface ImageGenerationResponse {
	created: number
	data: Array<{
		url?: string
		b64_json?: string
		revised_prompt?: string
	}>
}

export interface VisionInput {
	model?: string
	messages: Array<{
		role: AIMessageRole
		content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>
	}>
	maxTokens?: number
}

export interface AudioTranscriptionInput {
	model?: string
	file: Blob
	language?: string
	prompt?: string
	responseFormat?: string
}

export interface AudioTranscriptionResponse {
	text: string
	language?: string
	duration?: number
	words?: Array<{
		word: string
		start: number
		end: number
	}>
}

export interface TextToSpeechInput {
	model?: string
	input: string
	voice?: string
	speed?: number
	responseFormat?: string
}

export interface AIStreamChunk {
	id: string
	model: string
	// Direct delta (OpenAI format)
	delta?: {
		content?: string
		tool_calls?: AIToolCall[]
	}
	finishReason?: string | null
	// Choices array format (also OpenAI compatible)
	choices?: Array<{
		index: number
		delta: {
			content?: string
			tool_calls?: AIToolCall[]
		}
		finishReason: string | null
	}>
}

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

export interface AIAppConfig {
	enabled: boolean
	providers: AIProvider[]
	defaultModel: string
	rateLimits: {
		requestsPerMinute: number
		tokensPerMinute: number
	}
}

export interface AIRateLimitInfo {
	requestsRemaining: number
	requestsLimit: number
	tokensRemaining: number
	tokensLimit: number
	resetAt: string
}

export interface AIUsageStats {
	period: { start: string; end: string }
	totalRequests: number
	totalTokens: number
	totalCostMicrodollars: number
	byModel: Record<string, { requests: number; tokens: number; cost: number }>
}

export interface AIRateLimitStatus {
	requestsRemaining: number
	requestsLimit: number
	tokensRemaining: number
	tokensLimit: number
	resetAt: string
}

export interface AIModelsResponse {
	models: AIModelInfo[]
	total: number
	hasMore: boolean
}

export interface AIListModelsOptions {
	provider?: AIProvider
	capability?: string
	search?: string
	limit?: number
	offset?: number
}

export type AIListModelsResponse = AIModelsResponse

// ==========================================
// Jobs Types
// ==========================================

export type JobStatusEnum = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type JobTypeEnum = 'one-time' | 'cron'

export interface Job {
	id: string
	name: string | null
	type: JobTypeEnum
	status: JobStatusEnum
	callbackUrl: string
	payload?: unknown
	scheduledFor: string | null
	startedAt?: string | null
	completedAt?: string | null
	failedAt?: string | null
	errorMessage?: string | null
	retries: number
	maxRetries: number
	createdAt: string
}

export interface JobsListResult {
	jobs: Job[]
	total: number
	limit?: number
	offset?: number
	hasMore?: boolean
}

// ==========================================
// Storage Types
// ==========================================

export interface StorageFile {
	id: string
	name: string
	size: number
	mimeType: string
	url: string
	createdAt: string
}

export interface StorageUsage {
	bytesUsed: number
	bytesLimit: number
	fileCount: number
}

export interface UploadedFile {
	id: string
	url: string
	name: string
	size: number
	mimeType: string
}

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
	read: boolean
	isRead: boolean
	readAt: string | null
	isDismissed?: boolean
}

// ==========================================
// Challenge / Step-up Auth Types
// ==========================================

export type ChallengeLevel = 'low' | 'medium' | 'high' | 'critical'
export type ChallengeRequirement = 'password' | 'totp' | 'passkey' | 'email_code'
export type ChallengeStatus = 'pending' | 'verified' | 'expired' | 'failed'
export type IdentityMethod = 'password' | 'totp' | 'passkey' | 'email_code' | 'oauth'
export type MfaMethod = 'totp' | 'passkey' | 'email_code'

// ==========================================
// Organizations Types
// ==========================================

export interface Organization {
	id: string
	name: string
	slug: string
	image: string | null
	logoUrl: string | null
	createdAt: string
}

export interface OrganizationMember {
	id: string
	userId: string
	orgId: string
	role: OrgRole
	joinedAt: string
	// Flattened user properties for convenience
	name: string | null
	email: string
	image: string | null
	// Also keep nested user object for backward compatibility
	user: {
		id: string
		name: string | null
		email: string
		image: string | null
	}
}

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer' | 'developer' | 'analytics' | 'billing' | 'super_admin'

// ==========================================
// Input Types
// ==========================================

export interface TrackEventInput {
	event: string
	properties?: Record<string, unknown>
	timestamp?: string
	userId?: string
	anonymousId?: string
}

export interface BatchEventsInput {
	events: TrackEventInput[]
}

export interface IdentifyInput {
	userId: string
	traits?: Record<string, unknown>
	anonymousId?: string
}

export interface UpdateProfileInput {
	name?: string
	image?: string
}

export interface ChangePasswordInput {
	currentPassword: string
	newPassword: string
}

export interface CheckoutInput {
	planSlug: string
	interval: 'monthly' | 'annual' | 'lifetime'
	successUrl?: string
	cancelUrl?: string
}

export interface RegisterPushInput {
	subscription: PushSubscriptionJSON
}

export interface RedeemReferralInput {
	code: string
}

export interface CheckFeatureFlagInput {
	key: string
	context?: Record<string, unknown>
}

export interface UploadFileInput {
	file: File
	path?: string
}

export interface RegisterMobileDeviceInput {
	platform: 'ios' | 'android'
	token: string
	deviceId?: string
	deviceName?: string
	appVersion?: string
	osVersion?: string
}

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
}

export interface ScheduleJobResult {
	id: string
	jobId: string
	scheduledFor: string
}

export interface CreateCronInput {
	name?: string
	callbackUrl: string
	schedule?: string  // Either schedule or cron
	cron?: string      // Either schedule or cron
	payload?: unknown
	timezone?: string
}

export interface CreateCronResult {
	id: string
	scheduleId: string
	schedule: string
	nextRunAt: string
}

export interface JobsStatusResult {
	enabled: boolean
	available: boolean
	quotaUsed: number
	quotaLimit: number
}

// Webhooks additional types (React layer)
// Note: Core types re-exported from webhooks.ts above
export type WebhookEnvironmentType = 'development' | 'staging' | 'production'
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
	// These can be either form (REST vs legacy)
	device?: string | null
	deviceName?: string
	deviceType?: string
	browser?: string | null
	os?: string | null
	ipAddress?: string | null
	ip?: string | null
	location?: string | null
	country?: string
	city?: string
	lastActive?: string
	lastActiveAt?: string
	current?: boolean
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
