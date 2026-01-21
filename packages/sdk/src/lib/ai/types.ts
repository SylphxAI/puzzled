/**
 * AI Lib Types
 *
 * Type definitions for token counting, prompts, and cost estimation.
 */

// ============================================================================
// Model Types
// ============================================================================

/**
 * AI model provider
 */
export type ModelProvider =
	| 'openai'
	| 'anthropic'
	| 'google'
	| 'mistral'
	| 'meta'
	| 'cohere'

/**
 * Model capability
 */
export type ModelCapability =
	| 'chat'
	| 'completion'
	| 'embedding'
	| 'vision'
	| 'tool_use'
	| 'json_mode'

/**
 * Model information with context limits and pricing
 */
export interface ModelInfo {
	/** Model ID (e.g., 'gpt-4o', 'claude-3-5-sonnet') */
	id: string
	/** Display name */
	name: string
	/** Provider */
	provider: ModelProvider
	/** Maximum context window in tokens */
	contextWindow: number
	/** Maximum output tokens (if limited) */
	maxOutputTokens?: number
	/** Cost per 1M input tokens in USD */
	inputCostPer1M: number
	/** Cost per 1M output tokens in USD */
	outputCostPer1M: number
	/** Model capabilities */
	capabilities: ModelCapability[]
	/** Whether model is deprecated */
	deprecated?: boolean
	/** Recommended replacement if deprecated */
	replacedBy?: string
}

/**
 * Model family for tokenizer selection
 */
export type TokenizerFamily =
	| 'gpt-4o'      // cl100k_base with updates
	| 'gpt-4'       // cl100k_base
	| 'gpt-3.5'     // cl100k_base
	| 'claude'      // Claude's BPE tokenizer
	| 'gemini'      // SentencePiece
	| 'mistral'     // SentencePiece
	| 'llama'       // SentencePiece
	| 'unknown'     // Fallback estimation

// ============================================================================
// Token Counting Types
// ============================================================================

/**
 * Token count result
 */
export interface TokenCount {
	/** Total token count */
	tokens: number
	/** Tokenizer family used */
	tokenizer: TokenizerFamily
	/** Whether this is an estimate (true) or exact count (false) */
	isEstimate: boolean
}

/**
 * Multi-modal message content
 * Re-exported from ai.ts for compatibility
 */
export type { ContentPart as MessageContent } from '../../ai'
import type { ContentPart } from '../../ai'

/**
 * Message for token counting
 */
export interface CountableMessage {
	role: 'system' | 'user' | 'assistant' | 'tool'
	content: string | ContentPart[]
	name?: string
}

/**
 * Options for token counting
 */
export interface CountTokensOptions {
	/** Model ID to use for tokenizer selection */
	model?: string
	/** Include overhead tokens for message formatting */
	includeOverhead?: boolean
}

// ============================================================================
// Cost Estimation Types
// ============================================================================

/**
 * Cost estimate result
 */
export interface CostEstimate {
	/** Input/prompt cost in USD */
	inputCost: number
	/** Output/completion cost in USD */
	outputCost: number
	/** Total cost in USD */
	totalCost: number
	/** Model used for estimation */
	model: string
	/** Token counts */
	tokens: {
		input: number
		output: number
		total: number
	}
}

/**
 * Options for cost estimation
 */
export interface EstimateCostOptions {
	/** Model ID */
	model: string
	/** Input/prompt tokens or text */
	input: number | string | CountableMessage[]
	/** Expected output tokens (default: model's max or estimate) */
	outputTokens?: number
}

// ============================================================================
// Prompt Template Types
// ============================================================================

/**
 * Variable definition for prompt template
 */
export interface TemplateVariable {
	/** Variable name */
	name: string
	/** Description */
	description?: string
	/** Default value */
	default?: string
	/** Whether required */
	required?: boolean
	/** Validation pattern (regex) */
	pattern?: string
}

/**
 * Prompt template definition
 */
export interface PromptTemplate {
	/** Template name */
	name: string
	/** Template description */
	description?: string
	/** Template content with {{variable}} placeholders */
	template: string
	/** Variable definitions */
	variables: TemplateVariable[]
	/** Output format hint */
	outputFormat?: 'text' | 'json' | 'markdown' | 'code'
}

/**
 * Compiled prompt ready for use
 */
export interface CompiledPrompt {
	/** The formatted prompt text */
	text: string
	/** Variables that were substituted */
	substitutions: Record<string, string>
	/** Estimated token count */
	estimatedTokens: number
}

// ============================================================================
// Message Builder Types
// ============================================================================

/**
 * Chat message for building conversations
 * Re-exported from ai.ts (SSOT)
 */
export type { ChatMessage } from '../../ai'
import type { ChatMessage } from '../../ai'

/**
 * Conversation context
 */
export interface ConversationContext {
	/** All messages in conversation */
	messages: ChatMessage[]
	/** System message (if set) */
	systemMessage?: string
	/** Total tokens used */
	totalTokens: number
	/** Model being used */
	model: string
	/** Remaining tokens in context window */
	remainingTokens: number
}

// ============================================================================
// Batch Processing Types
// ============================================================================

/**
 * Batch request item
 */
export interface BatchRequestItem {
	/** Unique ID for this request */
	id: string
	/** Messages to process */
	messages: ChatMessage[]
	/** Model to use */
	model?: string
	/** Max tokens for response */
	maxTokens?: number
}

/**
 * Batch processing result
 */
export interface BatchResult<T = unknown> {
	/** Request ID */
	id: string
	/** Whether successful */
	success: boolean
	/** Result data if successful */
	data?: T
	/** Error if failed */
	error?: string
	/** Processing time in ms */
	processingTimeMs: number
}
