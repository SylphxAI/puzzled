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
 * ## Architecture (ADR-004)
 *
 * Feature Flags are **Console First** - define flags in the Console,
 * then consume them in code. This allows product/marketing teams
 * to control flag rollouts without code deployments.
 *
 * @example
 * ```typescript
 * import { checkFlag, isEnabled, getVariant } from '@sylphx/sdk'
 *
 * // Check if flag is enabled
 * if (await isEnabled(config, 'new-checkout')) {
 *   renderNewCheckout()
 * }
 *
 * // Get variant for A/B test
 * const variant = await getVariant(config, 'pricing-experiment')
 * if (variant === 'variant-a') {
 *   showHorizontalPricing()
 * }
 *
 * // Full flag result with metadata
 * const result = await checkFlag(config, 'feature-x', { userId: 'user-123' })
 * console.log(result.enabled, result.variant, result.payload)
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
