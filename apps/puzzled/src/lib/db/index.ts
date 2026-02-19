import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

/**
 * Database Connection
 *
 * Uses standard node-postgres (pg) Pool with drizzle-orm.
 * Works with any PostgreSQL-compatible server (local, managed, etc.).
 *
 * Connection String Resolution:
 * Set DATABASE_URL environment variable.
 *
 * For local development: set DATABASE_URL in .env.local
 * For production: set via docker-compose environment / Coolify env vars.
 */

function getConnectionString(): string {
	const envUrl = process.env.DATABASE_URL
	if (envUrl) {
		return envUrl
	}

	throw new Error(
		'DATABASE_URL environment variable is required.\n\n' +
			'For local development: Set DATABASE_URL in .env.local\n' +
			'For production: Set DATABASE_URL in your docker-compose environment',
	)
}

// Single, clean database instance
const pool = new Pool({ connectionString: getConnectionString() })
export const db = drizzle(pool, { schema })

// Export schema for convenience
export * from './schema'
