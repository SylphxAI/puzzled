// ============================================
// Components
// ============================================

export { GTMProvider, PostHogProvider, WebVitalsReporter } from './components'

// ============================================
// Consent Management
// ============================================

export {
	type ConsentCategory,
	type ConsentPreferences,
	type ConsentStatus,
	canTrackAnalytics,
	clearConsentData,
	getConsentPreferences,
	getConsentStatus,
	hasAnalyticsConsent,
	onConsentChange,
	setConsentStatus,
} from './lib/consent'

// ============================================
// SDK Analytics (Recommended)
// ============================================

/**
 * SDK-integrated analytics for consistent event tracking.
 * Use these for all new analytics code.
 */
export {
	useGameAnalytics,
	type GameStartEvent,
	type GameCompleteEvent,
	type AchievementEvent,
	type StreakEvent,
} from './lib/sdk-analytics'

// ============================================
// A/B Testing
// ============================================

export {
	useExperiment,
	useExperimentTracking,
	EXPERIMENTS,
	type ExperimentKey,
} from './lib/ab-testing'

// ============================================
// GTM & Web Vitals
// ============================================

export { initGTM } from './lib/gtm'
export { initWebVitals } from './lib/web-vitals'

