/**
 * AI Utilities SDK
 *
 * Platform-agnostic utilities for AI development: token counting, prompt templates,
 * cost estimation, and model information.
 *
 * ## Features
 *
 * - **Token Counting** - Accurate estimation without heavy dependencies
 * - **Prompt Templates** - Reusable templates with variable substitution
 * - **Cost Estimation** - Calculate costs before making API calls
 * - **Model Registry** - Context limits, pricing, capabilities for 30+ models
 *
 * @example
 * ```typescript
 * import {
 *   // Token counting
 *   countTokens,
 *   estimateTokens,
 *   countMessageTokens,
 *   truncateToTokenLimit,
 *
 *   // Prompts
 *   createPromptTemplate,
 *   renderPrompt,
 *   buildMessages,
 *
 *   // Cost
 *   estimateCost,
 *   compareCosts,
 *   formatCost,
 *
 *   // Models
 *   getModel,
 *   getModelsByCapability,
 *   findCheapestModel,
 * } from '@sylphx/platform-sdk/ai'
 *
 * // Count tokens in a prompt
 * const tokens = estimateTokens('Hello, world!', 'gpt-4o')
 *
 * // Estimate API cost
 * const cost = estimateCost({
 *   model: 'claude-3-5-sonnet',
 *   input: 'Explain quantum computing.',
 *   outputTokens: 2000,
 * })
 * console.log(`Estimated cost: ${formatCost(cost.totalCost)}`)
 *
 * // Find the cheapest model for a task
 * const model = findCheapestModel({
 *   capability: 'vision',
 *   minContext: 32000,
 * })
 * ```
 *
 * @module @sylphx/ai
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
	// Model types
	ModelProvider,
	ModelCapability,
	ModelInfo,
	TokenizerFamily,

	// Token counting types
	TokenCount,
	CountableMessage,
	MessageContent,
	CountTokensOptions,

	// Cost estimation types
	CostEstimate,
	EstimateCostOptions,

	// Prompt types
	TemplateVariable,
	PromptTemplate,
	CompiledPrompt,
	ChatMessage,
	ConversationContext,

	// Batch types
	BatchRequestItem,
	BatchResult,
} from './types'

// ============================================================================
// Token Counting
// ============================================================================

export {
	countTokens,
	estimateTokens,
	countMessageTokens,
	calculateRemainingTokens,
	fitsInContext,
	truncateToTokenLimit,
	splitIntoChunks,
} from './tokens'

// ============================================================================
// Prompt Utilities
// ============================================================================

export {
	createPromptTemplate,
	renderPrompt,
	validateTemplateValues,
	buildMessages,
	createConversationContext,
	jsonModePrompt,
	chainOfThoughtPrompt,
	fewShotPrompt,
	rolePrompt,
	compressPrompt,
	expandAbbreviations,
} from './prompts'

// ============================================================================
// Cost Estimation
// ============================================================================

export {
	estimateCost,
	compareCosts,
	estimateMonthlyCost,
	formatCost,
	formatTokens,
	createBudgetTracker,
	getCostOptimizations,
} from './cost'

// ============================================================================
// Model Registry
// ============================================================================

export {
	MODEL_REGISTRY,
	MODEL_ALIASES,
	MODEL_TOKENIZER_MAP,
	getModel,
	resolveModelAlias,
	getModelsByProvider,
	getModelsByCapability,
	getTokenizerFamily,
	findCheapestModel,
	findLargestContextModels,
	getAllModels,
	isValidModel,
} from './models'
