/**
 * @sylphx/platform-sdk/db
 *
 * Database utilities for SDK apps using platform-provisioned Neon databases.
 * Provides pre-configured Drizzle client setup with best practices.
 *
 * @example
 * ```ts
 * // lib/db/index.ts
 * import { createDatabase } from '@sylphx/platform-sdk/db'
 * import * as schema from './schema'
 *
 * export const db = createDatabase(schema)
 * ```
 */

import { drizzle } from 'drizzle-orm/neon-http'
import { neon, neonConfig } from '@neondatabase/serverless'

// Configure Neon for optimal serverless performance
neonConfig.fetchConnectionCache = true

/**
 * Database configuration options
 */
export interface DatabaseConfig {
	/**
	 * Connection string (defaults to DATABASE_URL env var)
	 * Get this from the Sylphx Platform Admin Panel
	 */
	connectionString?: string

	/**
	 * Enable query logging (defaults to false in production)
	 */
	logger?: boolean

	/**
	 * Custom fetch function for edge environments
	 */
	fetch?: typeof globalThis.fetch
}

/**
 * Creates a configured Drizzle database client for Neon
 *
 * @param schema - Your Drizzle schema object
 * @param config - Optional database configuration
 * @returns Configured Drizzle database client
 *
 * @example
 * ```ts
 * import { createDatabase } from '@sylphx/platform-sdk/db'
 * import * as schema from './schema'
 *
 * // Using DATABASE_URL from env
 * export const db = createDatabase(schema)
 *
 * // Or with custom config
 * export const db = createDatabase(schema, {
 *   connectionString: 'postgres://...',
 *   logger: true,
 * })
 * ```
 */
export function createDatabase<TSchema extends Record<string, unknown>>(
	schema: TSchema,
	config: DatabaseConfig = {},
): ReturnType<typeof drizzle<TSchema>> {
	const connectionString = config.connectionString ?? process.env.DATABASE_URL

	if (!connectionString) {
		throw new Error(
			'Database connection string not found. ' +
				'Set DATABASE_URL environment variable or pass connectionString in config. ' +
				'Get your connection string from the Sylphx Platform Admin Panel.',
		)
	}

	// Create Neon SQL function with optional custom fetch
	const sql = config.fetch ? neon(connectionString, { fetchOptions: {} }) : neon(connectionString)

	// Create and return Drizzle client
	const db = drizzle(sql, {
		schema,
		logger: config.logger ?? process.env.NODE_ENV === 'development',
	})

	return db
}

/**
 * Creates a Neon SQL function for raw queries
 * Use this when you need to execute raw SQL outside of Drizzle
 *
 * @param connectionString - Optional connection string (defaults to DATABASE_URL)
 * @returns Neon SQL tagged template function
 *
 * @example
 * ```ts
 * import { createSql } from '@sylphx/platform-sdk/db'
 *
 * const sql = createSql()
 *
 * // Execute raw query
 * const result = await sql`SELECT * FROM users WHERE id = ${userId}`
 * ```
 */
export function createSql(connectionString?: string) {
	const url = connectionString ?? process.env.DATABASE_URL

	if (!url) {
		throw new Error(
			'Database connection string not found. ' +
				'Set DATABASE_URL environment variable or pass connectionString.',
		)
	}

	return neon(url)
}

/**
 * Type helper for database transactions
 * Use this to type transaction callbacks
 */
export type Transaction<TSchema extends Record<string, unknown>> = Parameters<
	ReturnType<typeof drizzle<TSchema>>['transaction']
>[0]

/**
 * Re-export useful Drizzle utilities
 */
export { sql, eq, and, or, not, inArray, notInArray, isNull, isNotNull, asc, desc } from 'drizzle-orm'

// Re-export Neon types for advanced usage
export type { NeonQueryFunction } from '@neondatabase/serverless'
