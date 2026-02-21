/**
 * Server-side SDK configuration for Puzzled
 *
 * Use this for server components and API routes that need to call
 * Platform SDK functions (leaderboards, achievements, etc.)
 */

import { type SylphxConfig, createConfig } from "@sylphx/sdk";
import { env } from "./env";

let cachedConfig: SylphxConfig | null = null;

/**
 * Get SDK configuration for server-side calls
 *
 * @example
 * ```ts
 * import { getSdkConfig } from '@/lib/sdk-server'
 * import { getLeaderboard } from '@sylphx/sdk'
 *
 * const config = getSdkConfig()
 * const leaderboard = await getLeaderboard(config, 'daily-scores', userId, { limit: 10 })
 * ```
 */
export function getSdkConfig(): SylphxConfig {
	if (!cachedConfig) {
		cachedConfig = createConfig({
			secretKey: env.SYLPHX_SECRET_KEY,
			platformUrl:
				process.env.NEXT_PUBLIC_SYLPHX_PLATFORM_URL || "https://sylphx.com",
		});
	}
	return cachedConfig;
}
