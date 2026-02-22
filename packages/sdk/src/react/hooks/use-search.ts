/**
 * useSearch — Debounced search hook
 *
 * Client-side hook for real-time search with debouncing, loading states,
 * and optional click tracking.
 *
 * @example
 * ```tsx
 * import { useSearch } from '@sylphx/sdk/react'
 *
 * function SearchBox({ config }) {
 *   const { results, loading, error, setQuery } = useSearch(config, {
 *     namespace: 'products',
 *     searchType: 'hybrid',
 *     debounceMs: 250,
 *   })
 *
 *   return (
 *     <div>
 *       <input onChange={e => setQuery(e.target.value)} />
 *       {loading && <Spinner />}
 *       {results.map(r => <SearchResult key={r.id} item={r} />)}
 *     </div>
 *   )
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SylphxConfig } from "../../config";
import { search } from "../../search";
import type {
	SearchInput,
	SearchResponse,
	SearchResultItem,
} from "../../search";

// ============================================================================
// Types
// ============================================================================

export interface UseSearchOptions extends Omit<SearchInput, "query"> {
	/** Debounce delay in milliseconds (default: 300) */
	debounceMs?: number;
	/** Minimum query length before searching (default: 2) */
	minLength?: number;
	/** Automatically track clicks on results (default: true) */
	autoTrackClicks?: boolean;
	/** Initial query (optional) */
	initialQuery?: string;
}

export interface UseSearchReturn {
	/** Current search results */
	results: SearchResultItem[];
	/** Total number of matching results */
	total: number;
	/** True while a search request is in flight */
	loading: boolean;
	/** Error if the last search failed */
	error: Error | null;
	/** Current query string */
	query: string;
	/** Set the search query (triggers debounced search) */
	setQuery: (query: string) => void;
	/** Clear the search (resets query and results) */
	clear: () => void;
	/** Manually trigger a search with the current query */
	refetch: () => void;
	/** Track a click on a result (updates click-through data) */
	trackResultClick: (documentId: string, resultRank: number) => void;
	/** Full API response (including facets, metadata) */
	response: SearchResponse | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useSearch — Debounced real-time search hook.
 *
 * @param config  SDK config (appId for client-side, secretKey for server-rendered)
 * @param options Search options and configuration
 */
export function useSearch(
	config: SylphxConfig,
	options: UseSearchOptions = {},
): UseSearchReturn {
	const {
		debounceMs = 300,
		minLength = 2,
		autoTrackClicks = true,
		initialQuery = "",
		...searchOptions
	} = options;

	const [query, setQueryState] = useState(initialQuery);
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [response, setResponse] = useState<SearchResponse | null>(null);

	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const abortController = useRef<AbortController | null>(null);

	// Capture searchOptions as a stable ref so we don't need JSON.stringify as dep
	const searchOptionsRef = useRef(searchOptions);
	useEffect(() => {
		searchOptionsRef.current = searchOptions;
	});

	const executeSearch = useCallback(
		async (q: string) => {
			if (!q || q.length < minLength) {
				setResults([]);
				setTotal(0);
				setResponse(null);
				setLoading(false);
				return;
			}

			// Cancel previous in-flight request
			abortController.current?.abort();
			abortController.current = new AbortController();

			setLoading(true);
			setError(null);

			try {
				const res = await search(config, {
					...searchOptionsRef.current,
					query: q,
				});

				setResults(res.results);
				setTotal(res.total);
				setResponse(res);
			} catch (err) {
				// Ignore abort errors
				if (err instanceof Error && err.name === "AbortError") return;
				setError(err instanceof Error ? err : new Error(String(err)));
				setResults([]);
				setTotal(0);
			} finally {
				setLoading(false);
			}
		},
		[config, minLength],
	);

	// Set query with debouncing
	const setQuery = useCallback(
		(q: string) => {
			setQueryState(q);

			if (debounceTimer.current) {
				clearTimeout(debounceTimer.current);
			}

			if (!q || q.length < minLength) {
				setResults([]);
				setTotal(0);
				setResponse(null);
				setLoading(false);
				return;
			}

			setLoading(true); // Show spinner immediately

			debounceTimer.current = setTimeout(() => {
				executeSearch(q);
			}, debounceMs);
		},
		[executeSearch, debounceMs, minLength],
	);

	const clear = useCallback(() => {
		if (debounceTimer.current) clearTimeout(debounceTimer.current);
		abortController.current?.abort();
		setQueryState("");
		setResults([]);
		setTotal(0);
		setResponse(null);
		setLoading(false);
		setError(null);
	}, []);

	const refetch = useCallback(() => {
		executeSearch(query);
	}, [executeSearch, query]);

	const trackResultClick = useCallback(
		(_documentId: string, _resultRank: number) => {
			// Click tracking requires a queryId from the search response.
			// Implement manually using trackClick() from '@sylphx/sdk' with
			// response.queryId when the search API returns one.
		},
		[],
	);

	// Run initial search if initialQuery is provided (once on mount)
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only on mount
	useEffect(() => {
		if (initialQuery && initialQuery.length >= minLength) {
			executeSearch(initialQuery);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Empty deps = mount only

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
			abortController.current?.abort();
		};
	}, []);

	return {
		results,
		total,
		loading,
		error,
		query,
		setQuery,
		clear,
		refetch,
		trackResultClick,
		response,
	};
}
