import { neonConfig, Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import * as schema from './schema'

/**
 * Database Connection
 *
 * Uses Neon Serverless with WebSocket for full transaction support.
 * The `ws` package provides WebSocket for Node.js runtime (Vercel Serverless).
 *
 * Connection String Resolution (in order):
 * 1. DATABASE_URL environment variable (explicit override)
 * 2. Platform-provisioned database (fetched via SDK)
 *
 * For local development, set DATABASE_URL in .env.local
 * For production, Platform provisions and provides the database.
 *
 * @see https://neon.com/docs/serverless/serverless-driver
 * @see https://orm.drizzle.team/docs/connect-neon
 */

// Configure WebSocket for Node.js runtime
neonConfig.webSocketConstructor = ws

/**
 * Get database connection string.
 *
 * Resolution order:
 * 1. DATABASE_URL env var (for local dev or explicit override)
 * 2. Platform-provisioned database (via SDK)
 *
 * @throws Error if no connection string available
 */
function getConnectionString(): string {
	// Priority 1: Explicit environment variable
	const envUrl = process.env.DATABASE_URL
	if (envUrl) {
		return envUrl
	}

	// Priority 2: Platform-provisioned database would be fetched here,
	// but since this is synchronous initialization and SDK fetch is async,
	// we document the migration path instead.
	//
	// For full Platform integration, the DATABASE_URL should be injected
	// via Vercel Integration or set from Platform Console.
	//
	// To migrate to Platform-provisioned database:
	// 1. Ensure database is provisioned for this app on Platform
	// 2. Copy connection string from Platform Console to Vercel env vars
	// Or: Use the Sylphx Vercel Integration to auto-inject DATABASE_URL

	throw new Error(
		'DATABASE_URL environment variable is required.\n\n' +
			'For local development: Set DATABASE_URL in .env.local\n' +
			'For production: Copy from Platform Console or use Sylphx Vercel Integration',
	)
}

// Single, clean database instance
const pool = new Pool({ connectionString: getConnectionString() })
export const db = drizzle(pool, { schema })

// Export schema for convenience
export * from './schema'
