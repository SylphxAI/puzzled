'use client'

/**
 * Puzzled browser identity chrome - public barrel (TD-11).
 *
 * The module was split by concern under ./react (context/providers, auth
 * surface, product + observability hooks, billing, settings/consent UI).
 * Export names and the @/lib/identity/react import path are unchanged.
 */

export type { AppConfig } from './dest'
export {
	type OAuthProvider,
	useAuth,
	useForgotPasswordForm,
	useResetPasswordForm,
	useSafeAuth,
	useSafeUser,
	useSignInForm,
	useSignUpForm,
	useUser,
} from './react/auth'
export { BillingSection, type Plan, useBilling, usePlans, useSafeBilling } from './react/billing'
export { PlatformContext, PlatformProvider, SylphxProvider } from './react/context'
export {
	type PrivacyMode,
	type ReferralStats,
	type SessionReplayConfig,
	useAnalytics,
	useGlobalErrorHandler,
	useNotifications,
	useReferral,
	useSafeAchievements,
	useSafeAnalytics,
	useSafeConsent,
	useSessionReplay,
} from './react/hooks'
export {
	AccountSection,
	CookieBanner,
	OAuthIcons,
	SecuritySettings,
	UserProfile,
} from './react/ui'
