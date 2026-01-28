/**
 * Vector Search SDK
 *
 * Semantic search powered by pgvector.
 * Index documents, search by meaning, not just keywords.
 *
 * @example
 * ```typescript
 * import { createConfig, indexDocument, search, batchIndex } from '@sylphx/sdk'
 *
 * const config = createConfig({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 * })
 *
 * // Index a document
 * await indexDocument(config, {
 *   content: 'How to reset your password...',
 *   namespace: 'help-articles',
 *   metadata: { category: 'account', language: 'en' }
 * })
 *
 * // Search semantically
 * const results = await search(config, {
 *   query: 'forgot my login credentials',
 *   namespace: 'help-articles',
 *   limit: 5
 * })
 *
 * results.forEach(r => console.log(r.content, r.similarity))
 * ```
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types
// ============================================================================

export interface IndexDocumentInput {
	/** Document content to embed and store */
	content: string
	/** Namespace for data isolation (e.g., 'products', 'articles') */
	namespace?: string
	/** External document ID (your system's ID) */
	externalId?: string
	/** Optional metadata for filtering */
	metadata?: Record<string, unknown>
	/** Embedding model to use (default: openai/text-embedding-3-small) */
	model?: string
}

export interface IndexDocumentResult {
	/** Generated document ID */
	id: string
	/** External ID if provided */
	externalId: string | null
	/** Namespace */
	namespace: string
}

export interface BatchIndexInput {
	/** Documents to index */
	documents: Array<{
		content: string
		externalId?: string
		metadata?: Record<string, unknown>
	}>
	/** Namespace for all documents */
	namespace?: string
	/** Embedding model to use */
	model?: string
}

export interface BatchIndexResult {
	/** Number of documents indexed */
	indexed: number
	/** Generated document IDs */
	ids: string[]
}

export interface SearchInput {
	/** Search query text */
	query: string
	/** Namespace to search within */
	namespace?: string
	/** Maximum results to return (default: 10, max: 100) */
	limit?: number
	/** Minimum similarity threshold (0-1) */
	similarityThreshold?: number
	/** Filter by metadata fields */
	filter?: Record<string, unknown>
	/** Include content in results (default: true) */
	includeContent?: boolean
	/** Include metadata in results (default: true) */
	includeMetadata?: boolean
	/** Embedding model to use */
	model?: string
}

export interface SearchResult {
	/** Document ID */
	id: string
	/** External ID if set */
	externalId: string | null
	/** Document content (if includeContent is true) */
	content?: string
	/** Document metadata (if includeMetadata is true) */
	metadata?: Record<string, unknown>
	/** Similarity score (0-1, higher is more similar) */
	similarity: number
}

export interface SearchResponse {
	/** Search results */
	results: SearchResult[]
	/** Total results found */
	total: number
	/** Query processing time in ms */
	processingTimeMs: number
}

export interface DeleteDocumentInput {
	/** Document ID to delete */
	id?: string
	/** Or delete by external ID */
	externalId?: string
	/** Namespace (required if using externalId) */
	namespace?: string
}

export interface SearchStatsResult {
	/** Total documents indexed */
	totalDocuments: number
	/** Documents by namespace */
	byNamespace: Array<{ namespace: string; count: number }>
	/** Storage used in bytes */
	storageBytes: number
}

export interface ListDocumentsResult {
	documents: Array<{
		id: string
		externalId: string | null
		metadata: Record<string, unknown> | null
		createdAt: string
	}>
	nextCursor: string | null
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Index a document for semantic search.
 *
 * The document content is embedded using the specified model
 * and stored with optional metadata for filtering.
 *
 * @param config - SDK configuration
 * @param input - Document to index
 * @returns Indexed document info
 *
 * @example
 * ```typescript
 * // Index a help article
 * const result = await indexDocument(config, {
 *   content: article.body,
 *   namespace: 'help',
 *   externalId: article.id,
 *   metadata: {
 *     title: article.title,
 *     category: article.category,
 *     publishedAt: article.publishedAt,
 *   }
 * })
 * ```
 */
export async function indexDocument(
	config: SylphxConfig,
	input: IndexDocumentInput,
): Promise<IndexDocumentResult> {
	return callApi<IndexDocumentResult>(config, '/search/index', {
		method: 'POST',
		body: {
			content: input.content,
			namespace: input.namespace ?? 'default',
			externalId: input.externalId,
			metadata: input.metadata,
			model: input.model ?? 'openai/text-embedding-3-small',
		},
	})
}

/**
 * Index multiple documents in a single batch.
 *
 * More efficient than multiple indexDocument calls.
 * Max 100 documents per batch.
 *
 * @param config - SDK configuration
 * @param input - Documents to index
 * @returns Batch index result
 *
 * @example
 * ```typescript
 * // Index all products
 * const result = await batchIndex(config, {
 *   namespace: 'products',
 *   documents: products.map(p => ({
 *     content: `${p.name} ${p.description}`,
 *     externalId: p.id,
 *     metadata: { price: p.price, category: p.category }
 *   }))
 * })
 * console.log(`Indexed ${result.indexed} products`)
 * ```
 */
export async function batchIndex(
	config: SylphxConfig,
	input: BatchIndexInput,
): Promise<BatchIndexResult> {
	return callApi<BatchIndexResult>(config, '/search/batchIndex', {
		method: 'POST',
		body: {
			documents: input.documents,
			namespace: input.namespace ?? 'default',
			model: input.model ?? 'openai/text-embedding-3-small',
		},
	})
}

/**
 * Search documents by semantic similarity.
 *
 * Uses vector embeddings to find documents by meaning,
 * not just keyword matching.
 *
 * @param config - SDK configuration
 * @param input - Search query and options
 * @returns Search results with similarity scores
 *
 * @example
 * ```typescript
 * // Search help articles
 * const results = await search(config, {
 *   query: 'how do I change my email address',
 *   namespace: 'help',
 *   limit: 5,
 *   filter: { language: 'en' }
 * })
 *
 * results.results.forEach(r => {
 *   console.log(`[${r.similarity.toFixed(2)}] ${r.content?.slice(0, 100)}...`)
 * })
 * ```
 */
export async function search(config: SylphxConfig, input: SearchInput): Promise<SearchResponse> {
	return callApi<SearchResponse>(config, '/search/query', {
		method: 'POST',
		body: {
			query: input.query,
			namespace: input.namespace ?? 'default',
			limit: input.limit ?? 10,
			similarityThreshold: input.similarityThreshold,
			filter: input.filter,
			includeContent: input.includeContent ?? true,
			includeMetadata: input.includeMetadata ?? true,
			model: input.model ?? 'openai/text-embedding-3-small',
		},
	})
}

/**
 * Delete a document from the search index.
 *
 * @param config - SDK configuration
 * @param input - Document ID or external ID
 * @returns true if deleted
 *
 * @example
 * ```typescript
 * // Delete by internal ID
 * await deleteDocument(config, { id: 'doc-uuid-123' })
 *
 * // Delete by external ID
 * await deleteDocument(config, {
 *   externalId: 'article-456',
 *   namespace: 'help'
 * })
 * ```
 */
export async function deleteDocument(
	config: SylphxConfig,
	input: DeleteDocumentInput,
): Promise<{ success: boolean }> {
	return callApi<{ success: boolean }>(config, '/search/delete', {
		method: 'POST',
		body: {
			id: input.id,
			externalId: input.externalId,
			namespace: input.namespace ?? 'default',
		},
	})
}

/**
 * Get search index statistics.
 *
 * @param config - SDK configuration
 * @returns Index statistics
 *
 * @example
 * ```typescript
 * const stats = await getSearchStats(config)
 * console.log(`Total docs: ${stats.totalDocuments}`)
 * stats.byNamespace.forEach(ns => {
 *   console.log(`  ${ns.namespace}: ${ns.count} docs`)
 * })
 * ```
 */
export async function getSearchStats(config: SylphxConfig): Promise<SearchStatsResult> {
	return callApi<SearchStatsResult>(config, '/search/stats', { method: 'GET' })
}

/**
 * List all documents in a namespace.
 *
 * @param config - SDK configuration
 * @param namespace - Namespace to list
 * @param options - Pagination options
 * @returns List of documents
 */
export async function listDocuments(
	config: SylphxConfig,
	namespace: string = 'default',
	options: { limit?: number; cursor?: string } = {},
): Promise<ListDocumentsResult> {
	return callApi<ListDocumentsResult>(config, '/search/documents', {
		method: 'GET',
		query: {
			namespace,
			limit: options.limit ?? 50,
			cursor: options.cursor,
		},
	})
}
