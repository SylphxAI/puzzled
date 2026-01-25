/**
 * Monitoring Service Module
 *
 * Unified monitoring service combining:
 * - Error Tracking: Exception capture, breadcrumbs, stack traces
 * - Session Replay: Recording, PII masking, rage/dead click detection
 *
 * @example
 * ```typescript
 * import { initErrorTracking, SessionRecorder } from '@sylphx/platform-sdk/monitoring'
 *
 * // Initialize error tracking
 * const tracker = initErrorTracking({
 *   environment: 'production',
 *   release: '1.0.0',
 *   attachReplay: true,
 * })
 *
 * // Initialize session replay
 * const recorder = new SessionRecorder({
 *   privacyMode: 'balanced',
 *   errorCorrelation: true,
 * })
 *
 * recorder.start()
 * ```
 */

// ==========================================
// Error Tracking
// ==========================================

export {
	// Core tracker
	ErrorTracker,
	getTracker,
	initErrorTracking,
	resetTracker,
	// Breadcrumbs
	addBreadcrumb,
	getBreadcrumbs,
	clearBreadcrumbs,
	setMaxBreadcrumbs,
	enableAutoCapture,
	enableClickCapture,
	enableInputCapture,
	enableNetworkCapture,
	enableConsoleCapture,
	enableNavigationCapture,
	disableNetworkCapture,
	disableConsoleCapture,
	// Types
	type AutoCaptureOptions,
	DEFAULT_ERROR_CONFIG,
} from './error-tracking'

export type {
	// Core types
	ErrorLevel,
	BreadcrumbType,
	Breadcrumb,
	StackFrame,
	ExceptionValue,
	// Event types
	ErrorEvent,
	// Configuration
	ErrorTrackingConfig,
	// Options
	CaptureExceptionOptions,
	CaptureMessageOptions,
	// Callbacks
	UploadCallback as ErrorUploadCallback,
	UploadResult as ErrorUploadResult,
	CaptureResult,
} from './error-tracking'

// ==========================================
// Session Replay
// ==========================================

export {
	// Core recorder
	SessionRecorder,
	getRecorder,
	resetRecorder,
	// Detectors
	RageClickDetector,
	DeadClickDetector,
	ScrollThrashingDetector,
	// Privacy utilities
	detectSensitiveFields,
	getPrivacyOptions,
	sanitizeForLogging,
	sanitizeUrl,
	generatePrivacyReport,
	// Config
	DEFAULT_CONFIG as DEFAULT_SESSION_REPLAY_CONFIG,
} from './session-replay'

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
	UploadCallback as SessionUploadCallback,
	ErrorCallback,
	// State
	RecorderState,
	RecorderStatus,
} from './session-replay'

// ==========================================
// Web Vitals
// ==========================================

export {
	// Core functions
	initWebVitals,
	getWebVitalsReport,
	getMetric,
	checkCoreWebVitals,
	resetWebVitals,
	isWebVitalsInitialized,
	// Constants
	WEB_VITALS_THRESHOLDS,
	DEFAULT_WEB_VITALS_CONFIG,
} from './web-vitals'

export type {
	// Metric types
	CoreWebVitalName,
	WebVitalName,
	MetricRating,
	WebVitalMetric,
	WebVitalAttribution,
	// Report types
	WebVitalsReport,
	// Configuration
	WebVitalsConfig,
} from './web-vitals'
