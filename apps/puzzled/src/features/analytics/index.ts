// ============================================
// Components
// ============================================

export { WebVitalsReporter } from './components'

// ============================================
// Consent Management
// ============================================

export {
	hasAnalyticsConsent,
	onConsentChange,
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
export { useGameAnalytics } from './lib/sdk-analytics'

// ============================================
// A/B Testing
// ============================================

// ============================================
// Web Vitals
// ============================================
