/**
 * Type-Safe Analytics Tracker
 *
 * Provides compile-time type checking for event names and properties
 * based on the defined analytics schema.
 */

import type { SylphxConfig } from '../../config'
import { track as baseTrack, identify, page, trackBatch } from '../../analytics'
import type { AnalyticsSchema, EventDefinition, ExtractEventNames, PropertyDefinition } from './events'

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

/** Build event properties type - required and optional separated */
type EventPropsFromDef<TProps extends Record<string, PropertyDefinition>> =
	// Required properties
	{ [K in keyof TProps as TProps[K]['required'] extends true ? K : never]: PropertyValueType<TProps[K]> } &
	// Optional properties
	{ [K in keyof TProps as TProps[K]['required'] extends false ? K : never]?: PropertyValueType<TProps[K]> }

/** Find event definition by name */
type FindEventByName<
	TEvents extends EventDefinition[],
	TName extends string
> = TEvents extends [infer First, ...infer Rest]
	? First extends EventDefinition<TName, infer TProps>
		? EventDefinition<TName, TProps>
		: Rest extends EventDefinition[]
			? FindEventByName<Rest, TName>
			: never
	: never

/** Get properties type for event name */
type GetEventProps<
	TSchema extends AnalyticsSchema,
	TName extends ExtractEventNames<TSchema>
> = FindEventByName<TSchema['events'], TName> extends EventDefinition<TName, infer TProps>
	? EventPropsFromDef<TProps>
	: Record<string, unknown>

// ============================================================================
// Typed Tracker
// ============================================================================

/** Options for tracking */
interface TrackOptions {
	/** User ID (for server-side) */
	userId?: string
	/** Anonymous ID */
	anonymousId?: string
	/** Timestamp */
	timestamp?: string
}

/**
 * Type-safe tracker instance
 */
export interface TypedTracker<TSchema extends AnalyticsSchema> {
	/**
	 * Track an event with type-safe properties
	 *
	 * @example
	 * ```typescript
	 * tracker.track('purchase_completed', { amount: 99, currency: 'USD' })
	 * ```
	 */
	track<TName extends ExtractEventNames<TSchema>>(
		event: TName,
		properties: GetEventProps<TSchema, TName>,
		options?: TrackOptions
	): Promise<void>

	/**
	 * Identify a user
	 */
	identify(
		userId: string,
		traits?: Record<string, unknown>,
		anonymousId?: string
	): Promise<void>

	/**
	 * Track page view
	 */
	page(
		name: string,
		properties?: Record<string, unknown>,
		options?: TrackOptions
	): Promise<void>

	/**
	 * Track multiple events in batch
	 */
	batch(
		events: Array<{
			event: ExtractEventNames<TSchema>
			properties: Record<string, unknown>
			userId?: string
			anonymousId?: string
			timestamp?: string
		}>
	): Promise<void>

	/**
	 * Get the analytics schema
	 */
	getSchema(): TSchema

	/**
	 * Check if an event is defined in schema
	 */
	isEventDefined(eventName: string): boolean

	/**
	 * Get event definition by name
	 */
	getEventDefinition(eventName: string): EventDefinition | undefined
}

/**
 * Create a type-safe analytics tracker
 *
 * @example
 * ```typescript
 * import { createTypedTracker, createAnalyticsSchema, presetEvents } from '@sylphx/sdk'
 *
 * const schema = createAnalyticsSchema({
 *   events: [
 *     presetEvents.signUp,
 *     presetEvents.purchaseCompleted,
 *   ],
 * })
 *
 * const tracker = createTypedTracker(config, schema)
 *
 * // Type-safe tracking - compile error if event or properties are wrong
 * tracker.track('sign_up', { method: 'email' }) // ✅
 * tracker.track('sign_up', { method: 'invalid' }) // ❌ Compile error
 * tracker.track('unknown_event', {}) // ❌ Compile error
 * ```
 */
export function createTypedTracker<TSchema extends AnalyticsSchema>(
	config: SylphxConfig,
	schema: TSchema,
	defaultAnonymousId?: string
): TypedTracker<TSchema> {
	const eventMap = new Map<string, EventDefinition>()
	for (const event of schema.events) {
		eventMap.set(event.name, event)
	}

	return {
		async track(event, properties, options) {
			// Runtime validation (dev mode warning)
			if (process.env.NODE_ENV !== 'production' && schema.strictMode) {
				const def = eventMap.get(event)
				if (!def) {
					console.warn(`[Analytics] Event "${event}" is not defined in schema`)
				} else if (def.deprecated) {
					console.warn(`[Analytics] Event "${event}" is deprecated: ${def.deprecationMessage ?? 'Consider removing'}`)
				}
			}

			await baseTrack(config, {
				event,
				properties: properties as Record<string, unknown>,
				userId: options?.userId,
				anonymousId: options?.anonymousId ?? defaultAnonymousId,
				timestamp: options?.timestamp,
			})
		},

		async identify(userId, traits, anonymousId) {
			await identify(config, {
				userId,
				traits,
				anonymousId: anonymousId ?? defaultAnonymousId,
			})
		},

		async page(name, properties, options) {
			await page(config, {
				name,
				properties,
				userId: options?.userId,
				anonymousId: options?.anonymousId ?? defaultAnonymousId,
			})
		},

		async batch(events) {
			await trackBatch(
				config,
				events.map((e) => ({
					type: 'track' as const,
					event: e.event,
					properties: e.properties,
					userId: e.userId,
					anonymousId: e.anonymousId ?? defaultAnonymousId,
					timestamp: e.timestamp,
				}))
			)
		},

		getSchema() {
			return schema
		},

		isEventDefined(eventName) {
			return eventMap.has(eventName)
		},

		getEventDefinition(eventName) {
			return eventMap.get(eventName)
		},
	}
}
