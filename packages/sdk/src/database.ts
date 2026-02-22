/**
 * Database Functions
 *
 * Pure functions for retrieving Platform-provisioned database connection strings.
 * Server-side only (requires secret key `sk_*`).
 *
 * The Platform provisions a PostgreSQL database for each app and encrypts
 * the connection string. These functions retrieve and decrypt the connection
 * string at startup, so your app never needs to store it.
 *
 * @example
 * ```ts
 * import { createConfig, getDatabaseConnectionString } from '@sylphx/sdk'
 *
 * const config = createConfig({ secretKey: process.env.SYLPHX_SECRET_KEY! })
 * const { connectionString } = await getDatabaseConnectionString(config)
 *
 * const pool = new Pool({ connectionString })
 * ```
 */

import { type SylphxConfig, callApi } from "./config";

// ============================================================================
// Types
// ============================================================================

export type DatabaseStatus =
	| "provisioning"
	| "ready"
	| "suspended"
	| "failed"
	| "deleted"
	| "not_provisioned";

export interface DatabaseConnectionInfo {
	/** Decrypted PostgreSQL connection string */
	connectionString: string;
	/** Database name */
	databaseName: string;
	/** Database role/user name */
	roleName: string | null;
	/** Database provisioning status */
	status: Exclude<DatabaseStatus, "not_provisioned">;
}

export interface DatabaseStatusInfo {
	/** Current database status */
	status: DatabaseStatus;
	/** Provisioned region */
	region: string | null;
	/** PostgreSQL major version */
	pgVersion: number | null;
	/** Database name */
	databaseName: string | null;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Get the provisioned PostgreSQL connection string for this app.
 *
 * Requires secret key authentication (server-side only).
 * The connection string is decrypted on the Platform and returned in plaintext.
 *
 * @throws `NOT_FOUND` if no database has been provisioned for this app
 * @throws `UNPROCESSABLE_ENTITY` if database is not yet ready
 *
 * @example
 * ```ts
 * const { connectionString } = await getDatabaseConnectionString(config)
 * const pool = new Pool({ connectionString })
 * ```
 */
export async function getDatabaseConnectionString(
	config: SylphxConfig,
): Promise<DatabaseConnectionInfo> {
	return callApi<DatabaseConnectionInfo>(
		config,
		"/sdk/database/connection-string",
		{ method: "GET" },
	);
}

/**
 * Get the current status of the provisioned database.
 *
 * Use this to check if the database is ready before attempting to connect.
 * Requires secret key authentication (server-side only).
 *
 * @example
 * ```ts
 * const { status } = await getDatabaseStatus(config)
 * if (status === 'ready') {
 *   // Connect to database
 * }
 * ```
 */
export async function getDatabaseStatus(
	config: SylphxConfig,
): Promise<DatabaseStatusInfo> {
	return callApi<DatabaseStatusInfo>(config, "/sdk/database/status", {
		method: "GET",
	});
}
