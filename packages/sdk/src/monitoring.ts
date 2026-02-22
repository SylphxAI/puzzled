/**
 * Monitoring Functions — Server-Side Error Tracking
 *
 * Capture exceptions and log messages from server-side code.
 *
 * Types are derived from the OpenAPI spec (generated/api.d.ts).
 * Run `bun run generate:types:local` to regenerate after API changes.
 *
 * @example
 * ```typescript
 * import { createConfig, captureException, captureMessage } from '@sylphx/sdk'
 *
 * const config = createConfig({ appId: process.env.SYLPHX_APP_ID! })
 *
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   await captureException(config, error)
 * }
 * ```
 */

import { type SylphxConfig, callApi } from "./config";
import type { components } from "./generated/api";

// ============================================================================
// Types (re-exported from generated OpenAPI spec)
// ============================================================================

export type CaptureExceptionRequest =
	components["schemas"]["CaptureExceptionRequest"];
export type CaptureMessageRequest =
	components["schemas"]["CaptureMessageRequest"];
export type MonitoringExceptionValue =
	components["schemas"]["MonitoringExceptionValue"];
export type MonitoringBreadcrumb =
	components["schemas"]["MonitoringBreadcrumb"];
export type MonitoringErrorLevel =
	components["schemas"]["MonitoringErrorLevel"];

/** Successful capture response */
export interface MonitoringCaptureResult {
	/** Unique event ID assigned by the platform */
	eventId: string;
	/** True if this is a brand-new unique error (billed). False if duplicate (free). */
	isNewError: boolean;
}

// ============================================================================
// Helpers — error → SDK payload
// ============================================================================

/**
 * Convert a JavaScript Error (or unknown thrown value) to the
 * `exception.values` format expected by the API.
 */
function errorToExceptionValues(error: unknown): MonitoringExceptionValue[] {
	if (error instanceof Error) {
		const frames = (error.stack ?? "")
			.split("\n")
			.slice(1) // Skip "Error: <message>" header line
			.map((line) => {
				// Parse "    at <fn> (<file>:<line>:<col>)"
				const match = line.trim().match(/at (.+?) \((.+?):(\d+):(\d+)\)/);
				if (match) {
					return {
						filename: match[2],
						function: match[1],
						lineno: Number(match[3]),
						colno: Number(match[4]),
						in_app: !match[2]?.includes("node_modules"),
					};
				}
				return { filename: line.trim() };
			});

		return [
			{
				type: error.name ?? "Error",
				value: error.message,
				stacktrace: frames.length > 0 ? { frames } : undefined,
			},
		];
	}

	return [
		{
			type: "UnknownError",
			value: String(error),
		},
	];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Capture an exception from server-side code.
 *
 * Automatically parses the Error stack trace into structured frames.
 * Errors with the same fingerprint are grouped — only the first occurrence
 * per fingerprint is billed.
 *
 * @param config   SDK config (appId or secretKey)
 * @param error    The caught error (Error instance or any thrown value)
 * @param options  Additional context (tags, breadcrumbs, release, etc.)
 *
 * @example
 * ```typescript
 * try {
 *   await processPayment(userId)
 * } catch (error) {
 *   await captureException(config, error, {
 *     tags: { component: 'billing', userId },
 *     release: '2.1.0',
 *   })
 * }
 * ```
 */
export async function captureException(
	config: SylphxConfig,
	error: unknown,
	options?: {
		level?: MonitoringErrorLevel;
		tags?: Record<string, string>;
		extra?: Record<string, unknown>;
		breadcrumbs?: MonitoringBreadcrumb[];
		route?: string;
		fingerprint?: string[];
		release?: string;
		environment?: string;
	},
): Promise<MonitoringCaptureResult> {
	const body: CaptureExceptionRequest = {
		exception: {
			values: errorToExceptionValues(error),
		},
		level: options?.level ?? "error",
		tags: options?.tags,
		extra: options?.extra,
		breadcrumbs: options?.breadcrumbs,
		route: options?.route,
		fingerprint: options?.fingerprint,
		release: options?.release,
		environment: options?.environment,
	};

	return callApi<MonitoringCaptureResult>(config, "/monitoring/exception", {
		method: "POST",
		body,
	});
}

/**
 * Capture a log message for monitoring.
 *
 * Use for structured logging that you want searchable in the monitoring
 * dashboard — e.g., deprecation warnings, background job milestones, etc.
 *
 * @example
 * ```typescript
 * await captureMessage(config, 'Payment webhook received', {
 *   level: 'info',
 *   tags: { eventType: 'payment.succeeded' },
 *   extra: { amount: 4900, currency: 'usd' },
 * })
 * ```
 */
export async function captureMessage(
	config: SylphxConfig,
	message: string,
	options?: {
		level?: MonitoringErrorLevel;
		tags?: Record<string, string>;
		extra?: Record<string, unknown>;
		route?: string;
	},
): Promise<MonitoringCaptureResult> {
	const body: CaptureMessageRequest = {
		message,
		level: options?.level ?? "info",
		tags: options?.tags,
		extra: options?.extra,
		route: options?.route,
	};

	return callApi<MonitoringCaptureResult>(config, "/monitoring/message", {
		method: "POST",
		body,
	});
}
