/**
 * Explicit composition root for Puzzled Connect product clients.
 * Stats / leaderboard product authority — not Health-only.
 */
export { resolveStatsProductAuthorityMode, planStatsLeaderboardProduct } from "./stats-product-authority"
export { getLeaderboard, createStatsServiceClient } from "./stats-client"
export { statsQueryKeys } from "./stats-client"
