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

import {
	PKCE_CODE_TTL_MS,
	PKCE_STORAGE_PREFIX,
	STORAGE_TEST_KEY,
} from "../constants";

// ==========================================
// Constants
// ==========================================

/** Verifier length (43-128 chars per RFC 7636) */
const VERIFIER_LENGTH = 64;

/** Characters allowed in code_verifier (unreserved URI chars) */
const VERIFIER_CHARSET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/** PKCE entry TTL from constants (10 minutes, matches OAuth state) */
const PKCE_TTL_MS = PKCE_CODE_TTL_MS;

interface PKCEEntry {
	verifier: string;
	createdAt: number;
}

/**
 * Build storage key from appId and optional nonce
 */
function buildKey(appId: string, nonce?: string): string {
	return `${PKCE_STORAGE_PREFIX}${nonce ? `${appId}:${nonce}` : appId}`;
}

/**
 * In-memory fallback storage (used when sessionStorage is unavailable)
 * Note: This loses verifier on page navigation, so sessionStorage is preferred
 */
const pkceMemoryFallback = new Map<string, PKCEEntry>();

/**
 * Check if sessionStorage is available
 */
function isSessionStorageAvailable(): boolean {
	if (typeof window === "undefined") return false;
	try {
		sessionStorage.setItem(STORAGE_TEST_KEY, "test");
		sessionStorage.removeItem(STORAGE_TEST_KEY);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get PKCE entry from storage
 */
function getEntry(key: string): PKCEEntry | null {
	if (typeof window === "undefined") return null;

	if (isSessionStorageAvailable()) {
		const stored = sessionStorage.getItem(key);
		if (!stored) return null;
		try {
			return JSON.parse(stored) as PKCEEntry;
		} catch {
			return null;
		}
	}

	// Fallback to in-memory (less secure, loses on navigation)
	return pkceMemoryFallback.get(key) || null;
}

/**
 * Set PKCE entry in storage
 */
function setEntry(key: string, entry: PKCEEntry): void {
	if (typeof window === "undefined") return;

	if (isSessionStorageAvailable()) {
		sessionStorage.setItem(key, JSON.stringify(entry));
	} else {
		// Fallback to in-memory
		pkceMemoryFallback.set(key, entry);
	}
}

/**
 * Delete PKCE entry from storage
 */
function deleteEntry(key: string): void {
	if (typeof window === "undefined") return;

	if (isSessionStorageAvailable()) {
		sessionStorage.removeItem(key);
	} else {
		pkceMemoryFallback.delete(key);
	}
}

/**
 * Clean up expired entries from sessionStorage
 */
function cleanupExpiredEntries(): void {
	if (typeof window === "undefined") return;

	const now = Date.now();

	if (isSessionStorageAvailable()) {
		// Clean sessionStorage
		const keysToRemove: string[] = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i);
			if (key?.startsWith(PKCE_STORAGE_PREFIX)) {
				const entry = getEntry(key);
				if (entry && now - entry.createdAt > PKCE_TTL_MS) {
					keysToRemove.push(key);
				}
			}
		}
		for (const key of keysToRemove) {
			sessionStorage.removeItem(key);
		}
	} else {
		// Clean in-memory fallback
		for (const [key, entry] of pkceMemoryFallback.entries()) {
			if (now - entry.createdAt > PKCE_TTL_MS) {
				pkceMemoryFallback.delete(key);
			}
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
	const randomValues = new Uint8Array(VERIFIER_LENGTH);
	crypto.getRandomValues(randomValues);

	let verifier = "";
	for (let i = 0; i < VERIFIER_LENGTH; i++) {
		verifier += VERIFIER_CHARSET[randomValues[i] % VERIFIER_CHARSET.length];
	}

	return verifier;
}

/**
 * Generate code_challenge from code_verifier using S256 method.
 * S256 = base64url(SHA256(code_verifier))
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
	// SHA-256 hash
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const hash = await crypto.subtle.digest("SHA-256", data);

	// Base64url encode (no padding, URL-safe chars)
	const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate a complete PKCE pair (verifier + challenge).
 */
export async function generatePKCE(): Promise<{
	codeVerifier: string;
	codeChallenge: string;
	codeChallengeMethod: "S256";
}> {
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = await generateCodeChallenge(codeVerifier);

	return {
		codeVerifier,
		codeChallenge,
		codeChallengeMethod: "S256",
	};
}

// ==========================================
// PKCE Storage (In-Memory, XSS-Resistant)
// ==========================================

/**
 * Store code_verifier for later use in token exchange.
 *
 * Uses sessionStorage to persist across OAuth redirects (page navigations).
 * Falls back to in-memory storage if sessionStorage is unavailable.
 *
 * Security notes:
 * - sessionStorage is scoped to tab/window and cleared on close
 * - Auto-expires after 10 minutes
 * - XSS can access sessionStorage, but code_verifier alone is useless
 *   without the authorization code (attacker would need both)
 *
 * @param verifier - The code_verifier to store
 * @param appId - The app ID for namespacing
 * @param nonce - Optional nonce for correlating with specific OAuth flow
 */
export function storePKCEVerifier(
	verifier: string,
	appId: string,
	nonce?: string,
): void {
	if (typeof window === "undefined") return;

	// Cleanup expired entries periodically
	cleanupExpiredEntries();

	const key = buildKey(appId, nonce);
	setEntry(key, {
		verifier,
		createdAt: Date.now(),
	});
}

/**
 * Retrieve and clear stored code_verifier.
 * Verifier is cleared after retrieval (one-time use).
 *
 * @param appId - The app ID for namespacing
 * @param nonce - Optional nonce for correlating with specific OAuth flow
 * @returns The code_verifier or null if not found/expired
 */
export function retrievePKCEVerifier(
	appId: string,
	nonce?: string,
): string | null {
	if (typeof window === "undefined") return null;

	const key = buildKey(appId, nonce);
	const entry = getEntry(key);

	if (!entry) {
		return null;
	}

	// Always delete after retrieval (one-time use)
	deleteEntry(key);

	// Check if expired
	if (Date.now() - entry.createdAt > PKCE_TTL_MS) {
		return null;
	}

	return entry.verifier;
}

/**
 * Clear stored PKCE verifier (cleanup on error).
 *
 * @param appId - The app ID for namespacing
 * @param nonce - Optional nonce for correlating with specific OAuth flow
 */
export function clearPKCEVerifier(appId: string, nonce?: string): void {
	if (typeof window === "undefined") return;

	const key = buildKey(appId, nonce);
	deleteEntry(key);
}

/**
 * Clear all PKCE verifiers for an app (cleanup on logout).
 *
 * @param appId - The app ID to clear verifiers for
 */
export function clearAllPKCEVerifiers(appId: string): void {
	if (typeof window === "undefined") return;

	const prefix = PKCE_STORAGE_PREFIX + appId;

	if (isSessionStorageAvailable()) {
		const keysToRemove: string[] = [];
		for (let i = 0; i < sessionStorage.length; i++) {
			const key = sessionStorage.key(i);
			if (key?.startsWith(prefix)) {
				keysToRemove.push(key);
			}
		}
		for (const key of keysToRemove) {
			sessionStorage.removeItem(key);
		}
	} else {
		for (const key of pkceMemoryFallback.keys()) {
			if (key.startsWith(prefix)) {
				pkceMemoryFallback.delete(key);
			}
		}
	}
}

// ==========================================
// PKCE Verification (for testing/reference)
// ==========================================

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * Even though this is primarily for testing, we use timing-safe comparison
 * to establish correct patterns and prevent copy-paste vulnerabilities.
 *
 * @see OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) {
		// Still do comparison to maintain constant time
		// but we know it will fail
		let _result = 1;
		for (let i = 0; i < a.length; i++) {
			_result |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
		}
		return false;
	}

	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

/**
 * Verify code_verifier against stored code_challenge.
 *
 * ⚠️ This is a reference implementation for testing.
 * The actual server-side verification lives in apps/sylphx/src/lib/auth/service.ts
 * which has the same timing-safe comparison implementation.
 *
 * Uses constant-time comparison to prevent timing attacks (OWASP A02:2021).
 *
 * @see RFC 7636 - Proof Key for Code Exchange
 */
export async function verifyPKCE(
	codeVerifier: string,
	codeChallenge: string,
	method: "S256" | "plain" = "S256",
): Promise<boolean> {
	if (method === "plain") {
		// Plain method: code_verifier === code_challenge (timing-safe)
		return timingSafeEqual(codeVerifier, codeChallenge);
	}

	// S256 method: BASE64URL(SHA256(code_verifier)) === code_challenge
	const computedChallenge = await generateCodeChallenge(codeVerifier);

	// Timing-safe comparison
	return timingSafeEqual(computedChallenge, codeChallenge);
}
