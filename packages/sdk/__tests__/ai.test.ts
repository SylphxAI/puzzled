/**
 * AI Module Tests
 *
 * Tests for AI completion functions.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { SylphxConfig } from '../src/config'
import { chat, chatStream, complete, embed, streamToString } from '../src/ai'

// ============================================================================
// Test Setup
// ============================================================================

const mockConfig: SylphxConfig = {
	secretKey: 'sk_dev_test123',
	platformUrl: 'https://api.sylphx.com',
}

// Store all fetch calls
let fetchCalls: Array<{ url: string; options: RequestInit }> = []
const originalFetch = globalThis.fetch

function createMockResponse<T>(data: T, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})
}

function getLastCall() {
	return fetchCalls[fetchCalls.length - 1]
}

function getRequestBody(): Record<string, unknown> | null {
	const last = getLastCall()
	if (!last?.options.body) return null
	return JSON.parse(last.options.body as string)
}

function getRequestHeaders(): Record<string, string> {
	const last = getLastCall()
	if (!last?.options.headers) return {}
	return last.options.headers as Record<string, string>
}

beforeEach(() => {
	fetchCalls = []
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

// ============================================================================
// chat Tests
// ============================================================================

describe('chat', () => {
	test('sends chat completion request', async () => {
		const mockResponse = {
			id: 'chatcmpl-123',
			model: 'gpt-4o',
			choices: [
				{
					index: 0,
					message: { role: 'assistant', content: 'Hello! How can I help you?' },
					finish_reason: 'stop',
				},
			],
			usage: {
				prompt_tokens: 10,
				completion_tokens: 8,
				total_tokens: 18,
			},
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await chat(mockConfig, {
			model: 'gpt-4o',
			messages: [
				{ role: 'system', content: 'You are a helpful assistant.' },
				{ role: 'user', content: 'Hello!' },
			],
		})

		expect(result.id).toBe('chatcmpl-123')
		expect(result.model).toBe('gpt-4o')
		expect(result.choices[0]?.message.content).toBe('Hello! How can I help you?')
		expect(result.usage.totalTokens).toBe(18)
		expect(getLastCall()?.url).toContain('/api/v1/chat/completions')
	})

	test('includes all chat options', async () => {
		const mockResponse = {
			id: 'chatcmpl-456',
			model: 'gpt-4o',
			choices: [
				{ index: 0, message: { role: 'assistant', content: 'Response' }, finish_reason: 'stop' },
			],
			usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await chat(mockConfig, {
			model: 'gpt-4o',
			messages: [{ role: 'user', content: 'Test' }],
			temperature: 0.7,
			maxTokens: 100,
			topP: 0.9,
			frequencyPenalty: 0.5,
			presencePenalty: 0.5,
			stop: ['END'],
		})

		const body = getRequestBody()
		expect(body?.temperature).toBe(0.7)
		expect(body?.max_tokens).toBe(100)
		expect(body?.top_p).toBe(0.9)
		expect(body?.frequency_penalty).toBe(0.5)
		expect(body?.presence_penalty).toBe(0.5)
		expect(body?.stop).toEqual(['END'])
	})

	test('handles tool calls', async () => {
		const mockResponse = {
			id: 'chatcmpl-789',
			model: 'gpt-4o',
			choices: [
				{
					index: 0,
					message: {
						role: 'assistant',
						content: null,
						tool_calls: [
							{
								id: 'call_123',
								type: 'function',
								function: {
									name: 'get_weather',
									arguments: '{"location":"San Francisco"}',
								},
							},
						],
					},
					finish_reason: 'tool_calls',
				},
			],
			usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await chat(mockConfig, {
			model: 'gpt-4o',
			messages: [{ role: 'user', content: "What's the weather in San Francisco?" }],
			tools: [
				{
					type: 'function',
					function: {
						name: 'get_weather',
						description: 'Get current weather',
						parameters: {
							type: 'object',
							properties: { location: { type: 'string' } },
						},
					},
				},
			],
		})

		expect(result.choices[0]?.message.tool_calls).toHaveLength(1)
		expect(result.choices[0]?.message.tool_calls?.[0]?.function.name).toBe('get_weather')
		expect(result.choices[0]?.finishReason).toBe('tool_calls')
	})

	test('handles API errors', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(
				new Response(JSON.stringify({ error: { message: 'Invalid model' } }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		}) as typeof fetch

		await expect(
			chat(mockConfig, {
				model: 'invalid-model',
				messages: [{ role: 'user', content: 'Test' }],
			})
		).rejects.toThrow('Invalid model')
	})

	test('includes authorization header', async () => {
		const mockResponse = {
			id: 'chatcmpl-auth',
			model: 'gpt-4o',
			choices: [
				{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' },
			],
			usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await chat(mockConfig, {
			model: 'gpt-4o',
			messages: [{ role: 'user', content: 'Hi' }],
		})

		const headers = getRequestHeaders()
		expect(headers['Authorization']).toBe('Bearer sk_dev_test123')
	})
})

// ============================================================================
// chatStream Tests
// ============================================================================

describe('chatStream', () => {
	test('streams chat completion chunks', async () => {
		const chunks = [
			'data: {"id":"chatcmpl-stream","model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n',
			'data: {"id":"chatcmpl-stream","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n',
			'data: {"id":"chatcmpl-stream","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}\n',
			'data: {"id":"chatcmpl-stream","model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n',
			'data: [DONE]\n',
		]

		const encoder = new TextEncoder()
		const stream = new ReadableStream({
			start(controller) {
				for (const chunk of chunks) {
					controller.enqueue(encoder.encode(chunk))
				}
				controller.close()
			},
		})

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(
				new Response(stream, {
					status: 200,
					headers: { 'Content-Type': 'text/event-stream' },
				})
			)
		}) as typeof fetch

		const receivedChunks: string[] = []
		for await (const chunk of chatStream(mockConfig, {
			model: 'gpt-4o',
			messages: [{ role: 'user', content: 'Hi' }],
		})) {
			if (chunk.choices[0]?.delta.content) {
				receivedChunks.push(chunk.choices[0].delta.content)
			}
		}

		expect(receivedChunks).toEqual(['Hello', '!'])
	})

	test('handles stream errors', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(
				new Response(JSON.stringify({ error: { message: 'Stream error' } }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				})
			)
		}) as typeof fetch

		const stream = chatStream(mockConfig, {
			model: 'gpt-4o',
			messages: [{ role: 'user', content: 'Test' }],
		})

		await expect(async () => {
			for await (const _ of stream) {
				// Consume stream
			}
		}).toThrow('Stream error')
	})

	test('handles missing response body', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(
				new Response(null, {
					status: 200,
					headers: { 'Content-Type': 'text/event-stream' },
				})
			)
		}) as typeof fetch

		const stream = chatStream(mockConfig, {
			model: 'gpt-4o',
			messages: [{ role: 'user', content: 'Test' }],
		})

		await expect(async () => {
			for await (const _ of stream) {
				// Consume stream
			}
		}).toThrow('No response body')
	})
})

// ============================================================================
// embed Tests
// ============================================================================

describe('embed', () => {
	test('creates embeddings for single input', async () => {
		const mockResponse = {
			model: 'text-embedding-3-small',
			data: [{ index: 0, embedding: [0.1, 0.2, 0.3, 0.4] }],
			usage: { prompt_tokens: 5, total_tokens: 5 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await embed(mockConfig, {
			model: 'text-embedding-3-small',
			input: 'Hello world',
		})

		expect(result.model).toBe('text-embedding-3-small')
		expect(result.data).toHaveLength(1)
		expect(result.data[0]?.embedding).toEqual([0.1, 0.2, 0.3, 0.4])
		expect(getLastCall()?.url).toContain('/api/v1/embeddings')
	})

	test('creates embeddings for multiple inputs', async () => {
		const mockResponse = {
			model: 'text-embedding-3-small',
			data: [
				{ index: 0, embedding: [0.1, 0.2] },
				{ index: 1, embedding: [0.3, 0.4] },
			],
			usage: { prompt_tokens: 10, total_tokens: 10 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await embed(mockConfig, {
			model: 'text-embedding-3-small',
			input: ['Hello', 'World'],
		})

		expect(result.data).toHaveLength(2)
		expect(result.usage.promptTokens).toBe(10)
	})

	test('supports custom dimensions', async () => {
		const mockResponse = {
			model: 'text-embedding-3-small',
			data: [{ index: 0, embedding: new Array(256).fill(0.1) }],
			usage: { prompt_tokens: 5, total_tokens: 5 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await embed(mockConfig, {
			model: 'text-embedding-3-small',
			input: 'Test',
			dimensions: 256,
		})

		const body = getRequestBody()
		expect(body?.dimensions).toBe(256)
	})
})

// ============================================================================
// complete Tests
// ============================================================================

describe('complete', () => {
	test('simple text completion', async () => {
		const mockResponse = {
			id: 'chatcmpl-complete',
			model: 'gpt-4o',
			choices: [
				{
					index: 0,
					message: { role: 'assistant', content: 'Quantum computing uses qubits.' },
					finish_reason: 'stop',
				},
			],
			usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await complete(
			mockConfig,
			'gpt-4o',
			'Explain quantum computing in one sentence.'
		)

		expect(result).toBe('Quantum computing uses qubits.')
	})

	test('passes options to chat', async () => {
		const mockResponse = {
			id: 'chatcmpl-opts',
			model: 'gpt-4o',
			choices: [
				{ index: 0, message: { role: 'assistant', content: 'Response' }, finish_reason: 'stop' },
			],
			usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await complete(mockConfig, 'gpt-4o', 'Test', { temperature: 0.5, maxTokens: 50 })

		const body = getRequestBody()
		expect(body?.temperature).toBe(0.5)
		expect(body?.max_tokens).toBe(50)
	})

	test('returns empty string when no content', async () => {
		const mockResponse = {
			id: 'chatcmpl-empty',
			model: 'gpt-4o',
			choices: [
				{ index: 0, message: { role: 'assistant', content: null }, finish_reason: 'stop' },
			],
			usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await complete(mockConfig, 'gpt-4o', 'Test')

		expect(result).toBe('')
	})
})

// ============================================================================
// streamToString Tests
// ============================================================================

describe('streamToString', () => {
	test('collects all stream chunks into a string', async () => {
		const chunks = [
			'data: {"id":"stream","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n',
			'data: {"id":"stream","model":"gpt-4o","choices":[{"index":0,"delta":{"content":" "},"finish_reason":null}]}\n',
			'data: {"id":"stream","model":"gpt-4o","choices":[{"index":0,"delta":{"content":"world"},"finish_reason":null}]}\n',
			'data: {"id":"stream","model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n',
			'data: [DONE]\n',
		]

		const encoder = new TextEncoder()
		const stream = new ReadableStream({
			start(controller) {
				for (const chunk of chunks) {
					controller.enqueue(encoder.encode(chunk))
				}
				controller.close()
			},
		})

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(
				new Response(stream, {
					status: 200,
					headers: { 'Content-Type': 'text/event-stream' },
				})
			)
		}) as typeof fetch

		const result = await streamToString(mockConfig, {
			model: 'gpt-4o',
			messages: [{ role: 'user', content: 'Say hello world' }],
		})

		expect(result).toBe('Hello world')
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
	test('handles different models', async () => {
		const models = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-20250514', 'claude-3-haiku-20240307']

		for (const model of models) {
			const mockResponse = {
				id: `chatcmpl-${model}`,
				model,
				choices: [
					{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' },
				],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			}

			globalThis.fetch = mock((url: string, options: RequestInit) => {
				fetchCalls.push({ url, options })
				return Promise.resolve(createMockResponse(mockResponse))
			}) as typeof fetch

			const result = await chat(mockConfig, {
				model,
				messages: [{ role: 'user', content: 'Hi' }],
			})

			expect(result.model).toBe(model)
		}
	})

	test('handles multimodal content', async () => {
		const mockResponse = {
			id: 'chatcmpl-vision',
			model: 'gpt-4o',
			choices: [
				{
					index: 0,
					message: { role: 'assistant', content: 'I see a cat.' },
					finish_reason: 'stop',
				},
			],
			usage: { prompt_tokens: 100, completion_tokens: 5, total_tokens: 105 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await chat(mockConfig, {
			model: 'gpt-4o',
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'text', text: 'What is in this image?' },
						{ type: 'image_url', image_url: { url: 'https://example.com/cat.jpg' } },
					],
				},
			],
		})

		const body = getRequestBody()
		expect(body?.messages).toHaveLength(1)
		expect(
			(body?.messages as Array<{ content: unknown }>)[0]?.content
		).toHaveLength(2)
	})

	test('handles long conversations', async () => {
		const messages = []
		for (let i = 0; i < 50; i++) {
			messages.push({
				role: i % 2 === 0 ? 'user' : 'assistant',
				content: `Message ${i}`,
			})
		}

		const mockResponse = {
			id: 'chatcmpl-long',
			model: 'gpt-4o',
			choices: [
				{ index: 0, message: { role: 'assistant', content: 'Final' }, finish_reason: 'stop' },
			],
			usage: { prompt_tokens: 500, completion_tokens: 1, total_tokens: 501 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await chat(mockConfig, {
			model: 'gpt-4o',
			messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
		})

		const body = getRequestBody()
		expect((body?.messages as unknown[]).length).toBe(50)
	})

	test('handles tool choice configuration', async () => {
		const mockResponse = {
			id: 'chatcmpl-tool',
			model: 'gpt-4o',
			choices: [
				{
					index: 0,
					message: { role: 'assistant', content: null },
					finish_reason: 'tool_calls',
				},
			],
			usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
		}

		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await chat(mockConfig, {
			model: 'gpt-4o',
			messages: [{ role: 'user', content: 'Test' }],
			tools: [
				{
					type: 'function',
					function: { name: 'my_func', description: 'Test function' },
				},
			],
			toolChoice: { type: 'function', function: { name: 'my_func' } },
		})

		const body = getRequestBody()
		expect(body?.tool_choice).toEqual({ type: 'function', function: { name: 'my_func' } })
	})
})
