/**
 * Error Tracking Module
 *
 * Sentry-compatible error tracking with:
 * - Automatic breadcrumb collection
 * - Session Replay integration
 * - Stack trace parsing
 * - Device/browser context
 *
 * @example
 * ```typescript
 * import { initErrorTracking, getTracker } from '@sylphx/platform-sdk/monitoring'
 *
 * // Initialize at app startup
 * const tracker = initErrorTracking({
 *   environment: 'production',
 *   release: '1.0.0',
 *   attachReplay: true,
 * })
 *
 * // Set upload handler
 * tracker.onUpload(async (event) => {
 *   await api.monitoring.captureError(event)
 *   return { eventId: event.event_id }
 * })
 *
 * // Capture errors
 * try {
 *   riskyOperation()
 * } catch (error) {
 *   await tracker.captureException(error, {
 *     tags: { feature: 'payment' },
 *   })
 * }
 * ```
 */

// Core tracker
export { ErrorTracker, getTracker, initErrorTracking, resetTracker } from './tracker'

// PII Scrubbing (GDPR compliance)
export {
	scrubString,
	scrubObject,
	scrubErrorEvent,
	createScrubber,
	type PIIScrubberConfig,
} from './pii-scrubber'

// Breadcrumbs
export {
	addBreadcrumb,
	getBreadcrumbs,
	clearBreadcrumbs,
	
	enableAutoCapture,
	
	
	
	
	
	
	
	
} from './breadcrumbs'

// Types
export type {
	// Core types
	BreadcrumbType,
	Breadcrumb,
	StackFrame,
	ExceptionValue,
	// Event types
	ErrorEvent,
	// Configuration
	ErrorTrackingConfig,
	SourceMapConfig,
	// Options
	CaptureExceptionOptions,
	CaptureMessageOptions,
	// Callbacks
	UploadCallback,
	UploadResult,
	CaptureResult,
} from './types'

export { DEFAULT_ERROR_CONFIG } from './types'
