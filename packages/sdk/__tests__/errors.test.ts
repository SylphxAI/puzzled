/**
 * SDK Error Tests
 *
 * Tests for error classes and utility functions.
 */

import { describe, test, expect } from 'bun:test'
import {
	SylphxError,
	NetworkError,
	TimeoutError,
	AuthenticationError,
	AuthorizationError,
	ValidationError,
	RateLimitError,
	NotFoundError,
	isSylphxError,
	isRetryableError,
	getErrorMessage,
	getErrorCode,
	toSylphxError,
	exponentialBackoff,
	ERROR_CODE_STATUS,
	RETRYABLE_CODES,
} from '../src/errors'

// ============================================================================
// SylphxError Tests
// ============================================================================

describe('SylphxError', () => {
	test('creates error with message', () => {
		const error = new SylphxError('Test error')

		expect(error.message).toBe('Test error')
		expect(error.name).toBe('SylphxError')
	})

	test('sets code and status from options', () => {
		const error = new SylphxError('Bad request', { code: 'BAD_REQUEST' })

		expect(error.code).toBe('BAD_REQUEST')
		expect(error.status).toBe(400)
	})

	test('defaults to UNKNOWN code', () => {
		const error = new SylphxError('Unknown error')

		expect(error.code).toBe('UNKNOWN')
		expect(error.status).toBe(0)
	})

	test('includes data when provided', () => {
		const error = new SylphxError('Error with data', {
			code: 'BAD_REQUEST',
			data: { field: 'email' },
		})

		expect(error.data).toEqual({ field: 'email' })
	})

	test('sets isRetryable based on code', () => {
		const retryable = new SylphxError('Network issue', { code: 'NETWORK_ERROR' })
		const notRetryable = new SylphxError('Bad request', { code: 'BAD_REQUEST' })

		expect(retryable.isRetryable).toBe(true)
		expect(notRetryable.isRetryable).toBe(false)
	})

	test('includes retryAfter when provided', () => {
		const error = new SylphxError('Rate limited', {
			code: 'TOO_MANY_REQUESTS',
			retryAfter: 60,
		})

		expect(error.retryAfter).toBe(60)
	})

	test('includes timestamp', () => {
		const before = new Date()
		const error = new SylphxError('Test')
		const after = new Date()

		expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
		expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
	})

	test('includes cause when provided', () => {
		const cause = new Error('Original error')
		const error = new SylphxError('Wrapped error', { cause })

		expect(error.cause).toBe(cause)
	})

	test('toJSON returns serializable object', () => {
		const error = new SylphxError('Test error', {
			code: 'BAD_REQUEST',
			data: { field: 'email' },
		})

		const json = error.toJSON()

		expect(json.name).toBe('SylphxError')
		expect(json.message).toBe('Test error')
		expect(json.code).toBe('BAD_REQUEST')
		expect(json.status).toBe(400)
		expect(json.data).toEqual({ field: 'email' })
		expect(typeof json.timestamp).toBe('string')
	})
})

// ============================================================================
// Specialized Error Classes Tests
// ============================================================================

describe('NetworkError', () => {
	test('sets NETWORK_ERROR code', () => {
		const error = new NetworkError()

		expect(error.code).toBe('NETWORK_ERROR')
		expect(error.name).toBe('NetworkError')
		expect(error.isRetryable).toBe(true)
	})

	test('uses default message', () => {
		const error = new NetworkError()

		expect(error.message).toBe('Network request failed')
	})

	test('accepts custom message', () => {
		const error = new NetworkError('Connection refused')

		expect(error.message).toBe('Connection refused')
	})
})

describe('TimeoutError', () => {
	test('sets TIMEOUT code and includes timeout value', () => {
		const error = new TimeoutError(5000)

		expect(error.code).toBe('TIMEOUT')
		expect(error.name).toBe('TimeoutError')
		expect(error.timeout).toBe(5000)
		expect(error.message).toBe('Request timed out after 5000ms')
		expect(error.isRetryable).toBe(true)
	})
})

describe('AuthenticationError', () => {
	test('sets UNAUTHORIZED code', () => {
		const error = new AuthenticationError()

		expect(error.code).toBe('UNAUTHORIZED')
		expect(error.name).toBe('AuthenticationError')
		expect(error.status).toBe(401)
		expect(error.isRetryable).toBe(false)
	})

	test('uses default message', () => {
		const error = new AuthenticationError()

		expect(error.message).toBe('Authentication required')
	})
})

describe('AuthorizationError', () => {
	test('sets FORBIDDEN code', () => {
		const error = new AuthorizationError()

		expect(error.code).toBe('FORBIDDEN')
		expect(error.name).toBe('AuthorizationError')
		expect(error.status).toBe(403)
		expect(error.isRetryable).toBe(false)
	})

	test('uses default message', () => {
		const error = new AuthorizationError()

		expect(error.message).toBe('Permission denied')
	})
})

describe('ValidationError', () => {
	test('sets UNPROCESSABLE_ENTITY code', () => {
		const error = new ValidationError('Invalid input')

		expect(error.code).toBe('UNPROCESSABLE_ENTITY')
		expect(error.name).toBe('ValidationError')
		expect(error.status).toBe(422)
	})

	test('includes fieldErrors when provided', () => {
		const error = new ValidationError('Validation failed', {
			fieldErrors: {
				email: ['Invalid email format'],
				password: ['Too short', 'Must contain number'],
			},
		})

		expect(error.fieldErrors).toEqual({
			email: ['Invalid email format'],
			password: ['Too short', 'Must contain number'],
		})
	})

	test('getFieldError returns first error for field', () => {
		const error = new ValidationError('Validation failed', {
			fieldErrors: {
				password: ['Too short', 'Must contain number'],
			},
		})

		expect(error.getFieldError('password')).toBe('Too short')
		expect(error.getFieldError('email')).toBeUndefined()
	})
})

describe('RateLimitError', () => {
	test('sets TOO_MANY_REQUESTS code', () => {
		const error = new RateLimitError()

		expect(error.code).toBe('TOO_MANY_REQUESTS')
		expect(error.name).toBe('RateLimitError')
		expect(error.status).toBe(429)
		expect(error.isRetryable).toBe(true)
	})

	test('includes limit and current when provided', () => {
		const error = new RateLimitError('Rate limit exceeded', {
			limit: 100,
			current: 150,
		})

		expect(error.limit).toBe(100)
		expect(error.current).toBe(150)
	})
})

describe('NotFoundError', () => {
	test('sets NOT_FOUND code', () => {
		const error = new NotFoundError()

		expect(error.code).toBe('NOT_FOUND')
		expect(error.name).toBe('NotFoundError')
		expect(error.status).toBe(404)
	})

	test('includes resourceType and resourceId when provided', () => {
		const error = new NotFoundError('User not found', {
			resourceType: 'User',
			resourceId: 'user-123',
		})

		expect(error.resourceType).toBe('User')
		expect(error.resourceId).toBe('user-123')
	})
})

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe('isSylphxError', () => {
	test('returns true for SylphxError', () => {
		expect(isSylphxError(new SylphxError('Test'))).toBe(true)
	})

	test('returns true for subclasses', () => {
		expect(isSylphxError(new NetworkError())).toBe(true)
		expect(isSylphxError(new ValidationError('Invalid'))).toBe(true)
	})

	test('returns false for regular Error', () => {
		expect(isSylphxError(new Error('Test'))).toBe(false)
	})

	test('returns false for non-errors', () => {
		expect(isSylphxError('string')).toBe(false)
		expect(isSylphxError(null)).toBe(false)
		expect(isSylphxError(undefined)).toBe(false)
	})
})

describe('isRetryableError', () => {
	test('returns true for retryable SylphxError codes', () => {
		expect(isRetryableError(new NetworkError())).toBe(true)
		expect(isRetryableError(new TimeoutError(5000))).toBe(true)
		expect(isRetryableError(new RateLimitError())).toBe(true)
		expect(isRetryableError(new SylphxError('Server error', { code: 'SERVICE_UNAVAILABLE' }))).toBe(true)
	})

	test('returns false for non-retryable SylphxError codes', () => {
		expect(isRetryableError(new AuthenticationError())).toBe(false)
		expect(isRetryableError(new AuthorizationError())).toBe(false)
		expect(isRetryableError(new ValidationError('Invalid'))).toBe(false)
		expect(isRetryableError(new NotFoundError())).toBe(false)
	})

	test('detects network errors from regular Error', () => {
		const fetchError = new TypeError('fetch failed')
		expect(isRetryableError(fetchError)).toBe(true)
	})

	test('detects timeout from regular Error', () => {
		const timeoutError = new Error('Request timeout')
		expect(isRetryableError(timeoutError)).toBe(true)
	})

	test('detects connection errors from regular Error', () => {
		expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true)
		expect(isRetryableError(new Error('ECONNRESET'))).toBe(true)
		expect(isRetryableError(new Error('socket hang up'))).toBe(true)
	})

	test('detects server errors from regular Error', () => {
		expect(isRetryableError(new Error('502 Bad Gateway'))).toBe(true)
		expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true)
		expect(isRetryableError(new Error('504 Gateway Timeout'))).toBe(true)
	})

	test('returns false for non-error values', () => {
		expect(isRetryableError('string')).toBe(false)
		expect(isRetryableError(null)).toBe(false)
	})
})

describe('getErrorMessage', () => {
	test('extracts message from Error', () => {
		expect(getErrorMessage(new Error('Test error'))).toBe('Test error')
	})

	test('extracts message from SylphxError', () => {
		expect(getErrorMessage(new SylphxError('SDK error'))).toBe('SDK error')
	})

	test('returns string as-is', () => {
		expect(getErrorMessage('String error')).toBe('String error')
	})

	test('returns default message for unknown types', () => {
		expect(getErrorMessage(null)).toBe('An unknown error occurred')
		expect(getErrorMessage(undefined)).toBe('An unknown error occurred')
		expect(getErrorMessage(123)).toBe('An unknown error occurred')
	})
})

describe('getErrorCode', () => {
	test('extracts code from SylphxError', () => {
		expect(getErrorCode(new SylphxError('Test', { code: 'BAD_REQUEST' }))).toBe('BAD_REQUEST')
	})

	test('returns UNKNOWN for non-SylphxError', () => {
		expect(getErrorCode(new Error('Test'))).toBe('UNKNOWN')
		expect(getErrorCode('string')).toBe('UNKNOWN')
	})
})

describe('toSylphxError', () => {
	test('returns SylphxError as-is', () => {
		const original = new SylphxError('Test')
		expect(toSylphxError(original)).toBe(original)
	})

	test('converts TypeError fetch to NetworkError', () => {
		const error = new TypeError('fetch failed')
		const converted = toSylphxError(error)

		expect(converted).toBeInstanceOf(NetworkError)
		expect(converted.cause).toBe(error)
	})

	test('converts AbortError to ABORTED', () => {
		const error = new Error('Request aborted')
		error.name = 'AbortError'
		const converted = toSylphxError(error)

		expect(converted.code).toBe('ABORTED')
	})

	test('converts timeout error', () => {
		const error = new Error('Request timeout')
		const converted = toSylphxError(error)

		expect(converted).toBeInstanceOf(TimeoutError)
	})

	test('converts 401 error', () => {
		const error = new Error('401 Unauthorized')
		const converted = toSylphxError(error)

		expect(converted).toBeInstanceOf(AuthenticationError)
	})

	test('converts 403 error', () => {
		const error = new Error('403 Forbidden')
		const converted = toSylphxError(error)

		expect(converted).toBeInstanceOf(AuthorizationError)
	})

	test('converts 404 error', () => {
		const error = new Error('404 Not found')
		const converted = toSylphxError(error)

		expect(converted).toBeInstanceOf(NotFoundError)
	})

	test('converts 429 error', () => {
		const error = new Error('429 Rate limit exceeded')
		const converted = toSylphxError(error)

		expect(converted).toBeInstanceOf(RateLimitError)
	})

	test('converts generic Error to SylphxError', () => {
		const error = new Error('Generic error')
		const converted = toSylphxError(error)

		expect(converted).toBeInstanceOf(SylphxError)
		expect(converted.message).toBe('Generic error')
		expect(converted.cause).toBe(error)
	})

	test('converts non-Error to SylphxError with message', () => {
		const converted = toSylphxError('String error')

		expect(converted).toBeInstanceOf(SylphxError)
		// getErrorMessage returns the string as-is if it's a string
		expect(converted.message).toBe('String error')
	})
})

// ============================================================================
// exponentialBackoff Tests
// ============================================================================

describe('exponentialBackoff', () => {
	test('calculates exponential delay', () => {
		// Base delay 1000ms
		// Attempt 0: 1000 * 2^0 = 1000 ± jitter
		// Attempt 1: 1000 * 2^1 = 2000 ± jitter
		// Attempt 2: 1000 * 2^2 = 4000 ± jitter

		const delay0 = exponentialBackoff(0, 1000)
		const delay1 = exponentialBackoff(1, 1000)
		const delay2 = exponentialBackoff(2, 1000)

		// Allow for ±25% jitter
		expect(delay0).toBeGreaterThanOrEqual(750)
		expect(delay0).toBeLessThanOrEqual(1250)

		expect(delay1).toBeGreaterThanOrEqual(1500)
		expect(delay1).toBeLessThanOrEqual(2500)

		expect(delay2).toBeGreaterThanOrEqual(3000)
		expect(delay2).toBeLessThanOrEqual(5000)
	})

	test('caps at maxDelay', () => {
		// With base 1000 and maxDelay 5000
		// Attempt 10 would be 1000 * 2^10 = 1,024,000, but capped at 5000
		const delay = exponentialBackoff(10, 1000, 5000)

		// Should be capped at 5000 ± 25% jitter
		expect(delay).toBeGreaterThanOrEqual(3750)
		expect(delay).toBeLessThanOrEqual(6250)
	})

	test('uses default values', () => {
		const delay = exponentialBackoff(0)

		// Default base is 1000ms
		expect(delay).toBeGreaterThanOrEqual(750)
		expect(delay).toBeLessThanOrEqual(1250)
	})

	test('includes jitter (varies between calls)', () => {
		const delays = Array.from({ length: 10 }, () => exponentialBackoff(0, 1000))
		const uniqueDelays = new Set(delays)

		// With jitter, we should get different values (very unlikely to be all the same)
		expect(uniqueDelays.size).toBeGreaterThan(1)
	})
})

// ============================================================================
// Constants Tests
// ============================================================================

describe('ERROR_CODE_STATUS', () => {
	test('maps error codes to HTTP status', () => {
		expect(ERROR_CODE_STATUS['BAD_REQUEST']).toBe(400)
		expect(ERROR_CODE_STATUS['UNAUTHORIZED']).toBe(401)
		expect(ERROR_CODE_STATUS['FORBIDDEN']).toBe(403)
		expect(ERROR_CODE_STATUS['NOT_FOUND']).toBe(404)
		expect(ERROR_CODE_STATUS['TOO_MANY_REQUESTS']).toBe(429)
		expect(ERROR_CODE_STATUS['INTERNAL_SERVER_ERROR']).toBe(500)
		expect(ERROR_CODE_STATUS['SERVICE_UNAVAILABLE']).toBe(503)
	})

	test('network errors have status 0', () => {
		expect(ERROR_CODE_STATUS['NETWORK_ERROR']).toBe(0)
		expect(ERROR_CODE_STATUS['TIMEOUT']).toBe(0)
		expect(ERROR_CODE_STATUS['ABORTED']).toBe(0)
	})
})

describe('RETRYABLE_CODES', () => {
	test('includes transient error codes', () => {
		expect(RETRYABLE_CODES.has('NETWORK_ERROR')).toBe(true)
		expect(RETRYABLE_CODES.has('TIMEOUT')).toBe(true)
		expect(RETRYABLE_CODES.has('BAD_GATEWAY')).toBe(true)
		expect(RETRYABLE_CODES.has('SERVICE_UNAVAILABLE')).toBe(true)
		expect(RETRYABLE_CODES.has('GATEWAY_TIMEOUT')).toBe(true)
		expect(RETRYABLE_CODES.has('TOO_MANY_REQUESTS')).toBe(true)
	})

	test('excludes client error codes', () => {
		expect(RETRYABLE_CODES.has('BAD_REQUEST')).toBe(false)
		expect(RETRYABLE_CODES.has('UNAUTHORIZED')).toBe(false)
		expect(RETRYABLE_CODES.has('FORBIDDEN')).toBe(false)
		expect(RETRYABLE_CODES.has('NOT_FOUND')).toBe(false)
	})
})
