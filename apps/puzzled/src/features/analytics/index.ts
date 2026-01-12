// Components
export { GTMProvider, PostHogProvider, WebVitalsReporter } from './components'

// Consent Management
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

// Events
export {
	identifyUser,
	resetUser,
	trackEvent,
} from './lib/events'

// SDK-Integrated Analytics (uses Sylphx Platform)
export {
	useGameAnalytics,
	type GameStartEvent,
	type GameCompleteEvent,
	type AchievementEvent,
	type StreakEvent,
} from './lib/sdk-analytics'

// GTM
export { initGTM } from './lib/gtm'

// Web Vitals
export { initWebVitals } from './lib/web-vitals'
