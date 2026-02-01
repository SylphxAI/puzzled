/**
 * A/B Testing & Experiments
 *
 * Built on top of feature flags for controlled experiments.
 * Tracks exposures and integrates with analytics.
 */

import type {
	EvaluationContext,
	EvaluationResult,
	Experiment,
	ExperimentExposure,
	FlagDefinition,
	FeatureFlagsConfig,
} from './types'
import { LocalEvaluator } from './evaluator'
import { FLAGS_EXPOSURE_DEDUPE_WINDOW_MS } from '../../constants'

// ==========================================
// Types
// ==========================================

interface ExperimentResult {
	/** Experiment key */
	experimentKey: string
	/** Assigned variant */
	variant: string
	/** Variant payload (if any) */
	payload?: Record<string, unknown>
	/** Whether user is in experiment */
	inExperiment: boolean
	/** Flag evaluation result */
	evaluation: EvaluationResult
}

interface ExperimentConfig {
	/** Callback for exposure tracking */
	onExposure?: (exposure: ExperimentExposure) => void
	/** Deduplication window in ms (default: 1 hour) */
	exposureDedupeWindow?: number
	/** Enable debug logging */
	debug?: boolean
}

// ==========================================
// Experiment Manager
// ==========================================

/**
 * Experiment Manager
 *
 * Manages A/B tests built on feature flags.
 * Handles exposure tracking and deduplication.
 */
export class ExperimentManager {
	private evaluator: LocalEvaluator
	private config: ExperimentConfig
	private experiments: Map<string, Experiment> = new Map()
	private exposureCache: Map<string, number> = new Map() // key -> timestamp

	constructor(evaluator: LocalEvaluator, config: ExperimentConfig = {}) {
		this.evaluator = evaluator
		this.config = {
			exposureDedupeWindow: FLAGS_EXPOSURE_DEDUPE_WINDOW_MS,
			...config,
		}
	}

	// ==========================================
	// Experiment Management
	// ==========================================

	/**
	 * Register experiments
	 */
	setExperiments(experiments: Experiment[]): void {
		this.experiments.clear()
		for (const exp of experiments) {
			this.experiments.set(exp.key, exp)
		}
		this.debug('Experiments registered', { count: experiments.length })
	}

	/**
	 * Get experiment by key
	 */
	getExperiment(key: string): Experiment | undefined {
		return this.experiments.get(key)
	}

	/**
	 * Get all running experiments
	 */
	getRunningExperiments(): Experiment[] {
		return Array.from(this.experiments.values()).filter((e) => e.status === 'running')
	}

	// ==========================================
	// Variant Assignment
	// ==========================================

	/**
	 * Get variant assignment for an experiment
	 *
	 * Automatically tracks exposure if user is in experiment.
	 */
	getVariant(
		experimentKey: string,
		context?: EvaluationContext
	): ExperimentResult {
		const experiment = this.experiments.get(experimentKey)

		if (!experiment) {
			return {
				experimentKey,
				variant: 'control',
				inExperiment: false,
				evaluation: {
					value: false,
					variant: 'control',
					enabled: false,
					reason: 'error',
				},
			}
		}

		// Evaluate the experiment's feature flag
		const evaluation = this.evaluator.evaluate<boolean>(
			experiment.flagKey,
			false,
			context
		)

		const result: ExperimentResult = {
			experimentKey,
			variant: evaluation.variant,
			inExperiment: evaluation.enabled && experiment.status === 'running',
			evaluation,
		}

		// Get variant payload if available
		const flag = this.evaluator.getFlag(experiment.flagKey)
		if (flag) {
			const variantDef = flag.variants.find((v) => v.key === evaluation.variant)
			if (variantDef?.payload) {
				result.payload = variantDef.payload
			}
		}

		// Track exposure if in experiment
		if (result.inExperiment) {
			this.trackExposure(experiment, result.variant, context)
		}

		return result
	}

	/**
	 * Check if user is in experiment variant
	 */
	isInVariant(
		experimentKey: string,
		variant: string,
		context?: EvaluationContext
	): boolean {
		const result = this.getVariant(experimentKey, context)
		return result.inExperiment && result.variant === variant
	}

	/**
	 * Check if user is in treatment (any non-control variant)
	 */
	isInTreatment(
		experimentKey: string,
		context?: EvaluationContext
	): boolean {
		const result = this.getVariant(experimentKey, context)
		return result.inExperiment && result.variant !== 'control'
	}

	// ==========================================
	// Exposure Tracking
	// ==========================================

	private trackExposure(
		experiment: Experiment,
		variant: string,
		context?: EvaluationContext
	): void {
		const ctx = context ?? this.evaluator.getContext()
		const userId = ctx.userId
		const anonymousId = ctx.anonymousId

		// Check deduplication
		const cacheKey = `${experiment.key}:${userId ?? anonymousId ?? 'anon'}:${variant}`
		const lastExposure = this.exposureCache.get(cacheKey)
		const now = Date.now()

		if (lastExposure && now - lastExposure < (this.config.exposureDedupeWindow ?? FLAGS_EXPOSURE_DEDUPE_WINDOW_MS)) {
			this.debug('Exposure deduplicated', { experimentKey: experiment.key, variant })
			return
		}

		// Record exposure
		this.exposureCache.set(cacheKey, now)

		const exposure: ExperimentExposure = {
			experimentId: experiment.id,
			experimentKey: experiment.key,
			variant,
			userId,
			anonymousId,
			timestamp: now,
			context: ctx.attributes,
		}

		this.debug('Exposure tracked', exposure)
		this.config.onExposure?.(exposure)
	}

	/**
	 * Manually track exposure (for deferred exposure tracking)
	 */
	trackManualExposure(
		experimentKey: string,
		variant: string,
		context?: EvaluationContext
	): void {
		const experiment = this.experiments.get(experimentKey)
		if (experiment && experiment.status === 'running') {
			this.trackExposure(experiment, variant, context)
		}
	}

	// ==========================================
	// Utilities
	// ==========================================

	/**
	 * Clear exposure cache (for testing)
	 */
	clearExposureCache(): void {
		this.exposureCache.clear()
	}

	/**
	 * Get all exposure events (for debugging)
	 */
	getExposureStats(): { experimentKey: string; variant: string; timestamp: number }[] {
		const stats: { experimentKey: string; variant: string; timestamp: number }[] = []

		for (const [key, timestamp] of this.exposureCache) {
			const [experimentKey, , variant] = key.split(':')
			stats.push({ experimentKey: experimentKey!, variant: variant!, timestamp })
		}

		return stats
	}

	private debug(message: string, data?: unknown): void {
		if (this.config.debug) {
			console.log(`[Experiments] ${message}`, data ?? '')
		}
	}
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Create an experiment from a feature flag
 *
 * Convenience function for creating experiment definitions.
 */
export function createExperiment(params: {
	id: string
	key: string
	name: string
	flagKey: string
	hypothesis?: string
	metrics: string[]
}): Experiment {
	return {
		...params,
		status: 'draft',
	}
}

/**
 * Calculate experiment sample size
 *
 * Based on:
 * - Baseline conversion rate
 * - Minimum detectable effect (MDE)
 * - Statistical significance (default 95%)
 * - Statistical power (default 80%)
 */
export function calculateSampleSize(params: {
	baselineRate: number
	minimumEffect: number // relative, e.g., 0.1 = 10% lift
	significance?: number // default 0.95
	power?: number // default 0.8
}): number {
	const { baselineRate, minimumEffect, significance = 0.95, power = 0.8 } = params

	// Z-scores for significance and power
	const zAlpha = significance === 0.95 ? 1.96 : significance === 0.99 ? 2.576 : 1.645
	const zBeta = power === 0.8 ? 0.84 : power === 0.9 ? 1.28 : 0.84

	// Expected treatment rate
	const treatmentRate = baselineRate * (1 + minimumEffect)

	// Pooled variance
	const pooledRate = (baselineRate + treatmentRate) / 2
	const variance = 2 * pooledRate * (1 - pooledRate)

	// Effect size
	const effectSize = Math.abs(treatmentRate - baselineRate)

	// Sample size per variant
	const n = Math.ceil((Math.pow(zAlpha + zBeta, 2) * variance) / Math.pow(effectSize, 2))

	return n
}

/**
 * Calculate experiment duration
 *
 * Based on sample size and expected daily traffic.
 */
export function calculateExperimentDuration(params: {
	sampleSizePerVariant: number
	numberOfVariants: number
	dailyVisitors: number
	trafficPercentage?: number // default 100%
}): number {
	const { sampleSizePerVariant, numberOfVariants, dailyVisitors, trafficPercentage = 100 } = params

	const totalSampleNeeded = sampleSizePerVariant * numberOfVariants
	const dailyParticipants = dailyVisitors * (trafficPercentage / 100)

	return Math.ceil(totalSampleNeeded / dailyParticipants)
}

// ==========================================
// Singleton
// ==========================================

let experimentManagerInstance: ExperimentManager | null = null

export function getExperimentManager(
	evaluator: LocalEvaluator,
	config?: ExperimentConfig
): ExperimentManager {
	if (!experimentManagerInstance) {
		experimentManagerInstance = new ExperimentManager(evaluator, config)
	}
	return experimentManagerInstance
}

function resetExperimentManager(): void {
	experimentManagerInstance = null
}
