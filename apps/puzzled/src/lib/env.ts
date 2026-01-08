/**
 * Environment Variable Validation (SSOT)
 *
 * Centralized validation for all environment variables.
 * Import this module early to catch configuration errors at startup.
 *
 * Categories:
 * - REQUIRED: App won't function without these
 * - FEATURE: Required when specific feature is used
 * - OPTIONAL: Has sensible defaults or degrades gracefully
 */

type EnvVar = {
	name: string
	required: boolean
	description: string
	/** Only validate in these runtimes (nodejs, edge) */
	runtimes?: ('nodejs' | 'edge')[]
}

// Server-side required variables
const SERVER_REQUIRED: EnvVar[] = [
	{
		name: 'DATABASE_URL',
		required: true,
		description: 'PostgreSQL connection string',
		runtimes: ['nodejs'],
	},
	{
		name: 'BETTER_AUTH_SECRET',
		required: true,
		description: 'Secret for auth token encryption',
	},
	{
		name: 'KV_REST_API_URL',
		required: false, // Has UPSTASH_REDIS_REST_URL fallback
		description: 'Redis/KV store URL (or UPSTASH_REDIS_REST_URL)',
	},
	{
		name: 'KV_REST_API_TOKEN',
		required: false, // Has UPSTASH_REDIS_REST_TOKEN fallback
		description: 'Redis/KV store token (or UPSTASH_REDIS_REST_TOKEN)',
	},
]

// Feature-specific variables (validated when feature is used)
const FEATURE_VARS: EnvVar[] = [
	{
		name: 'STRIPE_SECRET_KEY',
		required: false, // Checked at runtime by stripe.ts
		description: 'Stripe API key for payments',
	},
	{
		name: 'STRIPE_WEBHOOK_SECRET',
		required: false,
		description: 'Stripe webhook signing secret',
	},
	{
		name: 'RESEND_API_KEY',
		required: false, // Checked at runtime by email.ts
		description: 'Resend API key for email',
	},
	{
		name: 'OPENROUTER_API_KEY',
		required: false,
		description: 'OpenRouter API key for puzzle generation',
	},
	{
		name: 'CRON_SECRET',
		required: false,
		description: 'Secret for securing cron endpoints',
	},
	{
		name: 'QSTASH_TOKEN',
		required: false,
		description: 'QStash token for scheduled tasks',
	},
	{
		name: 'ADMIN_SECRET',
		required: false,
		description: 'Admin API access secret',
	},
	{
		name: 'VAPID_PRIVATE_KEY',
		required: false,
		description: 'VAPID key for web push notifications',
	},
	{
		name: 'INIT_SECRET',
		required: false,
		description: 'Secret for /api/init endpoint (required in production)',
	},
]

// Security-critical vars that should be set in production
const PRODUCTION_SECURITY_VARS = ['INIT_SECRET', 'CRON_SECRET', 'ADMIN_SECRET']

/**
 * Validate environment variables at startup
 * Called from instrumentation.ts
 *
 * @throws Error if required variables are missing
 */
export function validateEnv(): void {
	const runtime = process.env.NEXT_RUNTIME as 'nodejs' | 'edge' | undefined
	const missing: string[] = []
	const warnings: string[] = []

	// Check required server variables
	for (const envVar of SERVER_REQUIRED) {
		// Skip if not applicable to current runtime
		if (envVar.runtimes && runtime && !envVar.runtimes.includes(runtime)) {
			continue
		}

		const value = process.env[envVar.name]

		if (envVar.required && !value) {
			missing.push(`${envVar.name} - ${envVar.description}`)
		}
	}

	// Check Redis - needs either KV_* or UPSTASH_* vars
	const hasRedis =
		(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
		(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN)

	if (!hasRedis && runtime === 'nodejs') {
		missing.push(
			'Redis connection - Set KV_REST_API_URL + KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN',
		)
	}

	// Warn about missing feature variables (don't fail)
	for (const envVar of FEATURE_VARS) {
		const value = process.env[envVar.name]
		if (!value) {
			warnings.push(`${envVar.name} not set - ${envVar.description}`)
		}
	}

	// Log warnings in development
	if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
		console.warn('[ENV] Optional variables not configured:')
		for (const warning of warnings) {
			console.warn(`  - ${warning}`)
		}
	}

	// SECURITY: Warn about missing security-critical vars in production
	if (process.env.NODE_ENV === 'production') {
		for (const varName of PRODUCTION_SECURITY_VARS) {
			if (!process.env[varName]) {
				console.warn(
					`[ENV] SECURITY WARNING: ${varName} not set in production - endpoints may be vulnerable`,
				)
			}
		}
	}

	// Fail on missing required variables
	if (missing.length > 0) {
		const message = [
			'[ENV] Missing required environment variables:',
			...missing.map((m) => `  - ${m}`),
			'',
			'Please configure these in your .env file or environment.',
		].join('\n')

		console.error(message)
		throw new Error(message)
	}
}

/**
 * Get typed environment variable with validation
 * Use for variables that are required at call time
 */
export function getRequiredEnv(name: string): string {
	const value = process.env[name]
	if (!value) {
		throw new Error(`Required environment variable ${name} is not set`)
	}
	return value
}

/**
 * Get optional environment variable with default
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
	return process.env[name] || defaultValue
}

/**
 * Check if a feature is configured (has required env vars)
 */
export function isFeatureConfigured(feature: 'stripe' | 'email' | 'push' | 'ai'): boolean {
	switch (feature) {
		case 'stripe':
			return !!process.env.STRIPE_SECRET_KEY
		case 'email':
			return !!process.env.RESEND_API_KEY
		case 'push':
			return !!process.env.VAPID_PRIVATE_KEY && !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
		case 'ai':
			return !!process.env.OPENROUTER_API_KEY
		default:
			return false
	}
}
