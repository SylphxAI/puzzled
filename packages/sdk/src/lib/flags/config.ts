/**
 * Feature Flags Config Builders (Code First)
 *
 * Define feature flags in code for type safety and documentation.
 * Flag definitions are synced to the platform automatically.
 *
 * @example
 * ```typescript
 * // flags.config.ts
 * import { defineFlag, defineBooleanFlag, defineVariantFlag, createFlagsConfig } from '@sylphx/sdk'
 *
 * const newCheckout = defineBooleanFlag({
 *   key: 'new-checkout',
 *   name: 'New Checkout Flow',
 *   description: 'Enable the redesigned checkout experience',
 *   defaultValue: false,
 * })
 *
 * const checkoutExperiment = defineVariantFlag({
 *   key: 'checkout-experiment',
 *   name: 'Checkout A/B Test',
 *   description: 'Test different checkout variations',
 *   variants: ['control', 'variant-a', 'variant-b'],
 *   defaultVariant: 'control',
 * })
 *
 * export const flagsConfig = createFlagsConfig({
 *   flags: [newCheckout, checkoutExperiment],
 * })
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/** Flag type (boolean, string, number, json) */
export type FlagType = 'boolean' | 'string' | 'number' | 'json'

/** Flag category for organization */
export type FlagCategory = 'release' | 'experiment' | 'ops' | 'permission' | 'killswitch'

/** Base flag definition */
export interface FlagDefinitionBase<TKey extends string = string> {
	/** Unique flag key (kebab-case recommended) */
	key: TKey
	/** Display name */
	name: string
	/** Description of what this flag controls */
	description: string
	/** Flag category */
	category?: FlagCategory
	/** Tags for filtering */
	tags?: string[]
	/** Whether this flag is temporary (tech debt to clean up) */
	temporary?: boolean
	/** Owner/team responsible */
	owner?: string
	/** JIRA/Linear ticket reference */
	ticketUrl?: string
	/** Whether this flag is deprecated */
	deprecated?: boolean
	/** Deprecation message */
	deprecationMessage?: string
}

/** Boolean flag definition */
export interface BooleanFlagDefinition<TKey extends string = string> extends FlagDefinitionBase<TKey> {
	type: 'boolean'
	/** Default value when no rules match */
	defaultValue: boolean
}

/** String flag definition */
export interface StringFlagDefinition<TKey extends string = string> extends FlagDefinitionBase<TKey> {
	type: 'string'
	/** Default value */
	defaultValue: string
	/** Allowed values (optional enum) */
	allowedValues?: string[]
}

/** Number flag definition */
export interface NumberFlagDefinition<TKey extends string = string> extends FlagDefinitionBase<TKey> {
	type: 'number'
	/** Default value */
	defaultValue: number
	/** Min value */
	min?: number
	/** Max value */
	max?: number
}

/** JSON flag definition (for remote config) */
export interface JsonFlagDefinition<
	TKey extends string = string,
	TPayload extends Record<string, unknown> = Record<string, unknown>
> extends FlagDefinitionBase<TKey> {
	type: 'json'
	/** Default payload */
	defaultValue: TPayload
	/** JSON schema for validation (optional) */
	schema?: Record<string, unknown>
}

/** Variant flag definition (A/B testing) */
export interface VariantFlagDefinition<
	TKey extends string = string,
	TVariants extends string[] = string[]
> extends FlagDefinitionBase<TKey> {
	type: 'variant'
	/** All possible variants */
	variants: TVariants
	/** Default variant */
	defaultVariant: TVariants[number]
	/** Variant payloads (optional) */
	payloads?: Partial<Record<TVariants[number], Record<string, unknown>>>
}

/** Any flag definition */
export type AnyFlagDefinition =
	| BooleanFlagDefinition
	| StringFlagDefinition
	| NumberFlagDefinition
	| JsonFlagDefinition
	| VariantFlagDefinition

/** Flags config */
export interface FlagsConfig<TFlags extends AnyFlagDefinition[] = AnyFlagDefinition[]> {
	/** Flag definitions */
	flags: TFlags
	/** Config version */
	version: string
	/** Environment-specific defaults */
	environments?: Record<string, Partial<Record<string, boolean>>>
}

// ============================================================================
// Type Utilities
// ============================================================================

/** Extract flag keys from config */
export type ExtractFlagKeys<T extends FlagsConfig> = T['flags'][number]['key']

/** Extract flag type by key */
export type ExtractFlagType<
	T extends FlagsConfig,
	TKey extends ExtractFlagKeys<T>
> = Extract<T['flags'][number], { key: TKey }>

/** Get flag value type */
export type FlagValueType<T extends AnyFlagDefinition> =
	T extends BooleanFlagDefinition ? boolean :
	T extends StringFlagDefinition ? T extends { allowedValues: infer V } ? (V extends string[] ? V[number] : string) : string :
	T extends NumberFlagDefinition ? number :
	T extends JsonFlagDefinition<string, infer TPayload> ? TPayload :
	T extends VariantFlagDefinition<string, infer TVariants> ? TVariants[number] :
	unknown

// ============================================================================
// Builders
// ============================================================================

/**
 * Define a boolean feature flag
 *
 * @example
 * ```typescript
 * const darkMode = defineBooleanFlag({
 *   key: 'dark-mode',
 *   name: 'Dark Mode',
 *   description: 'Enable dark mode theme',
 *   defaultValue: false,
 *   category: 'release',
 * })
 * ```
 */
export function defineBooleanFlag<TKey extends string>(
	input: Omit<BooleanFlagDefinition<TKey>, 'type'>
): BooleanFlagDefinition<TKey> {
	validateFlagKey(input.key)
	return { ...input, type: 'boolean' }
}

/**
 * Define a string feature flag
 *
 * @example
 * ```typescript
 * const apiVersion = defineStringFlag({
 *   key: 'api-version',
 *   name: 'API Version',
 *   description: 'Active API version',
 *   defaultValue: 'v1',
 *   allowedValues: ['v1', 'v2', 'v3'],
 * })
 * ```
 */
export function defineStringFlag<TKey extends string>(
	input: Omit<StringFlagDefinition<TKey>, 'type'>
): StringFlagDefinition<TKey> {
	validateFlagKey(input.key)
	return { ...input, type: 'string' }
}

/**
 * Define a number feature flag
 *
 * @example
 * ```typescript
 * const maxItems = defineNumberFlag({
 *   key: 'cart-max-items',
 *   name: 'Cart Max Items',
 *   description: 'Maximum items allowed in cart',
 *   defaultValue: 10,
 *   min: 1,
 *   max: 100,
 * })
 * ```
 */
export function defineNumberFlag<TKey extends string>(
	input: Omit<NumberFlagDefinition<TKey>, 'type'>
): NumberFlagDefinition<TKey> {
	validateFlagKey(input.key)
	return { ...input, type: 'number' }
}

/**
 * Define a JSON feature flag (remote config)
 *
 * @example
 * ```typescript
 * const themeConfig = defineJsonFlag({
 *   key: 'theme-config',
 *   name: 'Theme Configuration',
 *   description: 'Theme customization settings',
 *   defaultValue: {
 *     primaryColor: '#007bff',
 *     borderRadius: 8,
 *   },
 * })
 * ```
 */
export function defineJsonFlag<TKey extends string, TPayload extends Record<string, unknown>>(
	input: Omit<JsonFlagDefinition<TKey, TPayload>, 'type'>
): JsonFlagDefinition<TKey, TPayload> {
	validateFlagKey(input.key)
	return { ...input, type: 'json' }
}

/**
 * Define a variant feature flag (A/B testing)
 *
 * @example
 * ```typescript
 * const pricingExperiment = defineVariantFlag({
 *   key: 'pricing-experiment',
 *   name: 'Pricing Page A/B Test',
 *   description: 'Test different pricing layouts',
 *   variants: ['control', 'variant-a', 'variant-b'] as const,
 *   defaultVariant: 'control',
 *   payloads: {
 *     'variant-a': { layout: 'horizontal' },
 *     'variant-b': { layout: 'vertical', showTestimonials: true },
 *   },
 * })
 * ```
 */
export function defineVariantFlag<TKey extends string, const TVariants extends readonly string[]>(
	input: Omit<VariantFlagDefinition<TKey, TVariants extends readonly string[] ? [...TVariants] : string[]>, 'type'>
): VariantFlagDefinition<TKey, TVariants extends readonly string[] ? [...TVariants] : string[]> {
	validateFlagKey(input.key)
	if (!input.variants || input.variants.length < 2) {
		throw new Error(`[Flags] Variant flag "${input.key}" must have at least 2 variants`)
	}
	if (!input.variants.includes(input.defaultVariant)) {
		throw new Error(`[Flags] Default variant "${input.defaultVariant}" not in variants list`)
	}
	return { ...input, type: 'variant' } as VariantFlagDefinition<TKey, TVariants extends readonly string[] ? [...TVariants] : string[]>
}

/**
 * Define a feature flag (generic)
 *
 * Use the specific builders (defineBooleanFlag, etc.) for better type inference.
 */
export function defineFlag<T extends AnyFlagDefinition>(input: T): T {
	validateFlagKey(input.key)
	return input
}

function validateFlagKey(key: string): void {
	if (!key || key.length === 0) {
		throw new Error('[Flags] Flag key is required')
	}
	if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(key)) {
		throw new Error('[Flags] Flag key must be kebab-case (lowercase, hyphens, start/end with alphanumeric)')
	}
}

// ============================================================================
// Preset Flags (Common Patterns)
// ============================================================================

/**
 * Pre-defined common flag patterns for quick setup
 */
export const presetFlags = {
	/** Maintenance mode killswitch */
	maintenanceMode: defineBooleanFlag({
		key: 'maintenance-mode',
		name: 'Maintenance Mode',
		description: 'Show maintenance page to all users',
		defaultValue: false,
		category: 'killswitch',
	}),

	/** Beta features access */
	betaFeatures: defineBooleanFlag({
		key: 'beta-features',
		name: 'Beta Features',
		description: 'Enable beta features for opted-in users',
		defaultValue: false,
		category: 'release',
	}),

	/** Debug mode */
	debugMode: defineBooleanFlag({
		key: 'debug-mode',
		name: 'Debug Mode',
		description: 'Enable debug logging and tools',
		defaultValue: false,
		category: 'ops',
	}),
} as const

// ============================================================================
// Config Aggregator
// ============================================================================

export interface FlagsConfigInput<TFlags extends AnyFlagDefinition[]> {
	/** Flag definitions */
	flags: TFlags
	/** Config version */
	version?: string
	/** Environment-specific enabled overrides */
	environments?: Record<string, Partial<Record<TFlags[number]['key'], boolean>>>
}

/**
 * Create a flags configuration
 *
 * @example
 * ```typescript
 * export const flagsConfig = createFlagsConfig({
 *   flags: [
 *     defineBooleanFlag({
 *       key: 'new-feature',
 *       name: 'New Feature',
 *       description: 'Enable the new feature',
 *       defaultValue: false,
 *     }),
 *     presetFlags.maintenanceMode,
 *   ],
 *   environments: {
 *     development: { 'new-feature': true },
 *     staging: { 'new-feature': true },
 *     production: { 'new-feature': false },
 *   },
 * })
 * ```
 */
export function createFlagsConfig<TFlags extends AnyFlagDefinition[]>(
	input: FlagsConfigInput<TFlags>
): FlagsConfig<TFlags> {
	// Validate at least one flag
	if (!input.flags || input.flags.length === 0) {
		throw new Error('[Flags] At least one flag is required')
	}

	// Validate unique keys
	const keys = new Set<string>()
	for (const flag of input.flags) {
		if (keys.has(flag.key)) {
			throw new Error(`[Flags] Duplicate flag key: ${flag.key}`)
		}
		keys.add(flag.key)
	}

	return {
		flags: input.flags,
		version: input.version ?? '1.0',
		environments: input.environments,
	}
}

// ============================================================================
// Hash (for sync)
// ============================================================================

/**
 * Generate hash for change detection
 */
export function hashFlagsConfig(config: FlagsConfig): string {
	const content = JSON.stringify({
		flags: config.flags.map((f) => ({
			key: f.key,
			type: f.type,
			name: f.name,
			description: f.description,
			category: f.category,
			tags: f.tags?.sort(),
			temporary: f.temporary,
			deprecated: f.deprecated,
			// Type-specific fields
			...('defaultValue' in f && { defaultValue: f.defaultValue }),
			...('defaultVariant' in f && { defaultVariant: f.defaultVariant }),
			...('variants' in f && { variants: f.variants }),
			...('allowedValues' in f && { allowedValues: f.allowedValues }),
		})),
		version: config.version,
	})

	let hash = 0
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash
	}
	return Math.abs(hash).toString(36)
}
