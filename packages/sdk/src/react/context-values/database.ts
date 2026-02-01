/**
 * Database Context Value Factory
 *
 * Creates the Database context value for the SylphxProvider.
 * NOTE: Database uses direct Neon connection, not SDK API.
 */

import type { DatabaseContextValue } from '../services-context'

// =============================================================================
// Factory
// =============================================================================

/**
 * Create Database context value.
 *
 * Note: Database queries through SDK hooks are not supported.
 * Users should use @sylphx/platform-sdk/db with DATABASE_URL from Console.
 */
export function createDatabaseValue(): DatabaseContextValue {
	const errorMessage = (action: string) =>
		`Database ${action} through SDK hooks are not supported. ` +
		'Use @sylphx/platform-sdk/db with DATABASE_URL from the Console instead. ' +
		'See: https://sylphx.com/docs/database'

	return {
		query: async () => {
			throw new Error(errorMessage('queries'))
		},
		execute: async () => {
			throw new Error(errorMessage('mutations'))
		},
		transaction: async () => {
			throw new Error(errorMessage('transactions'))
		},
	}
}
