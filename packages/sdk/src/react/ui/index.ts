/**
 * Sylphx SDK UI Components
 *
 * Self-contained, embeddable UI components for authentication,
 * user management, and platform services. Like Clerk, but for Sylphx Platform.
 */

// Styles
export {
	type ThemeVariables,
	defaultTheme,
	darkTheme,
	createStyles,
	mergeStyles,
	conditionalStyle,
	baseStyles,
	injectGlobalStyles,
} from './styles'

// Modal
export { Modal, useModal, type ModalProps } from './modal'

// OAuth
export {
	OAuthButton,
	OAuthButtons,
	OrDivider,
	type OAuthProvider,
	type OAuthButtonProps,
	type OAuthButtonsProps,
} from './oauth-buttons'

// Sign In Form
export {
	SignInForm,
	type SignInFormProps,
	type SignInMethod,
} from './sign-in-form'

// Sign Up Form
export {
	SignUpForm,
	type SignUpFormProps,
	type AdditionalField,
} from './sign-up-form'

// User Profile
export {
	UserProfile,
	type UserProfileProps,
	type ProfileSection,
} from './user-profile'

// Security Settings
export {
	SecuritySettings,
	type SecuritySettingsProps,
} from './security-settings'

// Billing Section
export {
	BillingSection,
	type BillingSectionProps,
} from './billing-section'

// Account Section
export {
	AccountSection,
	type AccountSectionProps,
} from './account-section'

// Notification Settings
export {
	NotificationSettings,
	type NotificationSettingsProps,
} from './notification-settings'

// Referral Card
export {
	ReferralCard,
	type ReferralCardProps,
} from './referral-card'

// Model Selector (AI)
export {
	ModelSelector,
	ModelCard,
	ModelGrid,
	type ModelSelectorProps,
	type ModelCardProps,
	type ModelGridProps,
} from './model-selector'

// Cookie Banner (Privacy/GDPR)
export {
	CookieBanner,
	type CookieBannerProps,
} from './cookie-banner'

// Consent Preferences (Privacy/GDPR)
export {
	ConsentPreferences,
	type ConsentPreferencesProps,
} from './consent-preferences'

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
} from './feature-gate'

// File Upload (Storage)
export {
	FileUpload,
	ImageUploader,
	AvatarUpload,
	type FileUploadProps,
	type ImageUploaderProps,
	type AvatarUploadProps,
} from './file-upload'

// Push Notifications
export {
	PushPrompt,
	NotificationBell,
	NotificationList,
	type PushPromptProps,
	type NotificationBellProps,
	type NotificationListProps,
	type Notification,
} from './push-notifications'

// Error Boundary & Feedback (Monitoring)
export {
	ErrorBoundary,
	SylphxErrorBoundary,
	FeedbackWidget,
	type ErrorBoundaryProps,
	type SylphxErrorBoundaryProps,
	type ErrorBoundaryFallbackProps,
	type FeedbackWidgetProps,
} from './error-boundary'

// AI Chat Interface
export {
	ChatInterface,
	ChatBubble,
	ChatInput,
	type ChatInterfaceProps,
	type ChatBubbleProps,
	type ChatInputProps,
	type ChatMessage,
} from './chat-interface'

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
} from './billing-management'

// Organization Management
export {
	OrganizationProfile,
	CreateOrganization,
	OrganizationList,
	type OrganizationProfileProps,
	type CreateOrganizationProps,
	type OrganizationListProps,
} from './organization-management'

// Job Scheduler (Background Jobs)
export {
	JobScheduler,
	JobList,
	CronBuilder,
	type JobSchedulerProps,
	type JobListProps,
	type CronBuilderProps,
} from './job-scheduler'

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
} from './analytics-dashboard'

// Webhook Manager
export {
	WebhookManager,
	WebhookDeliveryLog,
	type WebhookManagerProps,
	type WebhookDeliveryLogProps,
	type Webhook,
	type WebhookDelivery,
} from './webhook-manager'

// Webhook Portal (Complete Embeddable Portal)
export {
	WebhookPortal,
	type WebhookPortalProps,
} from './webhook-portal'

// API Key Manager
export {
	APIKeyManager,
	type APIKeyManagerProps,
	type APIKey,
	type NewAPIKey,
} from './api-key-manager'

// Newsletter Components
export {
	NewsletterForm,
	type NewsletterFormProps,
} from './newsletter-form'

export {
	SubscriberPreferences,
	type SubscriberPreferencesProps,
	type PreferenceOption,
} from './subscriber-preferences'

export {
	UnsubscribeConfirm,
	type UnsubscribeConfirmProps,
} from './unsubscribe-confirm'
