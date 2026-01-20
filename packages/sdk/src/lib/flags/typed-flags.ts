/**
 * Type-Safe Feature Flags
 *
 * Provides compile-time type checking for flag keys and return values
 * based on the defined flags config.
 */

import type { SylphxConfig } from '../../config'
import { checkFlag as baseCheckFlag, getFlags as baseGetFlags } from '../../flags'
import type {
	FlagsConfig,
	AnyFlagDefinition,
	ExtractFlagKeys,
	BooleanFlagDefinition,
	StringFlagDefinition,
	NumberFlagDefinition,
	JsonFlagDefinition,
	VariantFlagDefinition,
} from './config'

// ============================================================================
// Type Utilities
// ============================================================================

/** Get flag definition by key */
type GetFlagDef<
	T extends FlagsConfig,
	TKey extends ExtractFlagKeys<T>
> = Extract<T['flags'][number], { key: TKey }>

/** Get return type for a flag */
type FlagReturnType<T extends AnyFlagDefinition> =
	T extends BooleanFlagDefinition ? boolean :
	T extends StringFlagDefinition<string> ? T extends { allowedValues: readonly (infer V)[] } ? V : string :
	T extends NumberFlagDefinition ? number :
	T extends JsonFlagDefinition<string, infer TPayload> ? TPayload :
	T extends VariantFlagDefinition<string, infer TVariants> ? TVariants[number] :
	unknown

// ============================================================================
// Typed Flags Client
// ============================================================================

/** Flag context for evaluation */
interface FlagContext {
	userId?: string
	anonymousId?: string
	properties?: Record<string, unknown>
}

/** Flag result */
interface FlagResult<T> {
	key: string
	enabled: boolean
	value: T
	variant?: string
}

/**
 * Type-safe flags client
 */
export interface TypedFlags<TConfig extends FlagsConfig> {
	/**
	 * Check if a boolean flag is enabled
	 */
	isEnabled<TKey extends ExtractFlagKeys<TConfig>>(
		key: TKey,
		context?: FlagContext
	): Promise<boolean>

	/**
	 * Get a flag value with proper typing
	 */
	getValue<TKey extends ExtractFlagKeys<TConfig>>(
		key: TKey,
		context?: FlagContext
	): Promise<FlagReturnType<GetFlagDef<TConfig, TKey>>>

	/**
	 * Get a variant flag's current variant
	 */
	getVariant<TKey extends ExtractFlagKeys<TConfig>>(
		key: TKey,
		context?: FlagContext
	): Promise<GetFlagDef<TConfig, TKey> extends VariantFlagDefinition<string, infer V> ? V[number] : string | undefined>

	/**
	 * Get a JSON flag's payload
	 */
	getPayload<TKey extends ExtractFlagKeys<TConfig>>(
		key: TKey,
		context?: FlagContext
	): Promise<GetFlagDef<TConfig, TKey> extends JsonFlagDefinition<string, infer P> ? P : Record<string, unknown> | undefined>

	/**
	 * Get multiple flags at once
	 */
	getFlags<TKeys extends readonly ExtractFlagKeys<TConfig>[]>(
		keys: TKeys,
		context?: FlagContext
	): Promise<{ [K in TKeys[number]]: FlagResult<FlagReturnType<GetFlagDef<TConfig, K>>> }>

	/**
	 * Check if a flag is defined
	 */
	isDefined(key: string): boolean

	/**
	 * Get flag definition
	 */
	getDefinition<TKey extends ExtractFlagKeys<TConfig>>(key: TKey): GetFlagDef<TConfig, TKey>

	/**
	 * Get all flag definitions
	 */
	getAllDefinitions(): TConfig['flags']

	/**
	 * Get the config
	 */
	getConfig(): TConfig
}

/**
 * Create a type-safe flags client
 *
 * @example
 * ```typescript
 * import { createTypedFlags, createFlagsConfig, defineBooleanFlag } from '@sylphx/sdk'
 *
 * const config = createFlagsConfig({
 *   flags: [
 *     defineBooleanFlag({
 *       key: 'new-checkout',
 *       name: 'New Checkout',
 *       description: 'Enable new checkout flow',
 *       defaultValue: false,
 *     }),
 *   ],
 * })
 *
 * const flags = createTypedFlags(sylphxConfig, config)
 *
 * // Type-safe - compile error if key is wrong
 * const enabled = await flags.isEnabled('new-checkout') // ✅
 * const enabled2 = await flags.isEnabled('wrong-key') // ❌ Compile error
 * ```
 */
export function createTypedFlags<TConfig extends FlagsConfig>(
	config: SylphxConfig,
	flagsConfig: TConfig
): TypedFlags<TConfig> {
	const flagMap = new Map<string, AnyFlagDefinition>()
	for (const flag of flagsConfig.flags) {
		flagMap.set(flag.key, flag)
	}

	const getDefault = (key: string): unknown => {
		const def = flagMap.get(key)
		if (!def) return undefined
		if ('defaultValue' in def) return def.defaultValue
		if ('defaultVariant' in def) return def.defaultVariant
		return undefined
	}

	return {
		async isEnabled(key, context) {
			const result = await baseCheckFlag(config, key, context)
			return result.enabled
		},

		async getValue(key, context) {
			const def = flagMap.get(key)
			if (!def) {
				throw new Error(`[Flags] Flag "${key}" is not defined`)
			}

			const result = await baseCheckFlag(config, key, context)

			if (!result.enabled) {
				return getDefault(key) as FlagReturnType<GetFlagDef<TConfig, typeof key>>
			}

			// For boolean flags, enabled status IS the value
			if (def.type === 'boolean') {
				return result.enabled as FlagReturnType<GetFlagDef<TConfig, typeof key>>
			}

			// For variant flags, return the variant
			if (def.type === 'variant') {
				return (result.variant ?? (def as VariantFlagDefinition).defaultVariant) as FlagReturnType<GetFlagDef<TConfig, typeof key>>
			}

			// For JSON flags, return the payload
			if (def.type === 'json') {
				return (result.payload ?? (def as JsonFlagDefinition).defaultValue) as FlagReturnType<GetFlagDef<TConfig, typeof key>>
			}

			// For string/number flags (from payload)
			const value = result.payload?.value
			if (value !== undefined) {
				return value as FlagReturnType<GetFlagDef<TConfig, typeof key>>
			}

			return getDefault(key) as FlagReturnType<GetFlagDef<TConfig, typeof key>>
		},

		async getVariant(key, context) {
			const result = await baseCheckFlag(config, key, context)
			const def = flagMap.get(key)
			if (def && def.type === 'variant') {
				return (result.variant ?? (def as VariantFlagDefinition).defaultVariant) as GetFlagDef<TConfig, typeof key> extends VariantFlagDefinition<string, infer V> ? V[number] : string | undefined
			}
			return result.variant as GetFlagDef<TConfig, typeof key> extends VariantFlagDefinition<string, infer V> ? V[number] : string | undefined
		},

		async getPayload(key, context) {
			const result = await baseCheckFlag(config, key, context)
			const def = flagMap.get(key)
			if (def && def.type === 'json' && !result.enabled) {
				return (def as JsonFlagDefinition).defaultValue as GetFlagDef<TConfig, typeof key> extends JsonFlagDefinition<string, infer P> ? P : Record<string, unknown> | undefined
			}
			return result.payload as GetFlagDef<TConfig, typeof key> extends JsonFlagDefinition<string, infer P> ? P : Record<string, unknown> | undefined
		},

		async getFlags(keys, context) {
			const results = await baseGetFlags(config, [...keys], context)
			const typed: Record<string, FlagResult<unknown>> = {}

			for (const key of keys) {
				const result = results[key]
				const def = flagMap.get(key)
				let value: unknown = result?.enabled ?? false

				if (def) {
					if (def.type === 'variant') {
						value = result?.variant ?? (def as VariantFlagDefinition).defaultVariant
					} else if (def.type === 'json') {
						value = result?.payload ?? (def as JsonFlagDefinition).defaultValue
					} else if (def.type === 'boolean') {
						value = result?.enabled ?? (def as BooleanFlagDefinition).defaultValue
					} else {
						value = result?.payload?.value ?? getDefault(key)
					}
				}

				typed[key] = {
					key,
					enabled: result?.enabled ?? false,
					value,
					variant: result?.variant,
				}
			}

			return typed as { [K in (typeof keys)[number]]: FlagResult<FlagReturnType<GetFlagDef<TConfig, K>>> }
		},

		isDefined(key) {
			return flagMap.has(key)
		},

		getDefinition(key) {
			const def = flagMap.get(key)
			if (!def) {
				throw new Error(`[Flags] Flag "${key}" is not defined`)
			}
			return def as GetFlagDef<TConfig, typeof key>
		},

		getAllDefinitions() {
			return flagsConfig.flags
		},

		getConfig() {
			return flagsConfig
		},
	}
}
