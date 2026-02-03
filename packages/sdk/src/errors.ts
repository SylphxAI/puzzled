/**
 * Sylphx SDK Error Classes
 *
 * Typed error classes for better error handling and debugging.
 * Compatible with tRPC error codes and provides rich context.
 *
 * @example
 * ```typescript
 * import { SylphxError, isRetryableError, getErrorMessage } from '@sylphx/sdk'
 *
 * try {
 *   await sylphx.auth.login.mutate({ email, password })
 * } catch (error) {
 *   if (error instanceof SylphxError) {
 *     console.log(error.code) // 'UNAUTHORIZED'
 *     console.log(error.isRetryable) // false
 *   }
 *   if (isRetryableError(error)) {
 *     // Safe to retry
 *   }
 * }
 * ```
 */

import { BASE_RETRY_DELAY_MS, MAX_RETRY_DELAY_MS, DEFAULT_TIMEOUT_MS } from './constants'

// ============================================================================
// Error Codes (aligned with tRPC and HTTP semantics)
// ============================================================================

export type SylphxErrorCode =
	// Client errors (4xx)
	| 'BAD_REQUEST' // 400 - Invalid input
	| 'UNAUTHORIZED' // 401 - Not authenticated
	| 'FORBIDDEN' // 403 - Not authorized
	| 'NOT_FOUND' // 404 - Resource not found
	| 'CONFLICT' // 409 - Resource conflict (e.g., duplicate)
	| 'PAYLOAD_TOO_LARGE' // 413 - Request too large
	| 'UNPROCESSABLE_ENTITY' // 422 - Validation failed
	| 'TOO_MANY_REQUESTS' // 429 - Rate limited
	// Server errors (5xx)
	| 'INTERNAL_SERVER_ERROR' // 500 - Server error
	| 'NOT_IMPLEMENTED' // 501 - Feature not available
	| 'BAD_GATEWAY' // 502 - Upstream error
	| 'SERVICE_UNAVAILABLE' // 503 - Temporarily unavailable
	| 'GATEWAY_TIMEOUT' // 504 - Upstream timeout
	// Network/Client errors
	| 'NETWORK_ERROR' // Network failure
	| 'TIMEOUT' // Request timeout
	| 'ABORTED' // Request aborted
	// SDK-specific
	| 'PARSE_ERROR' // JSON/response parse error
	| 'UNKNOWN' // Unknown error

/**
 * HTTP status code mapping for error codes
 */
export const ERROR_CODE_STATUS: Record<SylphxErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	PAYLOAD_TOO_LARGE: 413,
	UNPROCESSABLE_ENTITY: 422,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
	NOT_IMPLEMENTED: 501,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
	GATEWAY_TIMEOUT: 504,
	NETWORK_ERROR: 0,
	TIMEOUT: 0,
	ABORTED: 0,
	PARSE_ERROR: 0,
	UNKNOWN: 0,
}

/**
 * Retryable error codes (safe to retry automatically)
 */
export const RETRYABLE_CODES: Set<SylphxErrorCode> = new Set([
	'NETWORK_ERROR',
	'TIMEOUT',
	'BAD_GATEWAY',
	'SERVICE_UNAVAILABLE',
	'GATEWAY_TIMEOUT',
	'TOO_MANY_REQUESTS', // With backoff
	'INTERNAL_SERVER_ERROR', // Sometimes transient
])

// ============================================================================
// Error Classes
// ============================================================================

export interface SylphxErrorOptions {
	/** Error code for programmatic handling */
	code?: SylphxErrorCode
	/** HTTP status code (inferred from code if not provided) */
	status?: number
	/** Additional context data */
	data?: Record<string, unknown>
	/** Original error that caused this */
	cause?: Error
	/** Retry-After header value (seconds) for rate limiting */
	retryAfter?: number
}

/**
 * Base error class for all Sylphx SDK errors
 *
 * @example
 * ```typescript
 * throw new SylphxError('Invalid email format', {
 *   code: 'BAD_REQUEST',
 *   data: { field: 'email' }
 * })
 * ```
 */
export class SylphxError extends Error {
	/** Error code for programmatic handling */
	readonly code: SylphxErrorCode

	/** HTTP status code */
	readonly status: number

	/** Additional context data */
	readonly data?: Record<string, unknown>

	/** Whether this error is safe to retry */
	readonly isRetryable: boolean

	/** Retry-After value in seconds (for rate limiting) */
	readonly retryAfter?: number

	/** Timestamp when error occurred */
	readonly timestamp: Date

	constructor(message: string, options: SylphxErrorOptions = {}) {
		super(message, { cause: options.cause })
		this.name = 'SylphxError'
		this.code = options.code ?? 'UNKNOWN'
		this.status = options.status ?? ERROR_CODE_STATUS[this.code]
		this.data = options.data
		this.isRetryable = RETRYABLE_CODES.has(this.code)
		this.retryAfter = options.retryAfter
		this.timestamp = new Date()

		// Maintain proper stack trace in V8
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, SylphxError)
		}
	}

	/**
	 * Convert to JSON-serializable object
	 */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			status: this.status,
			data: this.data,
			isRetryable: this.isRetryable,
			retryAfter: this.retryAfter,
			timestamp: this.timestamp.toISOString(),
		}
	}
}

/**
 * Network-related errors (no response received)
 */
export class NetworkError extends SylphxError {
	constructor(message = 'Network request failed', options?: Omit<SylphxErrorOptions, 'code'>) {
		super(message, { ...options, code: 'NETWORK_ERROR' })
		this.name = 'NetworkError'
	}
}

/**
 * Request timeout errors
 */
export class TimeoutError extends SylphxError {
	/** Timeout duration in milliseconds */
	readonly timeout: number

	constructor(timeout: number, options?: Omit<SylphxErrorOptions, 'code'>) {
		super(`Request timed out after ${timeout}ms`, { ...options, code: 'TIMEOUT' })
		this.name = 'TimeoutError'
		this.timeout = timeout
	}
}

/**
 * Authentication errors (401)
 */
export class AuthenticationError extends SylphxError {
	constructor(message = 'Authentication required', options?: Omit<SylphxErrorOptions, 'code'>) {
		super(message, { ...options, code: 'UNAUTHORIZED' })
		this.name = 'AuthenticationError'
	}
}

/**
 * Authorization errors (403)
 */
export class AuthorizationError extends SylphxError {
	constructor(message = 'Permission denied', options?: Omit<SylphxErrorOptions, 'code'>) {
		super(message, { ...options, code: 'FORBIDDEN' })
		this.name = 'AuthorizationError'
	}
}

/**
 * Validation errors (422)
 */
export class ValidationError extends SylphxError {
	/** Field-specific errors */
	readonly fieldErrors?: Record<string, string[]>

	constructor(
		message: string,
		options?: Omit<SylphxErrorOptions, 'code'> & {
			fieldErrors?: Record<string, string[]>
		}
	) {
		super(message, { ...options, code: 'UNPROCESSABLE_ENTITY' })
		this.name = 'ValidationError'
		this.fieldErrors = options?.fieldErrors
	}

	/**
	 * Get error message for a specific field
	 */
	getFieldError(field: string): string | undefined {
		return this.fieldErrors?.[field]?.[0]
	}
}

/**
 * Rate limit metadata (Stripe SDK pattern)
 */
export interface RateLimitInfo {
	/** Maximum requests allowed in window */
	limit?: number
	/** Remaining requests in current window */
	remaining?: number
	/** Unix timestamp (seconds) when limit resets */
	resetAt?: number
	/** Seconds until limit resets (Retry-After header) */
	retryAfter?: number
}

/**
 * Rate limit errors (429)
 *
 * Provides full rate limit metadata for consumer apps to implement
 * proper backoff UI (countdown timers, retry buttons, etc.)
 *
 * @example
 * ```typescript
 * try {
 *   await sendEmail(config, options)
 * } catch (error) {
 *   if (error instanceof RateLimitError) {
 *     const waitSeconds = error.retryAfter ?? 60
 *     console.log(`Rate limited. Retry after ${waitSeconds}s`)
 *     console.log(`Remaining: ${error.remaining}/${error.limit}`)
 *     console.log(`Resets at: ${new Date(error.resetAt! * 1000)}`)
 *   }
 * }
 * ```
 */
export class RateLimitError extends SylphxError {
	/** Maximum requests allowed in window */
	readonly limit?: number

	/** Remaining requests in current window */
	readonly remaining?: number

	/** Unix timestamp (seconds) when limit resets */
	readonly resetAt?: number

	constructor(
		message = 'Too many requests',
		options?: Omit<SylphxErrorOptions, 'code'> & RateLimitInfo
	) {
		super(message, { ...options, code: 'TOO_MANY_REQUESTS' })
		this.name = 'RateLimitError'
		this.limit = options?.limit
		this.remaining = options?.remaining
		this.resetAt = options?.resetAt
	}

	/**
	 * Get Date when rate limit resets
	 */
	getResetDate(): Date | undefined {
		return this.resetAt ? new Date(this.resetAt * 1000) : undefined
	}

	/**
	 * Get human-readable retry message
	 */
	getRetryMessage(): string {
		if (this.retryAfter) {
			return `Please retry after ${this.retryAfter} seconds`
		}
		if (this.resetAt) {
			const seconds = Math.max(0, this.resetAt - Math.floor(Date.now() / 1000))
			return `Rate limit resets in ${seconds} seconds`
		}
		return 'Please wait before retrying'
	}
}

/**
 * Resource not found errors (404)
 */
export class NotFoundError extends SylphxError {
	/** Type of resource that wasn't found */
	readonly resourceType?: string

	/** ID of the resource that wasn't found */
	readonly resourceId?: string

	constructor(
		message = 'Resource not found',
		options?: Omit<SylphxErrorOptions, 'code'> & {
			resourceType?: string
			resourceId?: string
		}
	) {
		super(message, { ...options, code: 'NOT_FOUND' })
		this.name = 'NotFoundError'
		this.resourceType = options?.resourceType
		this.resourceId = options?.resourceId
	}
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an error is a Sylphx SDK error
 */
export function isSylphxError(error: unknown): error is SylphxError {
	return error instanceof SylphxError
}

/**
 * Check if an error is safe to retry
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof SylphxError) {
		return error.isRetryable
	}

	// Check for network errors
	if (error instanceof Error) {
		const message = error.message.toLowerCase()
		const name = error.name.toLowerCase()

		// Network errors
		if (name === 'typeerror' && message.includes('fetch')) return true
		if (name === 'networkerror') return true

		// Timeout patterns
		if (message.includes('timeout')) return true
		if (message.includes('timed out')) return true

		// Connection errors
		if (message.includes('econnrefused')) return true
		if (message.includes('econnreset')) return true
		if (message.includes('socket')) return true

		// Server errors that might be transient
		if (message.includes('502')) return true
		if (message.includes('503')) return true
		if (message.includes('504')) return true
	}

	return false
}

/**
 * Extract error message from any error type
 */
export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message
	}
	if (typeof error === 'string') {
		return error
	}
	return 'An unknown error occurred'
}

/**
 * Get error code from any error type
 */
export function getErrorCode(error: unknown): SylphxErrorCode {
	if (error instanceof SylphxError) {
		return error.code
	}
	return 'UNKNOWN'
}

/**
 * Convert any error to SylphxError
 */
export function toSylphxError(error: unknown): SylphxError {
	if (error instanceof SylphxError) {
		return error
	}

	if (error instanceof Error) {
		// Try to infer error type from message/name
		const message = error.message.toLowerCase()
		const name = error.name.toLowerCase()

		// Network errors
		if (name === 'typeerror' && message.includes('fetch')) {
			return new NetworkError(error.message, { cause: error })
		}
		if (name === 'aborterror' || message.includes('aborted')) {
			return new SylphxError(error.message, { code: 'ABORTED', cause: error })
		}

		// Timeout
		if (message.includes('timeout')) {
			return new TimeoutError(DEFAULT_TIMEOUT_MS, { cause: error })
		}

		// HTTP status codes in message
		if (message.includes('401') || message.includes('unauthorized')) {
			return new AuthenticationError(error.message, { cause: error })
		}
		if (message.includes('403') || message.includes('forbidden')) {
			return new AuthorizationError(error.message, { cause: error })
		}
		if (message.includes('404') || message.includes('not found')) {
			return new NotFoundError(error.message, { cause: error })
		}
		if (message.includes('429') || message.includes('rate limit')) {
			return new RateLimitError(error.message, { cause: error })
		}

		return new SylphxError(error.message, { cause: error })
	}

	return new SylphxError(getErrorMessage(error))
}

/**
 * Calculate exponential backoff delay with jitter
 *
 * @param attempt - Retry attempt number (0-indexed)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay in milliseconds (default: 30000)
 * @returns Delay in milliseconds with jitter
 */
export function exponentialBackoff(attempt: number, baseDelay = BASE_RETRY_DELAY_MS, maxDelay = MAX_RETRY_DELAY_MS): number {
	// Calculate exponential delay: baseDelay * 2^attempt
	const exponentialDelay = baseDelay * Math.pow(2, attempt)

	// Cap at maxDelay
	const cappedDelay = Math.min(exponentialDelay, maxDelay)

	// Add jitter (±25% randomness)
	const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1)

	return Math.round(cappedDelay + jitter)
}
