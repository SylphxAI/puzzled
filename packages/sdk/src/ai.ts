/**
 * AI Functions
 *
 * Pure functions for AI completions - Vercel AI SDK style.
 * Direct API calls with natural tree-shaking.
 */

import { type SylphxConfig, buildHeaders } from './config'

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant' | 'tool'
	content: string | ContentPart[]
	name?: string
	tool_call_id?: string
	tool_calls?: ToolCall[]
	/** Timestamp for UI display */
	timestamp?: Date
}

export interface ContentPart {
	type: 'text' | 'image_url'
	text?: string
	image_url?: { url: string; detail?: 'auto' | 'low' | 'high' }
}

export interface ToolCall {
	id: string
	type: 'function'
	function: { name: string; arguments: string }
}

export interface Tool {
	type: 'function'
	function: {
		name: string
		description?: string
		parameters?: Record<string, unknown>
	}
}

export interface ChatInput {
	/** Model ID (e.g., 'gpt-4o', 'claude-sonnet-4-20250514') */
	model: string
	/** Messages */
	messages: ChatMessage[]
	/** Temperature (0-2) */
	temperature?: number
	/** Max tokens to generate */
	maxTokens?: number
	/** Top P sampling */
	topP?: number
	/** Frequency penalty */
	frequencyPenalty?: number
	/** Presence penalty */
	presencePenalty?: number
	/** Stop sequences */
	stop?: string[]
	/** Tools for function calling */
	tools?: Tool[]
	/** Tool choice */
	toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
}

export interface ChatResult {
	id: string
	model: string
	choices: Array<{
		index: number
		message: {
			role: 'assistant'
			content: string | null
			tool_calls?: ToolCall[]
		}
		finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
	}>
	usage: {
		promptTokens: number
		completionTokens: number
		totalTokens: number
	}
}

export interface ChatStreamChunk {
	id: string
	model: string
	choices: Array<{
		index: number
		delta: {
			role?: 'assistant'
			content?: string
			tool_calls?: ToolCall[]
		}
		finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
	}>
}

export interface EmbedInput {
	/** Model ID (e.g., 'text-embedding-3-small') */
	model: string
	/** Text(s) to embed */
	input: string | string[]
	/** Dimensions (for models that support it) */
	dimensions?: number
}

export interface EmbedResult {
	model: string
	data: Array<{
		index: number
		embedding: number[]
	}>
	usage: {
		promptTokens: number
		totalTokens: number
	}
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Create a chat completion
 *
 * @example
 * ```typescript
 * const response = await chat(config, {
 *   model: 'gpt-4o',
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant.' },
 *     { role: 'user', content: 'Hello!' },
 *   ],
 * })
 *
 * console.log(response.choices[0].message.content)
 * ```
 */
export async function chat(config: SylphxConfig, input: ChatInput): Promise<ChatResult> {
	const response = await fetch(`${config.platformUrl}/api/v1/chat/completions`, {
		method: 'POST',
		headers: {
			...buildHeaders(config),
			Authorization: `Bearer ${config.appSecret}`,
		},
		body: JSON.stringify({
			model: input.model,
			messages: input.messages,
			temperature: input.temperature,
			max_tokens: input.maxTokens,
			top_p: input.topP,
			frequency_penalty: input.frequencyPenalty,
			presence_penalty: input.presencePenalty,
			stop: input.stop,
			tools: input.tools,
			tool_choice: input.toolChoice,
		}),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: 'Chat request failed' } }))
		throw new Error(error.error?.message ?? 'Chat request failed')
	}

	const data = await response.json()

	return {
		id: data.id,
		model: data.model,
		choices: data.choices.map((c: Record<string, unknown>) => ({
			index: c.index as number,
			message: {
				role: 'assistant' as const,
				content: (c.message as Record<string, unknown>)?.content as string | null,
				tool_calls: (c.message as Record<string, unknown>)?.tool_calls as ToolCall[] | undefined,
			},
			finishReason: c.finish_reason as ChatResult['choices'][0]['finishReason'],
		})),
		usage: {
			promptTokens: data.usage.prompt_tokens,
			completionTokens: data.usage.completion_tokens,
			totalTokens: data.usage.total_tokens,
		},
	}
}

/**
 * Create a streaming chat completion
 *
 * @example
 * ```typescript
 * const stream = chatStream(config, {
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Write a poem' }],
 * })
 *
 * for await (const chunk of stream) {
 *   process.stdout.write(chunk.choices[0].delta.content ?? '')
 * }
 * ```
 */
export function chatStream(
	config: SylphxConfig,
	input: ChatInput
): AsyncIterable<ChatStreamChunk> {
	return {
		[Symbol.asyncIterator]: async function* () {
			const response = await fetch(`${config.platformUrl}/api/v1/chat/completions`, {
				method: 'POST',
				headers: {
					...buildHeaders(config),
					Authorization: `Bearer ${config.appSecret}`,
				},
				body: JSON.stringify({
					model: input.model,
					messages: input.messages,
					temperature: input.temperature,
					max_tokens: input.maxTokens,
					top_p: input.topP,
					frequency_penalty: input.frequencyPenalty,
					presence_penalty: input.presencePenalty,
					stop: input.stop,
					tools: input.tools,
					tool_choice: input.toolChoice,
					stream: true,
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ error: { message: 'Stream request failed' } }))
				throw new Error(error.error?.message ?? 'Stream request failed')
			}

			const reader = response.body?.getReader()
			if (!reader) {
				throw new Error('No response body')
			}

			const decoder = new TextDecoder()
			let buffer = ''

			try {
				while (true) {
					const { done, value } = await reader.read()
					if (done) break

					buffer += decoder.decode(value, { stream: true })
					const lines = buffer.split('\n')
					buffer = lines.pop() ?? ''

					for (const line of lines) {
						if (line.startsWith('data: ')) {
							const data = line.slice(6).trim()
							if (data === '[DONE]') return

							try {
								const chunk = JSON.parse(data)
								yield {
									id: chunk.id ?? '',
									model: chunk.model ?? input.model,
									choices: (chunk.choices ?? []).map((c: Record<string, unknown>) => ({
										index: typeof c.index === 'number' ? c.index : 0,
										delta: {
											role: (c.delta as Record<string, unknown>)?.role as 'assistant' | undefined,
											content: (c.delta as Record<string, unknown>)?.content as string | undefined,
											tool_calls: (c.delta as Record<string, unknown>)?.tool_calls as ToolCall[] | undefined,
										},
										finishReason: (c.finish_reason as ChatStreamChunk['choices'][0]['finishReason']) ?? null,
									})),
								}
							} catch {
								// Skip malformed JSON
							}
						}
					}
				}
			} finally {
				reader.releaseLock()
			}
		},
	}
}

/**
 * Create embeddings
 *
 * @example
 * ```typescript
 * const result = await embed(config, {
 *   model: 'text-embedding-3-small',
 *   input: ['Hello world', 'Goodbye world'],
 * })
 *
 * console.log(result.data[0].embedding) // [0.123, -0.456, ...]
 * ```
 */
export async function embed(config: SylphxConfig, input: EmbedInput): Promise<EmbedResult> {
	const response = await fetch(`${config.platformUrl}/api/v1/embeddings`, {
		method: 'POST',
		headers: {
			...buildHeaders(config),
			Authorization: `Bearer ${config.appSecret}`,
		},
		body: JSON.stringify({
			model: input.model,
			input: input.input,
			dimensions: input.dimensions,
		}),
	})

	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: 'Embedding request failed' } }))
		throw new Error(error.error?.message ?? 'Embedding request failed')
	}

	const data = await response.json()

	return {
		model: data.model,
		data: data.data,
		usage: {
			promptTokens: data.usage.prompt_tokens,
			totalTokens: data.usage.total_tokens,
		},
	}
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Simple text completion (convenience wrapper)
 *
 * @example
 * ```typescript
 * const text = await complete(config, 'gpt-4o', 'Explain quantum computing in one sentence.')
 * ```
 */
export async function complete(
	config: SylphxConfig,
	model: string,
	prompt: string,
	options?: Omit<ChatInput, 'model' | 'messages'>
): Promise<string> {
	const response = await chat(config, {
		model,
		messages: [{ role: 'user', content: prompt }],
		...options,
	})
	return response.choices[0]?.message.content ?? ''
}

/**
 * Stream text to string (collects all chunks)
 *
 * @example
 * ```typescript
 * const text = await streamToString(config, {
 *   model: 'gpt-4o',
 *   messages: [{ role: 'user', content: 'Write a haiku' }],
 * })
 * ```
 */
export async function streamToString(config: SylphxConfig, input: ChatInput): Promise<string> {
	let result = ''
	for await (const chunk of chatStream(config, input)) {
		result += chunk.choices[0]?.delta.content ?? ''
	}
	return result
}
