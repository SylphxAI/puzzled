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

// GTM
export { initGTM } from './lib/gtm'

// Web Vitals
export { initWebVitals } from './lib/web-vitals'
