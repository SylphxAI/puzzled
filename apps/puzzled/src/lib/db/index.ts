import { neonConfig, Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'
import { getRequiredEnv } from '@/lib/env'
import * as schema from './schema'

/**
 * Database Connection
 *
 * Uses Neon Serverless with WebSocket for full transaction support.
 * The `ws` package provides WebSocket for Node.js runtime (Vercel Serverless).
 *
 * @see https://neon.com/docs/serverless/serverless-driver
 * @see https://orm.drizzle.team/docs/connect-neon
 */

// Configure WebSocket for Node.js runtime
neonConfig.webSocketConstructor = ws

// Single, clean database instance
// Uses getRequiredEnv for explicit validation - fails fast with clear error
const pool = new Pool({ connectionString: getRequiredEnv('DATABASE_URL') })
export const db = drizzle(pool, { schema })

// Export schema for convenience
export * from './schema'
