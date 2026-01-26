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
	
	createExperiment,
	calculateSampleSize,
	calculateExperimentDuration,
} from './experiments'

// Targeting


// Hashing
export {
	murmurHash3,
	getBucket,
	
	getUserBucket,
	selectVariant,
	
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
	
	// Experiments
	Experiment,
	ExperimentExposure,
	// Streaming
	
	
	
	
	
	// Configuration
	FeatureFlagsConfig,
	// Events
	FlagClientEvent,
} from './types'

export { DEFAULT_FLAGS_CONFIG } from './types'
