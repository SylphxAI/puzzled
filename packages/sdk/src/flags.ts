/**
 * Feature Flags Functions
 *
 * Pure functions for feature flag evaluation.
 *
 * Pattern: LaunchDarkly/Statsig server-side evaluation
 * - Server-side: POST /flags/evaluate with context
 * - Returns evaluated results (enabled/disabled for this context)
 *
 * Types are derived from the OpenAPI spec (generated/api.d.ts).
 * Run `bun run generate:types:local` to regenerate after API changes.
 */

import { type SylphxConfig, callApi } from "./config";

// ============================================================================
// Types (SDK-specific - no direct API schema for flag results)
// ============================================================================

export interface FlagResult {
	/** Flag key */
	key: string;
	/** Whether the flag is enabled for this context */
	enabled: boolean;
	/** Variant value (for multivariate flags) */
	variant?: string;
	/** Reason for the evaluation result */
	reason?: string;
	/** Additional payload data */
	payload?: Record<string, unknown>;
}

export interface FlagContext {
	/** User ID for consistent targeting */
	userId?: string;
	/** Anonymous ID for pre-auth targeting */
	anonymousId?: string;
	/** User properties for targeting rules (plan, isAdmin, etc.) */
	properties?: Record<string, unknown>;
}

/** Response from the evaluate endpoint */
interface EvaluateFlagsResponse {
	data: Record<string, FlagResult>;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Check a single feature flag (server-side evaluation)
 *
 * Uses POST /flags/evaluate for consistent, server-side targeting.
 * The server evaluates rollout percentage, premium targeting, etc.
 *
 * @example
 * ```typescript
 * const flag = await checkFlag(config, 'new-checkout', {
 *   userId: 'user-123',
 *   properties: { plan: 'pro' },
 * })
 *
 * if (flag.enabled) {
 *   // Show new checkout
 * }
 * ```
 */
export async function checkFlag(
	config: SylphxConfig,
	flagKey: string,
	context?: FlagContext,
): Promise<FlagResult> {
	const response = await callApi<EvaluateFlagsResponse>(
		config,
		"/flags/evaluate",
		{
			method: "POST",
			body: {
				context: {
					userId: context?.userId,
					anonymousId: context?.anonymousId,
					properties: context?.properties,
				},
				keys: [flagKey],
			},
		},
	);

	// Return the evaluated flag, or a disabled default if not found
	return (
		response.data[flagKey] ?? {
			key: flagKey,
			enabled: false,
			reason: "flag_not_found",
		}
	);
}

/**
 * Get multiple feature flags at once (batch evaluation)
 *
 * Evaluates all requested flags in a single API call.
 * More efficient than calling checkFlag() multiple times.
 *
 * @example
 * ```typescript
 * const flags = await getFlags(config, ['new-checkout', 'dark-mode', 'ai-features'], {
 *   userId: 'user-123',
 * })
 *
 * if (flags['new-checkout'].enabled) {
 *   // Show new checkout
 * }
 * ```
 */
export async function getFlags(
	config: SylphxConfig,
	flagKeys: string[],
	context?: FlagContext,
): Promise<Record<string, FlagResult>> {
	const response = await callApi<EvaluateFlagsResponse>(
		config,
		"/flags/evaluate",
		{
			method: "POST",
			body: {
				context: {
					userId: context?.userId,
					anonymousId: context?.anonymousId,
					properties: context?.properties,
				},
				keys: flagKeys,
			},
		},
	);

	return response.data;
}

/**
 * Get all feature flags for a context (bootstrap)
 *
 * Evaluates ALL flags for the app in a single API call.
 * Useful for bootstrapping the flag state on app load.
 *
 * @example
 * ```typescript
 * // Bootstrap all flags on app load
 * const allFlags = await getAllFlags(config, { userId: 'user-123' })
 *
 * // Use throughout the app
 * if (allFlags['new-checkout']?.enabled) {
 *   // Show new checkout
 * }
 * ```
 */
export async function getAllFlags(
	config: SylphxConfig,
	context?: FlagContext,
): Promise<Record<string, FlagResult>> {
	const response = await callApi<EvaluateFlagsResponse>(
		config,
		"/flags/evaluate",
		{
			method: "POST",
			body: {
				context: {
					userId: context?.userId,
					anonymousId: context?.anonymousId,
					properties: context?.properties,
				},
				// Omit keys to get all flags
			},
		},
	);

	return response.data;
}

/**
 * Check if a flag is enabled (boolean helper)
 *
 * @example
 * ```typescript
 * if (await isEnabled(config, 'new-checkout', { userId: 'user-123' })) {
 *   // Show new checkout
 * }
 * ```
 */
export async function isEnabled(
	config: SylphxConfig,
	flagKey: string,
	context?: FlagContext,
): Promise<boolean> {
	const flag = await checkFlag(config, flagKey, context);
	return flag.enabled;
}

/**
 * Get flag variant (for A/B tests)
 *
 * @example
 * ```typescript
 * const variant = await getVariant(config, 'checkout-experiment', {
 *   userId: 'user-123',
 * })
 *
 * switch (variant) {
 *   case 'control':
 *     // Show original checkout
 *     break
 *   case 'variant-a':
 *     // Show variant A
 *     break
 *   case 'variant-b':
 *     // Show variant B
 *     break
 * }
 * ```
 */
export async function getVariant(
	config: SylphxConfig,
	flagKey: string,
	context?: FlagContext,
): Promise<string | undefined> {
	const flag = await checkFlag(config, flagKey, context);
	return flag.variant;
}

/**
 * Get flag payload (for remote config)
 *
 * @example
 * ```typescript
 * const payload = await getFlagPayload<{ maxItems: number }>(config, 'cart-config', {
 *   userId: 'user-123',
 * })
 *
 * console.log(payload?.maxItems) // 10
 * ```
 */
export async function getFlagPayload<T extends Record<string, unknown>>(
	config: SylphxConfig,
	flagKey: string,
	context?: FlagContext,
): Promise<T | undefined> {
	const flag = await checkFlag(config, flagKey, context);
	return flag.payload as T | undefined;
}
