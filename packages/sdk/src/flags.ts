/**
 * Feature Flags Functions
 *
 * Pure functions for feature flag evaluation.
 *
 * Types are derived from the OpenAPI spec (generated/api.d.ts).
 * Run `bun run generate:types:local` to regenerate after API changes.
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types (SDK-specific - no direct API schema for flag results)
// ============================================================================

export interface FlagResult {
	/** Flag key */
	key: string
	/** Whether the flag is enabled */
	enabled: boolean
	/** Variant value (for multivariate flags) */
	variant?: string
	/** Additional payload data */
	payload?: Record<string, unknown>
}

export interface FlagContext {
	/** User ID */
	userId?: string
	/** Anonymous ID */
	anonymousId?: string
	/** User properties for targeting */
	properties?: Record<string, unknown>
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Check a single feature flag
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
	context?: FlagContext
): Promise<FlagResult> {
	return callApi<FlagResult>(config, '/flags/check', {
		method: 'GET',
		query: {
			key: flagKey,
			userId: context?.userId,
			anonymousId: context?.anonymousId,
			properties: context?.properties ? JSON.stringify(context.properties) : undefined,
		},
	})
}

/**
 * Get multiple feature flags at once
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
	context?: FlagContext
): Promise<Record<string, FlagResult>> {
	const results = await Promise.all(
		flagKeys.map((key) => checkFlag(config, key, context))
	)

	return Object.fromEntries(results.map((r) => [r.key, r]))
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
	context?: FlagContext
): Promise<boolean> {
	const flag = await checkFlag(config, flagKey, context)
	return flag.enabled
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
	context?: FlagContext
): Promise<string | undefined> {
	const flag = await checkFlag(config, flagKey, context)
	return flag.variant
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
	context?: FlagContext
): Promise<T | undefined> {
	const flag = await checkFlag(config, flagKey, context)
	return flag.payload as T | undefined
}
