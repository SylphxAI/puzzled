/**
 * Feature Flags Module
 *
 * Client-side feature flag evaluation with:
 * - Zero-latency local evaluation
 * - Real-time SSE streaming updates
 * - Consistent bucketing with MurmurHash3
 * - Flexible targeting rules
 * - A/B testing support
 *
 * @example
 * ```typescript
 * import { initFeatureFlags, getEvaluator } from '@sylphx/platform-sdk/flags'
 *
 * // Initialize with context
 * const evaluator = initFeatureFlags({
 *   streamEndpoint: '/api/flags/stream',
 *   debug: true,
 * })
 *
 * evaluator.setContext({
 *   userId: 'user-123',
 *   email: 'user@example.com',
 *   attributes: {
 *     plan: 'pro',
 *     company: 'acme',
 *   },
 * })
 *
 * // Evaluate flags
 * if (evaluator.isEnabled('new-dashboard')) {
 *   // Show new dashboard
 * }
 *
 * // Get string variant
 * const theme = evaluator.getString('theme-variant', 'light')
 *
 * // Full evaluation with metadata
 * const result = evaluator.evaluate('pricing-tier', 'basic')
 * console.log(result.variant, result.reason)
 * ```
 */

// Evaluator
export { LocalEvaluator, getEvaluator, initFeatureFlags, resetEvaluator } from './evaluator'

// Streaming
export { FlagStream, createFlagStream, fetchFlags, pollFlags } from './streaming'

// Experiments
export {
	ExperimentManager,
	getExperimentManager,
	resetExperimentManager,
	createExperiment,
	calculateSampleSize,
	calculateExperimentDuration,
} from './experiments'

// Targeting
export {
	evaluateCondition,
	evaluateRule,
	findMatchingRule,
	getAttributeValue,
	evaluateOperator,
	mergeContext,
	validateContext,
} from './targeting'

// Hashing
export {
	murmurHash3,
	getBucket,
	isInPercentage,
	getUserBucket,
	selectVariant,
	getConsistentRandom,
} from './hash'

// Types
export type {
	// Core types
	FlagValue,
	FlagVariant,
	TargetingOperator,
	TargetingCondition,
	TargetingRule,
	FlagDefinition,
	// Evaluation
	EvaluationContext,
	EvaluationResult,
	EvaluationReason,
	EvaluationError,
	// Experiments
	Experiment,
	ExperimentExposure,
	// Streaming
	StreamMessageType,
	StreamMessage,
	FlagUpdateMessage,
	FlagDeleteMessage,
	FlagsMessage,
	// Configuration
	FeatureFlagsConfig,
	// Events
	FlagClientEvent,
} from './types'

export { DEFAULT_FLAGS_CONFIG } from './types'
