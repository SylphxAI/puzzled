/**
 * SDK Hooks
 *
 * Headless hooks for building custom UIs.
 */

export {
	useSignInForm,
	type UseSignInFormOptions,
	type UseSignInFormReturn,
	type SignInFormState,
	type SignInStep,
	type SignInMethod,
	type PreSubmitResult,
} from './use-sign-in-form'

export {
	useSignUpForm,
	type UseSignUpFormOptions,
	type UseSignUpFormReturn,
	type SignUpFormState,
	type SignUpStep,
	type SignUpSubmitResult,
	type AdditionalField,
	type InviteInfo,
} from './use-sign-up-form'

export {
	useForgotPasswordForm,
	type UseForgotPasswordFormOptions,
	type UseForgotPasswordFormReturn,
	type ForgotPasswordFormState,
} from './use-forgot-password-form'

export {
	useResetPasswordForm,
	type UseResetPasswordFormOptions,
	type UseResetPasswordFormReturn,
	type ResetPasswordFormState,
} from './use-reset-password-form'

export {
	useSessionReplay,
	useSessionReplayErrorMarker,
	withSessionReplay,
	type UseSessionReplayOptions,
	type UseSessionReplayReturn,
	type WithSessionReplayProps,
} from './use-session-replay.js'

export {
	useEnhancedErrorTracking,
	useCombinedMonitoring,
	type UseEnhancedErrorTrackingOptions,
	type UseEnhancedErrorTrackingReturn,
	type UseCombinedMonitoringOptions,
} from './use-error-tracking'

export {
	FeatureFlagsProvider,
	useFeatureFlags,
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
	type UseFeatureFlagsReturn,
} from './use-flags'

export {
	AnalyticsProvider,
	useAnalyticsHook,
	usePageView,
	useComponentTracking,
	useFeatureTracking,
	useFormTracking,
	useTimeTracking,
	type AnalyticsProviderProps,
	type UseAnalyticsReturn,
} from './use-analytics'
