/**
 * Feature Flags Types
 *
 * Type definitions for client-side feature flag evaluation.
 * Supports percentage rollouts, user targeting, and A/B testing.
 */

// ==========================================
// Core Types
// ==========================================

/** Flag value types */
export type FlagValue = boolean | string | number | Record<string, unknown> | null

/** Flag value variant */
export interface FlagVariant {
	key: string
	value: FlagValue
	/** Percentage weight (0-100) */
	weight?: number
	/** Optional payload for A/B tests */
	payload?: Record<string, unknown>
}

/** Targeting operator */
export type TargetingOperator =
	| 'eq'
	| 'neq'
	| 'gt'
	| 'gte'
	| 'lt'
	| 'lte'
	| 'contains'
	| 'not_contains'
	| 'starts_with'
	| 'ends_with'
	| 'in'
	| 'not_in'
	| 'regex'
	| 'semver_gt'
	| 'semver_gte'
	| 'semver_lt'
	| 'semver_lte'

/** Targeting condition */
export interface TargetingCondition {
	attribute: string
	operator: TargetingOperator
	value: unknown
}

/** Targeting rule with conditions */
export interface TargetingRule {
	id: string
	/** All conditions must match (AND) */
	conditions: TargetingCondition[]
	/** Variant to serve if rule matches */
	variant: string
	/** Optional percentage rollout within this rule */
	percentage?: number
}

/** Feature flag definition */
export interface FlagDefinition {
	key: string
	/** Flag is active */
	enabled: boolean
	/** Default variant when no rules match */
	defaultVariant: string
	/** All possible variants */
	variants: FlagVariant[]
	/** Targeting rules (evaluated in order) */
	rules: TargetingRule[]
	/** Optional salt for consistent hashing */
	salt?: string
	/** Last updated timestamp */
	updatedAt: number
	/** Optional metadata */
	metadata?: Record<string, unknown>
}

// ==========================================
// Evaluation Types
// ==========================================

/** Context for flag evaluation */
export interface EvaluationContext {
	/** User ID for consistent bucketing */
	userId?: string
	/** Anonymous ID for pre-auth bucketing */
	anonymousId?: string
	/** User email */
	email?: string
	/** User attributes for targeting */
	attributes?: Record<string, unknown>
	/** Device/platform info */
	device?: {
		type?: 'mobile' | 'tablet' | 'desktop'
		os?: string
		browser?: string
	}
	/** Geographic info */
	geo?: {
		country?: string
		region?: string
		city?: string
	}
	/** App version for semver targeting */
	appVersion?: string
	/** Custom properties */
	[key: string]: unknown
}

/** Evaluation result */
export interface EvaluationResult<T = FlagValue> {
	/** The evaluated value */
	value: T
	/** Variant key that was selected */
	variant: string
	/** Whether the flag is enabled */
	enabled: boolean
	/** Rule that matched (if any) */
	matchedRule?: string
	/** Reason for the evaluation result */
	reason: EvaluationReason
	/** Flag definition version */
	version?: number
}

/** Why a particular value was returned */
export type EvaluationReason =
	| 'flag_disabled'
	| 'flag_not_found'
	| 'default'
	| 'default_value'
	| 'rule_match'
	| 'percentage_rollout'
	| 'targeting_match'
	| 'error'
	| 'cache_hit'
	| 'stale'
	// Extended reason with debug info
	| { rolloutBucket?: number; [key: string]: unknown }

/** Evaluation error */
export interface EvaluationError {
	code: 'FLAG_NOT_FOUND' | 'INVALID_CONTEXT' | 'EVALUATION_ERROR' | 'NETWORK_ERROR'
	message: string
	flagKey?: string
}

// ==========================================
// A/B Testing Types
// ==========================================

/** Experiment definition */
export interface Experiment {
	id: string
	key: string
	name: string
	/** Feature flag controlling this experiment */
	flagKey: string
	/** Hypothesis being tested */
	hypothesis?: string
	/** Metric keys to track */
	metrics: string[]
	/** Experiment status */
	status: 'draft' | 'running' | 'paused' | 'concluded'
	/** Start/end dates */
	startedAt?: number
	endedAt?: number
	/** Winning variant (if concluded) */
	winner?: string
}

/** Experiment exposure event */
export interface ExperimentExposure {
	experimentId: string
	experimentKey: string
	variant: string
	userId?: string
	anonymousId?: string
	timestamp: number
	context?: Record<string, unknown>
}

// ==========================================
// Streaming Types
// ==========================================

/** SSE message types */
export type StreamMessageType = 'flags' | 'flag_update' | 'flag_delete' | 'ping' | 'error'

/** SSE message */
export interface StreamMessage {
	type: StreamMessageType
	data: unknown
	timestamp: number
}

/** Flag update message */
export interface FlagUpdateMessage {
	type: 'flag_update'
	data: FlagDefinition
	timestamp: number
}

/** Flag delete message */
export interface FlagDeleteMessage {
	type: 'flag_delete'
	data: { key: string }
	timestamp: number
}

/** Initial flags message */
export interface FlagsMessage {
	type: 'flags'
	data: FlagDefinition[]
	timestamp: number
}

/** Error message from stream */
export interface ErrorMessage {
	type: 'error'
	data: EvaluationError
	timestamp: number
}

// ==========================================
// Configuration
// ==========================================

/** Feature flags client configuration */
export interface FeatureFlagsConfig {
	/** API endpoint for fetching flags */
	apiEndpoint?: string
	/** SSE endpoint for streaming updates */
	streamEndpoint?: string
	/** Environment key */
	environmentKey?: string
	/** Cache TTL in ms (default: 5 minutes) */
	cacheTtl?: number
	/** Stale-while-revalidate window in ms (default: 1 minute) */
	staleWhileRevalidate?: number
	/** Enable offline support */
	offlineSupport?: boolean
	/** localStorage key for persistence */
	storageKey?: string
	/** Enable debug logging */
	debug?: boolean
	/** Callback when flags are updated */
	onFlagsUpdated?: (flags: FlagDefinition[]) => void
	/** Callback when evaluation happens */
	onEvaluation?: (flagKey: string, result: EvaluationResult) => void
	/** Callback for experiment exposures */
	onExposure?: (exposure: ExperimentExposure) => void
	/** Initial context */
	initialContext?: EvaluationContext
}

/** Default configuration */
export const DEFAULT_FLAGS_CONFIG: Required<
	Pick<FeatureFlagsConfig, 'cacheTtl' | 'staleWhileRevalidate' | 'offlineSupport' | 'storageKey' | 'debug'>
> = {
	cacheTtl: 5 * 60 * 1000, // 5 minutes
	staleWhileRevalidate: 60 * 1000, // 1 minute
	offlineSupport: true,
	storageKey: 'sylphx_flags',
	debug: false,
}

// ==========================================
// Event Types
// ==========================================

/** Client events */
export type FlagClientEvent =
	| { type: 'ready'; flags: FlagDefinition[] }
	| { type: 'updated'; flags: FlagDefinition[] }
	| { type: 'error'; error: EvaluationError }
	| { type: 'stale' }
	| { type: 'reconnected' }
