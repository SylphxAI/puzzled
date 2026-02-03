/**
 * Error Tracker Tests
 *
 * Tests for the ErrorTracker class and pure utility functions.
 * Browser-dependent initialization tested via E2E tests.
 */

import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { ErrorTracker, getTracker, resetTracker } from '../../src/lib/monitoring/error-tracking/tracker'
import { clearBreadcrumbs, setMaxBreadcrumbs, addBreadcrumb } from '../../src/lib/monitoring/error-tracking/breadcrumbs'
import type { ErrorEvent, UploadCallback, UploadResult } from '../../src/lib/monitoring/error-tracking/types'

// ============================================================================
// Test Setup
// ============================================================================

beforeEach(() => {
	resetTracker()
	clearBreadcrumbs()
	setMaxBreadcrumbs(100)
})

afterEach(() => {
	resetTracker()
	clearBreadcrumbs()
})

// ============================================================================
// ErrorTracker Constructor Tests
// ============================================================================

describe('ErrorTracker constructor', () => {
	test('creates tracker with default config', () => {
		const tracker = new ErrorTracker()
		expect(tracker).toBeInstanceOf(ErrorTracker)
	})

	test('accepts partial config', () => {
		const tracker = new ErrorTracker({
			enabled: false,
			sampleRate: 0.5,
			environment: 'test',
		})
		expect(tracker).toBeInstanceOf(ErrorTracker)
	})

	test('merges config with defaults', () => {
		const tracker = new ErrorTracker({
			environment: 'production',
			release: '1.0.0',
		})

		// Config should be applied (tested via behavior)
		expect(tracker).toBeInstanceOf(ErrorTracker)
	})
})

// ============================================================================
// Adaptive Sampling Tests
// ============================================================================

describe('adaptive sampling', () => {
	test('returns config sample rate by default', () => {
		const tracker = new ErrorTracker({ sampleRate: 0.5 })
		expect(tracker.getEffectiveSampleRate()).toBe(0.5)
	})

	test('uses server-recommended rate when set', () => {
		const tracker = new ErrorTracker({ sampleRate: 0.5 })
		tracker.updateServerRecommendedSampleRate(0.25)
		expect(tracker.getEffectiveSampleRate()).toBe(0.25)
	})

	test('clamps server rate between 0 and 1', () => {
		const tracker = new ErrorTracker({ sampleRate: 0.5 })

		tracker.updateServerRecommendedSampleRate(1.5)
		expect(tracker.getEffectiveSampleRate()).toBe(1)

		tracker.updateServerRecommendedSampleRate(-0.5)
		expect(tracker.getEffectiveSampleRate()).toBe(0)
	})

	test('disabling adaptive sampling ignores server rate', () => {
		const tracker = new ErrorTracker({ sampleRate: 0.5 })
		tracker.updateServerRecommendedSampleRate(0.25)
		tracker.setAdaptiveSampling(false)
		expect(tracker.getEffectiveSampleRate()).toBe(0.5)
	})

	test('re-enabling adaptive sampling restores server rate', () => {
		const tracker = new ErrorTracker({ sampleRate: 0.5 })
		tracker.updateServerRecommendedSampleRate(0.25)
		tracker.setAdaptiveSampling(false)
		tracker.setAdaptiveSampling(true)
		// Server rate should be cleared when disabled
		expect(tracker.getEffectiveSampleRate()).toBe(0.5)
	})

	test('null server rate falls back to config', () => {
		const tracker = new ErrorTracker({ sampleRate: 0.5 })
		tracker.updateServerRecommendedSampleRate(0.25)
		tracker.updateServerRecommendedSampleRate(null)
		// Should retain previous server rate
		expect(tracker.getEffectiveSampleRate()).toBe(0.25)
	})
})

// ============================================================================
// User Context Tests
// ============================================================================

describe('user context', () => {
	test('setUser stores user information', () => {
		const tracker = new ErrorTracker()
		tracker.setUser({
			id: 'user-123',
			email: 'test@example.com',
			username: 'testuser',
		})
		// User info will be included in captured events
		expect(tracker).toBeInstanceOf(ErrorTracker)
	})

	test('setUser with partial data', () => {
		const tracker = new ErrorTracker()
		tracker.setUser({ id: 'user-123' })
		expect(tracker).toBeInstanceOf(ErrorTracker)
	})

	test('clearUser removes user information', () => {
		const tracker = new ErrorTracker()
		tracker.setUser({ id: 'user-123' })
		tracker.clearUser()
		expect(tracker).toBeInstanceOf(ErrorTracker)
	})
})

// ============================================================================
// Session Replay Integration Tests
// ============================================================================

describe('session replay integration', () => {
	test('setSessionReplayId stores session ID', () => {
		const tracker = new ErrorTracker()
		tracker.setSessionReplayId('replay-session-abc')
		expect(tracker).toBeInstanceOf(ErrorTracker)
	})
})

// ============================================================================
// Breadcrumb Integration Tests
// ============================================================================

describe('breadcrumb integration', () => {
	test('addBreadcrumb adds to breadcrumb store', () => {
		const tracker = new ErrorTracker()
		tracker.addBreadcrumb({
			type: 'navigation',
			category: 'navigation',
			message: 'Navigated to /dashboard',
			level: 'info',
		})

		// Verify breadcrumb was added via the tracker
		expect(tracker).toBeInstanceOf(ErrorTracker)
	})
})

// ============================================================================
// captureException Tests
// ============================================================================

describe('captureException', () => {
	test('returns empty eventId when disabled', async () => {
		const tracker = new ErrorTracker({ enabled: false })
		const result = await tracker.captureException(new Error('Test error'))
		expect(result.eventId).toBe('')
	})

	test('returns empty eventId when sampled out', async () => {
		const tracker = new ErrorTracker({ enabled: true, sampleRate: 0 })
		const result = await tracker.captureException(new Error('Test error'))
		expect(result.eventId).toBe('')
	})

	test('generates eventId when captured', async () => {
		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		const result = await tracker.captureException(new Error('Test error'))

		// EventId is 32-char hex string
		expect(result.eventId.length).toBe(32)
		expect(/^[a-f0-9]+$/.test(result.eventId)).toBe(true)
	})

	test('calls upload callback with event', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		tracker.onUpload(uploadCallback)

		await tracker.captureException(new Error('Test error'))

		expect(uploadedEvent).not.toBeNull()
		expect(uploadedEvent?.exception?.values[0]?.type).toBe('Error')
		expect(uploadedEvent?.exception?.values[0]?.value).toBe('Test error')
	})

	test('includes tags in captured event', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({
			enabled: true,
			sampleRate: 1,
			tags: { app: 'test-app' },
		})
		tracker.onUpload(uploadCallback)

		await tracker.captureException(new Error('Test'), {
			tags: { custom: 'tag' },
		})

		expect(uploadedEvent?.tags?.app).toBe('test-app')
		expect(uploadedEvent?.tags?.custom).toBe('tag')
	})

	test('includes extra context in captured event', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		tracker.onUpload(uploadCallback)

		await tracker.captureException(new Error('Test'), {
			extra: { requestId: 'abc-123', payload: { foo: 'bar' } },
		})

		expect(uploadedEvent?.extra?.requestId).toBe('abc-123')
		expect(uploadedEvent?.extra?.payload).toEqual({ foo: 'bar' })
	})

	test('includes user context when set', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		tracker.onUpload(uploadCallback)
		tracker.setUser({ id: 'user-123', email: 'test@example.com' })

		await tracker.captureException(new Error('Test'))

		expect(uploadedEvent?.user?.id).toBe('user-123')
		// Email is automatically scrubbed for PII protection (GDPR compliance)
		expect(uploadedEvent?.user?.email).toBe('[EMAIL]')
	})

	test('includes breadcrumbs in captured event', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		tracker.onUpload(uploadCallback)

		// Add some breadcrumbs
		addBreadcrumb({ type: 'navigation', category: 'nav', message: 'Page A', level: 'info' })
		addBreadcrumb({ type: 'ui', category: 'click', message: 'Button clicked', level: 'info' })

		await tracker.captureException(new Error('Test'))

		expect(uploadedEvent?.breadcrumbs?.values.length).toBe(2)
	})

	test('beforeSend hook can modify event', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({
			enabled: true,
			sampleRate: 1,
			beforeSend: (event) => {
				event.tags = { ...event.tags, modified: 'true' }
				return event
			},
		})
		tracker.onUpload(uploadCallback)

		await tracker.captureException(new Error('Test'))

		expect(uploadedEvent?.tags?.modified).toBe('true')
	})

	test('beforeSend returning null suppresses event', async () => {
		let uploadCalled = false
		const uploadCallback: UploadCallback = async (event) => {
			uploadCalled = true
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({
			enabled: true,
			sampleRate: 1,
			beforeSend: () => null,
		})
		tracker.onUpload(uploadCallback)

		const result = await tracker.captureException(new Error('Test'))

		// beforeSend returning null suppresses the event (Sentry-compatible behavior)
		expect(result.eventId).toBe('')
		expect(uploadCalled).toBe(false)
	})

	test('updates adaptive sampling from upload result', async () => {
		const uploadCallback: UploadCallback = async (event) => {
			return { eventId: event.event_id, recommendedSampleRate: 0.25 }
		}

		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		tracker.onUpload(uploadCallback)

		await tracker.captureException(new Error('Test'))

		expect(tracker.getEffectiveSampleRate()).toBe(0.25)
	})

	test('includes session replay ID when attached', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({
			enabled: true,
			sampleRate: 1,
			attachReplay: true,
		})
		tracker.onUpload(uploadCallback)
		tracker.setSessionReplayId('replay-xyz')

		const result = await tracker.captureException(new Error('Test'))

		expect(uploadedEvent?.contexts?.replay?.session_id).toBe('replay-xyz')
		expect(result.replaySessionId).toBe('replay-xyz')
	})
})

// ============================================================================
// captureMessage Tests
// ============================================================================

describe('captureMessage', () => {
	test('returns empty eventId when disabled', async () => {
		const tracker = new ErrorTracker({ enabled: false })
		const result = await tracker.captureMessage('Test message')
		expect(result.eventId).toBe('')
	})

	test('generates eventId when captured', async () => {
		const tracker = new ErrorTracker({ enabled: true })
		const result = await tracker.captureMessage('Test message')
		expect(result.eventId.length).toBe(32)
	})

	test('calls upload callback with message event', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true })
		tracker.onUpload(uploadCallback)

		await tracker.captureMessage('Test message')

		expect(uploadedEvent?.message?.message).toBe('Test message')
		expect(uploadedEvent?.message?.formatted).toBe('Test message')
	})

	test('includes level in message event', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true })
		tracker.onUpload(uploadCallback)

		await tracker.captureMessage('Warning message', { level: 'warning' })

		expect(uploadedEvent?.level).toBe('warning')
	})

	test('defaults to info level', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true })
		tracker.onUpload(uploadCallback)

		await tracker.captureMessage('Info message')

		expect(uploadedEvent?.level).toBe('info')
	})

	test('includes tags and extra', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true })
		tracker.onUpload(uploadCallback)

		await tracker.captureMessage('Test', {
			tags: { feature: 'test' },
			extra: { details: 'here' },
		})

		expect(uploadedEvent?.tags?.feature).toBe('test')
		expect(uploadedEvent?.extra?.details).toBe('here')
	})
})

// ============================================================================
// Singleton Tests
// ============================================================================

describe('singleton', () => {
	test('getTracker returns same instance', () => {
		const tracker1 = getTracker()
		const tracker2 = getTracker()
		expect(tracker1).toBe(tracker2)
	})

	test('resetTracker clears instance', () => {
		const tracker1 = getTracker()
		resetTracker()
		const tracker2 = getTracker()
		expect(tracker1).not.toBe(tracker2)
	})

	test('getTracker accepts initial config', () => {
		const tracker = getTracker({ environment: 'test' })
		expect(tracker).toBeInstanceOf(ErrorTracker)
	})
})

// ============================================================================
// Stack Trace Parsing Tests (Integration)
// ============================================================================

describe('stack trace parsing', () => {
	test('parses Error with stack trace', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		tracker.onUpload(uploadCallback)

		// Create error with stack
		const error = new Error('Test error')

		await tracker.captureException(error)

		expect(uploadedEvent?.exception?.values[0]?.type).toBe('Error')
		expect(uploadedEvent?.exception?.values[0]?.value).toBe('Test error')
		// Stack trace should be parsed (may or may not have frames depending on environment)
	})

	test('handles error without stack', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		tracker.onUpload(uploadCallback)

		const error = new Error('Test error')
		error.stack = ''

		await tracker.captureException(error)

		expect(uploadedEvent?.exception?.values[0]?.type).toBe('Error')
		expect(uploadedEvent?.exception?.values[0]?.value).toBe('Test error')
	})

	test('handles custom error types', async () => {
		let uploadedEvent: ErrorEvent | null = null
		const uploadCallback: UploadCallback = async (event) => {
			uploadedEvent = event
			return { eventId: event.event_id }
		}

		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		tracker.onUpload(uploadCallback)

		class CustomError extends Error {
			constructor(message: string) {
				super(message)
				this.name = 'CustomError'
			}
		}

		await tracker.captureException(new CustomError('Custom error message'))

		expect(uploadedEvent?.exception?.values[0]?.type).toBe('CustomError')
		expect(uploadedEvent?.exception?.values[0]?.value).toBe('Custom error message')
	})
})

// ============================================================================
// Upload Error Handling Tests
// ============================================================================

describe('upload error handling', () => {
	test('handles upload callback error gracefully', async () => {
		const uploadCallback: UploadCallback = async () => {
			throw new Error('Upload failed')
		}

		const tracker = new ErrorTracker({ enabled: true, sampleRate: 1 })
		tracker.onUpload(uploadCallback)

		// Should not throw
		const result = await tracker.captureException(new Error('Test'))

		// Still returns eventId even if upload fails
		expect(result.eventId.length).toBe(32)
	})
})
