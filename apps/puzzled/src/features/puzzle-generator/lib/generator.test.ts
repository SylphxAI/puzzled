import { afterEach, describe, expect, test } from 'bun:test'
import { generateConnectionsPuzzle } from './generator'
import { CONNECTIONS_SYSTEM_PROMPT, CONNECTIONS_USER_PROMPT } from './prompts/connections'

const originalFetch = globalThis.fetch
const originalConsole = { log: console.log, warn: console.warn, error: console.error }

const MODELS_DOOR = 'https://api.models.sylphx.ai/v1'

describe('puzzle generator requests (Models door Responses document)', () => {
	afterEach(() => {
		globalThis.fetch = originalFetch
		console.log = originalConsole.log
		console.warn = originalConsole.warn
		console.error = originalConsole.error
		delete process.env.AI_API_ORIGIN
		delete process.env.AI_API_KEY
	})

	test('maps the chat-shaped config onto the official Responses document', async () => {
		process.env.AI_API_ORIGIN = MODELS_DOOR
		process.env.AI_API_KEY = 'sk-sx-test-puzzled'
		console.log = () => {}
		console.warn = () => {}
		console.error = () => {}
		const calls: Array<{ url: string; init: RequestInit }> = []
		globalThis.fetch = (async (url: string, init?: RequestInit) => {
			calls.push({ url: String(url), init: init ?? {} })
			return {
				ok: true,
				status: 200,
				text: async () =>
					JSON.stringify({
						id: 'resp_gen',
						object: 'response',
						model: 'x-ai/grok-4.1-fast',
						output: [
							{
								type: 'message',
								role: 'assistant',
								content: [{ type: 'output_text', text: 'not json' }],
							},
						],
						usage: { input_tokens: 9, output_tokens: 2, total_tokens: 11 },
					}),
			} as Response
		}) as typeof fetch

		const result = await generateConnectionsPuzzle('2026-09-12', {
			model: 'x-ai/grok-4.1-fast',
			retries: 1,
		})

		expect(calls).toHaveLength(1)
		expect(calls[0]!.url).toBe(`${MODELS_DOOR}/responses`)
		expect(calls[0]!.init.method).toBe('POST')
		expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
			model: 'x-ai/grok-4.1-fast',
			instructions: CONNECTIONS_SYSTEM_PROMPT,
			input: CONNECTIONS_USER_PROMPT,
			max_output_tokens: 1000,
			temperature: 0.8,
		})
		// The Responses reply is read from output_text; a non-JSON body is a
		// parse failure for that attempt, not a silent empty puzzle.
		expect(result.valid).toBe(false)
		expect(result.errors).toEqual(['Failed to parse LLM response as JSON'])
	})
})
