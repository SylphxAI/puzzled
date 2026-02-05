/**
 * SDK Debug Mode
 *
 * Centralized debug logging for the SDK.
 *
 * Enable via:
 * - Browser: `localStorage.setItem('sylphx_debug', 'true')`
 * - Node.js: `SYLPHX_DEBUG=true`
 *
 * Debug messages are namespaced with [Sylphx] prefix for easy filtering.
 */

// ============================================================================
// Debug Configuration
// ============================================================================

/** Storage key for browser-side debug toggle */
const DEBUG_STORAGE_KEY = 'sylphx_debug'

/**
 * Check if debug mode is enabled
 *
 * Checks multiple sources in order:
 * 1. localStorage (browser)
 * 2. SYLPHX_DEBUG environment variable
 * 3. NODE_ENV === 'development' with explicit opt-in
 */
function isDebugEnabled(): boolean {
	// Browser environment
	if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
		try {
			return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true'
		} catch {
			// localStorage may be blocked in some contexts
			return false
		}
	}

	// Node.js environment
	if (typeof process !== 'undefined' && process.env) {
		return process.env.SYLPHX_DEBUG === 'true'
	}

	return false
}

// Cache the debug state to avoid repeated localStorage/env checks
let debugModeCache: boolean | null = null

/**
 * Whether debug mode is currently enabled
 *
 * Cached after first access for performance.
 */
export function getDebugMode(): boolean {
	if (debugModeCache === null) {
		debugModeCache = isDebugEnabled()
	}
	return debugModeCache
}

/**
 * Reset debug mode cache (for testing)
 */
export function resetDebugModeCache(): void {
	debugModeCache = null
}

// ============================================================================
// Debug Logging
// ============================================================================

/** Debug log categories */
export type DebugCategory =
	| 'auth'
	| 'api'
	| 'analytics'
	| 'flags'
	| 'storage'
	| 'cache'
	| 'token'
	| 'webhook'
	| 'error'

/**
 * Log a debug message with category prefix
 *
 * @example
 * ```ts
 * debugLog('auth', 'Token refreshed', { expiresIn: 300 })
 * // [Sylphx auth] Token refreshed { expiresIn: 300 }
 * ```
 */
export function debugLog(category: DebugCategory, message: string, data?: unknown): void {
	if (!getDebugMode()) return

	const prefix = `[Sylphx ${category}]`

	if (data !== undefined) {
		console.log(prefix, message, data)
	} else {
		console.log(prefix, message)
	}
}

/**
 * Log a debug warning with category prefix
 */
export function debugWarn(category: DebugCategory, message: string, data?: unknown): void {
	if (!getDebugMode()) return

	const prefix = `[Sylphx ${category}]`

	if (data !== undefined) {
		console.warn(prefix, message, data)
	} else {
		console.warn(prefix, message)
	}
}

/**
 * Log a debug error with category prefix
 *
 * Note: This always logs when debug mode is enabled, regardless of error severity.
 * Production error tracking should use the error tracking service, not this.
 */
export function debugError(category: DebugCategory, message: string, error?: unknown): void {
	if (!getDebugMode()) return

	const prefix = `[Sylphx ${category}]`

	if (error !== undefined) {
		console.error(prefix, message, error)
	} else {
		console.error(prefix, message)
	}
}

// ============================================================================
// Performance Timing
// ============================================================================

/**
 * Create a debug timer for measuring operation duration
 *
 * @example
 * ```ts
 * const timer = debugTimer('api', 'Fetching user profile')
 * // ... operation ...
 * timer.end() // Logs duration if debug mode enabled
 * ```
 */
export function debugTimer(category: DebugCategory, operation: string): { end: () => void } {
	if (!getDebugMode()) {
		return { end: () => {} }
	}

	const start = performance.now()

	return {
		end() {
			const duration = performance.now() - start
			debugLog(category, `${operation} completed`, { durationMs: Math.round(duration) })
		},
	}
}

// ============================================================================
// Browser Console Helpers
// ============================================================================

/**
 * Enable debug mode from browser console
 *
 * Call this in the browser console to enable debug logging:
 * ```js
 * window.__sylphx?.enableDebug()
 * ```
 */
export function enableDebug(): void {
	if (typeof localStorage === 'undefined') {
		console.warn('[Sylphx] Debug mode can only be enabled in browser environments')
		return
	}

	try {
		localStorage.setItem(DEBUG_STORAGE_KEY, 'true')
		debugModeCache = true
		console.log('[Sylphx] Debug mode enabled. Refresh the page to see debug logs.')
	} catch (e) {
		console.warn('[Sylphx] Failed to enable debug mode:', e)
	}
}

/**
 * Disable debug mode from browser console
 */
export function disableDebug(): void {
	if (typeof localStorage === 'undefined') {
		console.warn('[Sylphx] Debug mode can only be disabled in browser environments')
		return
	}

	try {
		localStorage.removeItem(DEBUG_STORAGE_KEY)
		debugModeCache = false
		console.log('[Sylphx] Debug mode disabled.')
	} catch (e) {
		console.warn('[Sylphx] Failed to disable debug mode:', e)
	}
}

// ============================================================================
// Global Window Helper (Browser Only)
// ============================================================================

/**
 * Install debug helpers on window.__sylphx
 *
 * This is called automatically when the SDK is loaded in the browser,
 * providing developers easy console access to debug utilities.
 */
export function installGlobalDebugHelpers(): void {
	if (typeof window === 'undefined') return

	// Use type assertion to extend window
	const w = window as typeof window & {
		__sylphx?: {
			enableDebug: typeof enableDebug
			disableDebug: typeof disableDebug
			isDebugEnabled: typeof getDebugMode
		}
	}

	w.__sylphx = {
		enableDebug,
		disableDebug,
		isDebugEnabled: getDebugMode,
	}
}
