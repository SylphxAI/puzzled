/**
 * Token Manager — State of the Art
 *
 * Manages access tokens for the BFF (Backend-for-Frontend) pattern.
 * Implements: Lazy fetch, request queuing, auto-refresh, retry with backoff, 401 recovery.
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │                     Token Manager                               │
 * │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐    │
 * │  │  Lazy    │ → │  Queue   │ → │  Auto    │ → │  Retry   │    │
 * │  │  Fetch   │   │ Requests │   │  Refresh │   │  + 401   │    │
 * │  └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 * ```typescript
 * const manager = new TokenManager({
 *   isSignedIn: () => authState.isSignedIn,
 *   onSessionExpired: () => clearAuthState(),
 *   authPrefix: '/auth',
 * })
 *
 * const token = await manager.getToken()
 * ```
 */

import {
	TOKEN_EXPIRY_BUFFER_MS,
	MAX_RETRIES,
	BASE_RETRY_DELAY_MS,
} from '../constants'

// =============================================================================
// Types
// =============================================================================

export interface TokenManagerConfig {
	/** Check if user is signed in */
	isSignedIn: () => boolean
	/** Called when token refresh fails (e.g., session expired) */
	onSessionExpired?: () => void
	/** Auth route prefix (e.g., '/auth') */
	authPrefix: string
}

// =============================================================================
// Token Manager Class
// =============================================================================

export class TokenManager {
	private token: string | null = null
	private tokenExpiry: number | null = null
	private fetchPromise: Promise<string | null> | null = null
	private refreshTimer: ReturnType<typeof setTimeout> | null = null
	private config: TokenManagerConfig

	constructor(config: TokenManagerConfig) {
		this.config = config
	}

	/**
	 * Get a valid access token.
	 * - Returns cached token if valid
	 * - Fetches new token if expired or missing
	 * - Queues concurrent requests (only one fetch at a time)
	 */
	async getToken(): Promise<string | null> {
		// Not signed in — no token needed
		if (!this.config.isSignedIn()) {
			return null
		}

		// Token exists and not expired (with buffer for network latency)
		if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry - TOKEN_EXPIRY_BUFFER_MS) {
			return this.token
		}

		// Already fetching — wait for that promise (request queuing)
		if (this.fetchPromise) {
			return this.fetchPromise
		}

		// Fetch new token
		this.fetchPromise = this.fetchTokenWithRetry()
		try {
			const token = await this.fetchPromise
			return token
		} finally {
			this.fetchPromise = null
		}
	}

	/**
	 * Invalidate cached token (call on 401)
	 */
	invalidate(): void {
		this.token = null
		this.tokenExpiry = null
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer)
			this.refreshTimer = null
		}
	}

	/**
	 * Clear everything (call on sign out)
	 */
	clear(): void {
		this.invalidate()
		this.fetchPromise = null
	}

	/**
	 * Fetch token with exponential backoff retry
	 */
	private async fetchTokenWithRetry(): Promise<string | null> {
		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			try {
				// Use configurable authPrefix for token endpoint
				const response = await fetch(`${this.config.authPrefix}/token`, {
					method: 'GET',
					credentials: 'include',
				})

				if (response.ok) {
					const data = await response.json()
					const accessToken = data.accessToken as string | null

					if (accessToken) {
						this.token = accessToken
						this.tokenExpiry = this.decodeTokenExpiry(accessToken)
						this.scheduleRefresh()
						return accessToken
					}
				}

				// 401 = session expired, don't retry
				if (response.status === 401) {
					this.config.onSessionExpired?.()
					return null
				}

				// Other errors — retry with backoff
			} catch {
				// Network error — retry with backoff
			}

			// Exponential backoff: 1s, 2s, 4s
			if (attempt < MAX_RETRIES - 1) {
				await new Promise((r) => setTimeout(r, BASE_RETRY_DELAY_MS * 2 ** attempt))
			}
		}

		// All retries failed
		return null
	}

	/**
	 * Decode JWT expiry without verification
	 * (Verification happens server-side)
	 */
	private decodeTokenExpiry(token: string): number | null {
		try {
			const parts = token.split('.')
			if (parts.length !== 3) return null
			const payload = parts[1]
			const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
			const jsonPayload = atob(base64)
			const parsed = JSON.parse(jsonPayload) as { exp?: number }
			// exp is in seconds, convert to milliseconds
			return parsed.exp ? parsed.exp * 1000 : null
		} catch {
			return null
		}
	}

	/**
	 * Schedule token refresh before expiry
	 */
	private scheduleRefresh(): void {
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer)
		}

		if (!this.tokenExpiry) return

		// Refresh 60 seconds before expiry
		const refreshIn = this.tokenExpiry - Date.now() - 60000

		if (refreshIn > 0) {
			this.refreshTimer = setTimeout(() => {
				// Only refresh if still signed in
				if (this.config.isSignedIn()) {
					this.fetchTokenWithRetry()
				}
			}, refreshIn)
		}
	}
}
