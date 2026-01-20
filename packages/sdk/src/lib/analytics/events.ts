/**
 * Analytics Event Schema Definitions (Code First)
 *
 * Define event schemas in code for type safety and documentation.
 * These definitions are synced to the platform for event discovery.
 *
 * @example
 * ```typescript
 * // analytics.config.ts
 * import { defineEvent, defineEventCategory, createAnalyticsSchema } from '@sylphx/sdk'
 *
 * const purchase = defineEvent({
 *   name: 'purchase_completed',
 *   description: 'User completed a purchase',
 *   category: 'conversion',
 *   properties: {
 *     amount: { type: 'number', required: true, description: 'Purchase amount' },
 *     currency: { type: 'string', required: true, description: 'Currency code' },
 *     productId: { type: 'string', required: false, description: 'Product ID' },
 *   },
 * })
 *
 * export const analyticsSchema = createAnalyticsSchema({
 *   events: [purchase, ...moreEvents],
 * })
 *
 * // Type-safe tracking
 * const tracker = createTypedTracker(config, analyticsSchema)
 * tracker.track('purchase_completed', { amount: 99, currency: 'USD' }) // ✅ Type-safe
 * tracker.track('invalid_event', {}) // ❌ Compile error
 * ```
 */

// ============================================================================
// Types
// ============================================================================

/** Property type definition */
export type PropertyType = 'string' | 'number' | 'boolean' | 'array' | 'object'

/** Property definition */
export interface PropertyDefinition {
	/** Property type */
	type: PropertyType
	/** Whether property is required */
	required: boolean
	/** Human-readable description */
	description?: string
	/** Example value for documentation */
	example?: unknown
	/** Enum values (for string type) */
	enum?: string[]
	/** Array item type (for array type) */
	items?: PropertyType
}

/** Event category for grouping */
export type EventCategory =
	| 'lifecycle'      // App/session lifecycle
	| 'navigation'     // Page views, routing
	| 'engagement'     // User interactions
	| 'conversion'     // Purchases, signups
	| 'feature'        // Feature usage
	| 'error'          // Error events
	| 'performance'    // Performance metrics
	| 'custom'         // Custom events

/** Event definition */
export interface EventDefinition<
	TName extends string = string,
	TProps extends Record<string, PropertyDefinition> = Record<string, PropertyDefinition>
> {
	/** Event name (unique identifier) */
	name: TName
	/** Human-readable description */
	description: string
	/** Event category for grouping */
	category: EventCategory
	/** Property definitions */
	properties: TProps
	/** Tags for filtering/searching */
	tags?: string[]
	/** Whether this event is deprecated */
	deprecated?: boolean
	/** Deprecation message */
	deprecationMessage?: string
}

/** Event category definition for grouping */
export interface EventCategoryDefinition {
	/** Category slug */
	slug: EventCategory
	/** Display name */
	name: string
	/** Description */
	description: string
}

/** Analytics schema config */
export interface AnalyticsSchema<
	TEvents extends EventDefinition[] = EventDefinition[]
> {
	/** Defined events */
	events: TEvents
	/** Schema version */
	version: string
	/** Event categories */
	categories: EventCategoryDefinition[]
	/** Whether to allow undefined events (strict mode = false allows any event) */
	strictMode: boolean
}

// ============================================================================
// Type Utilities
// ============================================================================

/** Extract property value type from definition */
type PropertyValueType<T extends PropertyDefinition> =
	T['type'] extends 'string' ? (T['enum'] extends string[] ? T['enum'][number] : string) :
	T['type'] extends 'number' ? number :
	T['type'] extends 'boolean' ? boolean :
	T['type'] extends 'array' ? unknown[] :
	T['type'] extends 'object' ? Record<string, unknown> :
	unknown

/** Build event properties type from definitions */
type EventPropertiesType<TProps extends Record<string, PropertyDefinition>> = {
	[K in keyof TProps as TProps[K]['required'] extends true ? K : never]: PropertyValueType<TProps[K]>
} & {
	[K in keyof TProps as TProps[K]['required'] extends false ? K : never]?: PropertyValueType<TProps[K]>
}

/** Extract event name union from schema */
export type ExtractEventNames<T extends AnalyticsSchema> = T['events'][number]['name']

/** Extract properties type for a specific event */
export type ExtractEventProps<
	T extends AnalyticsSchema,
	TName extends ExtractEventNames<T>
> = T['events'][number] extends infer E
	? E extends EventDefinition<TName, infer TProps>
		? EventPropertiesType<TProps>
		: never
	: never

// ============================================================================
// Builders
// ============================================================================

type EventDefinitionInput<
	TName extends string,
	TProps extends Record<string, PropertyDefinition>
> = Omit<EventDefinition<TName, TProps>, never>

/**
 * Define an analytics event
 *
 * @example
 * ```typescript
 * const buttonClicked = defineEvent({
 *   name: 'button_clicked',
 *   description: 'User clicked a button',
 *   category: 'engagement',
 *   properties: {
 *     buttonId: { type: 'string', required: true, description: 'Button identifier' },
 *     label: { type: 'string', required: false, description: 'Button label text' },
 *   },
 * })
 * ```
 */
export function defineEvent<
	TName extends string,
	TProps extends Record<string, PropertyDefinition>
>(input: EventDefinitionInput<TName, TProps>): EventDefinition<TName, TProps> {
	// Validate
	if (!input.name || input.name.length === 0) {
		throw new Error('[Analytics] Event name is required')
	}
	if (!/^[a-z][a-z0-9_]*$/.test(input.name)) {
		throw new Error('[Analytics] Event name must be snake_case (lowercase, underscores)')
	}
	if (!input.description || input.description.length === 0) {
		throw new Error('[Analytics] Event description is required')
	}

	return input
}

/**
 * Define an event category
 */
export function defineEventCategory(input: EventCategoryDefinition): EventCategoryDefinition {
	return input
}

// ============================================================================
// Preset Categories
// ============================================================================

export const presetCategories: Record<EventCategory, EventCategoryDefinition> = {
	lifecycle: {
		slug: 'lifecycle',
		name: 'Lifecycle',
		description: 'App and session lifecycle events',
	},
	navigation: {
		slug: 'navigation',
		name: 'Navigation',
		description: 'Page views and routing events',
	},
	engagement: {
		slug: 'engagement',
		name: 'Engagement',
		description: 'User interaction events',
	},
	conversion: {
		slug: 'conversion',
		name: 'Conversion',
		description: 'Purchase and signup events',
	},
	feature: {
		slug: 'feature',
		name: 'Feature Usage',
		description: 'Feature adoption and usage events',
	},
	error: {
		slug: 'error',
		name: 'Errors',
		description: 'Error and exception events',
	},
	performance: {
		slug: 'performance',
		name: 'Performance',
		description: 'Performance and timing metrics',
	},
	custom: {
		slug: 'custom',
		name: 'Custom',
		description: 'Custom application events',
	},
}

// ============================================================================
// Preset Events (Common Patterns)
// ============================================================================

/**
 * Pre-defined common events for quick setup
 */
export const presetEvents = {
	// Lifecycle
	sessionStart: defineEvent({
		name: 'session_start',
		description: 'User session started',
		category: 'lifecycle',
		properties: {
			referrer: { type: 'string', required: false, description: 'Referrer URL' },
			utm_source: { type: 'string', required: false, description: 'UTM source' },
			utm_medium: { type: 'string', required: false, description: 'UTM medium' },
			utm_campaign: { type: 'string', required: false, description: 'UTM campaign' },
		},
	}),

	// Auth
	signUp: defineEvent({
		name: 'sign_up',
		description: 'User completed registration',
		category: 'conversion',
		properties: {
			method: { type: 'string', required: true, description: 'Sign up method', enum: ['email', 'google', 'github', 'magic_link'] },
		},
	}),
	signIn: defineEvent({
		name: 'sign_in',
		description: 'User signed in',
		category: 'lifecycle',
		properties: {
			method: { type: 'string', required: true, description: 'Sign in method', enum: ['email', 'google', 'github', 'magic_link'] },
		},
	}),
	signOut: defineEvent({
		name: 'sign_out',
		description: 'User signed out',
		category: 'lifecycle',
		properties: {},
	}),

	// Conversion
	trialStarted: defineEvent({
		name: 'trial_started',
		description: 'User started a free trial',
		category: 'conversion',
		properties: {
			plan: { type: 'string', required: true, description: 'Trial plan name' },
			trialDays: { type: 'number', required: false, description: 'Trial duration in days' },
		},
	}),
	subscriptionStarted: defineEvent({
		name: 'subscription_started',
		description: 'User subscribed to a paid plan',
		category: 'conversion',
		properties: {
			plan: { type: 'string', required: true, description: 'Plan name' },
			interval: { type: 'string', required: true, description: 'Billing interval', enum: ['monthly', 'yearly'] },
			amount: { type: 'number', required: true, description: 'Subscription amount' },
			currency: { type: 'string', required: true, description: 'Currency code' },
		},
	}),
	purchaseCompleted: defineEvent({
		name: 'purchase_completed',
		description: 'User completed a purchase',
		category: 'conversion',
		properties: {
			amount: { type: 'number', required: true, description: 'Purchase amount' },
			currency: { type: 'string', required: true, description: 'Currency code' },
			productId: { type: 'string', required: false, description: 'Product ID' },
			productName: { type: 'string', required: false, description: 'Product name' },
		},
	}),

	// Feature Usage
	featureUsed: defineEvent({
		name: 'feature_used',
		description: 'User used a specific feature',
		category: 'feature',
		properties: {
			feature: { type: 'string', required: true, description: 'Feature name' },
			action: { type: 'string', required: false, description: 'Specific action taken' },
		},
	}),

	// Errors
	errorOccurred: defineEvent({
		name: 'error_occurred',
		description: 'An error occurred',
		category: 'error',
		properties: {
			errorType: { type: 'string', required: true, description: 'Error type/code' },
			errorMessage: { type: 'string', required: true, description: 'Error message' },
			component: { type: 'string', required: false, description: 'Component where error occurred' },
		},
	}),

	// Engagement
	buttonClicked: defineEvent({
		name: 'button_clicked',
		description: 'User clicked a button',
		category: 'engagement',
		properties: {
			buttonId: { type: 'string', required: true, description: 'Button identifier' },
			label: { type: 'string', required: false, description: 'Button label' },
			location: { type: 'string', required: false, description: 'Page/component location' },
		},
	}),
	formSubmitted: defineEvent({
		name: 'form_submitted',
		description: 'User submitted a form',
		category: 'engagement',
		properties: {
			formId: { type: 'string', required: true, description: 'Form identifier' },
			formName: { type: 'string', required: false, description: 'Form name' },
			success: { type: 'boolean', required: true, description: 'Whether submission succeeded' },
		},
	}),
	searchPerformed: defineEvent({
		name: 'search_performed',
		description: 'User performed a search',
		category: 'engagement',
		properties: {
			query: { type: 'string', required: true, description: 'Search query' },
			resultsCount: { type: 'number', required: false, description: 'Number of results' },
			category: { type: 'string', required: false, description: 'Search category/filter' },
		},
	}),
} as const

// ============================================================================
// Config Aggregator
// ============================================================================

export interface AnalyticsSchemaInput<TEvents extends EventDefinition[]> {
	/** Event definitions */
	events: TEvents
	/** Schema version (for change tracking) */
	version?: string
	/** Additional categories (presets included by default) */
	categories?: EventCategoryDefinition[]
	/** Strict mode - only allow defined events (default: true) */
	strictMode?: boolean
}

/**
 * Create an analytics schema
 *
 * @example Using presets
 * ```typescript
 * import { createAnalyticsSchema, presetEvents, defineEvent } from '@sylphx/sdk'
 *
 * export const analyticsSchema = createAnalyticsSchema({
 *   events: [
 *     presetEvents.signUp,
 *     presetEvents.signIn,
 *     presetEvents.purchaseCompleted,
 *     defineEvent({
 *       name: 'custom_action',
 *       description: 'App-specific action',
 *       category: 'custom',
 *       properties: { ... },
 *     }),
 *   ],
 * })
 * ```
 */
export function createAnalyticsSchema<TEvents extends EventDefinition[]>(
	input: AnalyticsSchemaInput<TEvents>
): AnalyticsSchema<TEvents> {
	// Validate at least one event
	if (!input.events || input.events.length === 0) {
		throw new Error('[Analytics] At least one event is required')
	}

	// Validate unique names
	const names = new Set<string>()
	for (const event of input.events) {
		if (names.has(event.name)) {
			throw new Error(`[Analytics] Duplicate event name: ${event.name}`)
		}
		names.add(event.name)
	}

	// Merge preset categories with any custom ones
	const allCategories = [
		...Object.values(presetCategories),
		...(input.categories ?? []),
	]

	return {
		events: input.events,
		version: input.version ?? '1.0',
		categories: allCategories,
		strictMode: input.strictMode ?? true,
	}
}

// ============================================================================
// Hash (for sync)
// ============================================================================

/**
 * Generate hash for change detection
 */
export function hashAnalyticsSchema(schema: AnalyticsSchema): string {
	const content = JSON.stringify({
		events: schema.events.map((e) => ({
			name: e.name,
			description: e.description,
			category: e.category,
			properties: e.properties,
			tags: e.tags?.sort(),
			deprecated: e.deprecated,
		})),
		version: schema.version,
		strictMode: schema.strictMode,
	})

	let hash = 0
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash
	}
	return Math.abs(hash).toString(36)
}
