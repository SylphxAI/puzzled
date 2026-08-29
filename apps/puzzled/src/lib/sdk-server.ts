/**
 * Server-side SDK configuration for Puzzled
 *
 * Use this for server components and API routes that need to call
 * Platform SDK functions (leaderboards, achievements, etc.)
 */

import { createConfig, type SylphxConfig } from '@/lib/identity'

let cachedConfig: SylphxConfig | null = null

/**
 * Get SDK configuration for server-side calls
 *
 * @example
 * ```ts
 * import { getSdkConfig } from '@/lib/sdk-server'
 * import { getLeaderboard } from '@/lib/identity'
 *
 * const config = getSdkConfig()
 * const leaderboard = await getLeaderboard(config, 'daily-scores', userId, { limit: 10 })
 * ```
 */
export function getSdkConfig(): SylphxConfig {
	if (!cachedConfig) {
		cachedConfig = createConfig({
			secretKey: process.env.COMMERCE_API_KEY || process.env.IDENTITY_API_KEY,
			platformUrl: process.env.IDENTITY_API_ORIGIN || 'https://api.identity.sylphx.com',
		})
	}
	return cachedConfig
}
