/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Implements RFC 7636 for secure OAuth 2.0 authorization code flow.
 * Required for public clients (browsers, mobile apps) per OAuth 2.1.
 *
 * Flow:
 * 1. Generate code_verifier (random 43-128 char string)
 * 2. Create code_challenge = base64url(SHA256(code_verifier))
 * 3. Send code_challenge to authorization endpoint
 * 4. Store code_verifier in sessionStorage
 * 5. Send code_verifier with token exchange request
 * 6. Server verifies: base64url(SHA256(code_verifier)) === code_challenge
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

// ==========================================
// Constants
// ==========================================

/** Storage key for PKCE code_verifier */
const PKCE_STORAGE_KEY = 'sylphx_pkce_verifier'

/** Verifier length (43-128 chars per RFC 7636) */
const VERIFIER_LENGTH = 64

/** Characters allowed in code_verifier (unreserved URI chars) */
const VERIFIER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

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
// PKCE Storage (sessionStorage for security)
// ==========================================

/**
 * Store code_verifier for later use in token exchange.
 * Uses sessionStorage (cleared when tab closes) for security.
 */
export function storePKCEVerifier(verifier: string, appId: string): void {
	if (typeof window === 'undefined') return

	const key = `${PKCE_STORAGE_KEY}_${appId}`
	sessionStorage.setItem(key, verifier)
}

/**
 * Retrieve and clear stored code_verifier.
 * Verifier is cleared after retrieval (one-time use).
 */
export function retrievePKCEVerifier(appId: string): string | null {
	if (typeof window === 'undefined') return null

	const key = `${PKCE_STORAGE_KEY}_${appId}`
	const verifier = sessionStorage.getItem(key)

	if (verifier) {
		sessionStorage.removeItem(key)
	}

	return verifier
}

/**
 * Clear stored PKCE verifier (cleanup on error).
 */
export function clearPKCEVerifier(appId: string): void {
	if (typeof window === 'undefined') return

	const key = `${PKCE_STORAGE_KEY}_${appId}`
	sessionStorage.removeItem(key)
}

// ==========================================
// PKCE Verification (server-side)
// ==========================================

/**
 * Verify code_verifier against stored code_challenge.
 * Used on server during token exchange.
 */
export async function verifyPKCE(
	codeVerifier: string,
	codeChallenge: string,
	method: 'S256' | 'plain' = 'S256',
): Promise<boolean> {
	if (method === 'plain') {
		// Plain method: direct comparison (not recommended)
		return codeVerifier === codeChallenge
	}

	// S256 method: hash and compare
	const computedChallenge = await generateCodeChallenge(codeVerifier)
	return computedChallenge === codeChallenge
}
