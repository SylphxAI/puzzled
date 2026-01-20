// ============================================
// Components
// ============================================

export { WebVitalsReporter } from './components'

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
 *
 * Features:
 * - Event batching (sends every 5s or when 10 events queued)
 * - Rich dimensions (device type, session, journey stage)
 * - Exponential backoff retry on failures
 * - Offline queue with sync when back online
 * - GDPR-compliant consent checks
 */
export {
	useGameAnalytics,
	useJourneyStage,
	type GameStartEvent,
	type GameCompleteEvent,
	type AchievementEvent,
	type StreakEvent,
	type UserJourneyStage,
	type DeviceType,
	type EventDimensions,
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
// Web Vitals
// ============================================

export { initWebVitals, setWebVitalsTracker } from './lib/web-vitals'

