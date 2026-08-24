/**
 * Environment Variable Validation (SSOT)
 *
 * Presentation (Next.js web) boot must listen without owning api or Platform
 * root secrets. Platform injects API_INTERNAL_URL from sylphx.toml
 * connect.services = ["api"] (same class as Epiow). DATABASE_URL / REDIS_URL
 * belong to the Rust api. SYLPHX_SECRET_KEY / SYLPHX_SECRET_URL are injected
 * only when the workload has an explicit BaaS/resource binding (ADR-3418);
 * presentation web does not, and must not die at register() without them.
 *
 * Categories:
 * - REQUIRED: process will not listen without these
 * - FEATURE: required when that feature is used
 * - OPTIONAL: defaults or degrades
 */

type EnvVar = {
	name: string
	required: boolean
	description: string
	/** Only validate in these runtimes (nodejs, edge) */
	runtimes?: ('nodejs' | 'edge')[]
}

type EnvSource = Record<string, string | undefined>

// Presentation listen has no required secrets. Do not add DATABASE_URL,
// REDIS_URL, or SYLPHX_SECRET_KEY: missing names must not prevent HTTP bind.
const SERVER_REQUIRED: EnvVar[] = []

// Feature-specific variables (validated when feature is used)
// Note: Stripe/billing is handled by Sylphx Platform SDK
const FEATURE_VARS: EnvVar[] = [
	{
		name: 'RESEND_API_KEY',
		required: false, // Checked at runtime by email.ts
		description: 'Resend API key for email',
	},
	// Note: AI/LLM goes through Sylphx Platform SDK (uses SYLPHX_SECRET_KEY).
	// Email/push delivery is platform-owned; no local provider keys are needed.
]

// Security-critical vars that should be set in production
const PRODUCTION_SECURITY_VARS: string[] = []

/**
 * Validate environment variables at startup
 * Called from instrumentation.ts
 *
 * Presentation boot does not throw on missing Platform/api secrets.
 */
export function validateEnv(env: EnvSource = process.env): void {
	const runtime = env.NEXT_RUNTIME as 'nodejs' | 'edge' | undefined
	const missing: string[] = []
	const warnings: string[] = []

	// Check required server variables
	for (const envVar of SERVER_REQUIRED) {
		// Skip if not applicable to current runtime
		if (envVar.runtimes && runtime && !envVar.runtimes.includes(runtime)) {
			continue
		}

		const value = env[envVar.name]

		if (envVar.required && !value) {
			missing.push(`${envVar.name} - ${envVar.description}`)
		}
	}

	// Warn about missing feature variables (don't fail)
	for (const envVar of FEATURE_VARS) {
		const value = env[envVar.name]
		if (!value) {
			warnings.push(`${envVar.name} not set - ${envVar.description}`)
		}
	}

	// Log warnings in development
	if (warnings.length > 0 && env.NODE_ENV === 'development') {
		console.warn('[ENV] Optional variables not configured:')
		for (const warning of warnings) {
			console.warn(`  - ${warning}`)
		}
	}

	// SECURITY: Warn about missing security-critical vars in production
	if (env.NODE_ENV === 'production') {
		for (const varName of PRODUCTION_SECURITY_VARS) {
			if (!env[varName]) {
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
 * Typed environment object for platform SDK and common config
 */
export const env = {
	/** Platform SDK Secret Key — identifies the app (server-side only) */
	get SYLPHX_SECRET_KEY() {
		return getRequiredEnv('SYLPHX_SECRET_KEY')
	},
	/** Node environment */
	get NODE_ENV() {
		return process.env.NODE_ENV || 'development'
	},
	/** Base URL for the app */
	get NEXT_PUBLIC_APP_URL() {
		return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
	},
}
