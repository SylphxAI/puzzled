/**
 * Monitoring Functions
 *
 * Pure functions for error tracking and log capture.
 * Works client-side and server-side.
 *
 * ## Industry Patterns
 * - **Error grouping via fingerprinting** — Same error only billed once (Sentry pattern)
 * - **Adaptive sampling** — Automatic sample rate adjustment based on quota usage
 * - **Breadcrumb trails** — Contextual trail leading to errors
 *
 * @example
 * ```ts
 * import { createConfig, captureException, captureMessage } from '@sylphx/sdk'
 *
 * const config = createConfig({ appId: process.env.NEXT_PUBLIC_SYLPHX_APP_ID! })
 *
 * // Capture errors
 * try {
 *   await riskyOperation()
 * } catch (err) {
 *   await captureException(config, err as Error)
 * }
 *
 * // Capture log messages
 * await captureMessage(config, 'User completed onboarding', { level: 'info' })
 * ```
 */

import { type SylphxConfig, callApi } from "./config";

// ============================================================================
// Types
// ============================================================================

export type MonitoringSeverity = "fatal" | "error" | "warning" | "info";

export interface ExceptionFrame {
	/** Source filename */
	filename?: string;
	/** Function name */
	function?: string;
	/** Line number */
	lineno?: number;
	/** Column number */
	colno?: number;
}

export interface ExceptionValue {
	/** Exception class/type (e.g., "TypeError") */
	type: string;
	/** Exception message */
	value: string;
	/** Stack trace frames (innermost first) */
	stacktrace?: { frames?: ExceptionFrame[] };
}

export interface Breadcrumb {
	/** Breadcrumb type (e.g., "navigation", "http", "ui.click") */
	type?: string;
	/** Log level */
	level?: MonitoringSeverity;
	/** Breadcrumb message */
	message?: string;
	/** Breadcrumb data */
	data?: Record<string, unknown>;
	/** Unix timestamp (seconds) */
	timestamp?: number;
}

export interface CaptureExceptionRequest {
	/** Exception value(s) — first is primary, rest are chained causes */
	exception: { values: ExceptionValue[] };
	/** Severity level (default: "error") */
	level?: MonitoringSeverity;
	/** Current page route */
	route?: string;
	/** User agent string */
	userAgent?: string;
	/** App release version */
	release?: string;
	/** Environment name (e.g., "production", "staging") */
	environment?: string;
	/** Custom tags for filtering */
	tags?: Record<string, string>;
	/** Extra context data */
	extra?: Record<string, unknown>;
	/** Breadcrumb trail leading to the error */
	breadcrumbs?: Breadcrumb[];
	/** Custom fingerprint for grouping (overrides automatic grouping) */
	fingerprint?: string[];
}

export interface CaptureMessageRequest {
	/** Log message */
	message: string;
	/** Severity level (default: "info") */
	level?: MonitoringSeverity;
	/** Current page route */
	route?: string;
	/** App release version */
	release?: string;
	/** Custom tags for filtering */
	tags?: Record<string, string>;
	/** Extra context data */
	extra?: Record<string, unknown>;
}

export interface MonitoringResponse {
	/** Internal event ID */
	eventId: string;
	/** Whether this is a new unique error (true = billed, false = duplicate = free) */
	isNewError: boolean;
	/** Current quota usage percentage (0-100+). Present when >= 50%. */
	quotaUsage?: number;
	/**
	 * Recommended client-side sample rate (0.0-1.0).
	 * Reduce your error capture rate to this value when quota is high.
	 * Present when quotaUsage >= 50%.
	 */
	recommendedSampleRate?: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a native Error object to ExceptionValue format.
 */
function errorToExceptionValue(error: Error): ExceptionValue {
	const frames: ExceptionFrame[] = [];

	if (error.stack) {
		// Parse V8/SpiderMonkey style stack traces
		const lines = error.stack.split("\n").slice(1);
		for (const line of lines) {
			// V8: "    at functionName (file:line:col)"
			const v8Match = line.match(/^\s+at\s+(.+?)\s+\((.+):(\d+):(\d+)\)$/);
			if (v8Match) {
				frames.push({
					function: v8Match[1],
					filename: v8Match[2],
					lineno: Number(v8Match[3]),
					colno: Number(v8Match[4]),
				});
				continue;
			}
			// V8 (no function): "    at file:line:col"
			const v8AnonMatch = line.match(/^\s+at\s+(.+):(\d+):(\d+)$/);
			if (v8AnonMatch) {
				frames.push({
					filename: v8AnonMatch[1],
					lineno: Number(v8AnonMatch[2]),
					colno: Number(v8AnonMatch[3]),
				});
			}
		}
	}

	return {
		type: error.name || "Error",
		value: error.message,
		stacktrace: frames.length > 0 ? { frames } : undefined,
	};
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Capture an exception for error tracking.
 *
 * Errors with the same fingerprint are grouped automatically.
 * Duplicate occurrences of the same error are FREE (only new unique
 * errors count against your quota).
 *
 * @example
 * ```ts
 * try {
 *   await processPayment(amount)
 * } catch (err) {
 *   const result = await captureException(config, err as Error, {
 *     tags: { paymentProvider: 'stripe' },
 *     extra: { amount, userId },
 *   })
 * }
 * ```
 */
export async function captureException(
	config: SylphxConfig,
	error: Error,
	options: Omit<CaptureExceptionRequest, "exception"> = {},
): Promise<MonitoringResponse> {
	const exceptionValue = errorToExceptionValue(error);
	const request: CaptureExceptionRequest = {
		...options,
		exception: { values: [exceptionValue] },
	};
	return callApi<MonitoringResponse>(config, "/sdk/monitoring/exception", {
		method: "POST",
		body: request,
	});
}

/**
 * Capture an exception with full control over the exception payload.
 *
 * Use this for structured exception capture with custom types, chained
 * causes, or when not working with native Error objects.
 */
export async function captureExceptionRaw(
	config: SylphxConfig,
	request: CaptureExceptionRequest,
): Promise<MonitoringResponse> {
	return callApi<MonitoringResponse>(config, "/sdk/monitoring/exception", {
		method: "POST",
		body: request,
	});
}

/**
 * Capture a log message for monitoring.
 *
 * Like `captureException` but for non-error events (warnings, info, etc.).
 * Messages with the same content are grouped automatically.
 *
 * @example
 * ```ts
 * // Info log
 * await captureMessage(config, 'Payment webhook received', {
 *   level: 'info',
 *   tags: { provider: 'stripe', event: 'payment.succeeded' },
 * })
 *
 * // Warning
 * await captureMessage(config, 'Slow query detected', {
 *   level: 'warning',
 *   extra: { queryMs: 2400, query: sql },
 * })
 * ```
 */
export async function captureMessage(
	config: SylphxConfig,
	message: string,
	options: Omit<CaptureMessageRequest, "message"> = {},
): Promise<MonitoringResponse> {
	const request: CaptureMessageRequest = { ...options, message };
	return callApi<MonitoringResponse>(config, "/sdk/monitoring/message", {
		method: "POST",
		body: request,
	});
}
