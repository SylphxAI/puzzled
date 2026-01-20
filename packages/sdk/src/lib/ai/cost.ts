/**
 * Cost Estimation Utilities
 *
 * Estimate API costs before making requests.
 *
 * @example
 * ```typescript
 * import { estimateCost, compareCosts, formatCost } from '@sylphx/platform-sdk/ai'
 *
 * // Estimate cost for a single request
 * const cost = estimateCost({
 *   model: 'gpt-4o',
 *   input: 'Explain quantum computing in detail.',
 *   outputTokens: 2000,
 * })
 * console.log(formatCost(cost.totalCost)) // '$0.0225'
 *
 * // Compare costs across models
 * const comparison = compareCosts({
 *   input: 'Write a poem about AI.',
 *   outputTokens: 500,
 *   models: ['gpt-4o', 'claude-3-5-sonnet', 'gemini-1.5-flash'],
 * })
 * ```
 */

import type { CostEstimate, EstimateCostOptions, CountableMessage } from './types'
import { getModel } from './models'
import { countTokens, countMessageTokens, estimateTokens } from './tokens'

// ============================================================================
// Cost Estimation
// ============================================================================

/**
 * Estimate the cost of an API request
 *
 * @param options - Cost estimation options
 * @returns Cost estimate with breakdown
 *
 * @example
 * ```typescript
 * // From text
 * const cost1 = estimateCost({
 *   model: 'gpt-4o',
 *   input: 'Hello, how are you?',
 *   outputTokens: 100,
 * })
 *
 * // From token count
 * const cost2 = estimateCost({
 *   model: 'claude-3-5-sonnet',
 *   input: 5000, // 5000 input tokens
 *   outputTokens: 2000,
 * })
 *
 * // From messages
 * const cost3 = estimateCost({
 *   model: 'gpt-4o',
 *   input: [
 *     { role: 'system', content: 'You are helpful.' },
 *     { role: 'user', content: 'Hi!' },
 *   ],
 *   outputTokens: 500,
 * })
 * ```
 */
export function estimateCost(options: EstimateCostOptions): CostEstimate {
	const { model, input, outputTokens } = options

	const modelInfo = getModel(model)
	if (!modelInfo) {
		throw new Error(`Unknown model: ${model}`)
	}

	// Calculate input tokens
	let inputTokens: number
	if (typeof input === 'number') {
		inputTokens = input
	} else if (typeof input === 'string') {
		inputTokens = countTokens(input, { model }).tokens
	} else {
		inputTokens = countMessageTokens(input, { model }).tokens
	}

	// Use provided output tokens or estimate
	const estimatedOutputTokens = outputTokens ?? modelInfo.maxOutputTokens ?? 1000

	// Calculate costs (per 1M tokens)
	const inputCost = (inputTokens / 1_000_000) * modelInfo.inputCostPer1M
	const outputCost = (estimatedOutputTokens / 1_000_000) * modelInfo.outputCostPer1M

	return {
		inputCost,
		outputCost,
		totalCost: inputCost + outputCost,
		model,
		tokens: {
			input: inputTokens,
			output: estimatedOutputTokens,
			total: inputTokens + estimatedOutputTokens,
		},
	}
}

/**
 * Compare costs across multiple models
 *
 * @param options - Comparison options
 * @returns Sorted array of cost estimates (cheapest first)
 *
 * @example
 * ```typescript
 * const comparison = compareCosts({
 *   input: 'Translate this document to French.',
 *   outputTokens: 1000,
 *   models: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet', 'gemini-1.5-flash'],
 * })
 *
 * console.log('Cheapest:', comparison[0].model)
 * console.log('Cost:', formatCost(comparison[0].totalCost))
 * ```
 */
export function compareCosts(options: {
	input: number | string | CountableMessage[]
	outputTokens?: number
	models: string[]
}): CostEstimate[] {
	const { input, outputTokens, models } = options

	const estimates = models
		.map((model) => {
			try {
				return estimateCost({ model, input, outputTokens })
			} catch {
				return null
			}
		})
		.filter((e): e is CostEstimate => e !== null)

	return estimates.sort((a, b) => a.totalCost - b.totalCost)
}

/**
 * Calculate monthly cost for a projected usage pattern
 *
 * @param options - Usage pattern options
 * @returns Estimated monthly cost
 *
 * @example
 * ```typescript
 * const monthly = estimateMonthlyCost({
 *   model: 'gpt-4o',
 *   requestsPerDay: 1000,
 *   avgInputTokens: 500,
 *   avgOutputTokens: 1000,
 * })
 *
 * console.log(`Estimated monthly cost: ${formatCost(monthly.totalCost)}`)
 * ```
 */
export function estimateMonthlyCost(options: {
	model: string
	requestsPerDay: number
	avgInputTokens: number
	avgOutputTokens: number
}): {
	totalCost: number
	inputCost: number
	outputCost: number
	totalRequests: number
	totalTokens: {
		input: number
		output: number
	}
} {
	const { model, requestsPerDay, avgInputTokens, avgOutputTokens } = options

	const modelInfo = getModel(model)
	if (!modelInfo) {
		throw new Error(`Unknown model: ${model}`)
	}

	const daysPerMonth = 30
	const totalRequests = requestsPerDay * daysPerMonth
	const totalInputTokens = avgInputTokens * totalRequests
	const totalOutputTokens = avgOutputTokens * totalRequests

	const inputCost = (totalInputTokens / 1_000_000) * modelInfo.inputCostPer1M
	const outputCost = (totalOutputTokens / 1_000_000) * modelInfo.outputCostPer1M

	return {
		totalCost: inputCost + outputCost,
		inputCost,
		outputCost,
		totalRequests,
		totalTokens: {
			input: totalInputTokens,
			output: totalOutputTokens,
		},
	}
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a cost value as a currency string
 *
 * @param cost - Cost in USD
 * @param options - Formatting options
 * @returns Formatted cost string
 *
 * @example
 * ```typescript
 * formatCost(0.00125) // '$0.0013'
 * formatCost(1.5) // '$1.50'
 * formatCost(0.00001) // '$0.00001'
 * formatCost(1234.56, { locale: 'de-DE' }) // '1.234,56 $'
 * ```
 */
export function formatCost(
	cost: number,
	options: {
		/** Currency code (default: 'USD') */
		currency?: string
		/** Locale for formatting (default: 'en-US') */
		locale?: string
		/** Minimum fraction digits */
		minDecimals?: number
		/** Maximum fraction digits */
		maxDecimals?: number
	} = {}
): string {
	const {
		currency = 'USD',
		locale = 'en-US',
		minDecimals = 2,
		maxDecimals = 6,
	} = options

	// Determine appropriate decimal places
	let decimals = minDecimals
	if (cost < 0.01 && cost > 0) {
		// For very small amounts, show more decimals
		decimals = Math.max(minDecimals, -Math.floor(Math.log10(cost)) + 1)
	}
	decimals = Math.min(decimals, maxDecimals)

	return new Intl.NumberFormat(locale, {
		style: 'currency',
		currency,
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).format(cost)
}

/**
 * Format token count with thousands separators
 *
 * @param tokens - Token count
 * @param locale - Locale for formatting
 * @returns Formatted token string
 *
 * @example
 * ```typescript
 * formatTokens(1234567) // '1,234,567'
 * formatTokens(1234567, 'de-DE') // '1.234.567'
 * ```
 */
export function formatTokens(tokens: number, locale: string = 'en-US'): string {
	return new Intl.NumberFormat(locale).format(tokens)
}

// ============================================================================
// Budget Tracking
// ============================================================================

/**
 * Create a budget tracker for monitoring API spend
 *
 * @param budgetUsd - Monthly budget in USD
 * @returns Budget tracker object
 *
 * @example
 * ```typescript
 * const budget = createBudgetTracker(100) // $100/month
 *
 * // Track usage
 * budget.addUsage({ inputCost: 0.01, outputCost: 0.05 })
 * budget.addUsage({ inputCost: 0.02, outputCost: 0.08 })
 *
 * console.log(budget.getStatus())
 * // { spent: 0.16, remaining: 99.84, percentUsed: 0.16 }
 *
 * if (budget.isOverBudget()) {
 *   console.warn('Budget exceeded!')
 * }
 * ```
 */
export function createBudgetTracker(budgetUsd: number): {
	addUsage: (cost: Pick<CostEstimate, 'inputCost' | 'outputCost'>) => void
	getStatus: () => {
		spent: number
		remaining: number
		percentUsed: number
		budget: number
	}
	isOverBudget: () => boolean
	isNearBudget: (threshold?: number) => boolean
	reset: () => void
} {
	let totalSpent = 0

	return {
		addUsage(cost) {
			totalSpent += cost.inputCost + cost.outputCost
		},

		getStatus() {
			return {
				spent: totalSpent,
				remaining: Math.max(0, budgetUsd - totalSpent),
				percentUsed: (totalSpent / budgetUsd) * 100,
				budget: budgetUsd,
			}
		},

		isOverBudget() {
			return totalSpent > budgetUsd
		},

		isNearBudget(threshold = 0.8) {
			return totalSpent >= budgetUsd * threshold
		},

		reset() {
			totalSpent = 0
		},
	}
}

// ============================================================================
// Cost Optimization Suggestions
// ============================================================================

/**
 * Get cost optimization suggestions based on usage pattern
 *
 * @param options - Current usage pattern
 * @returns Optimization suggestions
 */
export function getCostOptimizations(options: {
	model: string
	avgInputTokens: number
	avgOutputTokens: number
	requestsPerDay: number
}): Array<{
	suggestion: string
	potentialSavings: number
	alternativeModel?: string
}> {
	const suggestions: Array<{
		suggestion: string
		potentialSavings: number
		alternativeModel?: string
	}> = []

	const { model, avgInputTokens, avgOutputTokens, requestsPerDay } = options

	const currentCost = estimateMonthlyCost({
		model,
		requestsPerDay,
		avgInputTokens,
		avgOutputTokens,
	})

	const modelInfo = getModel(model)
	if (!modelInfo) return suggestions

	// Suggest cheaper alternatives
	const cheaperModels: Array<{ id: string; name: string }> = []

	if (model.includes('gpt-4o') && !model.includes('mini')) {
		cheaperModels.push({ id: 'gpt-4o-mini', name: 'GPT-4o Mini' })
	}
	if (model.includes('claude-3-5-sonnet')) {
		cheaperModels.push({ id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' })
	}
	if (model.includes('gemini-1.5-pro')) {
		cheaperModels.push({ id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' })
	}

	for (const alt of cheaperModels) {
		try {
			const altCost = estimateMonthlyCost({
				model: alt.id,
				requestsPerDay,
				avgInputTokens,
				avgOutputTokens,
			})

			const savings = currentCost.totalCost - altCost.totalCost
			if (savings > 0) {
				suggestions.push({
					suggestion: `Switch to ${alt.name} for simpler tasks`,
					potentialSavings: savings,
					alternativeModel: alt.id,
				})
			}
		} catch {
			// Model not in registry
		}
	}

	// Suggest prompt optimization if input tokens are high
	if (avgInputTokens > 2000) {
		const reducedInputCost = estimateMonthlyCost({
			model,
			requestsPerDay,
			avgInputTokens: Math.floor(avgInputTokens * 0.7), // 30% reduction
			avgOutputTokens,
		})

		suggestions.push({
			suggestion: 'Optimize prompts to reduce input tokens by 30%',
			potentialSavings: currentCost.totalCost - reducedInputCost.totalCost,
		})
	}

	// Suggest caching if high request volume
	if (requestsPerDay > 100) {
		suggestions.push({
			suggestion: 'Implement response caching for repeated queries',
			potentialSavings: currentCost.totalCost * 0.2, // Estimate 20% cache hit rate
		})
	}

	return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings)
}
