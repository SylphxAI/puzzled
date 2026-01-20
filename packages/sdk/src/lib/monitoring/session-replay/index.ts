/**
 * Session Replay Module
 *
 * State-of-the-art session replay built on rrweb with:
 * - Automatic PII detection and masking
 * - Error correlation for debugging
 * - Rage/dead click detection for UX insights
 * - Efficient compression and batching
 *
 * @example
 * ```typescript
 * import { SessionRecorder } from '@sylphx/platform-sdk/monitoring'
 *
 * const recorder = new SessionRecorder({
 *   privacyMode: 'balanced',
 *   errorCorrelation: true,
 *   rageClickDetection: true,
 * })
 *
 * // Start recording
 * const sessionId = recorder.start()
 *
 * // Set upload handler
 * recorder.onUpload(async (data) => {
 *   await api.monitoring.sessionReplay.upload(data)
 * })
 *
 * // Mark errors for correlation
 * recorder.markError('err_123', new Error('Payment failed'))
 *
 * // Stop when done
 * await recorder.stop()
 * ```
 */

// Core recorder
export { SessionRecorder, getRecorder, resetRecorder } from './recorder'

// Detectors
export { RageClickDetector, DeadClickDetector, ScrollThrashingDetector } from './detectors'

// Privacy utilities
export {
	detectSensitiveFields,
	getPrivacyOptions,
	sanitizeForLogging,
	sanitizeUrl,
	generatePrivacyReport,
} from './privacy'

// Types
export type {
	// Configuration
	PrivacyMode,
	SamplingStrategy,
	SessionReplayConfig,
	// Events
	MarkerType,
	SessionMarker,
	RageClick,
	DeadClick,
	NetworkRequest,
	ConsoleLog,
	// Session
	SessionMetadata,
	SessionData,
	SessionSummary,
	// Callbacks
	EventCallback,
	UploadCallback,
	ErrorCallback,
	// State
	RecorderState,
	RecorderStatus,
} from './types'

export { DEFAULT_CONFIG } from './types'
