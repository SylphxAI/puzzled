'use client'

/**
 * @sylphx/platform-sdk/react
 *
 * React integration for Sylphx Platform SDK.
 * 13 billable services: AI, Storage, Database, Email, Jobs, Notifications,
 * Analytics, Webhooks, Monitoring, Auth, Flags, Consent, Referrals.
 *
 * @example
 * ```tsx
 * // In your app layout
 * import { SylphxProvider } from '@sylphx/platform-sdk/react'
 *
 * export default function Layout({ children }) {
 *   return (
 *     <SylphxProvider appId="app_prod_xxx">
 *       {children}
 *     </SylphxProvider>
 *   )
 * }
 *
 * // In a component
 * import {
 *   useUser, useAuth, useBilling, useAnalytics, useNotifications, useReferral,
 *   SignedIn, SignedOut, UserButton
 * } from '@sylphx/platform-sdk/react'
 *
 * function Dashboard() {
 *   const { user } = useUser()
 *   const { isPremium } = useBilling()
 *   const { track } = useAnalytics()
 *
 *   return (
 *     <SignedIn>
 *       <h1>Hello, {user?.name}</h1>
 *       {isPremium && <PremiumFeatures />}
 *       <UserButton />
 *     </SignedIn>
 *   )
 * }
 * ```
 */

// Provider
export { SylphxProvider, type SylphxProviderProps } from './provider'

// Config Hooks (Server-First Pattern - config is required)
export {
	ConfigContext,
	useConfig,
	usePlans,
	useOAuthProviders as useConfigOAuthProviders,
	useConsentTypes,
	useFeatureFlagDefinitions,
	useAppMetadata,
	type AppConfig,
	type OAuthProviderInfo,
	type FeatureFlagDefinition,
	type AppMetadata,
} from './hooks/use-config'

// Auth Context (for advanced usage)
export {
	AuthContext,
	type AuthContextValue,
	type AuthState,
	type SignInOptions,
	type SignInWithOAuthOptions,
} from './context'

// OAuth Types (from @sylphx/ui - SSOT)
export { OAuthIcons, OAUTH_PROVIDER_META, type OAuthProvider } from '@sylphx/ui'

// Platform Context (for advanced usage)
export {
	PlatformContext,
	type PlatformContextValue,
	type Subscription,
	type Plan,
	type ReferralStats,
	type PushPreferences,
	type AnalyticsQuery,
	type AnalyticsDataPoint,
	type AnalyticsQueryResult,
	type ClickIds as PlatformClickIds,
} from './platform-context'

// Services Context (for advanced usage)
export {
	AIContext,
	JobsContext,
	MonitoringContext,
	ConsentContext,
	StorageContext,
	NewsletterContext,
	DatabaseContext,
	EmailContext,
	WebhooksContext,
	SdkAuthContext,
	UserContext,
	SecurityContext,
	useAIContext,
	useJobsContext,
	useMonitoringContext,
	useConsentContext,
	useStorageContext,
	useNewsletterContext,
	useDatabaseContext,
	useEmailContext,
	useWebhooksContext,
	useSdkAuthContext,
	useUserContext,
	useSecurityContext,
	type AIContextValue,
	type JobsContextValue,
	type MonitoringContextValue,
	type ConsentContextValue,
	type StorageContextValue,
	type NewsletterContextValue,
	type DatabaseContextValue,
	type EmailContextValue,
	type WebhooksContextValue,
	type SdkAuthContextValue,
	type UserContextValue,
	type SecurityContextValue,
	type AsyncState,
	type DataState,
	// Auth types
	type AuthUser,
	// Newsletter types
	type SubscriberStatus,
	type Subscriber,
	// Database types
	type QueryResult,
	// Email types
	type EmailOptions,
	// Re-export from types.ts for convenience
	// Note: UserProfile type not exported here - conflicts with UserProfile component
	// Import from '@sylphx/platform-sdk' or '../types' directly
	type LoginHistoryEntry,
	type ConnectedAccount,
	type TwoFactorStatus,
	type TwoFactorSetupResult,
	type PasskeyInfo,
	type SecurityScoreResult,
	type SecurityFactor,
	type SecurityRecommendation,
	type SecurityPriority,
	type SecurityGrade,
} from './services-context'

// Re-export auth types from types.ts
export type { AuthLoginResult, AuthRegisterResult } from '../types'

// Auth Hooks
export {
	useUser,
	useAuth,
	useSession,
	useSylphx,
	useOrganization,
	// Safe hooks (don't throw when outside provider)
	useSafeUser,
	useSafeAuth,
	// OAuth providers hook
	useOAuthProviders,
	type UseUserReturn,
	type UseAuthReturn,
	type UseSessionReturn,
	type UseSylphxReturn,
	type SylphxClientConfig,
	type UseOrganizationReturn,
	type UseSafeUserReturn,
	type UseSafeAuthReturn,
	type UseOAuthProvidersReturn,
	type EnabledProvider,
	type AuthSession,
	// Organization types (re-exported from types.ts - SSOT)
	type Organization,
	type OrganizationMember,
	type OrgRole,
} from './hooks'

// Session types (from types.ts - SSOT)
export { type DeviceSession } from '../types'

// Platform Hooks
export {
	useBilling,
	useSafeBilling,
	useAnalytics,
	useSafeAnalytics,
	useAnalyticsQuery,
	useNotifications,
	useMobilePush,
	useReferral,
	useConversionTracking,
	useInbox,
	type UseBillingReturn,
	type UseSafeBillingReturn,
	type UseAnalyticsReturn,
	type UseSafeAnalyticsReturn,
	type UseAnalyticsQueryOptions,
	type UseAnalyticsQueryReturn,
	type UseNotificationsReturn,
	type UseMobilePushReturn,
	type UseReferralReturn,
	type UseConversionTrackingReturn,
	type UseInboxReturn,
	// Analytics/Conversion types
	type TrackOptions,
	type ConversionData,
	type DestinationPlatform,
	type ClickIds,
	// In-App Message types
	type InAppMessage,
	type InAppMessageWithReadStatus,
	type InAppMessageType,
	type InAppMessagePriority,
	type InboxPreferences,
	// Mobile Push types
	type MobileDevice,
} from './platform-hooks'

// Storage Hooks (separated from auth hooks)
export {
	useStorage,
	useFileUpload,
	type UseStorageReturn,
	type UseFileUploadReturn,
	type UseFileUploadOptions,
	type StorageFile,
} from './storage-hooks'

// AI Hooks
export {
	useAI,
	useChat,
	useCompletion,
	useEmbedding,
	useModels,
	type UseAIReturn,
	type UseChatReturn,
	type UseChatOptions,
	type UseCompletionReturn,
	type UseCompletionOptions,
	type UseEmbeddingReturn,
	type UseEmbeddingOptions,
	type UseModelsOptions,
	type UseModelsReturn,
} from './ai-hooks'

// Monitoring Hooks (Error Tracking)
export {
	useErrorTracking,
	useErrorBoundary,
	useGlobalErrorHandler,
	type UseErrorTrackingReturn,
	type UseErrorBoundaryOptions,
	type UseGlobalErrorHandlerOptions,
	type MonitoringLevel,
	type Breadcrumb,
	type CaptureExceptionOptions,
	type CaptureMessageOptions,
} from './monitoring-hooks'

// Background Job Hooks
export {
	useJobs,
	type UseJobsReturn,
	type Job,
	type JobStatus,
	type JobStatusFilter,
	type ScheduleJobInput,
	type CreateCronInput,
	type ScheduleJobResult,
	type CreateCronResult,
} from './job-hooks'

// Consent Hooks (GDPR/CCPA)
export {
	useConsent,
	useSafeConsent,
	useConsentGate,
	ConsentGuard,
	useConsentCheck,
	type ConsentCategory,
	type ConsentType,
	type UserConsent,
	type UseConsentReturn,
	type UseSafeConsentReturn,
	type UseConsentGateOptions,
	type UseConsentGateReturn,
	type ConsentGuardProps,
	type UseConsentCheckOptions,
	type UseConsentCheckReturn,
} from './consent-hooks'

// Consent-Aware Script Loading (GDPR/CCPA Auto-Block)
export {
	// Core Script Components
	ConsentScript,
	ScriptManagerProvider,
	useScriptManager,
	// Known Script Components
	GoogleAnalytics,
	GoogleTagManager,
	FacebookPixel,
	Hotjar,
	Intercom,
	// Google Consent Mode v2
	GoogleConsentMode,
	useGoogleConsentMode,
	// Types
	type ConsentScriptProps,
	type ScriptStrategy,
	type ScriptQueueItem,
	type ScriptManagerContextValue,
	type GoogleAnalyticsProps,
	type GoogleTagManagerProps,
	type FacebookPixelProps,
	type HotjarProps,
	type IntercomProps,
	type GoogleConsentType,
	type GoogleConsentState,
	type GoogleConsentModeConfig,
	type GoogleConsentModeProps,
} from './consent-scripts'

// Feature Flag Hooks (Simple/Polling - React Query based)
// Use for: Basic flag checks, polling refresh, React Query integration
// For SOTA streaming + targeting + A/B tests, see FeatureFlagsProvider below
export {
	FeatureFlagProvider,
	useFeatureFlag,
	useFeatureFlags,
	useFlagOverrides,
	type FeatureFlagProviderProps,
	type FeatureFlagContextValue,
	type FeatureFlag,
	type FlagValue,
	type FlagOverrides,
	type UseFeatureFlagOptions,
	type UseFeatureFlagReturn,
} from './feature-flag-hooks'

// Newsletter Hooks (Part of Email Service - Marketing Email)
// Note: Newsletter is a sub-feature of the Email service
export {
	useNewsletter,
	useSubscriberForm,
	type UseNewsletterReturn,
	type UseSubscriberFormOptions,
	type UseSubscriberFormReturn,
} from './newsletter-hooks'

// Email Hooks
export {
	useEmail,
	type UseEmailReturn,
} from './email-hooks'

// Webhooks Hooks
export {
	useWebhooks,
	useWebhookDeliveries,
	useWebhookStats,
	type UseWebhooksReturn,
	type UseWebhookDeliveriesOptions,
	type UseWebhookDeliveriesReturn,
	type UseWebhookStatsReturn,
} from './webhooks-hooks'

// Engagement Hooks (Streaks, Leaderboards, Achievements)
export {
	useStreak,
	useLeaderboard,
	useAchievements,
	// Safe versions (for SSR/prerendering)
	useSafeStreak,
	useSafeLeaderboard,
	useSafeAchievements,
	type UseStreakReturn,
	type UseLeaderboardReturn,
	type UseAchievementsReturn,
	type UseSafeStreakReturn,
	type UseSafeLeaderboardReturn,
	type UseSafeAchievementsReturn,
} from './engagement-hooks'

// Headless Hooks (for custom UIs)
export {
	useSignInForm,
	type UseSignInFormOptions,
	type UseSignInFormReturn,
	type SignInFormState,
	type SignInStep,
	type SignInMethod,
	type PreSubmitResult,
} from './hooks/use-sign-in-form'

export {
	useSignUpForm,
	type UseSignUpFormOptions,
	type UseSignUpFormReturn,
	type SignUpFormState,
	type SignUpStep,
	type SignUpSubmitResult,
	type AdditionalField,
	type InviteInfo,
} from './hooks/use-sign-up-form'

export {
	useForgotPasswordForm,
	type UseForgotPasswordFormOptions,
	type UseForgotPasswordFormReturn,
	type ForgotPasswordFormState,
} from './hooks/use-forgot-password-form'

export {
	useResetPasswordForm,
	type UseResetPasswordFormOptions,
	type UseResetPasswordFormReturn,
	type ResetPasswordFormState,
} from './hooks/use-reset-password-form'

// Protected route components
export { SignedIn, SignedOut, ProtectedRoute, AuthLoading } from './protected'

// UI Components
export {
	SignIn,
	SignUp,
	UserButton,
	ForgotPassword,
	ResetPassword,
	VerifyEmail,
	OrganizationSwitcher,
	MembersList,
	InviteMember,
	PricingTable,
	BillingCard,
	CheckoutButton,
	// Access control (Clerk-like <Protect> component)
	Protect,
	AdminOnly,
	PremiumOnly,
	useProtect,
	type SignInProps,
	type SignUpProps,
	type UserButtonProps,
	type ForgotPasswordProps,
	type ResetPasswordProps,
	type VerifyEmailProps,
	type OrganizationSwitcherProps,
	type MembersListProps,
	type InviteMemberProps,
	type PricingTableProps,
	type BillingCardProps,
	type CheckoutButtonProps,
	type ProtectProps,
	type StandardRole,
} from './components'

// ============================================================================
// Embedded UI Components (Clerk-like)
// ============================================================================
// Full-featured, self-contained components for common platform functionality.
// These include styling and don't require additional CSS setup.

// Theming & Styles
export {
	type ThemeVariables,
	defaultTheme,
	darkTheme,
	createStyles,
	mergeStyles,
	conditionalStyle,
	baseStyles,
	injectGlobalStyles,
} from './ui/styles'

// Modal
export { Modal, useModal, type ModalProps } from './ui/modal'

// OAuth
export {
	OAuthButton,
	OAuthButtons,
	OrDivider,
	type OAuthButtonProps,
	type OAuthButtonsProps,
} from './ui/oauth-buttons'

// Sign In Form
export {
	SignInForm,
	type SignInFormProps,
	// Note: SignInMethod already exported from hooks
} from './ui/sign-in-form'

// Sign Up Form
export {
	SignUpForm,
	type SignUpFormProps,
	// Note: AdditionalField already exported from hooks
} from './ui/sign-up-form'

// User Profile
export {
	UserProfile,
	type UserProfileProps,
	type ProfileSection,
} from './ui/user-profile'

// Security Settings
export {
	SecuritySettings,
	type SecuritySettingsProps,
} from './ui/security-settings'

// Billing Section
export {
	BillingSection,
	type BillingSectionProps,
} from './ui/billing-section'

// Account Section
export {
	AccountSection,
	type AccountSectionProps,
} from './ui/account-section'

// Notification Settings
export {
	NotificationSettings,
	type NotificationSettingsProps,
} from './ui/notification-settings'

// Referral Card
export {
	ReferralCard,
	type ReferralCardProps,
} from './ui/referral-card'

// Model Selector (AI)
export {
	ModelSelector,
	ModelCard,
	ModelGrid,
	type ModelSelectorProps,
	type ModelCardProps,
	type ModelGridProps,
} from './ui/model-selector'

// Cookie Banner (Privacy/GDPR)
export {
	CookieBanner,
	type CookieBannerProps,
} from './ui/cookie-banner'

// Consent Preferences (Privacy/GDPR)
export {
	ConsentPreferences,
	type ConsentPreferencesProps,
} from './ui/consent-preferences'

// Feature Gates (Feature Flags)
export {
	FeatureGate,
	FeatureVariant,
	FeatureValue,
	FlagDevTools,
	type FeatureGateProps,
	type FeatureVariantProps,
	type FeatureValueProps,
	type FlagDevToolsProps,
} from './ui/feature-gate'

// File Upload (Storage)
export {
	FileUpload,
	ImageUploader,
	AvatarUpload,
	type FileUploadProps,
	type ImageUploaderProps,
	type AvatarUploadProps,
} from './ui/file-upload'

// Push Notifications
export {
	PushPrompt,
	NotificationBell,
	NotificationList,
	type PushPromptProps,
	type NotificationBellProps,
	type NotificationListProps,
	type Notification,
} from './ui/push-notifications'

// Error Boundary & Feedback (Monitoring)
export {
	ErrorBoundary,
	SylphxErrorBoundary,
	FeedbackWidget,
	type ErrorBoundaryProps,
	type SylphxErrorBoundaryProps,
	type ErrorBoundaryFallbackProps,
	type FeedbackWidgetProps,
} from './ui/error-boundary'

// AI Chat Interface
export {
	ChatInterface,
	ChatBubble,
	ChatInput,
	type ChatInterfaceProps,
	type ChatBubbleProps,
	type ChatInputProps,
	type ChatMessage,
} from './ui/chat-interface'

// Billing Management (Invoice, Payment Methods, Usage)
export {
	InvoiceHistory,
	PaymentMethodManager,
	UsageOverview,
	type InvoiceHistoryProps,
	type PaymentMethodManagerProps,
	type UsageOverviewProps,
	type Invoice,
	type PaymentMethod,
	type UsageItem,
} from './ui/billing-management'

// Organization Management
export {
	OrganizationProfile,
	CreateOrganization,
	OrganizationList,
	type OrganizationProfileProps,
	type CreateOrganizationProps,
	type OrganizationListProps,
} from './ui/organization-management'

// Job Scheduler (Background Jobs)
export {
	JobScheduler,
	JobList,
	CronBuilder,
	type JobSchedulerProps,
	type JobListProps,
	type CronBuilderProps,
} from './ui/job-scheduler'

// Analytics Dashboard
export {
	EventViewer,
	StatsCard,
	StatsGrid,
	SimpleChart,
	AnalyticsDashboard,
	type EventViewerProps,
	type StatsCardProps,
	type StatsGridProps,
	type SimpleChartProps,
	type AnalyticsDashboardProps,
	type AnalyticsEvent,
	type AnalyticsStat,
	type TimeSeriesData,
} from './ui/analytics-dashboard'

// Webhook Manager
export {
	WebhookManager,
	WebhookDeliveryLog,
	type WebhookManagerProps,
	type WebhookDeliveryLogProps,
	type Webhook,
	type WebhookDelivery,
} from './ui/webhook-manager'

// API Key Manager
export {
	APIKeyManager,
	type APIKeyManagerProps,
	type APIKey,
	type NewAPIKey,
} from './ui/api-key-manager'

// Newsletter Components (Part of Email Service - Marketing Email)
export {
	NewsletterForm,
	type NewsletterFormProps,
} from './ui/newsletter-form'

export {
	SubscriberPreferences,
	type SubscriberPreferencesProps,
	type PreferenceOption,
} from './ui/subscriber-preferences'

export {
	UnsubscribeConfirm,
	type UnsubscribeConfirmProps,
} from './ui/unsubscribe-confirm'

// ============================================================================
// Security Utilities
// ============================================================================
// Safe redirect and URL validation functions to prevent XSS attacks.

export { safeRedirect, isValidRedirectUrl, sanitizeUrl } from './security-utils'

// ============================================================================
// Key Validation — Single Source of Truth
// ============================================================================
// Industry-standard API key validation following Stripe, Clerk, Firebase patterns.
// Validates format, provides clear errors, and warns about common issues.
// ALL key validation logic lives in ../key-validation.ts

export {
	// Generic key validation (auto-detects type)
	validateKey,
	validateAndSanitizeKey,
	// App ID validation
	validateAppId,
	validateAndSanitizeAppId,
	// Secret key validation
	validateSecretKey,
	validateAndSanitizeSecretKey,
	// Environment detection
	detectEnvironment,
	isDevelopmentKey,
	isProductionKey,
	isDevelopmentRuntime,
	// Cookie namespace
	getCookieNamespace,
	// Key type detection
	detectKeyType,
	isAppId,
	isSecretKey,
	// Types
	type KeyValidationResult,
	type EnvironmentType,
	type KeyType,
} from '../key-validation'

// ============================================================================
// Session Replay (SOTA - built on rrweb)
// ============================================================================
// State-of-the-art session replay with automatic PII detection,
// error correlation, rage click detection, and AI summaries.

export {
	useSessionReplay,
	useSessionReplayErrorMarker,
	withSessionReplay,
	type UseSessionReplayOptions,
	type UseSessionReplayReturn,
	type WithSessionReplayProps,
} from './hooks/use-session-replay'

// Session Replay Core (for advanced usage)
export {
	SessionRecorder,
	getRecorder,
	resetRecorder,
	RageClickDetector,
	DeadClickDetector,
	ScrollThrashingDetector,
	detectSensitiveFields,
	getPrivacyOptions,
	sanitizeForLogging,
	sanitizeUrl as sanitizeReplayUrl,
	generatePrivacyReport,
	DEFAULT_SESSION_REPLAY_CONFIG as SESSION_REPLAY_DEFAULT_CONFIG,
	type PrivacyMode,
	type SamplingStrategy,
	type SessionReplayConfig,
	type MarkerType,
	type SessionMarker,
	type RageClick,
	type DeadClick,
	type NetworkRequest,
	type ConsoleLog,
	type SessionMetadata,
	type SessionData,
	type SessionSummary,
	type EventCallback,
	type SessionUploadCallback as UploadCallback,
	type ErrorCallback,
	type RecorderState,
	type RecorderStatus,
} from '../lib/monitoring'

// ============================================================================
// Web Vitals (Core Web Vitals Monitoring)
// ============================================================================
// State-of-the-art performance monitoring with automatic Core Web Vitals
// tracking, analytics integration, and performance scoring.

export {
	// Hooks
	useWebVitals,
	useWebVital,
	useWebVitalsAnalytics,
	// Types
	type UseWebVitalsOptions,
	type UseWebVitalsReturn,
	type UseWebVitalOptions,
	type UseWebVitalReturn,
	type UseWebVitalsAnalyticsOptions,
} from './hooks/use-web-vitals'

// Web Vitals Core (for advanced usage)
export {
	initWebVitals,
	getWebVitalsReport,
	getMetric,
	checkCoreWebVitals,
	resetWebVitals,
	isWebVitalsInitialized,
	WEB_VITALS_THRESHOLDS,
	DEFAULT_WEB_VITALS_CONFIG,
	type CoreWebVitalName,
	type WebVitalName,
	type MetricRating,
	type WebVitalMetric,
	type WebVitalAttribution,
	type WebVitalsReport,
	type WebVitalsConfig,
} from '../lib/monitoring'

// ============================================================================
// Enhanced Error Tracking (with Session Replay integration)
// ============================================================================
// Sentry-compatible error tracking with automatic breadcrumb collection
// and Session Replay correlation.

export {
	useEnhancedErrorTracking,
	useCombinedMonitoring,
	type UseEnhancedErrorTrackingOptions,
	type UseEnhancedErrorTrackingReturn,
	type UseCombinedMonitoringOptions,
} from './hooks/use-error-tracking'

// Error Tracking Core (for advanced usage)
export {
	ErrorTracker,
	getTracker,
	initErrorTracking,
	resetTracker,
	addBreadcrumb as addErrorBreadcrumb,
	getBreadcrumbs as getErrorBreadcrumbs,
	clearBreadcrumbs as clearErrorBreadcrumbs,
	enableAutoCapture,
	DEFAULT_ERROR_CONFIG,
	type ErrorEvent,
	type ErrorTrackingConfig,
	type CaptureExceptionOptions as ErrorCaptureExceptionOptions,
	type CaptureMessageOptions as ErrorCaptureMessageOptions,
	type CaptureResult,
	type Breadcrumb as ErrorBreadcrumb,
	type BreadcrumbType,
	type StackFrame,
	type ExceptionValue,
} from '../lib/monitoring'

// ============================================================================
// SOTA Feature Flags (Local Evaluation + SSE Streaming + A/B Testing)
// ============================================================================
// Zero-latency client-side flag evaluation with real-time streaming updates,
// consistent bucketing, flexible targeting, and built-in A/B testing support.

export {
	// Provider & Hooks
	FeatureFlagsProvider,
	useFeatureFlags as useFlags,
	useFlag,
	useFlagString,
	useFlagNumber,
	useFlagJSON,
	useFlagEvaluation,
	useExperiment,
	useIsInVariant,
	useIsInTreatment,
	useFlagsReady,
	type FeatureFlagsProviderProps,
	type UseFeatureFlagsReturn as UseFlagsReturn,
} from './hooks/use-flags'

// Feature Flags Core (for advanced usage)
export {
	LocalEvaluator,
	getEvaluator,
	initFeatureFlags,
	resetEvaluator,
	FlagStream,
	createFlagStream,
	fetchFlags,
	pollFlags,
	ExperimentManager,
	getExperimentManager,
	createExperiment,
	calculateSampleSize,
	calculateExperimentDuration,
	murmurHash3,
	getBucket,
	getUserBucket,
	selectVariant,
	DEFAULT_FLAGS_CONFIG,
	type FlagValue as FlagsValue,
	type FlagVariant,
	type FlagDefinition,
	type EvaluationContext,
	type EvaluationResult,
	type EvaluationReason,
	type TargetingRule,
	type TargetingCondition,
	type TargetingOperator,
	type Experiment,
	type ExperimentExposure,
	type FeatureFlagsConfig,
	type FlagClientEvent,
} from '../lib/flags'

// ============================================================================
// SOTA Analytics (Smart Autocapture + SPA Navigation + Intelligent Naming)
// ============================================================================
// PostHog-compatible analytics with smart autocapture, intelligent element
// naming, SPA navigation tracking, and attribution.

export {
	// Provider & Hooks
	AnalyticsProvider,
	useAnalyticsHook as useSmartAnalytics,
	usePageView,
	useComponentTracking,
	useFeatureTracking,
	useFormTracking,
	useTimeTracking,
	type AnalyticsProviderProps,
	type UseAnalyticsReturn as UseSmartAnalyticsReturn,
} from './hooks/use-analytics'

// Analytics Core (for advanced usage)
export {
	AnalyticsTracker,
	getAnalyticsTracker,
	initAnalytics,
	resetAnalyticsTracker,
	Autocapture,
	initAutocapture,
	NavigationTracker,
	initNavigationTracker,
	analyzeReferrer,
	generateElementName,
	generateEventName,
	buildElementData,
	DEFAULT_ANALYTICS_CONFIG,
	DEFAULT_AUTOCAPTURE_CONFIG,
	type AnalyticsConfig,
	type AutocaptureConfig,
	type AnalyticsEvent as SmartAnalyticsEvent,
	type EventProperties as AnalyticsEventProperties,
	type UserProperties as AnalyticsUserProperties,
	type ElementData,
	type UtmParams,
	type ReferrerData,
	type AttributionData,
	type DeviceContext as AnalyticsDeviceContext,
	type PageContext as AnalyticsPageContext,
} from '../lib/analytics'

// ============================================================================
// Analytics Destination Routing
// ============================================================================
// Route analytics events to multiple destinations (GA4, Mixpanel, Segment, etc.)
// with consent-aware routing and event transformation.

export {
	// Hook & Provider
	useDestinationRouter,
	DestinationRouterProvider,
	useRouterContext,
	// Types
	type UseDestinationRouterOptions,
	type UseDestinationRouterReturn,
	type DestinationRouterProviderProps,
} from './hooks/use-destination-router'

// Destination Router Core (for advanced usage)
export {
	createDestinationRouter,
	type DestinationType,
	type DestinationConsentCategory,
	type BaseDestinationConfig,
	type SylphxDestinationConfig,
	type GA4DestinationConfig,
	type GTMDestinationConfig,
	type MixpanelDestinationConfig,
	type SegmentDestinationConfig,
	type PostHogDestinationConfig,
	type AmplitudeDestinationConfig,
	type CustomDestinationConfig,
	type DestinationConfig,
	type DestinationRouterConfig,
	type DestinationRouter,
} from '../lib/analytics'

// ============================================================================
// SOTA Background Jobs (Workflow DSL + Durable Execution)
// ============================================================================
// Inngest/Trigger.dev-style workflow builder with type-safe step definitions,
// conditional branching, parallel execution, and saga patterns.

export {
	// Client
	JobsClient,
	createJobsClient,

	// Workflow Builder
	createWorkflow,
	WorkflowBuilder,

	// Step Builders
	job,
	conditional,
	parallel,
	loop,
	wait,
	subworkflow,

	// Step Helpers
	jobIf,
	delay,
	sleepUntil,
	withRetry,
	withTimeout,

	// Composition
	sequence,
	fanOut,
	saga,
	type SagaStep,

	// Validation
	validateWorkflow,

	// Constants
	DEFAULT_JOBS_CONFIG,
	DEFAULT_RETRY_DELAYS,

	// Types
	type JobStatus as JobsStatus,
	type JobPriority,
	type JobPayload,
	type JobResult,
	type JobDefinition,
	type JobOptions,
	type RetryDelayStrategy,
	type DLQOptions,
	type Job as JobInstance,
	type JobContext,
	type WorkflowDefinition,
	type WorkflowOptions,
	type WorkflowStep,
	type JobStep,
	type ConditionalStep,
	type ParallelStep,
	type LoopStep,
	type WaitStep,
	type SubworkflowStep,
	type StepContext,
	type Workflow,
	type CronSchedule,
	type ScheduledJob,
	type JobEvent,
	type WorkflowEvent,
	type JobsConfig,
} from '../lib/jobs'
