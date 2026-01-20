/**
 * AI Model Registry
 *
 * Comprehensive registry of AI models with context limits, pricing, and capabilities.
 * Updated regularly to reflect current model availability.
 *
 * @example
 * ```typescript
 * import { getModel, getModelsByProvider, getModelsByCapability } from '@sylphx/platform-sdk/ai'
 *
 * // Get specific model
 * const gpt4o = getModel('gpt-4o')
 * console.log(gpt4o?.contextWindow) // 128000
 *
 * // Find models by capability
 * const visionModels = getModelsByCapability('vision')
 *
 * // Find cheapest model for a task
 * const cheapest = findCheapestModel({ capability: 'chat', minContext: 16000 })
 * ```
 */

import type { ModelInfo, ModelProvider, ModelCapability, TokenizerFamily } from './types'

// ============================================================================
// Model Registry
// ============================================================================

/**
 * Registry of popular AI models with their specifications
 *
 * Prices are in USD per 1M tokens as of early 2025.
 * Context windows and capabilities may change - check provider docs for updates.
 */
export const MODEL_REGISTRY: Record<string, ModelInfo> = {
	// ========================================
	// OpenAI Models
	// ========================================

	'gpt-4o': {
		id: 'gpt-4o',
		name: 'GPT-4o',
		provider: 'openai',
		contextWindow: 128000,
		maxOutputTokens: 16384,
		inputCostPer1M: 2.50,
		outputCostPer1M: 10.00,
		capabilities: ['chat', 'vision', 'tool_use', 'json_mode'],
	},
	'gpt-4o-mini': {
		id: 'gpt-4o-mini',
		name: 'GPT-4o Mini',
		provider: 'openai',
		contextWindow: 128000,
		maxOutputTokens: 16384,
		inputCostPer1M: 0.15,
		outputCostPer1M: 0.60,
		capabilities: ['chat', 'vision', 'tool_use', 'json_mode'],
	},
	'gpt-4-turbo': {
		id: 'gpt-4-turbo',
		name: 'GPT-4 Turbo',
		provider: 'openai',
		contextWindow: 128000,
		maxOutputTokens: 4096,
		inputCostPer1M: 10.00,
		outputCostPer1M: 30.00,
		capabilities: ['chat', 'vision', 'tool_use', 'json_mode'],
	},
	'gpt-4': {
		id: 'gpt-4',
		name: 'GPT-4',
		provider: 'openai',
		contextWindow: 8192,
		maxOutputTokens: 4096,
		inputCostPer1M: 30.00,
		outputCostPer1M: 60.00,
		capabilities: ['chat', 'tool_use'],
		deprecated: true,
		replacedBy: 'gpt-4o',
	},
	'gpt-3.5-turbo': {
		id: 'gpt-3.5-turbo',
		name: 'GPT-3.5 Turbo',
		provider: 'openai',
		contextWindow: 16385,
		maxOutputTokens: 4096,
		inputCostPer1M: 0.50,
		outputCostPer1M: 1.50,
		capabilities: ['chat', 'tool_use', 'json_mode'],
		deprecated: true,
		replacedBy: 'gpt-4o-mini',
	},
	'o1': {
		id: 'o1',
		name: 'o1',
		provider: 'openai',
		contextWindow: 200000,
		maxOutputTokens: 100000,
		inputCostPer1M: 15.00,
		outputCostPer1M: 60.00,
		capabilities: ['chat', 'vision', 'tool_use'],
	},
	'o1-mini': {
		id: 'o1-mini',
		name: 'o1 Mini',
		provider: 'openai',
		contextWindow: 128000,
		maxOutputTokens: 65536,
		inputCostPer1M: 3.00,
		outputCostPer1M: 12.00,
		capabilities: ['chat'],
	},
	'o3-mini': {
		id: 'o3-mini',
		name: 'o3 Mini',
		provider: 'openai',
		contextWindow: 200000,
		maxOutputTokens: 100000,
		inputCostPer1M: 1.10,
		outputCostPer1M: 4.40,
		capabilities: ['chat', 'tool_use'],
	},
	'text-embedding-3-small': {
		id: 'text-embedding-3-small',
		name: 'Text Embedding 3 Small',
		provider: 'openai',
		contextWindow: 8191,
		inputCostPer1M: 0.02,
		outputCostPer1M: 0,
		capabilities: ['embedding'],
	},
	'text-embedding-3-large': {
		id: 'text-embedding-3-large',
		name: 'Text Embedding 3 Large',
		provider: 'openai',
		contextWindow: 8191,
		inputCostPer1M: 0.13,
		outputCostPer1M: 0,
		capabilities: ['embedding'],
	},

	// ========================================
	// Anthropic Models
	// ========================================

	'claude-3-5-sonnet-20241022': {
		id: 'claude-3-5-sonnet-20241022',
		name: 'Claude 3.5 Sonnet',
		provider: 'anthropic',
		contextWindow: 200000,
		maxOutputTokens: 8192,
		inputCostPer1M: 3.00,
		outputCostPer1M: 15.00,
		capabilities: ['chat', 'vision', 'tool_use', 'json_mode'],
	},
	'claude-3-5-haiku-20241022': {
		id: 'claude-3-5-haiku-20241022',
		name: 'Claude 3.5 Haiku',
		provider: 'anthropic',
		contextWindow: 200000,
		maxOutputTokens: 8192,
		inputCostPer1M: 0.80,
		outputCostPer1M: 4.00,
		capabilities: ['chat', 'vision', 'tool_use', 'json_mode'],
	},
	'claude-3-opus-20240229': {
		id: 'claude-3-opus-20240229',
		name: 'Claude 3 Opus',
		provider: 'anthropic',
		contextWindow: 200000,
		maxOutputTokens: 4096,
		inputCostPer1M: 15.00,
		outputCostPer1M: 75.00,
		capabilities: ['chat', 'vision', 'tool_use'],
	},
	'claude-3-sonnet-20240229': {
		id: 'claude-3-sonnet-20240229',
		name: 'Claude 3 Sonnet',
		provider: 'anthropic',
		contextWindow: 200000,
		maxOutputTokens: 4096,
		inputCostPer1M: 3.00,
		outputCostPer1M: 15.00,
		capabilities: ['chat', 'vision', 'tool_use'],
		deprecated: true,
		replacedBy: 'claude-3-5-sonnet-20241022',
	},
	'claude-3-haiku-20240307': {
		id: 'claude-3-haiku-20240307',
		name: 'Claude 3 Haiku',
		provider: 'anthropic',
		contextWindow: 200000,
		maxOutputTokens: 4096,
		inputCostPer1M: 0.25,
		outputCostPer1M: 1.25,
		capabilities: ['chat', 'vision', 'tool_use'],
		deprecated: true,
		replacedBy: 'claude-3-5-haiku-20241022',
	},

	// ========================================
	// Google Models
	// ========================================

	'gemini-2.0-flash': {
		id: 'gemini-2.0-flash',
		name: 'Gemini 2.0 Flash',
		provider: 'google',
		contextWindow: 1048576,
		maxOutputTokens: 8192,
		inputCostPer1M: 0.10,
		outputCostPer1M: 0.40,
		capabilities: ['chat', 'vision', 'tool_use', 'json_mode'],
	},
	'gemini-1.5-pro': {
		id: 'gemini-1.5-pro',
		name: 'Gemini 1.5 Pro',
		provider: 'google',
		contextWindow: 2097152,
		maxOutputTokens: 8192,
		inputCostPer1M: 1.25,
		outputCostPer1M: 5.00,
		capabilities: ['chat', 'vision', 'tool_use', 'json_mode'],
	},
	'gemini-1.5-flash': {
		id: 'gemini-1.5-flash',
		name: 'Gemini 1.5 Flash',
		provider: 'google',
		contextWindow: 1048576,
		maxOutputTokens: 8192,
		inputCostPer1M: 0.075,
		outputCostPer1M: 0.30,
		capabilities: ['chat', 'vision', 'tool_use', 'json_mode'],
	},
	'gemini-1.5-flash-8b': {
		id: 'gemini-1.5-flash-8b',
		name: 'Gemini 1.5 Flash 8B',
		provider: 'google',
		contextWindow: 1048576,
		maxOutputTokens: 8192,
		inputCostPer1M: 0.0375,
		outputCostPer1M: 0.15,
		capabilities: ['chat', 'vision', 'tool_use'],
	},

	// ========================================
	// Mistral Models
	// ========================================

	'mistral-large': {
		id: 'mistral-large',
		name: 'Mistral Large',
		provider: 'mistral',
		contextWindow: 128000,
		maxOutputTokens: 8192,
		inputCostPer1M: 2.00,
		outputCostPer1M: 6.00,
		capabilities: ['chat', 'tool_use', 'json_mode'],
	},
	'mistral-small': {
		id: 'mistral-small',
		name: 'Mistral Small',
		provider: 'mistral',
		contextWindow: 32000,
		maxOutputTokens: 8192,
		inputCostPer1M: 0.10,
		outputCostPer1M: 0.30,
		capabilities: ['chat', 'tool_use', 'json_mode'],
	},
	'codestral': {
		id: 'codestral',
		name: 'Codestral',
		provider: 'mistral',
		contextWindow: 32000,
		maxOutputTokens: 8192,
		inputCostPer1M: 0.20,
		outputCostPer1M: 0.60,
		capabilities: ['chat', 'completion'],
	},
	'mistral-embed': {
		id: 'mistral-embed',
		name: 'Mistral Embed',
		provider: 'mistral',
		contextWindow: 8192,
		inputCostPer1M: 0.10,
		outputCostPer1M: 0,
		capabilities: ['embedding'],
	},

	// ========================================
	// Meta Models (via providers)
	// ========================================

	'llama-3.3-70b': {
		id: 'llama-3.3-70b',
		name: 'Llama 3.3 70B',
		provider: 'meta',
		contextWindow: 128000,
		maxOutputTokens: 8192,
		inputCostPer1M: 0.60,
		outputCostPer1M: 0.60,
		capabilities: ['chat', 'tool_use'],
	},
	'llama-3.2-90b-vision': {
		id: 'llama-3.2-90b-vision',
		name: 'Llama 3.2 90B Vision',
		provider: 'meta',
		contextWindow: 128000,
		maxOutputTokens: 8192,
		inputCostPer1M: 0.90,
		outputCostPer1M: 0.90,
		capabilities: ['chat', 'vision'],
	},
	'llama-3.1-8b': {
		id: 'llama-3.1-8b',
		name: 'Llama 3.1 8B',
		provider: 'meta',
		contextWindow: 128000,
		maxOutputTokens: 8192,
		inputCostPer1M: 0.05,
		outputCostPer1M: 0.05,
		capabilities: ['chat'],
	},

	// ========================================
	// Cohere Models
	// ========================================

	'command-r-plus': {
		id: 'command-r-plus',
		name: 'Command R+',
		provider: 'cohere',
		contextWindow: 128000,
		maxOutputTokens: 4096,
		inputCostPer1M: 2.50,
		outputCostPer1M: 10.00,
		capabilities: ['chat', 'tool_use'],
	},
	'command-r': {
		id: 'command-r',
		name: 'Command R',
		provider: 'cohere',
		contextWindow: 128000,
		maxOutputTokens: 4096,
		inputCostPer1M: 0.15,
		outputCostPer1M: 0.60,
		capabilities: ['chat', 'tool_use'],
	},
	'embed-english-v3': {
		id: 'embed-english-v3',
		name: 'Embed English v3',
		provider: 'cohere',
		contextWindow: 512,
		inputCostPer1M: 0.10,
		outputCostPer1M: 0,
		capabilities: ['embedding'],
	},
	'embed-multilingual-v3': {
		id: 'embed-multilingual-v3',
		name: 'Embed Multilingual v3',
		provider: 'cohere',
		contextWindow: 512,
		inputCostPer1M: 0.10,
		outputCostPer1M: 0,
		capabilities: ['embedding'],
	},
}

// ============================================================================
// Model Aliases
// ============================================================================

/**
 * Common aliases for models
 */
export const MODEL_ALIASES: Record<string, string> = {
	// OpenAI aliases
	'gpt-4o-latest': 'gpt-4o',
	'gpt-4-turbo-preview': 'gpt-4-turbo',
	'gpt-35-turbo': 'gpt-3.5-turbo',

	// Anthropic aliases
	'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
	'claude-3.5-haiku': 'claude-3-5-haiku-20241022',
	'claude-3-opus': 'claude-3-opus-20240229',
	'claude-sonnet': 'claude-3-5-sonnet-20241022',
	'claude-haiku': 'claude-3-5-haiku-20241022',
	'claude-opus': 'claude-3-opus-20240229',

	// Google aliases
	'gemini-pro': 'gemini-1.5-pro',
	'gemini-flash': 'gemini-2.0-flash',

	// Meta aliases
	'llama-3.3': 'llama-3.3-70b',
	'llama-3': 'llama-3.3-70b',
}

// ============================================================================
// Tokenizer Mapping
// ============================================================================

/**
 * Map model IDs to tokenizer families
 */
export const MODEL_TOKENIZER_MAP: Record<string, TokenizerFamily> = {
	// OpenAI
	'gpt-4o': 'gpt-4o',
	'gpt-4o-mini': 'gpt-4o',
	'gpt-4-turbo': 'gpt-4',
	'gpt-4': 'gpt-4',
	'gpt-3.5-turbo': 'gpt-3.5',
	'o1': 'gpt-4o',
	'o1-mini': 'gpt-4o',
	'o3-mini': 'gpt-4o',
	'text-embedding-3-small': 'gpt-4',
	'text-embedding-3-large': 'gpt-4',

	// Anthropic
	'claude-3-5-sonnet-20241022': 'claude',
	'claude-3-5-haiku-20241022': 'claude',
	'claude-3-opus-20240229': 'claude',
	'claude-3-sonnet-20240229': 'claude',
	'claude-3-haiku-20240307': 'claude',

	// Google
	'gemini-2.0-flash': 'gemini',
	'gemini-1.5-pro': 'gemini',
	'gemini-1.5-flash': 'gemini',
	'gemini-1.5-flash-8b': 'gemini',

	// Mistral
	'mistral-large': 'mistral',
	'mistral-small': 'mistral',
	'codestral': 'mistral',
	'mistral-embed': 'mistral',

	// Meta
	'llama-3.3-70b': 'llama',
	'llama-3.2-90b-vision': 'llama',
	'llama-3.1-8b': 'llama',
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get a model by ID (resolves aliases)
 */
export function getModel(modelId: string): ModelInfo | undefined {
	const resolvedId = MODEL_ALIASES[modelId] ?? modelId
	return MODEL_REGISTRY[resolvedId]
}

/**
 * Resolve a model alias to its canonical ID
 */
export function resolveModelAlias(modelId: string): string {
	return MODEL_ALIASES[modelId] ?? modelId
}

/**
 * Get all models from a specific provider
 */
export function getModelsByProvider(provider: ModelProvider): ModelInfo[] {
	return Object.values(MODEL_REGISTRY).filter(
		(model) => model.provider === provider && !model.deprecated
	)
}

/**
 * Get all models with a specific capability
 */
export function getModelsByCapability(capability: ModelCapability): ModelInfo[] {
	return Object.values(MODEL_REGISTRY).filter(
		(model) => model.capabilities.includes(capability) && !model.deprecated
	)
}

/**
 * Get the tokenizer family for a model
 */
export function getTokenizerFamily(modelId: string): TokenizerFamily {
	const resolvedId = resolveModelAlias(modelId)
	return MODEL_TOKENIZER_MAP[resolvedId] ?? 'unknown'
}

/**
 * Find the cheapest model matching criteria
 */
export function findCheapestModel(options: {
	capability?: ModelCapability
	minContext?: number
	provider?: ModelProvider
	includeDeprecated?: boolean
}): ModelInfo | undefined {
	const {
		capability,
		minContext = 0,
		provider,
		includeDeprecated = false,
	} = options

	const candidates = Object.values(MODEL_REGISTRY).filter((model) => {
		if (!includeDeprecated && model.deprecated) return false
		if (capability && !model.capabilities.includes(capability)) return false
		if (model.contextWindow < minContext) return false
		if (provider && model.provider !== provider) return false
		return true
	})

	if (candidates.length === 0) return undefined

	// Sort by average cost (input + output) / 2
	return candidates.sort((a, b) => {
		const avgCostA = (a.inputCostPer1M + a.outputCostPer1M) / 2
		const avgCostB = (b.inputCostPer1M + b.outputCostPer1M) / 2
		return avgCostA - avgCostB
	})[0]
}

/**
 * Find models with the largest context window
 */
export function findLargestContextModels(options?: {
	capability?: ModelCapability
	provider?: ModelProvider
	limit?: number
}): ModelInfo[] {
	const { capability, provider, limit = 5 } = options ?? {}

	return Object.values(MODEL_REGISTRY)
		.filter((model) => {
			if (model.deprecated) return false
			if (capability && !model.capabilities.includes(capability)) return false
			if (provider && model.provider !== provider) return false
			return true
		})
		.sort((a, b) => b.contextWindow - a.contextWindow)
		.slice(0, limit)
}

/**
 * Get all available models
 */
export function getAllModels(options?: {
	includeDeprecated?: boolean
}): ModelInfo[] {
	const { includeDeprecated = false } = options ?? {}

	return Object.values(MODEL_REGISTRY).filter(
		(model) => includeDeprecated || !model.deprecated
	)
}

/**
 * Check if a model ID is valid
 */
export function isValidModel(modelId: string): boolean {
	return getModel(modelId) !== undefined
}
