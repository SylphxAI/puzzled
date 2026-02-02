/**
 * Search Module Tests
 *
 * Tests for search indexing and querying functions.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { SylphxConfig } from '../src/config'
import {
	batchIndex,
	deleteDocument,
	getFacets,
	getSearchStats,
	indexDocument,
	search,
	trackClick,
	upsertDocument,
} from '../src/search'

// ============================================================================
// Test Setup
// ============================================================================

const mockConfig: SylphxConfig = {
	secretKey: 'sk_dev_test123',
	platformUrl: 'https://api.sylphx.com',
}

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

beforeEach(() => {
	fetchCalls = []
})

afterEach(() => {
	globalThis.fetch = originalFetch
})

// ============================================================================
// indexDocument Tests
// ============================================================================

describe('indexDocument', () => {
	test('indexes a document with all fields', async () => {
		const mockResponse = {
			id: 'doc-123',
			externalId: 'ext-456',
			namespace: 'help-articles',
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await indexDocument(mockConfig, {
			title: 'Password Reset Guide',
			content: 'How to reset your password...',
			namespace: 'help-articles',
			externalId: 'ext-456',
			url: '/help/password-reset',
			metadata: { author: 'admin' },
			category: 'account',
			type: 'guide',
			tags: ['password', 'security'],
		})

		expect(result.id).toBe('doc-123')
		expect(result.namespace).toBe('help-articles')
		expect(getLastCall()?.url).toContain('/search/index')
		expect(getLastCall()?.options.method).toBe('POST')
	})

	test('uses default values for optional fields', async () => {
		const mockResponse = { id: 'doc-123', externalId: null, namespace: 'default' }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await indexDocument(mockConfig, {
			content: 'Simple content',
		})

		const body = getRequestBody()
		expect(body?.namespace).toBe('default')
		expect(body?.language).toBe('english')
		expect(body?.skipEmbedding).toBe(false)
		expect(body?.embeddingModel).toBe('openai/text-embedding-3-small')
	})

	test('allows skipping embedding generation', async () => {
		const mockResponse = { id: 'doc-123', externalId: null, namespace: 'default' }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await indexDocument(mockConfig, {
			content: 'Keyword-only content',
			skipEmbedding: true,
		})

		const body = getRequestBody()
		expect(body?.skipEmbedding).toBe(true)
	})

	test('supports custom embedding model', async () => {
		const mockResponse = { id: 'doc-123', externalId: null, namespace: 'default' }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await indexDocument(mockConfig, {
			content: 'Custom embedding content',
			embeddingModel: 'openai/text-embedding-3-large',
		})

		const body = getRequestBody()
		expect(body?.embeddingModel).toBe('openai/text-embedding-3-large')
	})
})

// ============================================================================
// batchIndex Tests
// ============================================================================

describe('batchIndex', () => {
	test('indexes multiple documents', async () => {
		const mockResponse = {
			indexed: 3,
			ids: ['doc-1', 'doc-2', 'doc-3'],
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await batchIndex(mockConfig, {
			namespace: 'products',
			documents: [
				{ title: 'Product 1', content: 'Description 1', externalId: 'prod-1' },
				{ title: 'Product 2', content: 'Description 2', externalId: 'prod-2' },
				{ title: 'Product 3', content: 'Description 3', externalId: 'prod-3' },
			],
		})

		expect(result.indexed).toBe(3)
		expect(result.ids).toHaveLength(3)
		expect(getLastCall()?.url).toContain('/search/batchIndex')
	})

	test('uses default namespace and language', async () => {
		const mockResponse = { indexed: 1, ids: ['doc-1'] }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await batchIndex(mockConfig, {
			documents: [{ content: 'Test content' }],
		})

		const body = getRequestBody()
		expect(body?.namespace).toBe('default')
		expect(body?.language).toBe('english')
	})
})

// ============================================================================
// search Tests
// ============================================================================

describe('search', () => {
	test('performs hybrid search by default', async () => {
		const mockResponse = {
			results: [
				{
					id: 'doc-1',
					title: 'Password Reset',
					content: 'How to reset...',
					score: 0.95,
					keywordScore: 0.8,
					semanticScore: 0.9,
					highlight: 'How to <mark>reset</mark> your password...',
				},
			],
			total: 1,
			query: 'password reset',
			searchType: 'hybrid',
			latencyMs: 45,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await search(mockConfig, {
			query: 'password reset',
			namespace: 'help',
		})

		expect(result.results).toHaveLength(1)
		expect(result.searchType).toBe('hybrid')
		expect(result.results[0]?.score).toBe(0.95)
		expect(result.results[0]?.highlight).toContain('<mark>reset</mark>')
	})

	test('performs keyword-only search', async () => {
		const mockResponse = {
			results: [],
			total: 0,
			query: 'test',
			searchType: 'keyword',
			latencyMs: 10,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await search(mockConfig, {
			query: 'test',
			searchType: 'keyword',
		})

		const body = getRequestBody()
		expect(body?.searchType).toBe('keyword')
	})

	test('performs semantic-only search', async () => {
		const mockResponse = {
			results: [],
			total: 0,
			query: 'conceptual question',
			searchType: 'semantic',
			latencyMs: 100,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await search(mockConfig, {
			query: 'conceptual question',
			searchType: 'semantic',
			minSimilarity: 0.7,
		})

		const body = getRequestBody()
		expect(body?.searchType).toBe('semantic')
		expect(body?.minSimilarity).toBe(0.7)
	})

	test('applies filters', async () => {
		const mockResponse = {
			results: [],
			total: 0,
			query: 'test',
			searchType: 'hybrid',
			latencyMs: 20,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await search(mockConfig, {
			query: 'test',
			filters: {
				category: 'tutorials',
				type: 'guide',
				tags: ['beginner'],
			},
		})

		const body = getRequestBody()
		expect(body?.filters).toEqual({
			category: 'tutorials',
			type: 'guide',
			tags: ['beginner'],
		})
	})

	test('includes pagination options', async () => {
		const mockResponse = {
			results: [],
			total: 100,
			query: 'test',
			searchType: 'hybrid',
			latencyMs: 15,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await search(mockConfig, {
			query: 'test',
			limit: 20,
			offset: 40,
		})

		const body = getRequestBody()
		expect(body?.limit).toBe(20)
		expect(body?.offset).toBe(40)
	})

	test('tracks query for analytics by default', async () => {
		const mockResponse = {
			results: [],
			total: 0,
			query: 'test',
			searchType: 'hybrid',
			latencyMs: 10,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await search(mockConfig, {
			query: 'test',
			sessionId: 'session-123',
			userId: 'user-456',
		})

		const body = getRequestBody()
		expect(body?.trackQuery).toBe(true)
		expect(body?.sessionId).toBe('session-123')
		expect(body?.userId).toBe('user-456')
	})

	test('can disable query tracking', async () => {
		const mockResponse = {
			results: [],
			total: 0,
			query: 'test',
			searchType: 'hybrid',
			latencyMs: 10,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await search(mockConfig, {
			query: 'test',
			trackQuery: false,
		})

		const body = getRequestBody()
		expect(body?.trackQuery).toBe(false)
	})
})

// ============================================================================
// getFacets Tests
// ============================================================================

describe('getFacets', () => {
	test('returns facet counts', async () => {
		const mockResponse = {
			facets: {
				category: [
					{ value: 'tutorials', count: 25 },
					{ value: 'guides', count: 15 },
				],
				type: [
					{ value: 'article', count: 30 },
					{ value: 'video', count: 10 },
				],
			},
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getFacets(mockConfig, {
			namespace: 'help',
			facets: ['category', 'type'],
		})

		expect(result.facets.category).toHaveLength(2)
		expect(result.facets.type).toHaveLength(2)
		expect(getLastCall()?.url).toContain('/search/getFacets')
	})

	test('uses default facets', async () => {
		const mockResponse = { facets: { category: [], type: [] } }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await getFacets(mockConfig)

		const body = getRequestBody()
		expect(body?.facets).toEqual(['category', 'type'])
		expect(body?.namespace).toBe('default')
	})
})

// ============================================================================
// deleteDocument Tests
// ============================================================================

describe('deleteDocument', () => {
	test('deletes document by internal ID', async () => {
		const mockResponse = { deleted: 1 }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await deleteDocument(mockConfig, {
			id: 'doc-123',
		})

		expect(result.deleted).toBe(1)
		expect(getLastCall()?.url).toContain('/search/delete')
		const body = getRequestBody()
		expect(body?.id).toBe('doc-123')
	})

	test('deletes document by external ID', async () => {
		const mockResponse = { deleted: 1 }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await deleteDocument(mockConfig, {
			externalId: 'ext-456',
			namespace: 'products',
		})

		expect(result.deleted).toBe(1)
		const body = getRequestBody()
		expect(body?.externalId).toBe('ext-456')
		expect(body?.namespace).toBe('products')
	})

	test('returns 0 when document not found', async () => {
		const mockResponse = { deleted: 0 }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await deleteDocument(mockConfig, {
			id: 'nonexistent',
		})

		expect(result.deleted).toBe(0)
	})
})

// ============================================================================
// upsertDocument Tests
// ============================================================================

describe('upsertDocument', () => {
	test('creates new document on upsert', async () => {
		const mockResponse = {
			id: 'doc-new',
			externalId: 'product-123',
			namespace: 'products',
			created: true,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await upsertDocument(mockConfig, {
			externalId: 'product-123',
			title: 'New Product',
			content: 'Product description',
			namespace: 'products',
		})

		expect(result.created).toBe(true)
		expect(result.externalId).toBe('product-123')
		expect(getLastCall()?.url).toContain('/search/upsert')
	})

	test('updates existing document on upsert', async () => {
		const mockResponse = {
			id: 'doc-existing',
			externalId: 'product-123',
			namespace: 'products',
			created: false,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await upsertDocument(mockConfig, {
			externalId: 'product-123',
			title: 'Updated Product',
			content: 'Updated description',
			namespace: 'products',
		})

		expect(result.created).toBe(false)
	})
})

// ============================================================================
// getSearchStats Tests
// ============================================================================

describe('getSearchStats', () => {
	test('returns index statistics', async () => {
		const mockResponse = {
			totalDocuments: 1500,
			documentsWithEmbedding: 1200,
			byNamespace: [
				{ namespace: 'products', count: 800 },
				{ namespace: 'help', count: 500 },
				{ namespace: 'default', count: 200 },
			],
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await getSearchStats(mockConfig)

		expect(result.totalDocuments).toBe(1500)
		expect(result.documentsWithEmbedding).toBe(1200)
		expect(result.byNamespace).toHaveLength(3)
		expect(getLastCall()?.url).toContain('/search/getStats')
	})

	test('filters by namespace', async () => {
		const mockResponse = {
			totalDocuments: 800,
			documentsWithEmbedding: 800,
			byNamespace: [{ namespace: 'products', count: 800 }],
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await getSearchStats(mockConfig, 'products')

		const body = getRequestBody()
		expect(body?.namespace).toBe('products')
	})
})

// ============================================================================
// trackClick Tests
// ============================================================================

describe('trackClick', () => {
	test('tracks search result click', async () => {
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse({ success: true }))
		}) as typeof fetch

		const result = await trackClick(mockConfig, {
			queryId: 'query-123',
			documentId: 'doc-456',
			position: 3,
		})

		expect(result.success).toBe(true)
		expect(getLastCall()?.url).toContain('/search/trackClick')
		const body = getRequestBody()
		expect(body?.queryId).toBe('query-123')
		expect(body?.documentId).toBe('doc-456')
		expect(body?.position).toBe(3)
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
	test('handles empty search results', async () => {
		const mockResponse = {
			results: [],
			total: 0,
			query: 'nonexistent query',
			searchType: 'hybrid',
			latencyMs: 5,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const result = await search(mockConfig, {
			query: 'nonexistent query',
		})

		expect(result.results).toHaveLength(0)
		expect(result.total).toBe(0)
	})

	test('handles special characters in search query', async () => {
		const mockResponse = {
			results: [],
			total: 0,
			query: 'C++ "programming language"',
			searchType: 'hybrid',
			latencyMs: 10,
		}
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await search(mockConfig, {
			query: 'C++ "programming language"',
		})

		const body = getRequestBody()
		expect(body?.query).toBe('C++ "programming language"')
	})

	test('handles very long content', async () => {
		const mockResponse = { id: 'doc-long', externalId: null, namespace: 'default' }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		const longContent = 'A'.repeat(10000)

		await indexDocument(mockConfig, {
			content: longContent,
		})

		const body = getRequestBody()
		expect(body?.content).toBe(longContent)
	})

	test('handles metadata with nested objects', async () => {
		const mockResponse = { id: 'doc-meta', externalId: null, namespace: 'default' }
		globalThis.fetch = mock((url: string, options: RequestInit) => {
			fetchCalls.push({ url, options })
			return Promise.resolve(createMockResponse(mockResponse))
		}) as typeof fetch

		await indexDocument(mockConfig, {
			content: 'Test content',
			metadata: {
				author: { name: 'John', id: 123 },
				tags: ['a', 'b'],
				stats: { views: 100, likes: 50 },
			},
		})

		const body = getRequestBody()
		expect(body?.metadata).toEqual({
			author: { name: 'John', id: 123 },
			tags: ['a', 'b'],
			stats: { views: 100, likes: 50 },
		})
	})

	test('handles different languages', async () => {
		const languages = ['english', 'french', 'german', 'spanish', 'japanese']

		for (const language of languages) {
			fetchCalls = []
			const mockResponse = { id: `doc-${language}`, externalId: null, namespace: 'default' }
			globalThis.fetch = mock((url: string, options: RequestInit) => {
				fetchCalls.push({ url, options })
				return Promise.resolve(createMockResponse(mockResponse))
			}) as typeof fetch

			await indexDocument(mockConfig, {
				content: `Content in ${language}`,
				language,
			})

			const body = getRequestBody()
			expect(body?.language).toBe(language)
		}
	})
})
