/**
 * JWT / JWKS Verification
 *
 * Verifies platform-issued access tokens. The SDK verifies the cryptographic
 * signature and issuer only — audience validation is handled by the platform
 * when tokens are issued.
 */

import { importJWK, type JWTPayload, jwtVerify } from 'jose'
import { DEFAULT_PLATFORM_URL, JWK_CACHE_TTL_MS } from '../constants'
import type { AccessTokenPayload } from '../types'

/** JWKS Response structure */
interface JwksResponse {
	keys: JsonWebKey[]
}

/** Type guard to validate JWKS response */
function isJwksResponse(data: unknown): data is JwksResponse {
	return (
		typeof data === 'object' &&
		data !== null &&
		'keys' in data &&
		Array.isArray((data as JwksResponse).keys)
	)
}

/** Type guard to validate AccessTokenPayload */
function isAccessTokenPayload(payload: JWTPayload): payload is JWTPayload & AccessTokenPayload {
	return (
		typeof payload.sub === 'string' &&
		typeof payload.email === 'string' &&
		typeof payload.app_id === 'string' &&
		typeof payload.iat === 'number' &&
		typeof payload.exp === 'number'
	)
}

// Cache for JWKS
let jwksCache: { keys: JsonWebKey[]; expiresAt: number } | null = null

/**
 * Fetch JWKS from the platform
 */
export async function getJwks(platformUrl = DEFAULT_PLATFORM_URL): Promise<JsonWebKey[]> {
	const now = Date.now()

	if (jwksCache && jwksCache.expiresAt > now) {
		return jwksCache.keys
	}

	const response = await fetch(`${platformUrl}/api/v1/auth/.well-known/jwks.json`)
	if (!response.ok) {
		throw new Error('Failed to fetch JWKS')
	}

	const data: unknown = await response.json()
	if (!isJwksResponse(data)) {
		throw new Error('Invalid JWKS response format')
	}

	jwksCache = {
		keys: data.keys,
		expiresAt: now + JWK_CACHE_TTL_MS, // Cache for 1 hour
	}

	return data.keys
}

/**
 * Verify an access token from the platform
 */
export async function verifyAccessToken(
	token: string,
	options: {
		secretKey?: string
		platformUrl?: string
	},
): Promise<AccessTokenPayload> {
	const platformUrl = options.platformUrl || DEFAULT_PLATFORM_URL
	const keys = await getJwks(platformUrl)

	if (!keys.length) {
		throw new Error('No keys in JWKS')
	}

	// Try each key until one works.
	// Audience validation is handled by the platform when tokens are issued —
	// the SDK verifies cryptographic signature and issuer only.
	let lastError: Error | null = null
	for (const key of keys) {
		try {
			const jwk = await importJWK(key, 'RS256')
			const { payload } = await jwtVerify(token, jwk, {
				issuer: platformUrl,
			})

			// Validate payload structure at runtime
			if (!isAccessTokenPayload(payload)) {
				throw new Error('Invalid token payload structure')
			}

			return {
				sub: payload.sub,
				email: payload.email,
				name: payload.name,
				picture: payload.picture,
				email_verified: payload.email_verified,
				app_id: payload.app_id,
				role: payload.role,
				iat: payload.iat,
				exp: payload.exp,
			}
		} catch (err) {
			lastError = err as Error
		}
	}

	throw lastError || new Error('Token verification failed')
}
