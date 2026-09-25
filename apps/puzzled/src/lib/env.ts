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
 *
 * This module is also the SSOT for every variable the app reads: KNOWN_VARS is
 * the inventory, and the env object below is the only sanctioned reader inside
 * src. A raw process.env.X read anywhere else bypasses the schema.
 */

import { logger } from './logger'

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
const FEATURE_VARS: EnvVar[] = [
	{
		name: 'RESEND_API_KEY',
		required: false, // Checked at runtime by email.ts
		description: 'Resend API key for email',
	},
]

// Security-critical vars that should be set in production
const PRODUCTION_SECURITY_VARS: string[] = []

/**
 * Complete inventory of the environment variables this app reads (measured at
 * 7523ba9: 38 raw reads outside this module and test files).
 *
 * Every entry carries required: false because presentation boot enforces none
 * of them (see SERVER_REQUIRED above): enforcement lives where the variable is
 * used - redis/db/credential helpers throw when used unconfigured, the dest
 * peels and the origin resolver fall back, admin-api treats a missing
 * ADMIN_SECRET as unauthorized. Add a name here before reading it in src.
 */
export const KNOWN_VARS: readonly EnvVar[] = [
	// Runtime / build
	{
		name: 'NODE_ENV',
		required: false,
		description: 'Node runtime mode (development/production/test); inlined by the bundler',
	},
	{
		name: 'NEXT_PHASE',
		required: false,
		description: 'Next.js phase; phase-production-build relaxes the Redis connect',
	},
	// Public browser config (baked at image build)
	{
		name: 'NEXT_PUBLIC_APP_URL',
		required: false,
		description: 'Configured site origin; falls back to the request origin',
	},
	{
		name: 'NEXT_PUBLIC_SYLPHX_APP_ID',
		required: false,
		description: 'Sylphx app id for the login surface; missing hides OAuth buttons',
	},
	// Deployment / dev host facts
	{
		name: 'VERCEL_URL',
		required: false,
		description: 'Deployment hostname used by site-origin resolution',
	},
	{
		name: 'PORT',
		required: false,
		description: 'Listen port for the local dev site-origin fallback',
	},
	// Dest peels (platform-injected origins)
	{
		name: 'IDENTITY_API_ORIGIN',
		required: false,
		description: 'Identity dest origin override',
	},
	{
		name: 'COMMERCE_API_ORIGIN',
		required: false,
		description: 'Commerce dest origin override',
	},
	{
		name: 'EVENTS_API_ORIGIN',
		required: false,
		description: 'Events dest origin override',
	},
	{
		name: 'OBSERVABILITY_API_ORIGIN',
		required: false,
		description: 'Observability dest origin override',
	},
	{
		name: 'AI_API_ORIGIN',
		required: false,
		description: 'Models dest origin override',
	},
	// Product credentials (read through lib/identity/credentials.ts)
	{
		name: 'IDENTITY_API_KEY',
		required: false,
		description: 'Identity product key; required when Identity is called',
	},
	{
		name: 'IDENTITY_ORGANIZATION_ID',
		required: false,
		description: 'Identity organization id; required for dest admission',
	},
	{
		name: 'COMMERCE_API_KEY',
		required: false,
		description: 'Commerce product key; required when Commerce is called',
	},
	{
		name: 'EVENTS_API_KEY',
		required: false,
		description: 'Events product key; required when Events is called',
	},
	{
		name: 'OBSERVABILITY_API_KEY',
		required: false,
		description: 'Observability product key; required when replay is called',
	},
	{
		name: 'AI_API_KEY',
		required: false,
		description: 'Models product key; required when Models is called',
	},
	// Security / infra
	{
		name: 'ADMIN_SECRET',
		required: false,
		description: 'Header secret for programmatic admin access; missing denies',
	},
	{
		name: 'EMAIL_UNSUBSCRIBE_SECRET',
		required: false,
		description: 'HMAC secret for email unsubscribe tokens',
	},
	{
		name: 'REDIS_URL',
		required: false,
		description: 'Residual admin rate-limit KV URL; platform injects, api owns',
	},
	{
		name: 'DATABASE_URL',
		required: false,
		description: 'Postgres connection string for product reads (audit logs)',
	},
	{
		name: 'COMMERCE_ENTITLEMENT_POLICY_ID',
		required: false,
		description: 'Entitlement policy id; the call site defaults to premium',
	},
]

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
		logger.warn('env.optional-vars-missing', { variables: warnings })
	}

	// SECURITY: Warn about missing security-critical vars in production
	if (env.NODE_ENV === 'production') {
		for (const varName of PRODUCTION_SECURITY_VARS) {
			if (!env[varName]) {
				logger.warn('env.security-var-missing', { variable: varName })
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

		logger.error('env.invalid-configuration', { message })
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
 * Typed environment object - the only sanctioned reader for the KNOWN_VARS
 * names inside src.
 *
 * Getters are lazy and raw: they read process.env at call time and return it
 * exactly as-is (undefined when unset), so a getter read is behaviour-identical
 * to the raw process.env read it replaces; defaults stay at the call sites.
 * NEXT_PUBLIC_* / NODE_ENV literal member expressions inside these getters are
 * still inlined by the bundler for client bundles; server-only names are never
 * inlined to the client.
 */
export const env = {
	/** Node runtime mode (development/production/test) */
	get NODE_ENV(): string | undefined {
		return process.env.NODE_ENV
	},
	/** Next.js phase; phase-production-build during build */
	get NEXT_PHASE(): string | undefined {
		return process.env.NEXT_PHASE
	},
	/** Configured site origin (baked at build) */
	get NEXT_PUBLIC_APP_URL(): string | undefined {
		return process.env.NEXT_PUBLIC_APP_URL
	},
	/** Sylphx app id for the login surface (baked at build) */
	get NEXT_PUBLIC_SYLPHX_APP_ID(): string | undefined {
		return process.env.NEXT_PUBLIC_SYLPHX_APP_ID
	},
	/** Deployment hostname fallback */
	get VERCEL_URL(): string | undefined {
		return process.env.VERCEL_URL
	},
	/** Listen port for the local dev fallback */
	get PORT(): string | undefined {
		return process.env.PORT
	},
	/** Identity dest origin override */
	get IDENTITY_API_ORIGIN(): string | undefined {
		return process.env.IDENTITY_API_ORIGIN
	},
	/** Commerce dest origin override */
	get COMMERCE_API_ORIGIN(): string | undefined {
		return process.env.COMMERCE_API_ORIGIN
	},
	/** Events dest origin override */
	get EVENTS_API_ORIGIN(): string | undefined {
		return process.env.EVENTS_API_ORIGIN
	},
	/** Observability dest origin override */
	get OBSERVABILITY_API_ORIGIN(): string | undefined {
		return process.env.OBSERVABILITY_API_ORIGIN
	},
	/** Models dest origin override */
	get AI_API_ORIGIN(): string | undefined {
		return process.env.AI_API_ORIGIN
	},
	/** Identity product key */
	get IDENTITY_API_KEY(): string | undefined {
		return process.env.IDENTITY_API_KEY
	},
	/** Identity organization id */
	get IDENTITY_ORGANIZATION_ID(): string | undefined {
		return process.env.IDENTITY_ORGANIZATION_ID
	},
	/** Commerce product key */
	get COMMERCE_API_KEY(): string | undefined {
		return process.env.COMMERCE_API_KEY
	},
	/** Events product key */
	get EVENTS_API_KEY(): string | undefined {
		return process.env.EVENTS_API_KEY
	},
	/** Observability product key */
	get OBSERVABILITY_API_KEY(): string | undefined {
		return process.env.OBSERVABILITY_API_KEY
	},
	/** Models product key */
	get AI_API_KEY(): string | undefined {
		return process.env.AI_API_KEY
	},
	/** Header secret for programmatic admin access */
	get ADMIN_SECRET(): string | undefined {
		return process.env.ADMIN_SECRET
	},
	/** HMAC key for email unsubscribe tokens; dedicated, shared with no other signer */
	get EMAIL_UNSUBSCRIBE_SECRET(): string | undefined {
		return process.env.EMAIL_UNSUBSCRIBE_SECRET
	},
	/** Residual admin rate-limit KV URL */
	get REDIS_URL(): string | undefined {
		return process.env.REDIS_URL
	},
	/** Postgres connection string */
	get DATABASE_URL(): string | undefined {
		return process.env.DATABASE_URL
	},
	/** Entitlement policy id (call site defaults to premium) */
	get COMMERCE_ENTITLEMENT_POLICY_ID(): string | undefined {
		return process.env.COMMERCE_ENTITLEMENT_POLICY_ID
	},
}
