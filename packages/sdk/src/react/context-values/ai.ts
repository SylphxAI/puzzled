/**
 * AI Context Value Factory
 *
 * Creates the AI context value for the SylphxProvider.
 * Provides OpenAI-compatible API access with chat, completion, embedding, and vision.
 */

import type { AIProvider } from '../../types'
import type { AIContextValue } from '../services-context'
import type { RestApiClient } from '../rest-client'

// =============================================================================
// Types
// =============================================================================

export interface CreateAIValueConfig {
	/** REST API client */
	api: RestApiClient
	/** Platform URL */
	platformUrl: string
	/** App ID for authentication */
	appId?: string
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Infer AI provider from model ID
 */
export function inferProviderFromModelId(modelId: string): AIProvider {
	if (modelId.startsWith('gpt-') || modelId.includes('openai')) return 'openai'
	if (modelId.startsWith('claude-') || modelId.includes('anthropic')) return 'anthropic'
	if (modelId.startsWith('gemini-') || modelId.includes('google')) return 'google'
	if (modelId.startsWith('mistral-') || modelId.includes('mistral')) return 'mistral'
	if (modelId.includes('groq')) return 'groq'
	if (modelId.includes('together')) return 'together'
	return 'openai' // Default
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create AI context value.
 *
 * Uses OpenAI-compatible /api/v1/* endpoints for:
 * - Chat completions
 * - Streaming chat
 * - Text completion
 * - Embeddings
 * - Vision
 */
export function createAIValue(config: CreateAIValueConfig): AIContextValue {
	const { api, platformUrl, appId } = config

	/**
	 * AI API call helper with app ID authentication
	 */
	const aiApiCall = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
		const response = await fetch(`${platformUrl}${endpoint}`, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${appId}`,
				...options.headers,
			},
		})

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: { message: 'API call failed' } }))
			throw new Error(error.error?.message || 'API call failed')
		}

		return response.json()
	}

	return {
		chat: async (input) => {
			const response = await aiApiCall<{
				id: string
				model: string
				choices: Array<{
					index: number
					message: { role: 'assistant'; content: string }
					finish_reason: string
				}>
				usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
			}>('/api/v1/chat/completions', {
				method: 'POST',
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
				}),
			})

			return {
				id: response.id,
				model: response.model,
				choices: response.choices.map((c) => ({
					index: c.index,
					message: {
						role: c.message.role,
						content: c.message.content,
					},
					finishReason: c.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter' | null,
				})),
				usage: {
					promptTokens: response.usage.prompt_tokens,
					completionTokens: response.usage.completion_tokens,
					totalTokens: response.usage.total_tokens,
				},
			}
		},

		chatStream: (input) => {
			const controller = new AbortController()

			return {
				[Symbol.asyncIterator]: async function* () {
					const response = await fetch(`${platformUrl}/api/v1/chat/completions`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${appId}`,
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
							stream: true,
						}),
						signal: controller.signal,
					})

					if (!response.ok) {
						const error = await response.json().catch(() => ({ error: { message: 'Stream request failed' } }))
						throw new Error(error.error?.message || 'Stream request failed')
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
							buffer = lines.pop() || ''

							for (const line of lines) {
								if (line.startsWith('data: ')) {
									const data = line.slice(6).trim()
									if (data === '[DONE]') {
										return
									}

									try {
										const chunk = JSON.parse(data)

										yield {
											id: chunk.id || '',
											model: chunk.model || input.model,
											choices: (chunk.choices || []).map((c: Record<string, unknown>) => ({
												index: typeof c.index === 'number' ? c.index : 0,
												delta: {
													role: (c.delta as Record<string, unknown>)?.role as 'assistant' | undefined,
													content: (c.delta as Record<string, unknown>)?.content as string | undefined,
													toolCalls: (c.delta as Record<string, unknown>)?.tool_calls as unknown[] | undefined,
												},
												finishReason: (c.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter') || null,
											})),
										}
									} catch {
										// Skip malformed JSON lines
									}
								}
							}
						}
					} finally {
						reader.releaseLock()
					}
				},
			}
		},

		complete: async (input) => {
			const response = await aiApiCall<{
				id: string
				model: string
				choices: Array<{
					message: { content: string }
					finish_reason: string
				}>
				usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
			}>('/api/v1/chat/completions', {
				method: 'POST',
				body: JSON.stringify({
					model: input.model,
					messages: [{ role: 'user', content: input.prompt }],
					temperature: input.temperature,
					max_tokens: input.maxTokens,
					stop: input.stop,
				}),
			})

			return {
				id: response.id,
				model: response.model,
				choices: [
					{
						index: 0,
						text: response.choices[0]?.message.content ?? '',
						finishReason: response.choices[0]?.finish_reason as 'stop' | 'length' | null,
					},
				],
				usage: {
					promptTokens: response.usage.prompt_tokens,
					completionTokens: response.usage.completion_tokens,
					totalTokens: response.usage.total_tokens,
				},
			}
		},

		embed: async (input) => {
			const response = await aiApiCall<{
				model: string
				data: Array<{ index: number; embedding: number[] }>
				usage: { prompt_tokens: number; total_tokens: number }
			}>('/api/v1/embeddings', {
				method: 'POST',
				body: JSON.stringify({
					model: input.model,
					input: input.input,
					dimensions: input.dimensions,
				}),
			})

			return {
				id: crypto.randomUUID(),
				model: response.model,
				embeddings: response.data.map((d) => d.embedding),
				data: response.data,
				usage: {
					promptTokens: response.usage.prompt_tokens,
					totalTokens: response.usage.total_tokens,
				},
			}
		},

		vision: async (input) => {
			const response = await aiApiCall<{
				id: string
				model: string
				choices: Array<{
					index: number
					message: { role: 'assistant'; content: string }
					finish_reason: string
				}>
				usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
			}>('/api/v1/chat/completions', {
				method: 'POST',
				body: JSON.stringify({
					model: input.model,
					messages: input.messages,
					max_tokens: input.maxTokens,
				}),
			})

			return {
				id: response.id,
				model: response.model,
				choices: response.choices.map((c) => ({
					index: c.index,
					message: {
						role: c.message.role,
						content: c.message.content,
					},
					finishReason: c.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter' | null,
				})),
				usage: {
					promptTokens: response.usage.prompt_tokens,
					completionTokens: response.usage.completion_tokens,
					totalTokens: response.usage.total_tokens,
				},
			}
		},

		getUsage: async (period) => {
			return await api.get('/ai/usage', { period })
		},

		getRateLimitStatus: async () => {
			return await api.get('/ai/rate-limit')
		},

		listModels: async (options) => {
			const response = await api.get<{
				models: Array<{
					id: string
					name?: string
					contextWindow?: number
					capabilities?: string[]
					inputCostPer1M?: number
					outputCostPer1M?: number
					description?: string
				}>
				total: number
				hasMore: boolean
			}>('/ai/models', {
				capability: options?.capability,
				search: options?.search,
				limit: options?.limit?.toString(),
				offset: options?.offset?.toString(),
			})

			return {
				models: response.models.map((m) => ({
					id: m.id,
					name: m.name || m.id,
					provider: inferProviderFromModelId(m.id),
					contextWindow: m.contextWindow || 0,
					maxOutputTokens: Math.floor((m.contextWindow || 4096) / 4),
					capabilities: m.capabilities || ['chat'],
					inputCostPer1M: m.inputCostPer1M ?? 0,
					outputCostPer1M: m.outputCostPer1M ?? 0,
					description: m.description || '',
				})),
				total: response.total,
				hasMore: response.hasMore,
			}
		},
	}
}
