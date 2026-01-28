/**
 * Secrets SDK
 *
 * Secure secrets management for applications.
 * Secrets are encrypted at rest with AES-256-GCM.
 *
 * @example
 * ```typescript
 * import { createConfig, getSecret, getSecrets, listSecretKeys } from '@sylphx/sdk'
 *
 * const config = createConfig({
 *   appId: 'my-app',
 *   appSecret: process.env.SYLPHX_SECRET!,
 * })
 *
 * // Get a single secret
 * const dbUrl = await getSecret(config, { key: 'DATABASE_URL' })
 * console.log(dbUrl.value) // postgres://...
 *
 * // Get multiple secrets at once
 * const secrets = await getSecrets(config, {
 *   keys: ['DATABASE_URL', 'API_KEY', 'JWT_SECRET']
 * })
 * console.log(secrets.DATABASE_URL) // postgres://...
 *
 * // List all secret keys (without values)
 * const keys = await listSecretKeys(config)
 * keys.forEach(k => console.log(k.key, k.description))
 * ```
 */

import { type SylphxConfig, callApi } from './config'

// ============================================================================
// Types
// ============================================================================

export interface GetSecretInput {
	/** Secret key (uppercase, underscores allowed) */
	key: string
	/** Optional environment ID override */
	environmentId?: string
}

export interface GetSecretResult {
	/** Secret key */
	key: string
	/** Decrypted secret value */
	value: string
	/** Version number */
	version: string
}

export interface GetSecretsInput {
	/** Array of secret keys to retrieve */
	keys: string[]
	/** Optional environment ID override */
	environmentId?: string
}

/** Map of key -> decrypted value */
export type GetSecretsResult = Record<string, string>

export interface ListSecretKeysInput {
	/** Optional environment ID filter */
	environmentId?: string
}

export interface SecretKeyInfo {
	/** Secret key name */
	key: string
	/** Human-readable description */
	description: string | null
	/** Current version */
	version: string
	/** Whether this is environment-specific */
	isEnvironmentSpecific: boolean
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Get a single secret value by key.
 *
 * @param config - SDK configuration
 * @param input - Secret key and optional environment ID
 * @returns Decrypted secret value
 * @throws Error if secret not found or access denied
 *
 * @example
 * ```typescript
 * const secret = await getSecret(config, { key: 'DATABASE_URL' })
 * const dbConnection = createPool(secret.value)
 * ```
 */
export async function getSecret(
	config: SylphxConfig,
	input: GetSecretInput,
): Promise<GetSecretResult> {
	return callApi<GetSecretResult>(config, '/secrets/get', {
		method: 'POST',
		body: {
			key: input.key,
			environmentId: input.environmentId,
		},
	})
}

/**
 * Get multiple secrets at once.
 *
 * More efficient than multiple getSecret calls.
 *
 * @param config - SDK configuration
 * @param input - Array of secret keys
 * @returns Map of key -> decrypted value
 *
 * @example
 * ```typescript
 * const secrets = await getSecrets(config, {
 *   keys: ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET']
 * })
 *
 * const db = createPool(secrets.DATABASE_URL)
 * const redis = createClient(secrets.REDIS_URL)
 * ```
 */
export async function getSecrets(
	config: SylphxConfig,
	input: GetSecretsInput,
): Promise<GetSecretsResult> {
	return callApi<GetSecretsResult>(config, '/secrets/getMany', {
		method: 'POST',
		body: {
			keys: input.keys,
			environmentId: input.environmentId,
		},
	})
}

/**
 * List all secret keys (without values).
 *
 * Useful for showing available secrets in UI or debugging.
 *
 * @param config - SDK configuration
 * @param input - Optional environment filter
 * @returns Array of secret key info
 *
 * @example
 * ```typescript
 * const keys = await listSecretKeys(config)
 * console.log('Available secrets:')
 * keys.forEach(k => console.log(`  ${k.key}: ${k.description}`))
 * ```
 */
export async function listSecretKeys(
	config: SylphxConfig,
	input: ListSecretKeysInput = {},
): Promise<SecretKeyInfo[]> {
	return callApi<SecretKeyInfo[]>(config, '/secrets/listKeys', {
		method: 'GET',
		query: input.environmentId ? { environmentId: input.environmentId } : undefined,
	})
}

/**
 * Check if a secret exists without retrieving its value.
 *
 * @param config - SDK configuration
 * @param key - Secret key to check
 * @returns true if the secret exists
 *
 * @example
 * ```typescript
 * if (await hasSecret(config, 'STRIPE_SECRET_KEY')) {
 *   // Stripe is configured, enable payment features
 * }
 * ```
 */
export async function hasSecret(config: SylphxConfig, key: string): Promise<boolean> {
	try {
		const keys = await listSecretKeys(config)
		return keys.some((k) => k.key === key)
	} catch {
		return false
	}
}

/**
 * Get all secrets for an environment as an object.
 *
 * Useful for loading all secrets into process.env at startup.
 *
 * @param config - SDK configuration
 * @param environmentId - Optional environment ID
 * @returns Object with all secrets
 *
 * @example
 * ```typescript
 * // Load all secrets into process.env at app startup
 * const secrets = await getAllSecrets(config)
 * Object.assign(process.env, secrets)
 * ```
 */
export async function getAllSecrets(
	config: SylphxConfig,
	environmentId?: string,
): Promise<GetSecretsResult> {
	const keys = await listSecretKeys(config, { environmentId })
	if (keys.length === 0) {
		return {}
	}
	return getSecrets(config, { keys: keys.map((k) => k.key), environmentId })
}
