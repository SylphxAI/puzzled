import { describe, expect, test } from 'bun:test'
import { adminModelCatalog } from './model-catalog'

// Door-shaped fixture: `GET /models` rows carry display_name/context_window
// and USD-per-million numeric pricing; a pair of non-priority providers must
// not break the sort (the legacy `name`/`context_length` assumptions did).
const DOOR_LIST = {
	object: 'list',
	data: [
		{
			id: 'openai/gpt-5.5',
			object: 'model',
			owned_by: 'sylphx',
			display_name: 'GPT-5.5',
			availability: 'operational',
			context_window: 400000,
			max_context_window: 400000,
			pricing: {
				prompt: 1.25,
				completion: 10,
				cache_read: 0.125,
				currency: 'USD',
				unit: 'usd_per_million_tokens',
			},
			supports_search_tool: true,
			supports_reasoning_summary_parameter: true,
			supports_parallel_tool_calls: true,
		},
		{
			id: 'x-ai/grok-4.1-fast',
			object: 'model',
			display_name: 'Grok 4.1 Fast',
			context_window: 2000000,
			pricing: { prompt: 0.2, completion: 0.5, currency: 'USD', unit: 'usd_per_million_tokens' },
		},
		{
			id: 'zhipu/glm-5',
			object: 'model',
			display_name: 'GLM 5',
			context_window: 128000,
			pricing: { prompt: 0.3, completion: 1.2, currency: 'USD', unit: 'usd_per_million_tokens' },
		},
		{
			id: 'openai/text-embedding-4',
			object: 'model',
			context_window: 8192,
		},
	],
	models: [],
}

describe('admin model catalog (Models door document)', () => {
	test('maps door rows to the admin shape without legacy fields', () => {
		const models = adminModelCatalog(DOOR_LIST)

		// Priority providers (openai here) first in catalog order, then the rest
		// by display name; the embedding row keeps the priority provider label.
		expect(models.map((model) => model.id)).toEqual([
			'openai/gpt-5.5',
			'openai/text-embedding-4',
			'zhipu/glm-5',
			'x-ai/grok-4.1-fast',
		])
		expect(models[0]).toEqual({
			id: 'openai/gpt-5.5',
			name: 'GPT-5.5',
			contextLength: 400000,
			pricing: { prompt: 1.25, completion: 10 },
			capabilities: { search: true, parallelToolCalls: true, reasoningSummary: true },
		})
		// Pricing stays in the door unit (USD per 1M tokens) — no legacy
		// per-token -> per-1M multiplication.
		const grok = models.find((model) => model.id === 'x-ai/grok-4.1-fast')!
		expect(grok.pricing).toEqual({ prompt: 0.2, completion: 0.5 })
		const embedding = models.find((model) => model.id === 'openai/text-embedding-4')!
		expect(embedding.name).toBe('openai/text-embedding-4')
		expect(embedding.contextLength).toBe(8192)
		expect(embedding.pricing).toEqual({ prompt: null, completion: null })
	})

	test('sorts non-priority providers by display name without throwing', () => {
		const models = adminModelCatalog({
			data: [
				{ id: 'b-vendor/bb', display_name: 'Bravo' },
				{ id: 'a-vendor/aa', display_name: 'Alpha' },
			],
		})
		expect(models.map((model) => model.name)).toEqual(['Alpha', 'Bravo'])
	})

	test('skips rows without an id', () => {
		expect(adminModelCatalog({ data: [{ id: '' }, { id: 'x/y' }] })).toHaveLength(1)
	})

	test('tolerates an empty catalog', () => {
		expect(adminModelCatalog({ data: [] })).toEqual([])
	})
})
