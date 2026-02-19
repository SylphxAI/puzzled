import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from './schema'

/**
 * Database Connection
 *
 * Uses standard node-postgres (pg) Pool with drizzle-orm.
 * Lazy initialization — avoids build-time errors when DATABASE_URL is not set.
 */

let _pool: Pool | null = null
let _db: NodePgDatabase<typeof schema> | null = null

function getDb(): NodePgDatabase<typeof schema> {
	if (!_db) {
		const url = process.env.DATABASE_URL
		if (!url) {
			throw new Error(
				'DATABASE_URL environment variable is required.\n\n' +
					'For local development: Set DATABASE_URL in .env.local\n' +
					'For production: Set via docker-compose environment / Coolify env vars.',
			)
		}
		_pool = new Pool({ connectionString: url })
		_db = drizzle(_pool, { schema })
	}
	return _db
}

// Proxy for lazy initialization — no connection at import time
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
	get(_target, prop, receiver) {
		const instance = getDb()
		const value = Reflect.get(instance, prop, receiver)
		return typeof value === 'function' ? value.bind(instance) : value
	},
})

// Export schema for convenience
export * from './schema'
