/**
 * REST API Client — With Token Management
 *
 * Provides authenticated HTTP client for SDK API calls.
 * Features:
 * - Token management integration (lazy fetch, auto-refresh)
 * - 401 recovery with automatic retry
 * - Type-safe request/response handling
 */

import { SDK_API_PATH } from '../constants'
import type { TokenManager } from './token-manager'

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for the authenticated REST client (client-side)
 *
 * Note: This is different from RestClientConfig in /rest-client.ts which is
 * for server-side usage with secret keys. This one uses token management
 * for authenticated browser requests.
 */
export interface AuthenticatedRestClientConfig {
	/** App ID — used as x-app-secret for SDK API calls */
	appId?: string
	/** Platform URL (e.g., https://sylphx.com) */
	platformUrl: string
	/** Token manager for authenticated requests */
	tokenManager: TokenManager
}

export interface RestApiClient {
	get: <T>(path: string, query?: Record<string, string | undefined>) => Promise<T>
	post: <T>(path: string, body?: unknown) => Promise<T>
	put: <T>(path: string, body?: unknown) => Promise<T>
	del: <T>(path: string) => Promise<T>
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a REST API client with token management.
 *
 * @example
 * ```ts
 * const api = createRestApi({
 *   appId: 'app_prod_xxx',
 *   platformUrl: 'https://sylphx.com',
 *   tokenManager,
 * })
 *
 * const user = await api.get<User>('/user/profile')
 * await api.post('/analytics/track', { event: 'click' })
 * ```
 */
export function createRestApi(config: AuthenticatedRestClientConfig): RestApiClient {
	const baseUrl = `${config.platformUrl}${SDK_API_PATH}`

	const buildHeaders = async (): Promise<Record<string, string>> => {
		const h: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		if (config.appId) h['x-app-secret'] = config.appId

		// Get token (lazy fetch, auto-refresh, request queuing)
		const token = await config.tokenManager.getToken()
		if (token) h['Authorization'] = `Bearer ${token}`

		return h
	}

	const fetchWithAuth = async (
		url: string,
		method: string,
		body?: unknown,
		retryOn401 = true
	): Promise<Response> => {
		const headers = await buildHeaders()
		const options: RequestInit = {
			method,
			headers,
			...(body !== undefined && { body: JSON.stringify(body) }),
		}

		const res = await fetch(url, options)

		// Handle 401 — invalidate token and retry once
		if (res.status === 401 && retryOn401) {
			config.tokenManager.invalidate()
			return fetchWithAuth(url, method, body, false) // Retry without recursion risk
		}

		return res
	}

	async function handleResponse<T>(res: Response): Promise<T> {
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }))
			throw new Error(err.error?.message ?? err.message ?? 'Request failed')
		}
		return res.json()
	}

	async function get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
		const url = new URL(`${baseUrl}${path}`)
		if (query) Object.entries(query).forEach(([k, v]) => v && url.searchParams.set(k, v))
		const res = await fetchWithAuth(url.toString(), 'GET')
		return handleResponse<T>(res)
	}

	async function post<T>(path: string, body?: unknown): Promise<T> {
		const res = await fetchWithAuth(`${baseUrl}${path}`, 'POST', body)
		return handleResponse<T>(res)
	}

	async function put<T>(path: string, body?: unknown): Promise<T> {
		const res = await fetchWithAuth(`${baseUrl}${path}`, 'PUT', body)
		return handleResponse<T>(res)
	}

	async function del<T>(path: string): Promise<T> {
		const res = await fetchWithAuth(`${baseUrl}${path}`, 'DELETE')
		return handleResponse<T>(res)
	}

	return { get, post, put, del }
}
