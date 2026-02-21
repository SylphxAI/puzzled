/**
 * Search SDK
 *
 * State-of-the-art search with full-text, semantic, and hybrid modes.
 * Powered by PostgreSQL tsvector + pgvector.
 *
 * @example
 * ```typescript
 * import { createConfig, indexDocument, search, batchIndex } from '@sylphx/sdk'
 *
 * const config = createConfig({
 *   secretKey: process.env.SYLPHX_SECRET_KEY!,
 * })
 *
 * // Index a document
 * await indexDocument(config, {
 *   content: 'How to reset your password...',
 *   title: 'Password Reset Guide',
 *   namespace: 'help-articles',
 *   category: 'account',
 *   tags: ['password', 'security'],
 * })
 *
 * // Search (hybrid mode by default)
 * const results = await search(config, {
 *   query: 'forgot my login credentials',
 *   namespace: 'help-articles',
 *   searchType: 'hybrid',
 *   highlight: true,
 * })
 *
 * results.results.forEach(r => console.log(r.title, r.score, r.highlight))
 * ```
 */

import { type SylphxConfig, callApi } from "./config";

// ============================================================================
// Types
// ============================================================================

export interface IndexDocumentInput {
	/** Document title (weighted higher in search) */
	title?: string;
	/** Document content to index */
	content: string;
	/** Namespace for data isolation (e.g., 'products', 'articles') */
	namespace?: string;
	/** External document ID (your system's ID) */
	externalId?: string;
	/** URL or path */
	url?: string;
	/** Searchable metadata */
	metadata?: Record<string, unknown>;
	/** Category facet for filtering */
	category?: string;
	/** Type facet for filtering */
	type?: string;
	/** Tags facet for filtering */
	tags?: string[];
	/** Language for full-text search (default: english) */
	language?: string;
	/** Skip embedding generation (for keyword-only search) */
	skipEmbedding?: boolean;
	/** Embedding model to use */
	embeddingModel?: string;
}

export interface IndexDocumentResult {
	/** Generated document ID */
	id: string;
	/** External ID if provided */
	externalId: string | null;
	/** Namespace */
	namespace: string;
}

export interface BatchIndexInput {
	/** Documents to index (max 100) */
	documents: Array<{
		title?: string;
		content: string;
		externalId?: string;
		url?: string;
		metadata?: Record<string, unknown>;
		category?: string;
		type?: string;
		tags?: string[];
	}>;
	/** Namespace for all documents */
	namespace?: string;
	/** Language for full-text search */
	language?: string;
	/** Skip embedding generation */
	skipEmbedding?: boolean;
	/** Embedding model to use */
	embeddingModel?: string;
}

export interface BatchIndexResult {
	/** Number of documents indexed */
	indexed: number;
	/** Generated document IDs */
	ids: string[];
}

export type SearchType = "keyword" | "semantic" | "hybrid";

export interface SearchInput {
	/** Search query text */
	query: string;
	/** Namespace to search within */
	namespace?: string;
	/** Search type: keyword, semantic, or hybrid (default) */
	searchType?: SearchType;
	/** Maximum results to return (default: 10, max: 100) */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
	/** Minimum similarity threshold (0-1) for semantic search */
	minSimilarity?: number;
	/** Enable typo tolerance (default: true) */
	typoTolerance?: boolean;
	/** Language for full-text search */
	language?: string;
	/** Facet filters */
	filters?: {
		category?: string;
		type?: string;
		tags?: string[];
		metadata?: Record<string, unknown>;
	};
	/** Include highlighted snippets (default: true) */
	highlight?: boolean;
	/** Embedding model for semantic search */
	embeddingModel?: string;
	/** Track this query for analytics (default: true) */
	trackQuery?: boolean;
	/** Session ID for analytics */
	sessionId?: string;
	/** User ID for analytics */
	userId?: string;
}

export interface SearchResultItem {
	/** Document ID */
	id: string;
	/** External ID if set */
	externalId: string | null;
	/** Document title */
	title: string | null;
	/** Document content */
	content: string;
	/** Document URL */
	url: string | null;
	/** Document metadata */
	metadata: Record<string, unknown> | null;
	/** Category facet */
	category: string | null;
	/** Type facet */
	type: string | null;
	/** Tags facet */
	tags: string[] | null;
	/** Combined score */
	score: number;
	/** Keyword search score (if hybrid) */
	keywordScore?: number;
	/** Semantic search score (if hybrid) */
	semanticScore?: number;
	/** Highlighted snippet (if enabled) */
	highlight?: string;
}

export interface SearchResponse {
	/** Search results */
	results: SearchResultItem[];
	/** Total results found */
	total: number;
	/** Original query */
	query: string;
	/** Search type used */
	searchType: SearchType;
	/** Query processing time in ms */
	latencyMs: number;
}

export interface GetFacetsInput {
	/** Namespace to get facets from */
	namespace?: string;
	/** Facets to retrieve */
	facets?: Array<"category" | "type" | "tags">;
	/** Filter facets by category or type */
	filters?: {
		category?: string;
		type?: string;
	};
}

export interface FacetsResponse {
	facets: {
		category?: Array<{ value: string; count: number }>;
		type?: Array<{ value: string; count: number }>;
		tags?: Array<{ value: string; count: number }>;
	};
}

export interface DeleteDocumentInput {
	/** Document ID to delete */
	id?: string;
	/** Or delete by external ID */
	externalId?: string;
	/** Namespace (required if using externalId) */
	namespace?: string;
}

export interface UpsertDocumentInput extends IndexDocumentInput {
	/** External ID is required for upsert */
	externalId: string;
}

export interface UpsertDocumentResult extends IndexDocumentResult {
	/** Whether the document was created (true) or updated (false) */
	created: boolean;
}

export interface SearchStatsResult {
	/** Total documents indexed */
	totalDocuments: number;
	/** Documents with embeddings */
	documentsWithEmbedding: number;
	/** Documents by namespace */
	byNamespace: Array<{ namespace: string; count: number }>;
}

export interface TrackClickInput {
	/** Search query ID */
	queryId: string;
	/** Clicked document ID */
	documentId: string;
	/** Position in results (1-indexed) */
	position: number;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Index a document for search.
 *
 * Automatically generates tsvector for full-text search and
 * optional embedding for semantic search.
 *
 * @param config - SDK configuration
 * @param input - Document to index
 * @returns Indexed document info
 *
 * @example
 * ```typescript
 * const result = await indexDocument(config, {
 *   title: 'Getting Started Guide',
 *   content: 'Welcome to our platform...',
 *   namespace: 'docs',
 *   category: 'tutorials',
 *   tags: ['beginner', 'setup'],
 * })
 * ```
 */
export async function indexDocument(
	config: SylphxConfig,
	input: IndexDocumentInput,
): Promise<IndexDocumentResult> {
	return callApi<IndexDocumentResult>(config, "/search/index", {
		method: "POST",
		body: {
			title: input.title,
			content: input.content,
			namespace: input.namespace ?? "default",
			externalId: input.externalId,
			url: input.url,
			metadata: input.metadata,
			category: input.category,
			type: input.type,
			tags: input.tags,
			language: input.language ?? "english",
			skipEmbedding: input.skipEmbedding ?? false,
			embeddingModel: input.embeddingModel ?? "openai/text-embedding-3-small",
		},
	});
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
 * const result = await batchIndex(config, {
 *   namespace: 'products',
 *   documents: products.map(p => ({
 *     title: p.name,
 *     content: p.description,
 *     externalId: p.id,
 *     category: p.category,
 *   }))
 * })
 * console.log(`Indexed ${result.indexed} products`)
 * ```
 */
export async function batchIndex(
	config: SylphxConfig,
	input: BatchIndexInput,
): Promise<BatchIndexResult> {
	return callApi<BatchIndexResult>(config, "/search/batchIndex", {
		method: "POST",
		body: {
			documents: input.documents,
			namespace: input.namespace ?? "default",
			language: input.language ?? "english",
			skipEmbedding: input.skipEmbedding ?? false,
			embeddingModel: input.embeddingModel ?? "openai/text-embedding-3-small",
		},
	});
}

/**
 * Search documents.
 *
 * Supports three search modes:
 * - `keyword`: Full-text search with typo tolerance
 * - `semantic`: AI-powered vector search
 * - `hybrid`: Combined ranking (default, best results)
 *
 * @param config - SDK configuration
 * @param input - Search query and options
 * @returns Search results with scores
 *
 * @example
 * ```typescript
 * // Hybrid search (recommended)
 * const results = await search(config, {
 *   query: 'how to change email address',
 *   namespace: 'help',
 *   searchType: 'hybrid',
 *   highlight: true,
 * })
 *
 * results.results.forEach(r => {
 *   console.log(`[${r.score.toFixed(3)}] ${r.title}`)
 *   console.log(r.highlight)
 * })
 * ```
 */
export async function search(
	config: SylphxConfig,
	input: SearchInput,
): Promise<SearchResponse> {
	return callApi<SearchResponse>(config, "/search/search", {
		method: "POST",
		body: {
			query: input.query,
			namespace: input.namespace ?? "default",
			searchType: input.searchType ?? "hybrid",
			limit: input.limit ?? 10,
			offset: input.offset ?? 0,
			minSimilarity: input.minSimilarity,
			typoTolerance: input.typoTolerance ?? true,
			language: input.language ?? "english",
			filters: input.filters,
			highlight: input.highlight ?? true,
			embeddingModel: input.embeddingModel ?? "openai/text-embedding-3-small",
			trackQuery: input.trackQuery ?? true,
			sessionId: input.sessionId,
			userId: input.userId,
		},
	});
}

/**
 * Get facet counts for filtering.
 *
 * Returns counts of documents by category, type, and tags.
 *
 * @param config - SDK configuration
 * @param input - Facet options
 * @returns Facet counts
 *
 * @example
 * ```typescript
 * const facets = await getFacets(config, {
 *   namespace: 'products',
 *   facets: ['category', 'type'],
 * })
 *
 * facets.facets.category?.forEach(f => {
 *   console.log(`${f.value}: ${f.count} products`)
 * })
 * ```
 */
export async function getFacets(
	config: SylphxConfig,
	input: GetFacetsInput = {},
): Promise<FacetsResponse> {
	return callApi<FacetsResponse>(config, "/search/getFacets", {
		method: "POST",
		body: {
			namespace: input.namespace ?? "default",
			facets: input.facets ?? ["category", "type"],
			filters: input.filters,
		},
	});
}

/**
 * Delete a document from the search index.
 *
 * @param config - SDK configuration
 * @param input - Document ID or external ID
 * @returns Deletion result
 *
 * @example
 * ```typescript
 * // Delete by internal ID
 * await deleteDocument(config, { id: 'doc-uuid-123' })
 *
 * // Delete by external ID
 * await deleteDocument(config, {
 *   externalId: 'product-456',
 *   namespace: 'products'
 * })
 * ```
 */
export async function deleteDocument(
	config: SylphxConfig,
	input: DeleteDocumentInput,
): Promise<{ deleted: number }> {
	return callApi<{ deleted: number }>(config, "/search/delete", {
		method: "POST",
		body: {
			id: input.id,
			externalId: input.externalId,
			namespace: input.namespace ?? "default",
		},
	});
}

/**
 * Upsert a document (insert or update by externalId).
 *
 * If a document with the same externalId exists, it will be replaced.
 * Otherwise, a new document is created.
 *
 * @param config - SDK configuration
 * @param input - Document to upsert (externalId required)
 * @returns Upsert result
 *
 * @example
 * ```typescript
 * const result = await upsertDocument(config, {
 *   externalId: 'product-123',
 *   title: 'Updated Product Name',
 *   content: 'New description...',
 *   namespace: 'products',
 * })
 * console.log(result.created ? 'Created' : 'Updated')
 * ```
 */
export async function upsertDocument(
	config: SylphxConfig,
	input: UpsertDocumentInput,
): Promise<UpsertDocumentResult> {
	return callApi<UpsertDocumentResult>(config, "/search/upsert", {
		method: "POST",
		body: {
			title: input.title,
			content: input.content,
			namespace: input.namespace ?? "default",
			externalId: input.externalId,
			url: input.url,
			metadata: input.metadata,
			category: input.category,
			type: input.type,
			tags: input.tags,
			language: input.language ?? "english",
			skipEmbedding: input.skipEmbedding ?? false,
			embeddingModel: input.embeddingModel ?? "openai/text-embedding-3-small",
		},
	});
}

/**
 * Get search index statistics.
 *
 * @param config - SDK configuration
 * @param namespace - Optional namespace filter
 * @returns Index statistics
 *
 * @example
 * ```typescript
 * const stats = await getSearchStats(config)
 * console.log(`Total docs: ${stats.totalDocuments}`)
 * console.log(`With embeddings: ${stats.documentsWithEmbedding}`)
 * ```
 */
export async function getSearchStats(
	config: SylphxConfig,
	namespace?: string,
): Promise<SearchStatsResult> {
	return callApi<SearchStatsResult>(config, "/search/getStats", {
		method: "POST",
		body: { namespace },
	});
}

/**
 * Track a click on a search result.
 *
 * Use this to improve search quality over time.
 *
 * @param config - SDK configuration
 * @param input - Click information
 * @returns Success status
 *
 * @example
 * ```typescript
 * await trackClick(config, {
 *   queryId: searchResponse.queryId,
 *   documentId: clickedResult.id,
 *   position: 3,
 * })
 * ```
 */
export async function trackClick(
	config: SylphxConfig,
	input: TrackClickInput,
): Promise<{ success: boolean }> {
	return callApi<{ success: boolean }>(config, "/search/trackClick", {
		method: "POST",
		body: input,
	});
}
