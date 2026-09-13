import { afterEach, describe, expect, test } from 'bun:test'
import { type AIResponse, aiResponseText, getAI } from './ai'

const originalFetch = globalThis.fetch

const MODELS_DOOR = 'https://api.models.sylphx.ai/v1'
const SERVICE_KEY = 'sk-sx-test-puzzled'

function stubFetch(status: number, body: unknown) {
	const calls: Array<{ url: string; init: RequestInit }> = []
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url: String(url), init: init ?? {} })
		return {
			ok: status >= 200 && status < 300,
			status,
			text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
		} as Response
	}) as typeof fetch
	return calls
}

describe('Models door AI client (official Responses document)', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch
		delete process.env.AI_API_ORIGIN
		delete process.env.AI_API_KEY
	})

	test('posts the official Responses document to {origin}/responses', async () => {
		process.env.AI_API_ORIGIN = MODELS_DOOR
		process.env.AI_API_KEY = SERVICE_KEY
		const calls = stubFetch(200, {
			id: 'resp_a',
			object: 'response',
			model: 'x-ai/grok-4.1-fast',
			output: [],
			usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
		})

		await getAI().createResponse({
			model: 'x-ai/grok-4.1-fast',
			instructions: 'Return JSON only.',
			input: 'Generate a connections puzzle.',
			max_output_tokens: 1000,
			temperature: 0.8,
		})

		expect(calls).toHaveLength(1)
		const [call] = calls
		expect(call!.url).toBe(`${MODELS_DOOR}/responses`)
		expect(call!.init.method).toBe('POST')
		const headers = call!.init.headers as Record<string, string>
		expect(headers.Authorization).toBe(`Bearer ${SERVICE_KEY}`)
		expect(headers['content-type']).toBe('application/json')
		expect(Object.keys(headers).some((name) => name.toLowerCase().includes('binding'))).toBe(false)
		// Exact wire document: official Responses keys only. Chat Completions
		// names (`messages`, `max_tokens`, `choices`) never appear.
		expect(JSON.parse(String(call!.init.body))).toEqual({
			model: 'x-ai/grok-4.1-fast',
			instructions: 'Return JSON only.',
			input: 'Generate a connections puzzle.',
			max_output_tokens: 1000,
			temperature: 0.8,
		})
	})

	test('accepts message-item input and posts it unchanged', async () => {
		process.env.AI_API_ORIGIN = MODELS_DOOR
		process.env.AI_API_KEY = SERVICE_KEY
		const calls = stubFetch(200, { id: 'resp_b', output: [] })

		await getAI().createResponse({
			model: 'openai/gpt-5.5',
			input: [{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }],
		})

		expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
			model: 'openai/gpt-5.5',
			input: [{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }],
		})
	})

	test('maps a non-streaming Responses document to visible text and usage', async () => {
		const response: AIResponse = {
			id: 'resp_c',
			object: 'response',
			model: 'x-ai/grok-4.1-fast',
			status: 'completed',
			output: [
				{ type: 'reasoning', content: [{ type: 'reasoning_text', text: 'private' }] },
				{
					type: 'message',
					role: 'assistant',
					content: [
						{ type: 'output_text', text: '{"categories":' },
						{ type: 'output_text', text: '[{"name":"a","words":[]}]}' },
					],
				},
			],
			usage: { input_tokens: 42, output_tokens: 17, total_tokens: 59 },
		}
		const calls = stubFetch(200, response)
		process.env.AI_API_ORIGIN = MODELS_DOOR
		process.env.AI_API_KEY = SERVICE_KEY

		const returned = await getAI().createResponse({
			model: 'x-ai/grok-4.1-fast',
			input: 'go',
			max_output_tokens: 1000,
		})

		expect(calls).toHaveLength(1)
		expect(aiResponseText(returned)).toBe('{"categories":[{"name":"a","words":[]}]}')
		expect(returned.usage).toEqual({ input_tokens: 42, output_tokens: 17, total_tokens: 59 })
		expect(returned.model).toBe('x-ai/grok-4.1-fast')
	})

	test('returns empty text when the model produced no output_text', () => {
		expect(aiResponseText({ output: [] })).toBe('')
		expect(aiResponseText({ output: [{ type: 'function_call', content: [] }] })).toBe('')
	})

	test('surfaces the door error envelope and never falls back to a retired path', async () => {
		process.env.AI_API_ORIGIN = MODELS_DOOR
		process.env.AI_API_KEY = SERVICE_KEY
		const calls = stubFetch(404, {
			error: { code: 'chat_completions_retired', message: 'Use POST /v1/responses.' },
		})

		await expect(getAI().createResponse({ model: 'openai/gpt-5.5', input: 'hi' })).rejects.toThrow(
			'/responses 404',
		)
		expect(calls.map((call) => new URL(call.url).pathname)).toEqual(['/v1/responses'])
	})

	test('lists models from GET {origin}/models with the product credential', async () => {
		process.env.AI_API_ORIGIN = MODELS_DOOR
		process.env.AI_API_KEY = SERVICE_KEY
		// Door document: {object:"list", data:[row...], models:[codex rows]}
		const calls = stubFetch(200, {
			object: 'list',
			data: [
				{
					id: 'openai/gpt-5.5',
					object: 'model',
					display_name: 'GPT-5.5',
					context_window: 400000,
					max_context_window: 400000,
					pricing: {
						prompt: 1.25,
						completion: 10,
						currency: 'USD',
						unit: 'usd_per_million_tokens',
					},
					supports_search_tool: true,
				},
			],
			models: [],
		})

		const listed = await getAI().listModels()

		expect(calls[0]!.url).toBe(`${MODELS_DOOR}/models`)
		expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe(
			`Bearer ${SERVICE_KEY}`,
		)
		expect(listed.data[0]!.id).toBe('openai/gpt-5.5')
		expect(listed.data[0]!.display_name).toBe('GPT-5.5')
		expect(listed.data[0]!.context_window).toBe(400000)
	})
})
