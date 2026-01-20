/**
 * Services Context
 *
 * React Context for all SDK services including Auth, AI, Jobs, etc.
 * All types are INFERRED from the tRPC router - no manual type definitions.
 */

import { createContext, useContext, type Context } from 'react'

// ============================================================================
// Import ALL types from tRPC (inferred from API router)
// ============================================================================

import type {
	// Router inference helpers
	RouterInputs,
	RouterOutputs,
	// Jobs
	Job,
	JobsListResult,
	JobStatusEnum,
	JobTypeEnum,
	ScheduleJobInput,
	ScheduleJobResult,
	CreateCronInput,
	CreateCronResult,
	JobsStatusResult,
	// Webhooks
	WebhookConfig,
	WebhookEnvironment,
	WebhookDelivery,
	WebhookDeliveryStatus,
	WebhookStats,
	WebhookStatsPeriod,
	UpdateWebhookConfigInput,
	UpdateWebhookConfigResult,
	ReplayDeliveryResult,
	GetDeliveriesInput,
	WebhookDeliveriesResult,
	// Consent
	ConsentType,
	UserConsent,
	SetConsentsResult,
	// Monitoring
	CaptureExceptionResult,
	CaptureMessageResult,
	MonitoringLevel,
	// Auth
	AuthLoginResult,
	AuthRegisterResult,
	AuthVerify2FAResult,
	AuthMeResult,
	// User
	UserProfile,
	LoginHistoryEntry,
	UserSessionInfo,
	ConnectedAccount,
	// Security
	TwoFactorStatus,
	TwoFactorSetupResult,
	TwoFactorVerifyResult,
	PasskeyInfo,
	SecurityScoreResult,
	PasswordStatus,
	// AI
	AIUsageStats,
	AIRateLimitStatus,
	AIModelsResponse,
	AIUsagePeriod,
	// Newsletter
	NewsletterSubscribeInput,
	NewsletterSubscribeResult,
	NewsletterVerifyResult,
	NewsletterUnsubscribeResult,
	NewsletterUnsubscribeInfo,
	NewsletterPreferences,
	// Email
	SendEmailResult,
	SendTemplatedResult,
} from '../trpc'

// Re-export commonly used types for convenience
export type {
	// Jobs (note: Job/JobsListResult are SDK-specific, defined below)
	JobStatusEnum,
	JobTypeEnum,
	ScheduleJobInput,
	ScheduleJobResult,
	CreateCronInput,
	CreateCronResult,
	// Webhooks
	WebhookConfig,
	WebhookEnvironment,
	WebhookDelivery,
	WebhookDeliveryStatus,
	WebhookStats,
	WebhookStatsPeriod,
	// Consent
	ConsentType,
	UserConsent,
	// User
	UserProfile,
	LoginHistoryEntry,
	UserSessionInfo,
	ConnectedAccount,
	// Security
	TwoFactorStatus,
	TwoFactorSetupResult,
	PasskeyInfo,
	SecurityScoreResult,
	// AI
	AIUsageStats,
	AIRateLimitStatus,
	AIModelsResponse,
}

// ============================================================================
// Type Aliases for Backward Compatibility
// Maps old hook type names to new tRPC-inferred types
// ============================================================================

// ============================================================================
// SDK-Specific Job Types
// The SDK layer uses its own job status enum that includes all possible states
// ============================================================================

/** SDK Job status - includes all possible states */
export type SdkJobStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'scheduled' | 'paused' | 'deleted'

/** SDK Job status filter for listing jobs */
export type SdkJobStatusFilter = SdkJobStatus

// Jobs type aliases for backward compatibility
/** @deprecated Use SdkJobStatus instead */
export type JobStatus = SdkJobStatus
/** @deprecated Use SdkJobStatusFilter instead */
export type JobStatusFilter = SdkJobStatusFilter
/** @deprecated Use ScheduleJobInput instead */
export type ScheduleJobOptions = ScheduleJobInput
/** @deprecated Use CreateCronInput instead */
export type CreateCronOptions = CreateCronInput
/** @deprecated Use ScheduleJobResult instead */
export type ScheduleResult = ScheduleJobResult
/** @deprecated Use CreateCronResult instead */
export type CronResult = CreateCronResult

// Monitoring type aliases
/** @deprecated Use MonitoringLevel instead */
export type ErrorLevel = MonitoringLevel

// Webhooks type aliases
/** @deprecated Use WebhookStatsPeriod instead */
export type StatsPeriod = WebhookStatsPeriod

// Auth type aliases
/** @deprecated Use AuthLoginResult instead */
export type LoginResult = AuthLoginResult
/** @deprecated Use AuthRegisterResult instead */
export type RegisterResult = AuthRegisterResult

// User type aliases
/** @deprecated Use UserProfile instead */
export type UserProfileData = UserProfile
/** @deprecated Use LoginHistoryEntry instead */
export type LoginHistoryItem = LoginHistoryEntry

// Security type aliases
/** @deprecated Use SecurityScoreResult instead */
export type SecurityScore = SecurityScoreResult

// Newsletter type aliases
/** @deprecated Use NewsletterSubscribeInput instead */
export type SubscribeOptions = NewsletterSubscribeInput
/** @deprecated Use NewsletterSubscribeResult instead */
export type SubscribeResult = NewsletterSubscribeResult

// Email type aliases
export type EmailOptions = {
	to: string
	subject: string
	html: string
	text?: string
	replyTo?: string
}
export type SimpleEmailOptions = EmailOptions
export type EmailStatus = 'sent' | 'pending' | 'failed'
export type EmailTemplateName = string

// Consent type aliases (category is typically the slug)
export type ConsentCategory = string

// ============================================================================
// SDK-Specific Types for Monitoring (Sentry-compatible)
// ============================================================================

/** Stack frame for exception tracing */
export interface StackFrame {
	filename?: string
	function?: string
	lineno?: number
	colno?: number
	in_app?: boolean
}

/** Exception value with stack trace */
export interface ExceptionValue {
	type: string
	value: string
	stacktrace?: {
		frames: StackFrame[]
	}
}

/** Breadcrumb for debugging context */
export interface Breadcrumb {
	type?: string
	category?: string
	message?: string
	level?: MonitoringLevel
	data?: Record<string, unknown>
	timestamp?: number
}

/** Options for captureException */
export interface CaptureExceptionOptions {
	level?: MonitoringLevel
	tags?: Record<string, string>
	extra?: Record<string, unknown>
	fingerprint?: string[]
	route?: string
	userAgent?: string
}

/** Options for captureMessage */
export interface CaptureMessageOptions {
	level?: MonitoringLevel
	tags?: Record<string, string>
	extra?: Record<string, unknown>
	route?: string
}

// ============================================================================
// SDK-Specific Types for Newsletter
// ============================================================================

/** Subscriber status */
export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed'

/** Subscriber preference key type */
export type SubscriberPreferenceKey = string

/** Subscriber type for newsletter */
export interface Subscriber {
	email: string
	name?: string
	status: SubscriberStatus
	preferences?: Record<string, boolean>
	subscribedAt?: string
	unsubscribedAt?: string
}

// Import AI types that are SDK-specific (not from router)
import type {
	AIMessage,
	AITool,
	ChatCompletionInput,
	ChatCompletionResponse,
	TextCompletionInput,
	TextCompletionResponse,
	EmbeddingInput,
	EmbeddingResponse,
	VisionInput,
	AIModelInfo,
	AIListModelsOptions,
	AIStreamChunk,
	AIRateLimitInfo,
} from '../types'

// ============================================
// SDK-Specific Types (not from router)
// ============================================

/**
 * Standard async operation state
 */
export interface AsyncState<TError = Error> {
	/** Whether an operation is in progress */
	isLoading: boolean
	/** Last error from an operation */
	error: TError | null
}

/**
 * Standard data fetch state
 */
export interface DataState<T, TError = Error> extends AsyncState<TError> {
	/** The fetched data */
	data: T | null
	/** Whether there was an error */
	isError: boolean
}

// ============================================
// Generic Context Helper
// ============================================

/**
 * Generic helper to get required context value
 * Throws descriptive error if used outside provider
 */
export function useRequiredContext<T>(context: Context<T | null>, serviceName: string): T {
	const value = useContext(context)
	if (!value) {
		throw new Error(`${serviceName} hooks must be used within a SylphxProvider`)
	}
	return value
}

// ============================================
// AI Context
// ============================================

export interface AIContextValue {
	chat: (input: ChatCompletionInput) => Promise<ChatCompletionResponse>
	chatStream: (input: ChatCompletionInput) => AsyncIterable<AIStreamChunk>
	complete: (input: TextCompletionInput) => Promise<TextCompletionResponse>
	embed: (input: EmbeddingInput) => Promise<EmbeddingResponse>
	vision: (input: VisionInput) => Promise<ChatCompletionResponse>
	getUsage: (period: AIUsagePeriod) => Promise<AIUsageStats>
	getRateLimitStatus: () => Promise<AIRateLimitInfo>
	listModels: (options?: AIListModelsOptions) => Promise<AIModelsResponse>
}

export const AIContext = createContext<AIContextValue | null>(null)

export function useAIContext(): AIContextValue {
	return useRequiredContext(AIContext, 'AI')
}

// ============================================
// Jobs Context
// ============================================

/** SDK Job type with all optional fields for flexibility */
export interface SdkJob {
	id: string
	name: string | null
	type: string
	status: SdkJobStatus
	callbackUrl: string
	payload?: unknown
	scheduledFor: Date | null
	startedAt?: Date | null
	completedAt?: Date | null
	failedAt?: Date | null
	errorMessage?: string | null
	lastError?: string | null
	retries: number
	maxRetries: number
	createdAt: Date
}

/** SDK Jobs List Result */
export interface SdkJobsListResult {
	jobs: SdkJob[]
	total: number
	limit?: number
	offset?: number
	hasMore?: boolean
}

export interface JobsContextValue {
	checkStatus: () => Promise<JobsStatusResult>
	schedule: (options: ScheduleJobInput) => Promise<ScheduleJobResult>
	createCron: (options: CreateCronInput) => Promise<CreateCronResult>
	pauseCron: (scheduleId: string) => Promise<boolean>
	resumeCron: (scheduleId: string) => Promise<boolean>
	deleteCron: (scheduleId: string) => Promise<boolean>
	getJob: (jobId: string) => Promise<SdkJob>
	listJobs: (options?: {
		status?: SdkJobStatusFilter
		type?: 'one-time' | 'cron'
		limit?: number
		offset?: number
	}) => Promise<SdkJobsListResult>
	cancelJob: (jobId: string) => Promise<boolean>
}

export const JobsContext = createContext<JobsContextValue | null>(null)

export function useJobsContext(): JobsContextValue {
	return useRequiredContext(JobsContext, 'Jobs')
}

// ============================================
// Monitoring Context
// ============================================

export interface MonitoringContextValue {
	captureException: (
		error: Error,
		options?: {
			level?: MonitoringLevel
			tags?: Record<string, string>
			extra?: Record<string, unknown>
			fingerprint?: string[]
			route?: string
			userAgent?: string
		}
	) => Promise<CaptureExceptionResult>
	captureMessage: (
		message: string,
		options?: {
			level?: MonitoringLevel
			tags?: Record<string, string>
			extra?: Record<string, unknown>
			route?: string
		}
	) => Promise<CaptureMessageResult>
}

export const MonitoringContext = createContext<MonitoringContextValue | null>(null)

export function useMonitoringContext(): MonitoringContextValue {
	return useRequiredContext(MonitoringContext, 'Monitoring')
}

// ============================================
// Consent Context
// ============================================

export interface ConsentContextValue {
	anonymousId: string | null
	userId: string | null
	getConsentTypes: () => Promise<ConsentType[]>
	getUserConsents: () => Promise<UserConsent[]>
	setConsents: (consents: { slug: string; granted: boolean }[]) => Promise<SetConsentsResult>
	acceptAll: () => Promise<SetConsentsResult>
	declineOptional: () => Promise<SetConsentsResult>
}

export const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsentContext(): ConsentContextValue {
	return useRequiredContext(ConsentContext, 'Consent')
}

// ============================================
// Storage Context
// ============================================

export interface UploadProgressEvent {
	loaded: number
	total: number
	progress: number
}

export interface UploadOptions {
	path?: string
	onProgress?: (event: UploadProgressEvent) => void
}

export interface StorageContextValue {
	upload: (file: File, options?: UploadOptions) => Promise<string>
	uploadAvatar: (file: File, options?: { onProgress?: (event: UploadProgressEvent) => void }) => Promise<string>
	deleteFile: (fileId: string) => Promise<void>
	getUrl: (fileId: string) => Promise<string | null>
}

export const StorageContext = createContext<StorageContextValue | null>(null)

export function useStorageContext(): StorageContextValue {
	return useRequiredContext(StorageContext, 'Storage')
}

// ============================================
// Newsletter Context (deprecated - use Email)
// ============================================

export interface NewsletterContextValue {
	subscribe: (options: NewsletterSubscribeInput) => Promise<NewsletterSubscribeResult>
	verify: (token: string) => Promise<NewsletterVerifyResult>
	unsubscribe: (email: string, token: string) => Promise<NewsletterUnsubscribeResult>
	resendVerification: (email: string) => Promise<{ success: boolean; message: string }>
	getUnsubscribeInfo: (token: string) => Promise<NewsletterUnsubscribeInfo>
	updatePreferences: (email: string, preferences: Record<string, boolean>) => Promise<{ success: boolean; preferences: Array<{ key: string; enabled: boolean }> }>
	getPreferences: (email: string) => Promise<NewsletterPreferences>
}

/** @deprecated Use EmailContext instead */
export const NewsletterContext = createContext<NewsletterContextValue | null>(null)

/** @deprecated Use useEmailContext().newsletter instead */
export function useNewsletterContext(): NewsletterContextValue {
	return useRequiredContext(NewsletterContext, 'Newsletter')
}

// ============================================
// Database Context
// ============================================

export interface QueryResult<T = unknown> {
	rows: T[]
	rowCount: number
}

export interface DatabaseContextValue {
	query: <T = unknown>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>
	execute: (sql: string, params?: unknown[]) => Promise<{ rowCount: number }>
	transaction: <T>(fn: (tx: DatabaseContextValue) => Promise<T>) => Promise<T>
}

export const DatabaseContext = createContext<DatabaseContextValue | null>(null)

export function useDatabaseContext(): DatabaseContextValue {
	return useRequiredContext(DatabaseContext, 'Database')
}

// ============================================
// Email Context
// ============================================

export interface EmailContextValue {
	send: (options: { to: string; subject: string; html: string; text?: string; replyTo?: string }) => Promise<SendEmailResult>
	sendTemplated: (options: { template: string; to: string; data?: Record<string, unknown> }) => Promise<{ success: boolean; template: string }>
	sendToUser: (options: { userId: string; subject: string; html: string; text?: string }) => Promise<SendEmailResult>
	newsletter: NewsletterContextValue
}

export const EmailContext = createContext<EmailContextValue | null>(null)

export function useEmailContext(): EmailContextValue {
	return useRequiredContext(EmailContext, 'Email')
}

// ============================================
// Webhooks Context
// ============================================

export interface WebhooksContextValue {
	getConfig: () => Promise<WebhookConfig>
	updateConfig: (options: UpdateWebhookConfigInput) => Promise<UpdateWebhookConfigResult>
	getDeliveries: (options?: GetDeliveriesInput) => Promise<WebhookDeliveriesResult>
	replayDelivery: (deliveryId: string) => Promise<ReplayDeliveryResult>
	getStats: (period: WebhookStatsPeriod) => Promise<WebhookStats>
}

export const WebhooksContext = createContext<WebhooksContextValue | null>(null)

export function useWebhooksContext(): WebhooksContextValue {
	return useRequiredContext(WebhooksContext, 'Webhooks')
}

// ============================================
// Auth Context (SDK Auth for direct API calls)
// ============================================

/** User shape from SDK auth operations */
export interface SdkAuthUser {
	id: string
	email: string
	name: string | null
	image: string | null
	emailVerified: boolean
	twoFactorEnabled: boolean
}

/** Login result shape from SDK */
export interface SdkLoginResult {
	requiresTwoFactor: boolean
	userId?: string
	user?: SdkAuthUser
}

/** 2FA verification result shape from SDK */
export interface SdkVerify2FAResult {
	accessToken: string
	refreshToken: string
	expiresIn: number
	user: SdkAuthUser
}

/** Registration result shape from SDK */
export interface SdkRegisterResult {
	requiresVerification: boolean
	message: string
	user: {
		id: string
		email: string
		name: string | null
	}
}

/** User shape from auth.me() */
export interface AuthUser {
	id: string
	email: string
	name: string | null
	image: string | null
	emailVerified: boolean
	twoFactorEnabled: boolean
}

export interface SdkAuthContextValue {
	login: (email: string, password: string) => Promise<SdkLoginResult>
	verifyTwoFactor: (userId: string, code: string) => Promise<SdkVerify2FAResult>
	register: (name: string, email: string, password: string) => Promise<SdkRegisterResult>
	forgotPassword: (email: string) => Promise<{ success: boolean; message: string }>
	resetPassword: (token: string, password: string) => Promise<{ success: boolean }>
	verifyEmail: (token: string) => Promise<{ success: boolean }>
	logout: (refreshToken?: string) => Promise<{ success: boolean }>
	me: () => Promise<AuthUser>
	getOAuthProviders: () => Promise<{ providers: string[] }>
}

export const SdkAuthContext = createContext<SdkAuthContextValue | null>(null)

export function useSdkAuthContext(): SdkAuthContextValue {
	return useRequiredContext(SdkAuthContext, 'SdkAuth')
}

// ============================================
// User Context
// ============================================

/** SDK User Profile (includes computed fields) */
export interface SdkUserProfile {
	id: string
	email: string
	name: string | null
	image: string | null
	emailVerified: boolean
	twoFactorEnabled: boolean
	createdAt: Date
}

/** SDK Login History Entry (transformed from API) */
export interface SdkLoginHistoryEntry {
	id: string
	ipAddress: string | null
	userAgent: string | null
	location: string | null
	device: string | null
	browser: string | null
	os: string | null
	loginAt: Date
	successful: boolean
}

/** SDK Connected Account (transformed from API) */
export interface SdkConnectedAccount {
	provider: string
	accountId: string
	email: string | null
	name: string | null
	image: string | null
	connectedAt: Date
}

export interface UserContextValue {
	getProfile: () => Promise<SdkUserProfile>
	updateProfile: (data: { name?: string; image?: string }) => Promise<SdkUserProfile>
	changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean }>
	getLoginHistory: (options?: { limit?: number }) => Promise<SdkLoginHistoryEntry[]>
	getSessions: () => Promise<UserSessionInfo[]>
	revokeSession: (sessionId: string) => Promise<{ success: boolean }>
	revokeAllSessions: () => Promise<{ success: boolean; count: number }>
	getConnectedAccounts: () => Promise<SdkConnectedAccount[]>
	deleteAccount: (password?: string) => Promise<{ success: boolean }>
	exportData: () => Promise<{ downloadUrl: string; expiresAt: Date }>
}

export const UserContext = createContext<UserContextValue | null>(null)

export function useUserContext(): UserContextValue {
	return useRequiredContext(UserContext, 'User')
}

// ============================================
// Security Context
// ============================================

/** SDK 2FA Status */
export interface SdkTwoFactorStatus {
	enabled: boolean
	backupCodesRemaining: number
}

/** SDK Password Status */
export interface SdkPasswordStatus {
	hasPassword: boolean
}

/** SDK Passkey Info (transformed from API) */
export interface SdkPasskeyInfo {
	id: string
	name?: string
	deviceType?: string
	createdAt: Date
	lastUsedAt: Date | null
}

export interface SecurityContextValue {
	getTwoFactorStatus: () => Promise<SdkTwoFactorStatus>
	twoFactorSetup: () => Promise<TwoFactorSetupResult>
	twoFactorVerify: (code: string) => Promise<TwoFactorVerifyResult>
	twoFactorDisable: (code: string) => Promise<{ success: boolean }>
	backupCodesView: (code: string) => Promise<{ codes: string[]; remaining?: number }>
	backupCodesRegenerate: (code: string) => Promise<{ codes: string[] }>
	getPasswordStatus: () => Promise<SdkPasswordStatus>
	passwordSet: (password: string) => Promise<{ success: boolean }>
	emailChangeRequest: (newEmail: string) => Promise<{ success: boolean; message: string }>
	emailChangeConfirm: (token: string) => Promise<{ success: boolean; newEmail: string }>
	passkeyList: () => Promise<SdkPasskeyInfo[]>
	passkeyRegisterStart: () => Promise<unknown>
	passkeyRegisterVerify: (credential: unknown, name?: string) => Promise<SdkPasskeyInfo>
	oauthConnect: (provider: string) => Promise<{ redirectUrl: string }>
	oauthDisconnect: (provider: string) => Promise<{ success: boolean }>
	getSecurityScore: () => Promise<SecurityScoreResult>
}

export const SecurityContext = createContext<SecurityContextValue | null>(null)

export function useSecurityContext(): SecurityContextValue {
	return useRequiredContext(SecurityContext, 'Security')
}
