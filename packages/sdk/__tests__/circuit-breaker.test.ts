/**
 * Circuit Breaker Tests
 *
 * Comprehensive tests for the circuit breaker implementation in rest-client.ts.
 * Tests all state transitions: CLOSED -> OPEN -> HALF_OPEN -> CLOSED/OPEN
 * and edge cases like failure window expiry, custom thresholds, and state monitoring.
 *
 * IMPORTANT: openapi-fetch captures `globalThis.fetch` at client creation time.
 * The fetch mock MUST be set BEFORE calling `createRestClient`. Mocking after
 * creation has no effect because the client holds a stale reference.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import {
	CircuitBreakerOpenError,
	createRestClient,
	getCircuitBreakerState,
	resetCircuitBreaker,
	type CircuitState,
} from '../src/rest-client'
import {
	CIRCUIT_BREAKER_FAILURE_THRESHOLD,
	CIRCUIT_BREAKER_OPEN_DURATION_MS,
	CIRCUIT_BREAKER_WINDOW_MS,
} from '../src/constants'

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Low thresholds for fast, deterministic tests.
 * Using small values avoids real-time waits in the test suite.
 */
const TEST_CONFIG = {
	failureThreshold: 3,
	windowMs: 5_000,
	openDurationMs: 1_000,
} as const

const TEST_SECRET_KEY = 'sk_dev_testcircuitbreaker1234567890ab'

const originalFetch = globalThis.fetch
const originalDateNow = Date.now

/**
 * Install a mock fetch that always returns the given status.
 * MUST be called before createTestClient — openapi-fetch captures fetch at construction.
 */
function mockFetchWith(status: number, body: Record<string, unknown> = {}) {
	globalThis.fetch = mock(() =>
		Promise.resolve(
			new Response(JSON.stringify(body), {
				status,
				headers: { 'Content-Type': 'application/json' },
			}),
		),
	) as typeof fetch
}

/**
 * Install a mock fetch that returns responses in sequence.
 * MUST be called before createTestClient.
 */
function mockFetchSequence(responses: Array<{ status: number; body?: Record<string, unknown> }>) {
	let callIndex = 0
	globalThis.fetch = mock(() => {
		const response = responses[callIndex] ?? responses[responses.length - 1]
		callIndex++
		return Promise.resolve(
			new Response(JSON.stringify(response.body ?? {}), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' },
			}),
		)
	}) as typeof fetch
}

/**
 * Create a rest client configured for circuit breaker testing.
 * Disables retry, deduplication, and etag to isolate circuit breaker behavior.
 *
 * MUST be called after mockFetchWith/mockFetchSequence.
 */
function createTestClient(overrides: {
	failureThreshold?: number
	windowMs?: number
	openDurationMs?: number
	isFailure?: (status: number) => boolean
} = {}) {
	return createRestClient({
		secretKey: TEST_SECRET_KEY,
		retry: false,
		deduplication: false,
		etag: false,
		circuitBreaker: {
			failureThreshold: overrides.failureThreshold ?? TEST_CONFIG.failureThreshold,
			windowMs: overrides.windowMs ?? TEST_CONFIG.windowMs,
			openDurationMs: overrides.openDurationMs ?? TEST_CONFIG.openDurationMs,
			isFailure: overrides.isFailure,
		},
	})
}

/**
 * Stub Date.now to return a controlled timestamp.
 */
function stubDateNow(timestamp: number) {
	Date.now = () => timestamp
}

// ============================================================================
// Lifecycle
// ============================================================================

beforeEach(() => {
	resetCircuitBreaker()
})

afterEach(() => {
	globalThis.fetch = originalFetch
	Date.now = originalDateNow
})

// ============================================================================
// Initial State
// ============================================================================

describe('Circuit Breaker', () => {
	describe('initial state', () => {
		test('starts with null state before any request', () => {
			const state = getCircuitBreakerState()
			expect(state).toBeNull()
		})

		test('initializes to CLOSED after first request', async () => {
			mockFetchWith(200, { ok: true })
			const client = createTestClient()

			await client.GET('/auth/me' as never)

			const state = getCircuitBreakerState()
			expect(state).not.toBeNull()
			expect(state!.state).toBe('CLOSED')
			expect(state!.failures).toBe(0)
			expect(state!.openedAt).toBeNull()
		})
	})

	// ============================================================================
	// CLOSED State
	// ============================================================================

	describe('CLOSED state', () => {
		test('allows all requests through', async () => {
			mockFetchWith(200, { ok: true })
			const client = createTestClient()

			for (let i = 0; i < 10; i++) {
				await client.GET('/auth/me' as never)
			}

			const state = getCircuitBreakerState()
			expect(state!.state).toBe('CLOSED')
			expect(state!.failures).toBe(0)
		})

		test('records failures without tripping below threshold', async () => {
			mockFetchWith(500, { error: 'Internal Server Error' })
			const client = createTestClient({ failureThreshold: 5 })

			for (let i = 0; i < 4; i++) {
				await client.GET('/auth/me' as never)
			}

			const state = getCircuitBreakerState()
			expect(state!.state).toBe('CLOSED')
			expect(state!.failures).toBe(4)
		})

		test('records 429 as failure', async () => {
			mockFetchWith(429, { error: 'Rate limited' })
			const client = createTestClient()

			await client.GET('/auth/me' as never)

			const state = getCircuitBreakerState()
			expect(state!.state).toBe('CLOSED')
			expect(state!.failures).toBe(1)
		})

		test('does not count 4xx client errors (except 429) as failures', async () => {
			// All client errors in one sequence to avoid re-creating client
			mockFetchSequence([
				{ status: 400 },
				{ status: 401 },
				{ status: 403 },
				{ status: 404 },
				{ status: 422 },
			])
			const client = createTestClient()

			for (let i = 0; i < 5; i++) {
				await client.GET('/auth/me' as never)
			}

			const state = getCircuitBreakerState()
			expect(state!.state).toBe('CLOSED')
			expect(state!.failures).toBe(0)
		})

		test('success in CLOSED state does not clear failure timestamps', async () => {
			// 2 failures then 1 success
			mockFetchSequence([
				{ status: 500 },
				{ status: 500 },
				{ status: 200, body: { ok: true } },
			])
			const client = createTestClient({ failureThreshold: 5 })

			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.failures).toBe(2)

			await client.GET('/auth/me' as never)
			// recordSuccess is a no-op in CLOSED state; failures remain tracked in window
			expect(getCircuitBreakerState()!.state).toBe('CLOSED')
			expect(getCircuitBreakerState()!.failures).toBe(2)
		})
	})

	// ============================================================================
	// CLOSED -> OPEN Transition
	// ============================================================================

	describe('CLOSED -> OPEN transition', () => {
		test('opens after reaching failure threshold', async () => {
			mockFetchWith(500, { error: 'Server error' })
			const client = createTestClient({ failureThreshold: 3 })

			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			const state = getCircuitBreakerState()
			expect(state!.state).toBe('OPEN')
			expect(state!.failures).toBe(3)
			expect(state!.openedAt).toBeTypeOf('number')
		})

		test('opens at exactly the threshold count, not before', async () => {
			mockFetchWith(500)
			const client = createTestClient({ failureThreshold: 3 })

			// 2 failures: still CLOSED
			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.state).toBe('CLOSED')

			// 3rd failure: trips to OPEN
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.state).toBe('OPEN')
		})

		test('counts mixed 5xx status codes as failures', async () => {
			mockFetchSequence([
				{ status: 500 },
				{ status: 502 },
				{ status: 503 },
			])
			const client = createTestClient({ failureThreshold: 3 })

			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)

			expect(getCircuitBreakerState()!.state).toBe('OPEN')
		})

		test('uses default threshold from constants when not configured', () => {
			expect(CIRCUIT_BREAKER_FAILURE_THRESHOLD).toBe(5)
			expect(CIRCUIT_BREAKER_WINDOW_MS).toBe(10_000)
			expect(CIRCUIT_BREAKER_OPEN_DURATION_MS).toBe(30_000)
		})
	})

	// ============================================================================
	// OPEN State
	// ============================================================================

	describe('OPEN state', () => {
		test('rejects requests with CircuitBreakerOpenError', async () => {
			mockFetchWith(500)
			const client = createTestClient({ failureThreshold: 3, openDurationMs: 60_000 })

			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			// Next request should fail fast
			try {
				await client.GET('/auth/me' as never)
				expect(true).toBe(false)
			} catch (error) {
				expect(error).toBeInstanceOf(CircuitBreakerOpenError)
			}
		})

		test('CircuitBreakerOpenError includes remaining time', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchWith(500)
			const client = createTestClient({ failureThreshold: 3, openDurationMs: 5_000 })

			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			// Advance 2 seconds into the open period
			stubDateNow(baseTime + 2_000)

			try {
				await client.GET('/auth/me' as never)
				expect(true).toBe(false)
			} catch (error) {
				expect(error).toBeInstanceOf(CircuitBreakerOpenError)
				const cbError = error as CircuitBreakerOpenError
				expect(cbError.remainingMs).toBe(3_000)
				expect(cbError.message).toContain('3s')
				expect(cbError.name).toBe('CircuitBreakerOpenError')
			}
		})

		test('does not make network requests when open', async () => {
			mockFetchWith(500)
			const client = createTestClient({ failureThreshold: 3, openDurationMs: 60_000 })

			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			// Count calls after tripping
			const fetchMock = globalThis.fetch as ReturnType<typeof mock>
			const callCountBefore = fetchMock.mock.calls.length

			try {
				await client.GET('/auth/me' as never)
			} catch {
				// Expected CircuitBreakerOpenError
			}

			// No additional fetch calls were made
			expect(fetchMock.mock.calls.length).toBe(callCountBefore)
		})

		test('records openedAt timestamp', async () => {
			const baseTime = 1_700_000_000_000
			stubDateNow(baseTime)

			mockFetchWith(500)
			const client = createTestClient({ failureThreshold: 3 })

			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			const state = getCircuitBreakerState()
			expect(state!.openedAt).toBe(baseTime)
		})
	})

	// ============================================================================
	// OPEN -> HALF_OPEN Transition
	// ============================================================================

	describe('OPEN -> HALF_OPEN transition', () => {
		test('transitions to HALF_OPEN and closes after success when openDurationMs expires', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchSequence([
				// 3 failures to trip
				{ status: 500 },
				{ status: 500 },
				{ status: 500 },
				// Probe request succeeds
				{ status: 200, body: { ok: true } },
			])
			const client = createTestClient({
				failureThreshold: 3,
				openDurationMs: 5_000,
			})

			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			// Advance past the open duration
			stubDateNow(baseTime + 5_001)

			// Next request should be allowed (HALF_OPEN probe) and succeed
			await client.GET('/auth/me' as never)

			// After success in HALF_OPEN, circuit closes
			expect(getCircuitBreakerState()!.state).toBe('CLOSED')
		})

		test('still rejects before openDurationMs expires', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchWith(500)
			const client = createTestClient({
				failureThreshold: 3,
				openDurationMs: 5_000,
			})

			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			// Advance but not enough
			stubDateNow(baseTime + 4_999)

			try {
				await client.GET('/auth/me' as never)
				expect(true).toBe(false)
			} catch (error) {
				expect(error).toBeInstanceOf(CircuitBreakerOpenError)
				const cbError = error as CircuitBreakerOpenError
				expect(cbError.remainingMs).toBe(1)
			}
		})

		test('transitions at exactly openDurationMs boundary', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchSequence([
				{ status: 500 },
				{ status: 500 },
				{ status: 500 },
				{ status: 200, body: { ok: true } },
			])
			const client = createTestClient({
				failureThreshold: 3,
				openDurationMs: 5_000,
			})

			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			// Advance exactly to the boundary
			stubDateNow(baseTime + 5_000)

			// Should transition to HALF_OPEN and allow request
			await client.GET('/auth/me' as never)

			expect(getCircuitBreakerState()!.state).toBe('CLOSED')
		})
	})

	// ============================================================================
	// HALF_OPEN -> CLOSED
	// ============================================================================

	describe('HALF_OPEN -> CLOSED transition', () => {
		test('closes circuit on successful probe request', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchSequence([
				{ status: 500 },
				{ status: 500 },
				{ status: 500 },
				{ status: 200, body: { ok: true } },
			])
			const client = createTestClient({
				failureThreshold: 3,
				openDurationMs: 1_000,
			})

			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			// Wait for open duration to expire
			stubDateNow(baseTime + 1_001)

			// Probe succeeds
			await client.GET('/auth/me' as never)

			const state = getCircuitBreakerState()
			expect(state!.state).toBe('CLOSED')
			expect(state!.failures).toBe(0)
			expect(state!.openedAt).toBeNull()
		})

		test('allows normal traffic after closing', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			// 3 failures + probe success + 10 normal requests
			const responses: Array<{ status: number; body?: Record<string, unknown> }> = [
				{ status: 500 },
				{ status: 500 },
				{ status: 500 },
				{ status: 200, body: { ok: true } },
			]
			for (let i = 0; i < 10; i++) {
				responses.push({ status: 200, body: { ok: true } })
			}
			mockFetchSequence(responses)
			const client = createTestClient({
				failureThreshold: 3,
				openDurationMs: 1_000,
			})

			// Trip -> wait -> probe success -> CLOSED
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			stubDateNow(baseTime + 1_001)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.state).toBe('CLOSED')

			// Now make many requests -- all should succeed
			for (let i = 0; i < 10; i++) {
				await client.GET('/auth/me' as never)
			}

			expect(getCircuitBreakerState()!.state).toBe('CLOSED')
			expect(getCircuitBreakerState()!.failures).toBe(0)
		})
	})

	// ============================================================================
	// HALF_OPEN -> OPEN
	// ============================================================================

	describe('HALF_OPEN -> OPEN transition', () => {
		test('re-opens circuit on failed probe request', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchSequence([
				{ status: 500 },
				{ status: 500 },
				{ status: 500 },
				// Probe fails
				{ status: 500 },
			])
			const client = createTestClient({
				failureThreshold: 3,
				openDurationMs: 1_000,
			})

			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			// Wait for open duration to expire -> HALF_OPEN
			stubDateNow(baseTime + 1_001)

			// Probe fails -- should re-open
			await client.GET('/auth/me' as never)

			const state = getCircuitBreakerState()
			expect(state!.state).toBe('OPEN')
			expect(state!.openedAt).toBeTypeOf('number')
		})

		test('re-opens circuit on 429 probe response', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchSequence([
				{ status: 500 },
				{ status: 500 },
				{ status: 500 },
				// Probe gets rate-limited
				{ status: 429 },
			])
			const client = createTestClient({
				failureThreshold: 3,
				openDurationMs: 1_000,
			})

			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			stubDateNow(baseTime + 1_001)

			// Probe with 429
			await client.GET('/auth/me' as never)

			expect(getCircuitBreakerState()!.state).toBe('OPEN')
		})

		test('subsequent requests are blocked after re-opening', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchSequence([
				{ status: 500 },
				{ status: 500 },
				{ status: 500 },
				// Probe fails
				{ status: 500 },
			])
			const client = createTestClient({
				failureThreshold: 3,
				openDurationMs: 2_000,
			})

			// Trip -> wait -> probe fails -> re-OPEN
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			stubDateNow(baseTime + 2_001)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			// Immediately after re-opening, requests should be blocked
			stubDateNow(baseTime + 2_002)

			try {
				await client.GET('/auth/me' as never)
				expect(true).toBe(false)
			} catch (error) {
				expect(error).toBeInstanceOf(CircuitBreakerOpenError)
			}
		})
	})

	// ============================================================================
	// Failure Window Expiry
	// ============================================================================

	describe('failure window expiry', () => {
		test('old failures outside window do not count toward threshold', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchWith(500)
			const client = createTestClient({
				failureThreshold: 3,
				windowMs: 5_000,
			})

			// Record 2 failures at baseTime
			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.failures).toBe(2)

			// Advance past the window so those 2 failures expire
			stubDateNow(baseTime + 6_000)

			// Record 1 more failure -- total in window is now 1, not 3
			await client.GET('/auth/me' as never)

			const state = getCircuitBreakerState()
			expect(state!.state).toBe('CLOSED')
			// Old failures are pruned; only the fresh one remains
			expect(state!.failures).toBe(1)
		})

		test('mixed old and new failures only count recent ones', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchWith(500)
			const client = createTestClient({
				failureThreshold: 3,
				windowMs: 5_000,
			})

			// 1 failure at t=0
			await client.GET('/auth/me' as never)

			// 1 failure at t=3000 (within window of t=0)
			stubDateNow(baseTime + 3_000)
			await client.GET('/auth/me' as never)

			// 1 failure at t=6000 -- first failure (t=0) is now outside the window
			stubDateNow(baseTime + 6_000)
			await client.GET('/auth/me' as never)

			// Only 2 failures in window (t=3000 and t=6000), not 3
			expect(getCircuitBreakerState()!.state).toBe('CLOSED')
			expect(getCircuitBreakerState()!.failures).toBe(2)
		})

		test('failure burst within window trips the circuit', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchWith(500)
			const client = createTestClient({
				failureThreshold: 3,
				windowMs: 5_000,
			})

			// Some old failures that will expire
			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)

			// Advance past window
			stubDateNow(baseTime + 6_000)

			// New burst of 3 failures within the window
			await client.GET('/auth/me' as never)

			stubDateNow(baseTime + 6_100)
			await client.GET('/auth/me' as never)

			stubDateNow(baseTime + 6_200)
			await client.GET('/auth/me' as never)

			expect(getCircuitBreakerState()!.state).toBe('OPEN')
		})
	})

	// ============================================================================
	// resetCircuitBreaker()
	// ============================================================================

	describe('resetCircuitBreaker()', () => {
		test('resets state to null', async () => {
			mockFetchWith(500)
			const client = createTestClient({ failureThreshold: 3 })

			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			resetCircuitBreaker()

			expect(getCircuitBreakerState()).toBeNull()
		})

		test('allows a fresh circuit breaker to be created after reset', async () => {
			mockFetchWith(500)
			const client = createTestClient({ failureThreshold: 3 })

			// Trip the breaker
			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			resetCircuitBreaker()

			// New client creates fresh breaker
			mockFetchWith(200, { ok: true })
			const freshClient = createTestClient()
			await freshClient.GET('/auth/me' as never)

			const state = getCircuitBreakerState()
			expect(state!.state).toBe('CLOSED')
			expect(state!.failures).toBe(0)
		})

		test('is idempotent when called multiple times', () => {
			resetCircuitBreaker()
			resetCircuitBreaker()
			resetCircuitBreaker()

			expect(getCircuitBreakerState()).toBeNull()
		})
	})

	// ============================================================================
	// getCircuitBreakerState()
	// ============================================================================

	describe('getCircuitBreakerState()', () => {
		test('returns null before initialization', () => {
			expect(getCircuitBreakerState()).toBeNull()
		})

		test('returns correct structure for CLOSED state', async () => {
			mockFetchWith(200, { ok: true })
			const client = createTestClient()
			await client.GET('/auth/me' as never)

			const state = getCircuitBreakerState()
			expect(state).toEqual({
				state: 'CLOSED',
				failures: 0,
				openedAt: null,
			})
		})

		test('returns correct structure for OPEN state', async () => {
			const baseTime = 1_700_000_000_000
			stubDateNow(baseTime)

			mockFetchWith(500)
			const client = createTestClient({ failureThreshold: 3 })

			for (let i = 0; i < 3; i++) {
				await client.GET('/auth/me' as never)
			}

			const state = getCircuitBreakerState()
			expect(state).toEqual({
				state: 'OPEN',
				failures: 3,
				openedAt: baseTime,
			})
		})

		test('returns failure count reflecting current tracked failures', async () => {
			mockFetchWith(500)
			const client = createTestClient({ failureThreshold: 10 })

			for (let i = 0; i < 5; i++) {
				await client.GET('/auth/me' as never)
			}

			expect(getCircuitBreakerState()!.failures).toBe(5)
		})
	})

	// ============================================================================
	// CircuitBreakerOpenError
	// ============================================================================

	describe('CircuitBreakerOpenError', () => {
		test('has correct name', () => {
			const error = new CircuitBreakerOpenError(5000)
			expect(error.name).toBe('CircuitBreakerOpenError')
		})

		test('extends Error', () => {
			const error = new CircuitBreakerOpenError(5000)
			expect(error).toBeInstanceOf(Error)
		})

		test('stores remainingMs', () => {
			const error = new CircuitBreakerOpenError(12345)
			expect(error.remainingMs).toBe(12345)
		})

		test('formats human-readable message with seconds', () => {
			const error = new CircuitBreakerOpenError(5000)
			expect(error.message).toContain('5s')

			const errorFractional = new CircuitBreakerOpenError(3500)
			expect(errorFractional.message).toContain('4s') // Math.ceil(3500/1000) = 4
		})

		test('rounds up fractional seconds', () => {
			const error = new CircuitBreakerOpenError(1)
			expect(error.message).toContain('1s') // Math.ceil(1/1000) = 1
		})
	})

	// ============================================================================
	// Custom isFailure function
	// ============================================================================

	describe('custom isFailure function', () => {
		test('uses custom failure detection when provided', async () => {
			// Only treat 503 as failure
			mockFetchSequence([
				// 500s should NOT be treated as failures
				{ status: 500 },
				{ status: 500 },
				{ status: 500 },
				// 503s SHOULD be failures
				{ status: 503 },
				{ status: 503 },
			])
			const client = createTestClient({
				failureThreshold: 2,
				isFailure: (status) => status === 503,
			})

			// 500 should NOT be treated as failure with this custom function
			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)

			expect(getCircuitBreakerState()!.state).toBe('CLOSED')
			expect(getCircuitBreakerState()!.failures).toBe(0)

			// 503 should trip it
			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)

			expect(getCircuitBreakerState()!.state).toBe('OPEN')
		})
	})

	// ============================================================================
	// Circuit Breaker Disabled
	// ============================================================================

	describe('disabled circuit breaker', () => {
		test('passes all requests when circuitBreaker is false', async () => {
			mockFetchWith(500)
			const client = createRestClient({
				secretKey: TEST_SECRET_KEY,
				retry: false,
				deduplication: false,
				etag: false,
				circuitBreaker: false,
			})

			// Even many 500s should not throw CircuitBreakerOpenError
			for (let i = 0; i < 20; i++) {
				await client.GET('/auth/me' as never)
			}

			// No error was thrown -- circuit breaker is bypassed
		})

		test('passes all requests when enabled is false in config', async () => {
			mockFetchWith(500)
			const client = createRestClient({
				secretKey: TEST_SECRET_KEY,
				retry: false,
				deduplication: false,
				etag: false,
				circuitBreaker: { enabled: false },
			})

			for (let i = 0; i < 20; i++) {
				await client.GET('/auth/me' as never)
			}

			// No CircuitBreakerOpenError thrown
		})
	})

	// ============================================================================
	// Global Singleton Behavior
	// ============================================================================

	describe('global singleton behavior', () => {
		test('circuit breaker state is shared across client instances', async () => {
			// Both clients use the same mock fetch
			mockFetchWith(500)
			const client1 = createTestClient({ failureThreshold: 3, openDurationMs: 60_000 })

			// Trip the breaker via client1
			for (let i = 0; i < 3; i++) {
				await client1.GET('/auth/me' as never)
			}
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			// client2 uses the same global singleton, should be blocked
			// (Note: client2 must also be created with the mocked fetch, but
			// the CB check happens BEFORE fetch, so the mock doesn't matter)
			mockFetchWith(200)
			const client2 = createTestClient({ failureThreshold: 3, openDurationMs: 60_000 })

			try {
				await client2.GET('/auth/me' as never)
				expect(true).toBe(false)
			} catch (error) {
				expect(error).toBeInstanceOf(CircuitBreakerOpenError)
			}
		})
	})

	// ============================================================================
	// Full Lifecycle: CLOSED -> OPEN -> HALF_OPEN -> CLOSED -> OPEN (re-trip)
	// ============================================================================

	describe('full lifecycle', () => {
		test('complete state machine cycle', async () => {
			const baseTime = 1_000_000
			stubDateNow(baseTime)

			mockFetchSequence([
				// Phase 1: Trip the breaker (2 failures)
				{ status: 500 },
				{ status: 500 },
				// Phase 2: Probe succeeds -> CLOSED
				{ status: 200, body: { ok: true } },
				// Phase 3: Trip again (2 failures)
				{ status: 500 },
				{ status: 500 },
				// Phase 4: Probe fails -> stays OPEN
				{ status: 500 },
				// Phase 5: Probe succeeds -> CLOSED
				{ status: 200, body: { ok: true } },
			])
			const client = createTestClient({
				failureThreshold: 2,
				openDurationMs: 3_000,
				windowMs: 10_000,
			})

			// 1. CLOSED -> record failures -> OPEN
			await client.GET('/auth/me' as never)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			// 2. OPEN -> wait -> attempt -> HALF_OPEN -> success -> CLOSED
			stubDateNow(baseTime + 3_001)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.state).toBe('CLOSED')
			expect(getCircuitBreakerState()!.failures).toBe(0)

			// 3. CLOSED -> more failures -> OPEN again
			stubDateNow(baseTime + 4_000)
			await client.GET('/auth/me' as never)
			stubDateNow(baseTime + 4_100)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			// 4. OPEN -> wait -> probe fails -> still OPEN
			stubDateNow(baseTime + 7_200)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.state).toBe('OPEN')

			// 5. OPEN -> wait again -> probe succeeds -> CLOSED
			stubDateNow(baseTime + 10_300)
			await client.GET('/auth/me' as never)
			expect(getCircuitBreakerState()!.state).toBe('CLOSED')
		})
	})
})
