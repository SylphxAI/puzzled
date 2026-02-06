/**
 * Server-side AI Client
 *
 * Creates an OpenAI-compatible client configured for Sylphx Platform.
 * Use this in Server Components, API routes, and server actions.
 *
 * @example
 * ```ts
 * import { createAI } from '@sylphx/platform-sdk/server'
 *
 * const ai = createAI()
 *
 * // Chat completion
 * const response = await ai.chat({
 *   model: 'anthropic/claude-3.5-sonnet',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * })
 *
 * // Embeddings
 * const embeddings = await ai.embed({
 *   model: 'openai/text-embedding-3-small',
 *   input: 'Hello world',
 * })
 *
 * // Streaming
 * const stream = await ai.chat({
 *   model: 'anthropic/claude-3.5-sonnet',
 *   messages: [{ role: 'user', content: 'Tell me a story' }],
 *   stream: true,
 * })
 *
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.choices[0]?.delta?.content || '')
 * }
 * ```
 */

// ============================================
// Types
// ============================================

export interface AIClientOptions {
	/** Secret key for authentication (default: SYLPHX_SECRET_KEY env var) */
	secretKey?: string
	/** Platform URL (default: SYLPHX_PLATFORM_URL env var or https://sylphx.com) */
	platformUrl?: string
}

// ChatMessage re-exported from ai.ts (SSOT)
export type { ChatMessage } from '../ai'
import type { ChatMessage } from '../ai'
import { validateAndSanitizeSecretKey } from '../key-validation'
import { DEFAULT_PLATFORM_URL } from '../constants'

export interface ChatCompletionOptions {
	model: string
	messages: ChatMessage[]
	temperature?: number
	max_tokens?: number
	top_p?: number
	frequency_penalty?: number
	presence_penalty?: number
	stop?: string | string[]
	stream?: false
	user?: string
}

export interface ChatCompletionStreamOptions extends Omit<ChatCompletionOptions, 'stream'> {
	stream: true
}

export interface ChatCompletionResponse {
	id: string
	object: 'chat.completion'
	created: number
	model: string
	choices: Array<{
		index: number
		message: {
			role: 'assistant'
			content: string
		}
		finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
	}>
	usage: {
		prompt_tokens: number
		completion_tokens: number
		total_tokens: number
	}
}

export interface ChatCompletionChunk {
	id: string
	object: 'chat.completion.chunk'
	created: number
	model: string
	choices: Array<{
		index: number
		delta: {
			role?: 'assistant'
			content?: string
		}
		finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
	}>
}

export interface EmbeddingOptions {
	model: string
	input: string | string[]
	dimensions?: number
	user?: string
}

export interface EmbeddingResponse {
	object: 'list'
	data: Array<{
		object: 'embedding'
		index: number
		embedding: number[]
	}>
	model: string
	usage: {
		prompt_tokens: number
		total_tokens: number
	}
}

export interface ModelInfo {
	id: string
	name: string
	context_length: number
	pricing: {
		prompt: string
		completion: string
	}
	capabilities: string[]
}

export interface ModelsResponse {
	object: 'list'
	data: ModelInfo[]
}

// ============================================
// AI Client
// ============================================

export interface AIClient {
	/** Create a chat completion */
	chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse>
	/** Create a streaming chat completion */
	chat(options: ChatCompletionStreamOptions): Promise<AsyncIterable<ChatCompletionChunk>>
	/** Create embeddings */
	embed(options: EmbeddingOptions): Promise<EmbeddingResponse>
	/** List available models */
	listModels(options?: { capability?: string; search?: string }): Promise<ModelsResponse>
}

/**
 * Create a server-side AI client
 *
 * Uses environment variables by default:
 * - SYLPHX_PLATFORM_URL: Platform URL (default: https://sylphx.com)
 * - SYLPHX_SECRET_KEY: Your app's secret key (sk_dev_xxx, sk_stg_xxx, sk_prod_xxx)
 */
export function createAI(options: AIClientOptions = {}): AIClient {
	const baseURL = (options.platformUrl || process.env.SYLPHX_PLATFORM_URL || DEFAULT_PLATFORM_URL).trim()
	const rawApiKey = options.secretKey || process.env.SYLPHX_SECRET_KEY

	// Validate and sanitize API key using SSOT
	const apiKey = validateAndSanitizeSecretKey(rawApiKey)

	const headers = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${apiKey}`,
	}

	async function chat(
		opts: ChatCompletionOptions | ChatCompletionStreamOptions
	): Promise<ChatCompletionResponse | AsyncIterable<ChatCompletionChunk>> {
		const response = await fetch(`${baseURL}/api/v1/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify(opts),
		})

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: { message: 'Chat failed' } }))
			throw new Error(error.error?.message || 'Chat failed')
		}

		if (opts.stream) {
			// Return async iterable for streaming
			return parseSSEStream(response)
		}

		return response.json()
	}

	async function embed(opts: EmbeddingOptions): Promise<EmbeddingResponse> {
		const response = await fetch(`${baseURL}/api/v1/embeddings`, {
			method: 'POST',
			headers,
			body: JSON.stringify(opts),
		})

		if (!response.ok) {
			const error = await response
				.json()
				.catch(() => ({ error: { message: 'Embedding failed' } }))
			throw new Error(error.error?.message || 'Embedding failed')
		}

		return response.json()
	}

	async function listModels(
		opts?: { capability?: string; search?: string }
	): Promise<ModelsResponse> {
		const params = new URLSearchParams()
		if (opts?.capability) params.set('capability', opts.capability)
		if (opts?.search) params.set('search', opts.search)
		const query = params.toString()

		const response = await fetch(`${baseURL}/api/v1/models${query ? `?${query}` : ''}`)

		if (!response.ok) {
			throw new Error('Failed to fetch models')
		}

		return response.json()
	}

	return {
		chat: chat as AIClient['chat'],
		embed,
		listModels,
	}
}

// ============================================
// SSE Stream Parser
// ============================================

async function* parseSSEStream(
	response: Response
): AsyncIterable<ChatCompletionChunk> {
	const reader = response.body?.getReader()
	if (!reader) {
		throw new Error('Response body is not readable')
	}

	const decoder = new TextDecoder()
	let buffer = ''

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break

			buffer += decoder.decode(value, { stream: true })
			const lines = buffer.split('\n')
			buffer = lines.pop() || ''

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const data = line.slice(6)
					if (data === '[DONE]') {
						return
					}

					try {
						const chunk = JSON.parse(data) as ChatCompletionChunk
						yield chunk
					} catch {
						// Skip invalid JSON
					}
				}
			}
		}
	} finally {
		reader.releaseLock()
	}
}

// ============================================
// Convenience Functions
// ============================================

let defaultClient: AIClient | null = null

/**
 * Get the default AI client (singleton)
 * Creates one using environment variables on first call
 */
export function getAI(): AIClient {
	if (!defaultClient) {
		defaultClient = createAI()
	}
	return defaultClient
}
