/**
 * tRPC Client for Sylphx Platform
 *
 * Provides type-safe API calls to the platform.
 * All types are derived from the server's AppRouter - NO manual type definitions.
 */

import type { AppRouter } from './api'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

// ============================================================================
// Type Inference from Server Router
// ============================================================================

/** Infer all input types from the server router */
export type RouterInputs = inferRouterInputs<AppRouter>

/** Infer all output types from the server router */
export type RouterOutputs = inferRouterOutputs<AppRouter>

// ============================================================================
// Auth Types (inferred from router)
// ============================================================================

export type AuthLoginResult = RouterOutputs['auth']['login']
export type AuthRegisterResult = RouterOutputs['auth']['register']
export type AuthVerify2FAResult = RouterOutputs['auth']['verifyTwoFactor']
export type AuthMeResult = RouterOutputs['auth']['me']

// ============================================================================
// User & Profile Types (inferred from router)
// ============================================================================

export type UserProfile = RouterOutputs['user']['getProfile']
export type SecuritySettings = RouterOutputs['user']['getSecuritySettings']
export type LoginHistoryEntry = RouterOutputs['user']['getLoginHistory'][number]
export type UserSessions = RouterOutputs['user']['getSessions']
export type UserSessionInfo = UserSessions[number]
export type ConnectedAccounts = RouterOutputs['user']['getConnectedAccounts']
export type ConnectedAccount = ConnectedAccounts[number]

// ============================================================================
// Security Types (inferred from router)
// ============================================================================

export type SecuritySessions = RouterOutputs['security']['getSessions']
export type DeviceSession = SecuritySessions['sessions'][number]
export type TwoFactorStatus = RouterOutputs['security']['getTwoFactorStatus']
export type TwoFactorSetupResult = RouterOutputs['security']['twoFactorSetup']
export type TwoFactorVerifyResult = RouterOutputs['security']['twoFactorVerify']
export type PasskeyList = RouterOutputs['security']['passkeyList']
export type PasskeyInfo = PasskeyList[number]
export type SecurityScoreResult = RouterOutputs['security']['getSecurityScore']
export type PasswordStatus = RouterOutputs['security']['getPasswordStatus']
export type OAuthProviders = RouterOutputs['security']['getOAuthProviders']

// ============================================================================
// Billing Types (inferred from router)
// ============================================================================

export type Plans = RouterOutputs['billing']['getPlans']
export type Plan = Plans[number]
export type Subscription = NonNullable<RouterOutputs['billing']['getSubscription']>
export type BillingBalance = RouterOutputs['billing']['getBalance']
export type BillingUsage = RouterOutputs['billing']['getUsage']
export type CheckoutResult = RouterOutputs['billing']['createCheckout']
export type PortalSessionResult = RouterOutputs['billing']['createPortalSession']

// ============================================================================
// Referral Types (inferred from router)
// ============================================================================

export type ReferralCode = RouterOutputs['referrals']['getMyCode']
export type ReferralStats = RouterOutputs['referrals']['getStats']
export type LeaderboardResult = RouterOutputs['referrals']['getLeaderboard']
// Extract from optional input type (Exclude void/undefined, then get period)
type LeaderboardInput = Exclude<RouterInputs['referrals']['getLeaderboard'], void | undefined>
export type LeaderboardPeriod = NonNullable<LeaderboardInput['period']>

// ============================================================================
// Feature Flag Types (inferred from router)
// ============================================================================

export type FeatureFlagResult = RouterOutputs['flags']['check']
export type FeatureFlagDetailResult = RouterOutputs['flags']['checkWithDetail']
export type AllFlagsResult = RouterOutputs['flags']['getAll']
export type AllFlagsDetailResult = RouterOutputs['flags']['getAllWithDetail']

// EvaluationReason inferred from router output (SSOT)
export type EvaluationReason = FeatureFlagDetailResult['reason']
export type EvaluationReasonKind = EvaluationReason['kind']

// ============================================================================
// AI Types (inferred from router)
// ============================================================================

export type AIUsageStats = RouterOutputs['ai']['getUsage']
export type AIRateLimitStatus = RouterOutputs['ai']['getRateLimitStatus']
export type AIModelsResponse = RouterOutputs['ai']['listModels']
export type AIUsagePeriod = NonNullable<RouterInputs['ai']['getUsage']>['period']

// ============================================================================
// Jobs Types (inferred from router)
// ============================================================================

/** Result of jobs.status query */
export type JobsStatusResult = RouterOutputs['jobs']['status']

/** Single job from jobs.get */
export type Job = RouterOutputs['jobs']['get']

/** Result of jobs.list query */
export type JobsListResult = RouterOutputs['jobs']['list']

/** Job status enum - inferred from input schema */
export type JobStatusEnum = NonNullable<RouterInputs['jobs']['list']['status']>

/** Job type enum - inferred from input schema */
export type JobTypeEnum = NonNullable<RouterInputs['jobs']['list']['type']>

/** Jobs list input options */
export type JobsListInput = RouterInputs['jobs']['list']

/** Schedule job input */
export type ScheduleJobInput = RouterInputs['jobs']['schedule']

/** Schedule job result */
export type ScheduleJobResult = RouterOutputs['jobs']['schedule']

/** Create cron input */
export type CreateCronInput = RouterInputs['jobs']['createCron']

/** Create cron result */
export type CreateCronResult = RouterOutputs['jobs']['createCron']

/** Cancel job result */
export type CancelJobResult = RouterOutputs['jobs']['cancel']

// ============================================================================
// Storage Types (inferred from router)
// ============================================================================

export type StorageFile = RouterOutputs['storage']['getFile']
export type StorageUsage = RouterOutputs['storage']['getUsage']
export type UploadedFile = NonNullable<RouterOutputs['storage']['getFile']>
export type StorageFilesList = RouterOutputs['storage']['listFiles']
export type UploadInput = RouterInputs['storage']['upload']
export type UploadResult = RouterOutputs['storage']['upload']

// ============================================================================
// Webhook Types (inferred from router)
// ============================================================================

/** Webhook config result */
export type WebhookConfig = RouterOutputs['webhooks']['getConfig']

/** Single webhook environment from config */
export type WebhookEnvironment = WebhookConfig['environments'][number]

/** Webhook deliveries result */
export type WebhookDeliveriesResult = RouterOutputs['webhooks']['getDeliveries']

/** Single webhook delivery */
export type WebhookDelivery = WebhookDeliveriesResult['deliveries'][number]

/** Webhook delivery status - inferred from delivery object */
export type WebhookDeliveryStatus = WebhookDelivery['status']

/** Webhook stats result */
export type WebhookStats = RouterOutputs['webhooks']['getStats']

/** Webhook stats period - inferred from input */
export type WebhookStatsPeriod = RouterInputs['webhooks']['getStats']['period']

/** Update webhook config input */
export type UpdateWebhookConfigInput = RouterInputs['webhooks']['updateConfig']

/** Update webhook config result */
export type UpdateWebhookConfigResult = RouterOutputs['webhooks']['updateConfig']

/** Replay delivery result */
export type ReplayDeliveryResult = RouterOutputs['webhooks']['replayDelivery']

/** Get deliveries input */
export type GetDeliveriesInput = RouterInputs['webhooks']['getDeliveries']

// ============================================================================
// Consent Types (inferred from router)
// ============================================================================

export type ConsentTypes = RouterOutputs['consent']['getConsentTypes']
export type ConsentType = ConsentTypes[number]
export type UserConsents = RouterOutputs['consent']['getUserConsents']
export type UserConsent = UserConsents[number]
export type SetConsentsInput = RouterInputs['consent']['setConsents']
export type SetConsentsResult = RouterOutputs['consent']['setConsents']

// ============================================================================
// Monitoring Types (inferred from router)
// ============================================================================

export type CaptureExceptionInput = RouterInputs['monitoring']['captureException']
export type CaptureExceptionResult = RouterOutputs['monitoring']['captureException']
export type CaptureMessageInput = RouterInputs['monitoring']['captureMessage']
export type CaptureMessageResult = RouterOutputs['monitoring']['captureMessage']
export type MonitoringLevel = NonNullable<CaptureExceptionInput['level']>

// ============================================================================
// Email Types (inferred from router)
// ============================================================================

export type SendEmailInput = RouterInputs['email']['send']
export type SendEmailResult = RouterOutputs['email']['send']
export type SendTemplatedInput = RouterInputs['email']['sendTemplated']
export type SendTemplatedResult = RouterOutputs['email']['sendTemplated']
export type SendToUserInput = RouterInputs['email']['sendToUser']
export type EmailTemplates = RouterOutputs['email']['listTemplates']
export type EmailConfigured = RouterOutputs['email']['isConfigured']

// ============================================================================
// Newsletter Types (inferred from router)
// ============================================================================

export type NewsletterSubscribeInput = RouterInputs['newsletter']['sdkSubscribe']
export type NewsletterSubscribeResult = RouterOutputs['newsletter']['sdkSubscribe']
export type NewsletterVerifyResult = RouterOutputs['newsletter']['sdkVerify']
export type NewsletterUnsubscribeResult = RouterOutputs['newsletter']['sdkUnsubscribe']
export type NewsletterUnsubscribeInfo = RouterOutputs['newsletter']['sdkGetUnsubscribeInfo']
export type NewsletterPreferences = RouterOutputs['newsletter']['sdkGetPreferences']
export type NewsletterStats = RouterOutputs['newsletter']['sdkGetStats']

// ============================================================================
// Organization Types (inferred from router)
// ============================================================================

export type Organization = RouterOutputs['orgs']['getMyOrg']
export type OrganizationMembers = RouterOutputs['orgs']['listMembers']
export type OrganizationMember = OrganizationMembers[number]
export type OrgRole = OrganizationMember['role']

// ============================================================================
// Notifications Types (inferred from router)
// ============================================================================

export type NotificationMessages = RouterOutputs['notifications']['getMessages']
export type NotificationMessage = NotificationMessages[number]
export type NotificationPreferences = RouterOutputs['notifications']['getPreferences']
export type MobilePushConfig = RouterOutputs['notifications']['isMobileConfigured']
export type MobilePushPreferences = RouterOutputs['notifications']['getMobilePreferences']
export type RegisterDeviceInput = RouterInputs['notifications']['registerDevice']

// ============================================================================
// Analytics Types (inferred from router)
// ============================================================================

export type TrackEventInput = RouterInputs['analytics']['track']
export type BatchEventsInput = RouterInputs['analytics']['trackBatch']
export type IdentifyInput = RouterInputs['analytics']['identify']
export type UpdateProfileInput = RouterInputs['user']['updateProfile']
export type ChangePasswordInput = { newPassword: string }
export type CheckoutInput = RouterInputs['billing']['createCheckout']
export type RegisterPushInput = RouterInputs['notifications']['register']
export type RedeemReferralInput = RouterInputs['referrals']['redeem']
export type CheckFeatureFlagInput = RouterInputs['flags']['check']
export type UploadFileInput = RouterInputs['storage']['upload']

// Mobile Push Types (top-level routes, not nested under mobile.*)
export type RegisterMobileDeviceInput = RouterInputs['notifications']['registerDevice']

// ============================================================================
// Utility types (SDK-specific, not from router)
// ============================================================================

export interface PaginationInput {
	page?: number
	limit?: number
	cursor?: string
}

export interface PaginatedResponse<T> {
	items: T[]
	total: number
	page: number
	pageSize: number
	hasMore: boolean
}

export interface SuccessResponse {
	success: boolean
	message?: string
}

export interface ErrorResponse {
	error: string
	code?: string
	details?: Record<string, unknown>
}

// ============================================================================
// AI Types (SDK-specific for chat completions)
// ============================================================================

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'groq' | 'cohere'
export type AIRequestType = 'chat' | 'text' | 'embedding' | 'image' | 'vision' | 'audio' | 'tts'
export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface AIMessage {
	role: AIMessageRole
	content: string
	name?: string
	toolCalls?: AIToolCall[]
	toolCallId?: string
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
	frequencyPenalty?: number
	presencePenalty?: number
	stop?: string | string[]
	tools?: AITool[]
	toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
	stream?: boolean
}

export interface ChatCompletionResponse {
	id: string
	model: string
	choices: Array<{
		index: number
		message: {
			role: 'assistant'
			content: string
			toolCalls?: AIToolCall[]
		}
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
	temperature?: number
	maxTokens?: number
	topP?: number
	stop?: string | string[]
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
	data: Array<{
		index: number
		embedding: number[]
	}>
	usage: {
		promptTokens: number
		totalTokens: number
	}
}

export interface ImageGenerationInput {
	model: string
	prompt: string
	n?: number
	size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792'
	quality?: 'standard' | 'hd'
	style?: 'vivid' | 'natural'
}

export interface ImageGenerationResponse {
	created: number
	data: Array<{
		url?: string
		b64Json?: string
		revisedPrompt?: string
	}>
}

export interface VisionInput {
	model?: string
	messages: Array<{
		role: 'user'
		content: Array<
			| { type: 'text'; text: string }
			| { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
		>
	}>
	maxTokens?: number
}

export interface AudioTranscriptionInput {
	model: string
	file: Blob | File
	language?: string
	prompt?: string
	responseFormat?: 'json' | 'text' | 'srt' | 'vtt'
}

export interface AudioTranscriptionResponse {
	text: string
	language?: string
	duration?: number
	segments?: Array<{
		id: number
		start: number
		end: number
		text: string
	}>
}

export interface TextToSpeechInput {
	model: string
	input: string
	voice: string
	speed?: number
	responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac'
}

export interface AIStreamChunk {
	id: string
	model: string
	choices: Array<{
		index: number
		delta: {
			role?: AIMessageRole
			content?: string
			toolCalls?: AIToolCall[]
		}
		finishReason: string | null
	}>
}

export interface AIModelInfo {
	id: string
	name: string
	provider?: AIProvider
	capabilities: ('chat' | 'text' | 'embedding' | 'image' | 'vision' | 'audio' | 'tts' | 'tool')[]
	contextWindow: number
	maxOutputTokens?: number
	description?: string
	inputCostPer1M?: number
	outputCostPer1M?: number
	pricing?: {
		inputPerMillion: number
		outputPerMillion: number
	}
}

export interface AIAppConfig {
	enabled: boolean
	allowedModels: string[]
	blockedModels: string[]
	defaultModel?: string
	rateLimits?: Record<string, { rpm: number; tpm: number }>
}

/**
 * AI Rate Limit Info - matches server ai.getRateLimitStatus response
 */
export interface AIRateLimitInfo {
	requestsPerMinute: number | null
	requestsPerDay: number | null
	tokensPerMinute: number | null
	tokensPerDay: number | null
	costPerDayMicrodollars: number | null
	current: {
		requestsThisMinute: number
		requestsToday: number
		tokensThisMinute: number
		tokensToday: number
		costToday: number
	}
}

export interface AIListModelsOptions {
	capability?: 'chat' | 'vision' | 'tool' | 'embedding'
	search?: string
	limit?: number
	offset?: number
}

export interface AIListModelsResponse {
	models: AIModelInfo[]
	total: number
	hasMore: boolean
}

// Note: Analytics types are defined in platform-context.ts for SDK internal use

// ============================================================================
// In-App Message Types (inferred from router output)
// ============================================================================

// Infer types from router output (SSOT)
export type InAppMessageWithReadStatus = NotificationMessages[number]
export type InAppMessageType = NonNullable<InAppMessageWithReadStatus['type']>
export type InAppMessagePriority = NonNullable<InAppMessageWithReadStatus['priority']>

// ============================================================================
// Client Configuration
// ============================================================================

export interface TRPCClientConfig {
	appId: string
	appSecret: string
	platformUrl?: string
	accessToken?: string
}

// ============================================================================
// Challenge types for step-up authentication (inferred from router output)
// ============================================================================

// Infer full types from router outputs (SSOT)
export type ChallengeRequirement = RouterOutputs['challenge']['required']
export type ChallengeStatus = RouterOutputs['challenge']['status']

// Extract nested enum types from inferred output
export type ChallengeLevel = ChallengeRequirement['level']
export type IdentityMethod = NonNullable<ChallengeRequirement['identity']['method']>
export type MfaMethod = NonNullable<ChallengeRequirement['mfa']['method']>

// ============================================================================
// Platform API Interface
//
// This interface provides ergonomic method calls (no .query()/.mutate())
// All return types are inferred from the server's AppRouter.
// ============================================================================

/**
 * @deprecated Use `SylphxClient` from `createSylphx()` or `createDynamicSylphx()` instead.
 * This interface will be removed in the next major version.
 *
 * Migration:
 * ```typescript
 * // Old (deprecated)
 * import { createDynamicPlatformAPI } from '@sylphx/platform-sdk'
 * const api = createDynamicPlatformAPI(config, getToken)
 * await api.user.getProfile()
 *
 * // New (recommended)
 * import { createDynamicSylphx } from '@sylphx/platform-sdk'
 * const api = createDynamicSylphx({ ...config, getAccessToken: getToken })
 * await api.user.getProfile.query()
 * ```
 */
export interface PlatformAPI {
	// Auth
	auth: {
		login(email: string, password: string): Promise<RouterOutputs['auth']['login']>
		register(email: string, password: string, name?: string): Promise<RouterOutputs['auth']['register']>
		logout(): Promise<RouterOutputs['auth']['logout']>
		verifyTwoFactor(userId: string, code: string): Promise<RouterOutputs['auth']['verifyTwoFactor']>
		forgotPassword(email: string): Promise<RouterOutputs['auth']['forgotPassword']>
		resetPassword(token: string, password: string): Promise<RouterOutputs['auth']['resetPassword']>
	}

	// Challenge (Step-up Authentication)
	challenge: {
		required(operation: string): Promise<ChallengeRequirement>
		sendCode(): Promise<RouterOutputs['challenge']['sendCode']>
		verifyIdentity(method: IdentityMethod, value: string): Promise<RouterOutputs['challenge']['verifyIdentity']>
		verifyMfa(method: MfaMethod, value: string): Promise<RouterOutputs['challenge']['verifyMfa']>
		status(): Promise<ChallengeStatus>
	}

	// User
	user: {
		getProfile(): Promise<RouterOutputs['user']['getProfile']>
		updateProfile(data: RouterInputs['user']['updateProfile']): Promise<RouterOutputs['user']['updateProfile']>
		changePassword(newPassword: string): Promise<RouterOutputs['user']['changePassword']>
		getSecuritySettings(): Promise<RouterOutputs['user']['getSecuritySettings']>
		getLoginHistory(): Promise<RouterOutputs['user']['getLoginHistory']>
		getConnectedAccounts(): Promise<RouterOutputs['user']['getConnectedAccounts']>
		getSessions(): Promise<RouterOutputs['user']['getSessions']>
		revokeSession(sessionId: string): Promise<RouterOutputs['user']['revokeSession']>
		revokeAllSessions(): Promise<RouterOutputs['user']['revokeAllSessions']>
		exportData(): Promise<RouterOutputs['user']['exportData']>
		deleteAccount(): Promise<RouterOutputs['user']['deleteAccount']>
	}

	// Billing
	billing: {
		getPlans(): Promise<RouterOutputs['billing']['getPlans']>
		getSubscription(): Promise<RouterOutputs['billing']['getSubscription']>
		createCheckout(data: RouterInputs['billing']['createCheckout']): Promise<RouterOutputs['billing']['createCheckout']>
		createPortalSession(returnUrl: string): Promise<RouterOutputs['billing']['createPortalSession']>
		cancelSubscription(): Promise<RouterOutputs['billing']['cancelSubscription']>
		getBalance(): Promise<RouterOutputs['billing']['getBalance']>
		getUsage(options?: { month?: string }): Promise<RouterOutputs['billing']['getUsage']>
	}

	// Analytics
	analytics: {
		track(event: RouterInputs['analytics']['track']): Promise<RouterOutputs['analytics']['track']>
		trackBatch(events: RouterInputs['analytics']['trackBatch']): Promise<RouterOutputs['analytics']['trackBatch']>
		identify(data: RouterInputs['analytics']['identify']): Promise<RouterOutputs['analytics']['identify']>
		pageView(url: string, properties?: Record<string, unknown>): Promise<RouterOutputs['analytics']['track']>
		query(query: RouterInputs['analytics']['query']): Promise<RouterOutputs['analytics']['query']>
	}

	// AI
	ai: {
		getUsage(period: 'day' | 'week' | 'month' | 'year'): Promise<RouterOutputs['ai']['getUsage']>
		getRateLimitStatus(): Promise<RouterOutputs['ai']['getRateLimitStatus']>
		listModels(options?: RouterInputs['ai']['listModels']): Promise<RouterOutputs['ai']['listModels']>
	}

	// Notifications (Push + In-App Messages + Mobile Push)
	notifications: {
		// Web Push
		register(subscription: RouterInputs['notifications']['register']): Promise<RouterOutputs['notifications']['register']>
		unregister(endpoint: string): Promise<RouterOutputs['notifications']['unregister']>
		getPreferences(): Promise<RouterOutputs['notifications']['getPreferences']>
		// In-App Messages
		getMessages(filters?: RouterInputs['notifications']['getMessages']): Promise<InAppMessageWithReadStatus[]>
		getUnreadCount(): Promise<number>
		markAsRead(input: { messageId: string }): Promise<void>
		markAllAsRead(): Promise<RouterOutputs['notifications']['markAllAsRead']>
		dismiss(input: { messageId: string }): Promise<void>
		recordClick(input: { messageId: string; action: 'primary' | 'secondary' }): Promise<void>
		getMessagePreferences(): Promise<RouterOutputs['notifications']['getMessagePreferences']>
		updateMessagePreferences(prefs: RouterInputs['notifications']['updateMessagePreferences']): Promise<void>
		// Mobile Push (top-level routes, not nested)
		isMobileConfigured(): Promise<RouterOutputs['notifications']['isMobileConfigured']>
		registerDevice(input: RouterInputs['notifications']['registerDevice']): Promise<RouterOutputs['notifications']['registerDevice']>
		unregisterDevice(input: RouterInputs['notifications']['unregisterDevice']): Promise<RouterOutputs['notifications']['unregisterDevice']>
		getMobilePreferences(): Promise<RouterOutputs['notifications']['getMobilePreferences']>
	}

	// Security (2FA, Passkeys, Sessions)
	security: {
		getTwoFactorStatus(): Promise<RouterOutputs['security']['getTwoFactorStatus']>
		twoFactorSetup(): Promise<RouterOutputs['security']['twoFactorSetup']>
		twoFactorVerify(code: string): Promise<RouterOutputs['security']['twoFactorVerify']>
		twoFactorDisable(code: string): Promise<RouterOutputs['security']['twoFactorDisable']>
		backupCodesView(code: string): Promise<RouterOutputs['security']['backupCodesView']>
		backupCodesRegenerate(code: string): Promise<RouterOutputs['security']['backupCodesRegenerate']>
		getPasswordStatus(): Promise<RouterOutputs['security']['getPasswordStatus']>
		passwordSet(password: string): Promise<RouterOutputs['security']['passwordSet']>
		emailChangeRequest(newEmail: string): Promise<RouterOutputs['security']['emailChangeRequest']>
		emailChangeConfirm(token: string): Promise<RouterOutputs['security']['emailChangeConfirm']>
		passkeyList(): Promise<RouterOutputs['security']['passkeyList']>
		passkeyRegisterStart(): Promise<RouterOutputs['security']['passkeyRegisterStart']>
		passkeyRegisterVerify(credential: unknown, name: string): Promise<RouterOutputs['security']['passkeyRegisterVerify']>
		passkeyRename(passkeyId: string, name: string): Promise<RouterOutputs['security']['passkeyRename']>
		passkeyDelete(passkeyId: string): Promise<RouterOutputs['security']['passkeyDelete']>
		getOAuthProviders(): Promise<RouterOutputs['security']['getOAuthProviders']>
		oauthConnect(provider: string): Promise<RouterOutputs['security']['oauthConnect']>
		oauthDisconnect(provider: string): Promise<RouterOutputs['security']['oauthDisconnect']>
		getSecurityScore(): Promise<RouterOutputs['security']['getSecurityScore']>
		getSessions(): Promise<RouterOutputs['security']['getSessions']>
		revokeSession(sessionId: string): Promise<RouterOutputs['security']['revokeSession']>
		revokeAllSessions(): Promise<RouterOutputs['security']['revokeOtherSessions']>
		getSecurityAlerts(): Promise<RouterOutputs['security']['getSecurityAlerts']>
		markAlertRead(alertId: string): Promise<RouterOutputs['security']['markAlertRead']>
	}

	// Referrals
	referrals: {
		getMyCode(): Promise<RouterOutputs['referrals']['getMyCode']>
		redeem(code: string): Promise<RouterOutputs['referrals']['redeem']>
		getStats(): Promise<RouterOutputs['referrals']['getStats']>
		regenerateCode(): Promise<RouterOutputs['referrals']['regenerateCode']>
		getLeaderboard(options?: RouterInputs['referrals']['getLeaderboard']): Promise<RouterOutputs['referrals']['getLeaderboard']>
	}

	// Feature Flags
	flags: {
		check(key: string, userId?: string): Promise<RouterOutputs['flags']['check']>
		getAll(userId?: string): Promise<RouterOutputs['flags']['getAll']>
		checkWithDetail(key: string, userId?: string, userContext?: { isPremium?: boolean; isAdmin?: boolean }): Promise<RouterOutputs['flags']['checkWithDetail']>
		getAllWithDetail(userId?: string, userContext?: { isPremium?: boolean; isAdmin?: boolean }): Promise<RouterOutputs['flags']['getAllWithDetail']>
	}

	// Storage
	storage: {
		upload(input: RouterInputs['storage']['upload']): Promise<RouterOutputs['storage']['upload']>
		listFiles(options?: RouterInputs['storage']['listFiles']): Promise<RouterOutputs['storage']['listFiles']>
		getFile(fileId: string): Promise<RouterOutputs['storage']['getFile']>
		deleteFile(fileId: string): Promise<RouterOutputs['storage']['deleteFile']>
		getUsage(): Promise<RouterOutputs['storage']['getUsage']>
		trackDownload(fileId: string): Promise<RouterOutputs['storage']['trackDownload']>
	}

	// Monitoring / Error Tracking
	monitoring: {
		captureException(error: Error, options?: {
			level?: 'fatal' | 'error' | 'warning' | 'info'
			tags?: Record<string, string>
			extra?: Record<string, unknown>
			fingerprint?: string[]
			route?: string
			userAgent?: string
		}): Promise<RouterOutputs['monitoring']['captureException']>
		captureMessage(message: string, options?: {
			level?: 'fatal' | 'error' | 'warning' | 'info'
			tags?: Record<string, string>
			extra?: Record<string, unknown>
			route?: string
		}): Promise<RouterOutputs['monitoring']['captureMessage']>
	}

	// Jobs (Background Tasks)
	jobs: {
		status(): Promise<RouterOutputs['jobs']['status']>
		schedule(options: RouterInputs['jobs']['schedule']): Promise<RouterOutputs['jobs']['schedule']>
		createCron(options: RouterInputs['jobs']['createCron']): Promise<RouterOutputs['jobs']['createCron']>
		pauseCron(scheduleId: string): Promise<RouterOutputs['jobs']['pauseCron']>
		resumeCron(scheduleId: string): Promise<RouterOutputs['jobs']['resumeCron']>
		deleteCron(scheduleId: string): Promise<RouterOutputs['jobs']['deleteCron']>
		get(jobId: string): Promise<RouterOutputs['jobs']['get']>
		list(options?: RouterInputs['jobs']['list']): Promise<RouterOutputs['jobs']['list']>
		cancel(jobId: string): Promise<RouterOutputs['jobs']['cancel']>
	}

	// Session Replay
	sessionReplay: {
		upload(data: RouterInputs['sessionReplay']['sdkUpload']): Promise<RouterOutputs['sessionReplay']['sdkUpload']>
		endSession(sessionId: string, duration?: number): Promise<RouterOutputs['sessionReplay']['sdkEndSession']>
		markError(sessionId: string, errorId: string): Promise<RouterOutputs['sessionReplay']['sdkMarkError']>
	}

	// Consent Management
	consent: {
		getConsentTypes(): Promise<RouterOutputs['consent']['getConsentTypes']>
		getUserConsents(options: RouterInputs['consent']['getUserConsents']): Promise<RouterOutputs['consent']['getUserConsents']>
		setConsents(options: RouterInputs['consent']['setConsents']): Promise<RouterOutputs['consent']['setConsents']>
		acceptAll(options: RouterInputs['consent']['acceptAll']): Promise<RouterOutputs['consent']['acceptAll']>
		declineOptional(options: RouterInputs['consent']['declineOptional']): Promise<RouterOutputs['consent']['declineOptional']>
	}

	// Newsletter / Subscribers
	subscribers: {
		subscribe(options: RouterInputs['newsletter']['sdkSubscribe']): Promise<RouterOutputs['newsletter']['sdkSubscribe']>
		verify(token: string): Promise<RouterOutputs['newsletter']['sdkVerify']>
		unsubscribe(email: string, token: string): Promise<RouterOutputs['newsletter']['sdkUnsubscribe']>
		resendVerification(email: string): Promise<RouterOutputs['newsletter']['sdkResendVerification']>
		getUnsubscribeInfo(token: string): Promise<RouterOutputs['newsletter']['sdkGetUnsubscribeInfo']>
		updatePreferences(email: string, preferences: Record<string, boolean>): Promise<RouterOutputs['newsletter']['sdkUpdatePreferences']>
		getPreferences(email: string): Promise<RouterOutputs['newsletter']['sdkGetPreferences']>
		list(options?: RouterInputs['newsletter']['sdkListSubscribers']): Promise<RouterOutputs['newsletter']['sdkListSubscribers']>
		get(email: string): Promise<RouterOutputs['newsletter']['sdkGetSubscriber']>
		delete(email: string): Promise<RouterOutputs['newsletter']['sdkDeleteSubscriber']>
		stats(): Promise<RouterOutputs['newsletter']['sdkGetStats']>
	}

	// Database (uses direct Neon connection)
	database: {
		query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>
		execute(sql: string, params?: unknown[]): Promise<{ rowCount: number }>
	}

	// Email (Transactional + Scheduling)
	email: {
		send(options: RouterInputs['email']['send']): Promise<RouterOutputs['email']['send']>
		sendTemplated(options: RouterInputs['email']['sendTemplated']): Promise<RouterOutputs['email']['sendTemplated']>
		sendToUser(options: RouterInputs['email']['sendToUser']): Promise<RouterOutputs['email']['sendToUser']>
		schedule(options: RouterInputs['email']['schedule']): Promise<RouterOutputs['email']['schedule']>
		listScheduled(options?: RouterInputs['email']['listScheduled']): Promise<RouterOutputs['email']['listScheduled']>
		getScheduled(scheduledEmailId: string): Promise<RouterOutputs['email']['getScheduled']>
		cancelScheduled(scheduledEmailId: string): Promise<RouterOutputs['email']['cancelScheduled']>
		reschedule(scheduledEmailId: string, newScheduledFor: string): Promise<RouterOutputs['email']['reschedule']>
		scheduledStats(options?: RouterInputs['email']['scheduledStats']): Promise<RouterOutputs['email']['scheduledStats']>
		listTemplates(): Promise<RouterOutputs['email']['listTemplates']>
		isConfigured(): Promise<RouterOutputs['email']['isConfigured']>
	}

	// Webhooks
	webhooks: {
		getConfig(): Promise<RouterOutputs['webhooks']['getConfig']>
		updateConfig(options: RouterInputs['webhooks']['updateConfig']): Promise<RouterOutputs['webhooks']['updateConfig']>
		getDeliveries(options?: RouterInputs['webhooks']['getDeliveries']): Promise<RouterOutputs['webhooks']['getDeliveries']>
		getDelivery(deliveryId: string): Promise<RouterOutputs['webhooks']['getDelivery']>
		replayDelivery(deliveryId: string): Promise<RouterOutputs['webhooks']['replayDelivery']>
		getStats(period: 'day' | 'week' | 'month' | 'year'): Promise<RouterOutputs['webhooks']['getStats']>
	}

	// Privacy (Cookie Scanner)
	privacy: {
		startScan(input: RouterInputs['privacy']['startScan']): Promise<RouterOutputs['privacy']['startScan']>
		getScan(scanId: string): Promise<RouterOutputs['privacy']['getScan']>
		listScans(input?: RouterInputs['privacy']['listScans']): Promise<RouterOutputs['privacy']['listScans']>
		getCookies(input?: RouterInputs['privacy']['getCookies']): Promise<RouterOutputs['privacy']['getCookies']>
		getSummary(): Promise<RouterOutputs['privacy']['getSummary']>
		updateCookieCategory(cookieId: string, category: string): Promise<RouterOutputs['privacy']['updateCookieCategory']>
		linkToConsentType(cookieId: string, consentTypeId: string | null): Promise<RouterOutputs['privacy']['linkToConsentType']>
		bulkLinkToConsentType(category: string, consentTypeId: string): Promise<RouterOutputs['privacy']['bulkLinkToConsentType']>
	}
}

// ============================================================================
// Implementation
// ============================================================================

function createHeaders(config: TRPCClientConfig): Record<string, string> {
	const headers: Record<string, string> = {
		'x-app-id': config.appId,
		'x-app-secret': config.appSecret,
	}

	if (config.accessToken) {
		headers['Authorization'] = `Bearer ${config.accessToken}`
	}

	return headers
}

const DEFAULT_REQUEST_TIMEOUT = 30000

/**
 * @deprecated Use `createSylphx()` or `createDynamicSylphx()` from `@sylphx/platform-sdk` instead.
 * This function will be removed in the next major version.
 *
 * Migration:
 * ```typescript
 * // Old (deprecated)
 * const api = createPlatformAPI({ appId, appSecret })
 * await api.user.getProfile()
 *
 * // New (recommended)
 * import { createSylphx } from '@sylphx/platform-sdk'
 * const api = createSylphx({ appId, appSecret })
 * await api.user.getProfile.query()
 * ```
 */
export function createPlatformAPI(config: TRPCClientConfig): PlatformAPI {
	const platformUrl = config.platformUrl || 'https://sylphx.com'
	const trpcUrl = `${platformUrl}/api/trpc`

	async function call<T>(path: string, input?: unknown): Promise<T> {
		const isQuery = !input || (typeof input === 'object' && Object.keys(input as object).length === 0)
		const method = isQuery ? 'GET' : 'POST'

		let url = `${trpcUrl}/${path}`
		let body: string | undefined

		if (method === 'GET' && input) {
			url += `?input=${encodeURIComponent(JSON.stringify(input))}`
		} else if (method === 'POST') {
			body = JSON.stringify(input)
		}

		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT)

		try {
			const response = await fetch(url, {
				method,
				headers: {
					...createHeaders(config),
					'Content-Type': 'application/json',
				},
				body,
				signal: controller.signal,
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Request failed' }))
				throw new Error(error.message || error.error || 'API request failed')
			}

			const data = await response.json()
			return data.result?.data ?? data
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') {
				throw new Error(`Request timed out after ${DEFAULT_REQUEST_TIMEOUT / 1000} seconds`)
			}
			throw err
		} finally {
			clearTimeout(timeoutId)
		}
	}

	return {
		auth: {
			async login(email, password) { return call('auth.login', { email, password }) },
			async register(email, password, name) { return call('auth.register', { email, password, name }) },
			async logout() { return call('auth.logout', {}) },
			async verifyTwoFactor(userId, code) { return call('auth.verifyTwoFactor', { userId, code }) },
			async forgotPassword(email) { return call('auth.forgotPassword', { email }) },
			async resetPassword(token, password) { return call('auth.resetPassword', { token, newPassword: password }) },
		},

		challenge: {
			async required(operation) { return call('challenge.required', { operation }) },
			async sendCode() { return call('challenge.sendCode', {}) },
			async verifyIdentity(method, value) { return call('challenge.verifyIdentity', { method, value }) },
			async verifyMfa(method, value) { return call('challenge.verifyMfa', { method, value }) },
			async status() { return call('challenge.status') },
		},

		user: {
			async getProfile() { return call('user.getProfile') },
			async updateProfile(data) { return call('user.updateProfile', data) },
			async changePassword(newPassword) { return call('user.changePassword', { newPassword }) },
			async getSecuritySettings() { return call('user.getSecuritySettings') },
			async getLoginHistory() { return call('user.getLoginHistory') },
			async getConnectedAccounts() { return call('user.getConnectedAccounts') },
			async getSessions() { return call('user.getSessions') },
			async revokeSession(sessionId) { return call('user.revokeSession', { sessionId }) },
			async revokeAllSessions() { return call('user.revokeAllSessions', {}) },
			async exportData() { return call('user.exportData', {}) },
			async deleteAccount() { return call('user.deleteAccount', {}) },
		},

		billing: {
			async getPlans() { return call('billing.getPlans') },
			async getSubscription() { return call('billing.getSubscription') },
			async createCheckout(data) { return call('billing.createCheckout', data) },
			async createPortalSession(returnUrl) { return call('billing.createPortalSession', { returnUrl }) },
			async cancelSubscription() { return call('billing.cancelSubscription', {}) },
			async getBalance() { return call('billing.getBalance') },
			async getUsage(options) { return call('billing.getUsage', options ?? {}) },
		},

		analytics: {
			async track(event) { return call('analytics.track', event) },
			async trackBatch(events) { return call('analytics.trackBatch', events) },
			async identify(data) { return call('analytics.identify', data) },
			async pageView(url, properties) { return call('analytics.track', { event: '$pageview', url, properties }) },
			async query(query) { return call('analytics.query', query) },
		},

		ai: {
			async getUsage(period) { return call('ai.getUsage', { period }) },
			async getRateLimitStatus() { return call('ai.getRateLimitStatus') },
			async listModels(options) { return call('ai.listModels', options ?? {}) },
		},

		notifications: {
			// Web Push
			async register(subscription) { return call('notifications.register', subscription) },
			async unregister(endpoint) { return call('notifications.unregister', { endpoint }) },
			async getPreferences() { return call('notifications.getPreferences') },
			// In-App Messages
			async getMessages(filters) { return call('notifications.getMessages', filters || {}) },
			async getUnreadCount() { return call('notifications.getUnreadCount') },
			async markAsRead(input) { return call('notifications.markAsRead', input) },
			async markAllAsRead() { return call('notifications.markAllAsRead', {}) },
			async dismiss(input) { return call('notifications.dismiss', input) },
			async recordClick(input) { return call('notifications.recordClick', input) },
			async getMessagePreferences() { return call('notifications.getMessagePreferences') },
			async updateMessagePreferences(prefs) { return call('notifications.updateMessagePreferences', prefs) },
			// Mobile Push (top-level routes)
			async isMobileConfigured() { return call('notifications.isMobileConfigured') },
			async registerDevice(input) { return call('notifications.registerDevice', input) },
			async unregisterDevice(input) { return call('notifications.unregisterDevice', input) },
			async getMobilePreferences() { return call('notifications.getMobilePreferences') },
		},

		security: {
			async getTwoFactorStatus() { return call('security.getTwoFactorStatus') },
			async twoFactorSetup() { return call('security.twoFactorSetup', {}) },
			async twoFactorVerify(code) { return call('security.twoFactorVerify', { code }) },
			async twoFactorDisable(code) { return call('security.twoFactorDisable', { code }) },
			async backupCodesView(code) { return call('security.backupCodesView', { code }) },
			async backupCodesRegenerate(code) { return call('security.backupCodesRegenerate', { code }) },
			async getPasswordStatus() { return call('security.getPasswordStatus') },
			async passwordSet(password) { return call('security.passwordSet', { password }) },
			async emailChangeRequest(newEmail) { return call('security.emailChangeRequest', { newEmail }) },
			async emailChangeConfirm(token) { return call('security.emailChangeConfirm', { token }) },
			async passkeyList() { return call('security.passkeyList') },
			async passkeyRegisterStart() { return call('security.passkeyRegisterStart', {}) },
			async passkeyRegisterVerify(credential, name) { return call('security.passkeyRegisterVerify', { credential, name }) },
			async passkeyRename(passkeyId, name) { return call('security.passkeyRename', { passkeyId, name }) },
			async passkeyDelete(passkeyId) { return call('security.passkeyDelete', { passkeyId }) },
			async getOAuthProviders() { return call('security.getOAuthProviders') },
			async oauthConnect(provider) { return call('security.oauthConnect', { provider }) },
			async oauthDisconnect(provider) { return call('security.oauthDisconnect', { provider }) },
			async getSecurityScore() { return call('security.getSecurityScore') },
			async getSessions() { return call('security.getSessions') },
			async revokeSession(sessionId) { return call('security.revokeSession', { sessionId }) },
			async revokeAllSessions() { return call('security.revokeOtherSessions', {}) },
			async getSecurityAlerts() { return call('security.getSecurityAlerts') },
			async markAlertRead(alertId) { return call('security.markAlertRead', { alertId }) },
		},

		referrals: {
			async getMyCode() { return call('referrals.getMyCode') },
			async redeem(code) { return call('referrals.redeem', { code }) },
			async getStats() { return call('referrals.getStats') },
			async regenerateCode() { return call('referrals.regenerateCode', {}) },
			async getLeaderboard(options) { return call('referrals.getLeaderboard', options) },
		},

		flags: {
			async check(key, userId) { return call('flags.check', { key, userId }) },
			async getAll(userId) { return call('flags.getAll', { userId }) },
			async checkWithDetail(key, userId, userContext) { return call('flags.checkWithDetail', { key, userId, userContext }) },
			async getAllWithDetail(userId, userContext) { return call('flags.getAllWithDetail', { userId, userContext }) },
		},

		storage: {
			async upload(input) { return call('storage.upload', input) },
			async listFiles(options) { return call('storage.listFiles', options || {}) },
			async getFile(id) { return call('storage.getFile', { id }) },
			async deleteFile(id) { return call('storage.deleteFile', { id }) },
			async getUsage() { return call('storage.getUsage') },
			async trackDownload(id) { return call('storage.trackDownload', { id }) },
		},

		monitoring: {
			async captureException(error, options = {}) {
				const frames: Array<{ filename?: string; function?: string; lineno?: number; colno?: number; in_app?: boolean }> = []
				if (error.stack) {
					const lines = error.stack.split('\n').slice(1)
					for (const line of lines) {
						const match = line.match(/^\s*at\s+(?:(.+?)\s+)?(?:\()?(.+?):(\d+):(\d+)\)?$/)
						if (match) {
							frames.push({
								function: match[1] || '<anonymous>',
								filename: match[2],
								lineno: parseInt(match[3] ?? '0', 10),
								colno: parseInt(match[4] ?? '0', 10),
								in_app: !match[2]?.includes('node_modules'),
							})
						}
					}
				}
				return call('monitoring.captureException', {
					exception: { values: [{ type: error.name || 'Error', value: error.message, stacktrace: frames.length > 0 ? { frames } : undefined }] },
					level: options.level,
					tags: options.tags,
					extra: options.extra,
					fingerprint: options.fingerprint,
					route: options.route,
					userAgent: options.userAgent,
				})
			},
			async captureMessage(message, options = {}) {
				return call('monitoring.captureMessage', { message, level: options.level, tags: options.tags, extra: options.extra, route: options.route })
			},
		},

		jobs: {
			async status() { return call('jobs.status') },
			async schedule(options) { return call('jobs.schedule', options) },
			async createCron(options) { return call('jobs.createCron', options) },
			async pauseCron(scheduleId) { return call('jobs.pauseCron', { scheduleId }) },
			async resumeCron(scheduleId) { return call('jobs.resumeCron', { scheduleId }) },
			async deleteCron(scheduleId) { return call('jobs.deleteCron', { scheduleId }) },
			async get(jobId) { return call('jobs.get', { jobId }) },
			async list(options = {}) { return call('jobs.list', options) },
			async cancel(jobId) { return call('jobs.cancel', { jobId }) },
		},

		sessionReplay: {
			async upload(data) { return call('sessionReplay.sdkUpload', data) },
			async endSession(sessionId, duration) { return call('sessionReplay.sdkEndSession', { sessionId, duration }) },
			async markError(sessionId, errorId) { return call('sessionReplay.sdkMarkError', { sessionId, errorId }) },
		},

		consent: {
			async getConsentTypes() { return call('consent.getConsentTypes') },
			async getUserConsents(options) { return call('consent.getUserConsents', options) },
			async setConsents(options) { return call('consent.setConsents', options) },
			async acceptAll(options) { return call('consent.acceptAll', options) },
			async declineOptional(options) { return call('consent.declineOptional', options) },
		},

		subscribers: {
			async subscribe(options) { return call('newsletter.sdkSubscribe', options) },
			async verify(token) { return call('newsletter.sdkVerify', { token }) },
			async unsubscribe(email, token) { return call('newsletter.sdkUnsubscribe', { email, token }) },
			async resendVerification(email) { return call('newsletter.sdkResendVerification', { email }) },
			async getUnsubscribeInfo(token) { return call('newsletter.sdkGetUnsubscribeInfo', { token }) },
			async updatePreferences(email, preferences) { return call('newsletter.sdkUpdatePreferences', { email, preferences }) },
			async getPreferences(email) { return call('newsletter.sdkGetPreferences', { email }) },
			async list(options = {}) { return call('newsletter.sdkListSubscribers', options) },
			async get(email) { return call('newsletter.sdkGetSubscriber', { email }) },
			async delete(email) { return call('newsletter.sdkDeleteSubscriber', { email }) },
			async stats() { return call('newsletter.sdkGetStats', {}) },
		},

		database: {
			async query(_sql: string, _params?: unknown[]) { throw new Error('Use @sylphx/platform-sdk/db with DATABASE_URL') },
			async execute(_sql: string, _params?: unknown[]) { throw new Error('Use @sylphx/platform-sdk/db with DATABASE_URL') },
		},

		email: {
			async send(options) { return call('email.send', options) },
			async sendTemplated(options) { return call('email.sendTemplated', options) },
			async sendToUser(options) { return call('email.sendToUser', options) },
			async schedule(options) { return call('email.schedule', options) },
			async listScheduled(options = {}) { return call('email.listScheduled', options) },
			async getScheduled(id) { return call('email.getScheduled', { id }) },
			async cancelScheduled(id) { return call('email.cancelScheduled', { id }) },
			async reschedule(id, scheduledFor) { return call('email.reschedule', { id, scheduledFor }) },
			async scheduledStats(options = {}) { return call('email.scheduledStats', options) },
			async listTemplates() { return call('email.listTemplates') },
			async isConfigured() { return call('email.isConfigured') },
		},

		webhooks: {
			async getConfig() { return call('webhooks.getConfig') },
			async updateConfig(options) { return call('webhooks.updateConfig', options) },
			async getDeliveries(options = {}) { return call('webhooks.getDeliveries', options) },
			async getDelivery(deliveryId) { return call('webhooks.getDelivery', { deliveryId }) },
			async replayDelivery(deliveryId) { return call('webhooks.replayDelivery', { deliveryId }) },
			async getStats(period) { return call('webhooks.getStats', { period }) },
		},

		privacy: {
			async startScan(input) { return call('privacy.startScan', input) },
			async getScan(scanId) { return call('privacy.getScan', { scanId }) },
			async listScans(input = {}) { return call('privacy.listScans', input) },
			async getCookies(input = {}) { return call('privacy.getCookies', input) },
			async getSummary() { return call('privacy.getSummary') },
			async updateCookieCategory(cookieId, category) { return call('privacy.updateCookieCategory', { cookieId, category }) },
			async linkToConsentType(cookieId, consentTypeId) { return call('privacy.linkToConsentType', { cookieId, consentTypeId }) },
			async bulkLinkToConsentType(category, consentTypeId) { return call('privacy.bulkLinkToConsentType', { category, consentTypeId }) },
		},
	}
}

/**
 * @deprecated Use `createDynamicSylphx()` from `@sylphx/platform-sdk` instead.
 * This function will be removed in the next major version.
 *
 * Migration:
 * ```typescript
 * // Old (deprecated)
 * const api = createDynamicPlatformAPI(config, getToken)
 * await api.user.getProfile()
 *
 * // New (recommended)
 * import { createDynamicSylphx } from '@sylphx/platform-sdk'
 * const api = createDynamicSylphx({ ...config, getAccessToken: getToken })
 * await api.user.getProfile.query()
 * ```
 */
export function createDynamicPlatformAPI(
	config: Omit<TRPCClientConfig, 'accessToken'>,
	getAccessToken: () => string | undefined,
): PlatformAPI {
	return createPlatformAPI({
		...config,
		get accessToken() {
			return getAccessToken()
		},
	})
}
