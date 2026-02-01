/**
 * Storage Utilities — Non-Auth Data Only
 *
 * Namespaced localStorage utilities for client-side data.
 *
 * IMPORTANT: Auth tokens are NOT stored in localStorage.
 * All auth state lives in HttpOnly cookies (see nextjs/cookies.ts).
 *
 * This module handles:
 * - Anonymous ID (for analytics before sign-in)
 * - Click IDs (for ad conversion attribution)
 * - Consent preferences
 * - Organization selection
 */

import type { ClickIds } from './platform-context'
import type { User } from '../types'
import { CLICK_ID_EXPIRY_MS, STORAGE_KEY_PREFIX } from '../constants'

// Re-export for convenience
export type { ClickIds }

// =============================================================================
// User Cookie Type (from server-set cookies)
// =============================================================================

/**
 * User data from server-set cookie (for client hydration)
 *
 * This is read from the __sylphx_{namespace}_user cookie.
 * The cookie is set by the server after OAuth callback.
 */
export interface UserCookieData {
	user: User
	expiresAt: number
}

// =============================================================================
// Storage Keys (Non-Auth Only)
// =============================================================================

/**
 * Storage key constants - all prefixed with appId
 *
 * NOTE: Auth tokens are NOT in localStorage.
 * They are stored in HttpOnly cookies for security.
 */
export const STORAGE_KEYS = {
	// Analytics
	ANONYMOUS_ID: 'anonymous_id',

	// Organization selection
	CURRENT_ORG: 'current_org',

	// Consent management
	CONSENT: 'consent',
	CONSENT_TIMESTAMP: 'consent_at',

	// Click IDs for conversion attribution (gclid, fbclid, ttclid)
	CLICK_IDS: 'click_ids',
	CLICK_IDS_CAPTURED_AT: 'click_ids_at',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

// =============================================================================
// Storage Manager
// =============================================================================

/**
 * Create namespaced storage key
 * Format: sylphx_{appId}_{key}
 */
function createStorageKey(appId: string, key: StorageKey): string {
	return `${STORAGE_KEY_PREFIX}${appId}_${key}`
}

/**
 * Storage manager with app-specific namespacing
 */
export class SylphxStorage {
	private appId: string

	constructor(appId: string) {
		this.appId = appId
	}

	private key(k: StorageKey): string {
		return createStorageKey(this.appId, k)
	}

	get(key: StorageKey): string | null {
		if (typeof window === 'undefined') return null
		try {
			return localStorage.getItem(this.key(key))
		} catch {
			return null
		}
	}

	set(key: StorageKey, value: string): void {
		if (typeof window === 'undefined') return
		try {
			localStorage.setItem(this.key(key), value)
		} catch {
			// Ignore storage errors (quota exceeded, etc.)
		}
	}

	remove(key: StorageKey): void {
		if (typeof window === 'undefined') return
		try {
			localStorage.removeItem(this.key(key))
		} catch {
			// Ignore
		}
	}

	getJSON<T>(key: StorageKey): T | null {
		const value = this.get(key)
		if (!value) return null
		try {
			return JSON.parse(value) as T
		} catch {
			return null
		}
	}

	setJSON<T>(key: StorageKey, value: T): void {
		try {
			this.set(key, JSON.stringify(value))
		} catch {
			// Ignore
		}
	}

	/**
	 * Check if a key exists
	 */
	has(key: StorageKey): boolean {
		return this.get(key) !== null
	}

	/**
	 * Clear all Sylphx storage for this app
	 */
	clear(): void {
		if (typeof window === 'undefined') return
		try {
			const prefix = `${STORAGE_KEY_PREFIX}${this.appId}_`
			const keysToRemove: string[] = []

			for (let i = 0; i < localStorage.length; i++) {
				const key = localStorage.key(i)
				if (key?.startsWith(prefix)) {
					keysToRemove.push(key)
				}
			}

			for (const key of keysToRemove) {
				localStorage.removeItem(key)
			}
		} catch {
			// Storage access failed (private browsing, iframe restrictions, etc.)
		}
	}
}

// =============================================================================
// Anonymous ID
// =============================================================================

/**
 * Generate a unique anonymous ID (UUIDv4)
 */
function generateAnonymousId(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID()
	}
	// Fallback for older browsers
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === 'x' ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}

/**
 * Get or create anonymous ID
 */
export function getOrCreateAnonymousId(storage: SylphxStorage): string {
	let anonymousId = storage.get(STORAGE_KEYS.ANONYMOUS_ID)
	if (!anonymousId) {
		anonymousId = generateAnonymousId()
		storage.set(STORAGE_KEYS.ANONYMOUS_ID, anonymousId)
	}
	return anonymousId
}

// =============================================================================
// Click ID Utilities for Conversion Attribution
// =============================================================================

/** Click ID expiry from constants (90 days - standard attribution window) */

/**
 * Capture click IDs from URL parameters
 *
 * Call this on page load to capture ad platform click IDs (gclid, fbclid, ttclid)
 * from URL query parameters. These are used for conversion attribution.
 *
 * @returns Captured click IDs (may be empty if none present)
 */
function captureClickIdsFromUrl(): ClickIds {
	if (typeof window === 'undefined') return {}

	const params = new URLSearchParams(window.location.search)
	const clickIds: ClickIds = {}

	const gclid = params.get('gclid')
	const fbclid = params.get('fbclid')
	const ttclid = params.get('ttclid')

	if (gclid) clickIds.gclid = gclid
	if (fbclid) clickIds.fbclid = fbclid
	if (ttclid) clickIds.ttclid = ttclid

	return clickIds
}

/**
 * Get stored click IDs (if not expired)
 */
export function getStoredClickIds(storage: SylphxStorage): ClickIds | null {
	const capturedAtStr = storage.get(STORAGE_KEYS.CLICK_IDS_CAPTURED_AT)
	if (!capturedAtStr) return null

	const capturedAt = parseInt(capturedAtStr, 10)

	// Handle corrupted data (NaN) or expired
	if (isNaN(capturedAt) || Date.now() - capturedAt > CLICK_ID_EXPIRY_MS) {
		// Invalid or expired - clear and return null
		storage.remove(STORAGE_KEYS.CLICK_IDS)
		storage.remove(STORAGE_KEYS.CLICK_IDS_CAPTURED_AT)
		return null
	}

	return storage.getJSON<ClickIds>(STORAGE_KEYS.CLICK_IDS)
}

/**
 * Store click IDs with timestamp
 */
function storeClickIds(storage: SylphxStorage, clickIds: ClickIds): void {
	if (Object.keys(clickIds).length === 0) return

	// Merge with existing (new values take precedence)
	const existing = getStoredClickIds(storage) || {}
	const merged = { ...existing, ...clickIds }

	storage.setJSON(STORAGE_KEYS.CLICK_IDS, merged)
	storage.set(STORAGE_KEYS.CLICK_IDS_CAPTURED_AT, Date.now().toString())
}

/**
 * Auto-capture click IDs from URL and store them
 *
 * This should be called once on provider mount to capture any click IDs
 * from the current URL. New click IDs override stored ones.
 *
 * @returns The merged click IDs (stored + new)
 */
export function autoCaptureClickIds(storage: SylphxStorage): ClickIds {
	const urlClickIds = captureClickIdsFromUrl()
	const storedClickIds = getStoredClickIds(storage) || {}

	// If we have new click IDs in URL, store them
	if (Object.keys(urlClickIds).length > 0) {
		storeClickIds(storage, urlClickIds)
		return { ...storedClickIds, ...urlClickIds }
	}

	return storedClickIds
}

/**
 * Get the primary click ID for conversion attribution
 *
 * Returns the most relevant click ID based on priority:
 * gclid (Google) > fbclid (Meta) > ttclid (TikTok)
 */
export function getPrimaryClickId(clickIds: ClickIds | null): string | undefined {
	if (!clickIds) return undefined
	return clickIds.gclid || clickIds.fbclid || clickIds.ttclid
}

// =============================================================================
// User Cookie Reading (Client-Side)
// =============================================================================

/**
 * Derive cookie namespace from app ID (matching server-side logic)
 *
 * Server uses getCookieNamespace(secretKey) which returns sylphx_{env}
 * Both sk_prod_xxx and app_prod_xxx should map to sylphx_prod
 */
function getCookieNamespaceFromAppId(appId: string): string {
	// Extract environment from appId (e.g., 'app_prod_xxx' → 'prod')
	const parts = appId.split('_')
	if (parts.length < 2) return 'sylphx'

	const envPart = parts[1] // 'dev', 'stg', or 'prod'
	const shortEnv = envPart === 'development' ? 'dev' : envPart === 'staging' ? 'stg' : envPart

	// Match server-side format: sylphx_{shortEnv}
	return `sylphx_${shortEnv}`
}

/**
 * Get user data from JS-readable cookie (set by server after OAuth)
 *
 * This enables client-side hydration after server-side OAuth callback:
 * 1. Server callback exchanges OAuth code for tokens
 * 2. Server sets HttpOnly token cookies + JS-readable user cookie
 * 3. Client reads user cookie on mount for immediate auth state
 *
 * @param appId - App ID used to namespace the cookie
 * @returns User data or null if not found/expired
 */
export function getUserFromCookie(appId: string): UserCookieData | null {
	if (typeof document === 'undefined') return null

	try {
		// Cookie name format: __{namespace}_user
		// Namespace derived from appId to match server-side logic
		const namespace = getCookieNamespaceFromAppId(appId)
		const cookieName = `__${namespace}_user`

		// Parse cookies
		const cookies = document.cookie.split(';')
		for (const cookie of cookies) {
			const [name, ...valueParts] = cookie.trim().split('=')
			if (name === cookieName) {
				const value = valueParts.join('=') // Handle values with = in them
				const decoded = decodeURIComponent(value)
				const userData: UserCookieData = JSON.parse(decoded)

				// Check if session is expired
				if (userData.expiresAt && userData.expiresAt < Date.now()) {
					return null
				}

				return userData
			}
		}
		return null
	} catch {
		return null
	}
}

/**
 * Clear the user cookie (client-side)
 *
 * Call this on sign out to remove the user cookie.
 * Note: This only clears the JS-readable cookie.
 * The HttpOnly session/refresh cookies can only be cleared server-side.
 */
export function clearUserCookie(appId: string): void {
	if (typeof document === 'undefined') return

	try {
		const namespace = getCookieNamespaceFromAppId(appId)
		const cookieName = `__${namespace}_user`
		// Set cookie with expired date to delete it
		document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
	} catch {
		// Ignore errors
	}
}
