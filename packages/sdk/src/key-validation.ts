/**
 * API Key Validation — Single Source of Truth
 *
 * OAuth 2.0 standard key validation for Sylphx Platform.
 * ALL key validation, sanitization, and environment detection logic lives here.
 *
 * Principles:
 * 1. Fail fast - Invalid input rejected immediately with clear errors
 * 2. Helpful errors - Tell users exactly what's wrong and how to fix it
 * 3. Development warnings - Warn about issues that would fail in production
 * 4. No silent fixes - Transparency over convenience (but warn + continue)
 * 5. Single Source of Truth - All key logic in one place
 *
 * Key Formats (OAuth 2.0 Standard):
 * - App ID: app_(dev|stg|prod)_[identifier] — Public identifier (like OAuth client_id)
 * - Secret Key: sk_(dev|stg|prod)_[identifier] — Server-side only (like OAuth client_secret)
 *
 * Identifier Types:
 * - Customer apps: 32 hex chars
 * - Platform apps: platform_{app-slug} (e.g., platform_sylphx-console)
 */

// =============================================================================
// Types
// =============================================================================

/** Environment type derived from key prefix */
export type EnvironmentType = 'development' | 'staging' | 'production'

/** Key type - appId (public) or secret (server) */
export type KeyType = 'appId' | 'secret'

/** Validation result with clear error information */
export interface KeyValidationResult {
	/** Whether the key is valid (possibly after sanitization) */
	valid: boolean
	/** The sanitized key to use (only if valid) */
	sanitizedKey: string
	/** Detected key type */
	keyType?: KeyType
	/** Detected environment */
	environment?: EnvironmentType
	/** Error message if invalid */
	error?: string
	/** Warning message if key was auto-fixed */
	warning?: string
	/** Detected issues for debugging */
	issues?: string[]
}

// =============================================================================
// Patterns — Strict Format Validation
// =============================================================================

/**
 * App ID pattern: app_(dev|stg|prod)_[identifier]
 * - Prefix: app_ (application identifier, public)
 * - Environment: dev, stg, or prod (NO typos allowed)
 * - Suffix: alphanumeric with underscores/hyphens (hex for apps, or internal identifiers)
 */
const APP_ID_PATTERN = /^app_(dev|stg|prod)_[a-z0-9_-]+$/

/**
 * Secret key pattern: sk_(dev|stg|prod)_[identifier]
 * - Prefix: sk_ (secret key)
 * - Environment: dev, stg, or prod (NO typos allowed)
 * - Suffix: alphanumeric with underscores/hyphens (hex for apps, or internal identifiers)
 */
const SECRET_KEY_PATTERN = /^sk_(dev|stg|prod)_[a-z0-9_-]+$/

/** Environment prefix to type mapping */
const ENV_PREFIX_MAP: Record<string, EnvironmentType> = {
	dev: 'development',
	stg: 'staging',
	prod: 'production',
}

// =============================================================================
// Core Validation Functions
// =============================================================================

/**
 * Detect common issues with a key (whitespace, newlines, etc.)
 */
function detectKeyIssues(key: string): string[] {
	const issues: string[] = []
	if (key !== key.trim()) issues.push('whitespace')
	if (key.includes('\n')) issues.push('newline')
	if (key.includes('\r')) issues.push('carriage-return')
	if (key.includes(' ')) issues.push('space')
	if (key !== key.toLowerCase()) issues.push('uppercase-chars')
	return issues
}

/**
 * Create a helpful warning message for keys that needed sanitization
 */
function createSanitizationWarning(
	keyType: KeyType,
	issues: string[],
	envVarName: string,
): string {
	const keyTypeName = keyType === 'appId' ? 'App ID' : 'Secret Key'
	return (
		`[Sylphx] ${keyTypeName} contains ${issues.join(', ')}. ` +
		`This is commonly caused by Vercel CLI's 'env pull' command.\n\n` +
		`To fix permanently:\n` +
		`1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables\n` +
		`2. Edit ${envVarName}\n` +
		`3. Remove any trailing whitespace or newline characters\n` +
		`4. Redeploy your application\n\n` +
		`The SDK will automatically sanitize the key, but fixing the source is recommended.`
	)
}

/**
 * Create a helpful error message for invalid keys
 */
function createInvalidKeyError(
	keyType: KeyType,
	key: string,
	envVarName: string,
): string {
	const prefix = keyType === 'appId' ? 'app' : 'sk'
	const maskedKey = key.length > 20 ? `${key.slice(0, 20)}...` : key
	const formatHint = `${prefix}_(dev|stg|prod)_[identifier]`
	const keyTypeName = keyType === 'appId' ? 'App ID' : 'Secret Key'

	return (
		`[Sylphx] Invalid ${keyTypeName} format.\n\n` +
		`Expected format: ${formatHint}\n` +
		`Received: "${maskedKey}"\n\n` +
		`Please check your ${envVarName} environment variable.\n` +
		`You can find your keys in the Sylphx Console → API Keys.\n\n` +
		`Common issues:\n` +
		`• Key has uppercase characters (must be lowercase)\n` +
		`• Key has wrong prefix (App ID: app_, Secret Key: sk_)\n` +
		`• Key has invalid environment (must be dev, stg, or prod)\n` +
		`• Key was copied with extra whitespace`
	)
}

/**
 * Extract environment from a validated key
 */
function extractEnvironment(key: string): EnvironmentType | undefined {
	// Match app_ or sk_ prefix followed by environment
	const match = key.match(/^(?:app|sk)_(dev|stg|prod)_/)
	if (!match) return undefined
	return ENV_PREFIX_MAP[match[1]]
}

/**
 * Internal: Generic key validation logic for specific key types
 */
function validateKeyForType(
	key: string | undefined | null,
	keyType: KeyType,
	pattern: RegExp,
	envVarName: string,
): KeyValidationResult {
	const keyTypeName = keyType === 'appId' ? 'App ID' : 'Secret Key'

	// Check if key is provided
	if (!key) {
		return {
			valid: false,
			sanitizedKey: '',
			error:
				`[Sylphx] ${keyTypeName} is required. ` +
				`Set ${envVarName} in your environment variables.`,
			issues: ['missing'],
		}
	}

	// Detect issues before validation
	const issues = detectKeyIssues(key)

	// Check if key matches expected format exactly
	if (pattern.test(key)) {
		return {
			valid: true,
			sanitizedKey: key,
			keyType,
			environment: extractEnvironment(key),
			issues: [],
		}
	}

	// Key doesn't match - try sanitization (trim + lowercase)
	const sanitized = key.trim().toLowerCase()

	if (pattern.test(sanitized)) {
		// Sanitization fixes the issue
		return {
			valid: true,
			sanitizedKey: sanitized,
			keyType,
			environment: extractEnvironment(sanitized),
			warning: createSanitizationWarning(keyType, issues, envVarName),
			issues,
		}
	}

	// Sanitization doesn't fix it - key format is genuinely wrong
	return {
		valid: false,
		sanitizedKey: '',
		error: createInvalidKeyError(keyType, key, envVarName),
		issues: [...issues, 'invalid-format'],
	}
}

// =============================================================================
// Public API — App ID (formerly Publishable Key)
// =============================================================================

/**
 * Validate an App ID and return detailed results
 *
 * @example
 * ```typescript
 * const result = validateAppId(process.env.NEXT_PUBLIC_SYLPHX_APP_ID)
 * if (!result.valid) {
 *   throw new Error(result.error)
 * }
 * if (result.warning) {
 *   console.warn(result.warning)
 * }
 * ```
 */
export function validateAppId(key: string | undefined | null): KeyValidationResult {
	return validateKeyForType(key, 'appId', APP_ID_PATTERN, 'NEXT_PUBLIC_SYLPHX_APP_ID')
}

/**
 * Validate and sanitize App ID, logging warnings
 *
 * @throws Error if the key is invalid and cannot be sanitized
 * @returns The sanitized App ID
 */
export function validateAndSanitizeAppId(key: string | undefined | null): string {
	const result = validateAppId(key)

	if (!result.valid) {
		throw new Error(result.error)
	}

	if (result.warning) {
		console.warn(result.warning)
	}

	return result.sanitizedKey
}

// =============================================================================
// Public API — Secret Keys
// =============================================================================

/**
 * Validate a secret key and return detailed results
 *
 * @example
 * ```typescript
 * const result = validateSecretKey(process.env.SYLPHX_SECRET_KEY)
 * if (!result.valid) {
 *   throw new Error(result.error)
 * }
 * ```
 */
export function validateSecretKey(key: string | undefined | null): KeyValidationResult {
	return validateKeyForType(key, 'secret', SECRET_KEY_PATTERN, 'SYLPHX_SECRET_KEY')
}

/**
 * Validate and sanitize secret key, logging warnings
 *
 * @throws Error if the key is invalid and cannot be sanitized
 * @returns The sanitized secret key
 */
export function validateAndSanitizeSecretKey(key: string | undefined | null): string {
	const result = validateSecretKey(key)

	if (!result.valid) {
		throw new Error(result.error)
	}

	if (result.warning) {
		console.warn(result.warning)
	}

	return result.sanitizedKey
}

// =============================================================================
// Public API — Environment Detection (SSOT)
// =============================================================================

/**
 * Detect environment type from any key (App ID or Secret Key)
 *
 * @example
 * ```typescript
 * detectEnvironment('sk_dev_abc123')   // 'development'
 * detectEnvironment('app_prod_xyz789') // 'production'
 * detectEnvironment('sk_stg_qwe456')   // 'staging'
 * ```
 *
 * @throws Error if key format is invalid
 */
export function detectEnvironment(key: string): EnvironmentType {
	// Validate and sanitize first
	const sanitized = key.trim().toLowerCase()

	// Check both key types
	if (sanitized.startsWith('sk_')) {
		const result = validateSecretKey(sanitized)
		if (!result.valid) {
			throw new Error(result.error)
		}
		return result.environment!
	}

	if (sanitized.startsWith('app_')) {
		const result = validateAppId(sanitized)
		if (!result.valid) {
			throw new Error(result.error)
		}
		return result.environment!
	}

	throw new Error(
		`[Sylphx] Invalid key format. Key must start with 'sk_' (secret) or 'app_' (App ID).`,
	)
}

/**
 * Check if running in development environment based on key
 */
export function isDevelopmentKey(key: string): boolean {
	return detectEnvironment(key) === 'development'
}

/**
 * Check if running in production environment based on key
 */
export function isProductionKey(key: string): boolean {
	return detectEnvironment(key) === 'production'
}

// =============================================================================
// Public API — Cookie Namespace (SSOT)
// =============================================================================

/**
 * Get the cookie namespace for a given secret key
 *
 * Used by auth middleware to namespace cookies per environment.
 * This prevents dev/staging/prod cookies from conflicting.
 *
 * @example
 * ```typescript
 * getCookieNamespace('sk_dev_abc123')  // 'sylphx_dev'
 * getCookieNamespace('sk_prod_xyz789') // 'sylphx_prod'
 * ```
 */
export function getCookieNamespace(secretKey: string): string {
	const env = detectEnvironment(secretKey)
	const shortEnv = env === 'development' ? 'dev' : env === 'staging' ? 'stg' : 'prod'
	return `sylphx_${shortEnv}`
}

// =============================================================================
// Public API — Key Type Detection
// =============================================================================

/**
 * Detect the type of key (App ID or Secret Key)
 *
 * @returns 'appId', 'secret', or null if unknown
 */
export function detectKeyType(key: string): KeyType | null {
	const sanitized = key.trim().toLowerCase()
	if (sanitized.startsWith('app_')) return 'appId'
	if (sanitized.startsWith('sk_')) return 'secret'
	return null
}

/**
 * Check if a key is an App ID
 */
export function isAppId(key: string): boolean {
	return detectKeyType(key) === 'appId'
}

/**
 * Check if a key is a secret key
 */
export function isSecretKey(key: string): boolean {
	return detectKeyType(key) === 'secret'
}

/**
 * Validate any key (auto-detects type)
 *
 * Use this when you accept either App ID or Secret Key.
 * The function auto-detects the key type and validates accordingly.
 *
 * @example
 * ```typescript
 * const result = validateKey(process.env.SYLPHX_SECRET_KEY)
 * if (!result.valid) {
 *   throw new Error(result.error)
 * }
 * const sanitizedKey = result.sanitizedKey
 * ```
 */
export function validateKey(key: string | undefined | null): KeyValidationResult {
	const keyType = key ? detectKeyType(key) : null

	if (keyType === 'appId') {
		return validateAppId(key)
	}
	if (keyType === 'secret') {
		return validateSecretKey(key)
	}

	// Unknown key type - return detailed error
	return {
		valid: false,
		sanitizedKey: '',
		error: key
			? `Invalid key format. Keys must start with 'app_' (App ID) or 'sk_' (Secret Key), followed by environment (dev/stg/prod) and identifier. Got: ${key.slice(0, 20)}...`
			: 'API key is required but was not provided.',
		issues: key ? ['invalid_format'] : ['missing'],
	}
}

/**
 * Validate any key and return sanitized version (throws on error)
 *
 * Use this when you need the key value and want to throw on invalid input.
 */
export function validateAndSanitizeKey(key: string | undefined | null): string {
	const result = validateKey(key)
	if (!result.valid) {
		throw new Error(result.error)
	}
	if (result.warning) {
		console.warn(`[Sylphx] ${result.warning}`)
	}
	return result.sanitizedKey
}

// =============================================================================
// Public API — Runtime Environment Detection
// =============================================================================

/**
 * Check if we're in development mode (based on NODE_ENV or hostname)
 */
export function isDevelopmentRuntime(): boolean {
	if (typeof process !== 'undefined' && process.env) {
		return process.env.NODE_ENV === 'development'
	}
	if (typeof window !== 'undefined') {
		return (
			window.location.hostname === 'localhost' ||
			window.location.hostname === '127.0.0.1'
		)
	}
	return false
}
