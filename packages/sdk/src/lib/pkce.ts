/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Implements RFC 7636 for secure OAuth 2.0 authorization code flow.
 * Required for public clients (browsers, mobile apps) per OAuth 2.1.
 *
 * Security improvements:
 * - Uses in-memory Map instead of sessionStorage (not accessible to XSS)
 * - Correlates verifier with state nonce to prevent race conditions
 * - Auto-expires entries after 10 minutes (matches state TTL)
 *
 * Flow:
 * 1. Generate code_verifier (random 43-128 char string)
 * 2. Create code_challenge = base64url(SHA256(code_verifier))
 * 3. Send code_challenge to authorization endpoint
 * 4. Store code_verifier in memory (keyed by appId + nonce)
 * 5. Send code_verifier with token exchange request
 * 6. Server verifies: base64url(SHA256(code_verifier)) === code_challenge
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

// ==========================================
// Constants
// ==========================================

/** Verifier length (43-128 chars per RFC 7636) */
const VERIFIER_LENGTH = 64

/** Characters allowed in code_verifier (unreserved URI chars) */
const VERIFIER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

/** PKCE entry TTL in milliseconds (10 minutes, matches OAuth state) */
const PKCE_TTL_MS = 10 * 60 * 1000

// ==========================================
// In-Memory Storage (XSS-resistant)
// ==========================================

interface PKCEEntry {
	verifier: string
	createdAt: number
}

/**
 * In-memory storage for PKCE verifiers.
 * Not accessible to XSS attacks (unlike sessionStorage).
 * Cleared on page refresh, but that's acceptable for OAuth flow.
 */
const pkceStore = new Map<string, PKCEEntry>()

/**
 * Build storage key from appId and optional nonce for correlation
 */
function buildKey(appId: string, nonce?: string): string {
	return nonce ? `${appId}:${nonce}` : appId
}

/**
 * Clean up expired entries (called periodically)
 */
function cleanupExpiredEntries(): void {
	const now = Date.now()
	for (const [key, entry] of pkceStore.entries()) {
		if (now - entry.createdAt > PKCE_TTL_MS) {
			pkceStore.delete(key)
		}
	}
}

// ==========================================
// PKCE Generation
// ==========================================

/**
 * Generate a cryptographically random code_verifier.
 * Uses Web Crypto API for secure random generation.
 */
export function generateCodeVerifier(): string {
	const randomValues = new Uint8Array(VERIFIER_LENGTH)
	crypto.getRandomValues(randomValues)

	let verifier = ''
	for (let i = 0; i < VERIFIER_LENGTH; i++) {
		verifier += VERIFIER_CHARSET[randomValues[i] % VERIFIER_CHARSET.length]
	}

	return verifier
}

/**
 * Generate code_challenge from code_verifier using S256 method.
 * S256 = base64url(SHA256(code_verifier))
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
	// SHA-256 hash
	const encoder = new TextEncoder()
	const data = encoder.encode(verifier)
	const hash = await crypto.subtle.digest('SHA-256', data)

	// Base64url encode (no padding, URL-safe chars)
	const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
	return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generate a complete PKCE pair (verifier + challenge).
 */
export async function generatePKCE(): Promise<{
	codeVerifier: string
	codeChallenge: string
	codeChallengeMethod: 'S256'
}> {
	const codeVerifier = generateCodeVerifier()
	const codeChallenge = await generateCodeChallenge(codeVerifier)

	return {
		codeVerifier,
		codeChallenge,
		codeChallengeMethod: 'S256',
	}
}

// ==========================================
// PKCE Storage (In-Memory, XSS-Resistant)
// ==========================================

/**
 * Store code_verifier for later use in token exchange.
 *
 * Uses in-memory storage instead of sessionStorage for XSS protection.
 * The verifier is stored with a timestamp and auto-expires after 10 minutes.
 *
 * @param verifier - The code_verifier to store
 * @param appId - The app ID for namespacing
 * @param nonce - Optional nonce for correlating with specific OAuth flow
 */
export function storePKCEVerifier(verifier: string, appId: string, nonce?: string): void {
	if (typeof window === 'undefined') return

	// Cleanup expired entries periodically
	cleanupExpiredEntries()

	const key = buildKey(appId, nonce)
	pkceStore.set(key, {
		verifier,
		createdAt: Date.now(),
	})
}

/**
 * Retrieve and clear stored code_verifier.
 * Verifier is cleared after retrieval (one-time use).
 *
 * @param appId - The app ID for namespacing
 * @param nonce - Optional nonce for correlating with specific OAuth flow
 * @returns The code_verifier or null if not found/expired
 */
export function retrievePKCEVerifier(appId: string, nonce?: string): string | null {
	if (typeof window === 'undefined') return null

	const key = buildKey(appId, nonce)
	const entry = pkceStore.get(key)

	if (!entry) {
		// Try without nonce for backwards compatibility
		const fallbackEntry = pkceStore.get(appId)
		if (fallbackEntry) {
			pkceStore.delete(appId)
			// Check if expired
			if (Date.now() - fallbackEntry.createdAt > PKCE_TTL_MS) {
				return null
			}
			return fallbackEntry.verifier
		}
		return null
	}

	// Always delete after retrieval (one-time use)
	pkceStore.delete(key)

	// Check if expired
	if (Date.now() - entry.createdAt > PKCE_TTL_MS) {
		return null
	}

	return entry.verifier
}

/**
 * Clear stored PKCE verifier (cleanup on error).
 *
 * @param appId - The app ID for namespacing
 * @param nonce - Optional nonce for correlating with specific OAuth flow
 */
export function clearPKCEVerifier(appId: string, nonce?: string): void {
	if (typeof window === 'undefined') return

	const key = buildKey(appId, nonce)
	pkceStore.delete(key)
}

/**
 * Clear all PKCE verifiers for an app (cleanup on logout).
 *
 * @param appId - The app ID to clear verifiers for
 */
export function clearAllPKCEVerifiers(appId: string): void {
	if (typeof window === 'undefined') return

	for (const key of pkceStore.keys()) {
		if (key === appId || key.startsWith(`${appId}:`)) {
			pkceStore.delete(key)
		}
	}
}

// ==========================================
// PKCE Verification (server-side)
// ==========================================

/**
 * Verify code_verifier against stored code_challenge.
 * Used on server during token exchange.
 *
 * Note: Server should use timing-safe comparison.
 * This function is primarily for testing/reference.
 */
export async function verifyPKCE(
	codeVerifier: string,
	codeChallenge: string,
	method: 'S256' | 'plain' = 'S256',
): Promise<boolean> {
	if (method === 'plain') {
		// Plain method: direct comparison (not recommended, timing-unsafe)
		return codeVerifier === codeChallenge
	}

	// S256 method: hash and compare
	const computedChallenge = await generateCodeChallenge(codeVerifier)
	return computedChallenge === codeChallenge
}
