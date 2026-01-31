/**
 * Storage Utilities
 *
 * Namespaced localStorage utilities to prevent key collisions
 * when multiple Sylphx apps run on the same domain.
 *
 * Also includes session cookie reading for SSR hydration.
 */

import type { ClickIds } from './platform-context'
import type { User } from '../types'

// Re-export for convenience
export type { ClickIds }

/**
 * Session data from server-set cookie (for SSR hydration)
 */
export interface SessionCookie {
	user: User
	expiresAt: number
}

// Storage key constants - all prefixed with appId
export const STORAGE_KEYS = {
	ACCESS_TOKEN: 'access_token',
	REFRESH_TOKEN: 'refresh_token',
	USER: 'user',
	EXPIRES_AT: 'expires_at',
	ANONYMOUS_ID: 'anonymous_id',
	CURRENT_ORG: 'current_org',
	CONSENT: 'consent',
	CONSENT_TIMESTAMP: 'consent_at',
	// Click IDs for conversion attribution (gclid, fbclid, ttclid)
	CLICK_IDS: 'click_ids',
	CLICK_IDS_CAPTURED_AT: 'click_ids_at',
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/**
 * Create namespaced storage key
 * Format: sylphx_{appId}_{key}
 */
function createStorageKey(appId: string, key: StorageKey): string {
	return `sylphx_${appId}_${key}`
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
			const prefix = `sylphx_${this.appId}_`
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

// ==========================================
// Click ID Utilities for Conversion Attribution
// ==========================================

/** Click ID expiry (90 days - standard attribution window) */
const CLICK_ID_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000

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

// ==========================================
// Session Cookie for SSR Hydration
// ==========================================

/**
 * Get session data from JS-readable cookie (set by server after OAuth)
 *
 * This enables client-side hydration after server-side OAuth callback:
 * 1. Server callback exchanges OAuth code for tokens
 * 2. Server sets HTTP-only token cookies + JS-readable session cookie
 * 3. Client reads session cookie on mount for immediate auth state
 *
 * @param appId - App ID used to namespace the cookie
 * @returns Session data or null if not found/expired
 */
export function getSessionFromCookie(appId: string): SessionCookie | null {
	if (typeof document === 'undefined') return null

	try {
		// Cookie name format: {namespace}_session (namespace derived from appId)
		// The namespace is the first part of the appId (e.g., 'app_prod' from 'app_prod_xxx')
		const namespace = appId.split('_').slice(0, 2).join('_')
		const cookieName = `${namespace}_session`

		// Parse cookies
		const cookies = document.cookie.split(';')
		for (const cookie of cookies) {
			const [name, ...valueParts] = cookie.trim().split('=')
			if (name === cookieName) {
				const value = valueParts.join('=') // Handle values with = in them
				const decoded = decodeURIComponent(value)
				const session: SessionCookie = JSON.parse(decoded)

				// Check if session is expired
				if (session.expiresAt && session.expiresAt < Date.now()) {
					return null
				}

				return session
			}
		}
		return null
	} catch {
		return null
	}
}

/**
 * Clear the session cookie (client-side)
 *
 * Call this on sign out to remove the session cookie.
 */
export function clearSessionCookie(appId: string): void {
	if (typeof document === 'undefined') return

	try {
		const namespace = appId.split('_').slice(0, 2).join('_')
		const cookieName = `${namespace}_session`
		// Set cookie with expired date to delete it
		document.cookie = `${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
	} catch {
		// Ignore errors
	}
}
