/**
 * Engagement Functions
 *
 * Pure functions for streaks, leaderboards, and achievements.
 *
 * ## Architecture (ADR-004)
 *
 * Engagement uses **Inline Defaults + Auto-Discovery + Console Override**:
 * - Code provides optional inline defaults when calling functions
 * - Platform auto-discovers/creates entities when first referenced
 * - Console can override names, descriptions, values without deployment
 *
 * @example
 * ```typescript
 * import { unlockAchievement, recordStreakActivity, submitScore } from '@sylphx/sdk'
 *
 * // Unlock achievement with inline defaults (auto-discovered if doesn't exist)
 * await unlockAchievement(config, 'first-win', userId, {
 *   name: 'First Win',
 *   description: 'Won your first game',
 *   points: 100,
 *   tier: 'bronze',
 * })
 *
 * // Record streak activity with inline defaults
 * await recordStreakActivity(config, { streakId: 'daily-login' }, userId, {
 *   name: 'Daily Login',
 *   frequency: 'daily',
 *   gracePeriodHours: 12,
 * })
 *
 * // Submit leaderboard score with inline defaults
 * await submitScore(config, { leaderboardId: 'high-scores', value: 1500 }, userId, {
 *   name: 'High Scores',
 *   sortDirection: 'desc',
 *   resetPeriod: 'weekly',
 * })
 * ```
 */

import { type SylphxConfig, callTrpc } from './config'

// Re-export types from types file
export type {
	// Streaks
	StreakDefinition,
	StreakState,
	StreakFrequency,
	RecordActivityInput,
	RecordActivityResult,
	StreakDefaults,
	// Leaderboards
	LeaderboardDefinition,
	LeaderboardEntry,
	LeaderboardResult,
	LeaderboardQueryOptions,
	LeaderboardSortDirection,
	LeaderboardResetPeriod,
	LeaderboardAggregation,
	SubmitScoreInput,
	SubmitScoreResult,
	LeaderboardDefaults,
	// Achievements
	AchievementDefinition,
	AchievementType,
	AchievementTier,
	AchievementCategory,
	AchievementCriteria,
	AchievementCriterion,
	CriteriaOperator,
	UserAchievement,
	AchievementUnlockEvent,
	AchievementDefaults,
} from './lib/engagement/types'

export { ACHIEVEMENT_TIER_CONFIG } from './lib/engagement/types'

// ============================================================================
// Streak Functions
// ============================================================================

import type {
	RecordActivityInput,
	RecordActivityResult,
	StreakState,
	StreakDefaults,
} from './lib/engagement/types'

/**
 * Get current streak state for a user
 *
 * @example
 * ```typescript
 * const streak = await getStreak(config, 'daily-challenge', userId)
 * console.log(`Current streak: ${streak.current}`)
 * console.log(`Expires in: ${streak.timeRemainingMs}ms`)
 * ```
 */
export async function getStreak(
	config: SylphxConfig,
	streakId: string,
	userId: string
): Promise<StreakState> {
	return callTrpc(config, 'engagement.getStreak', { streakId, userId }, 'query')
}

/**
 * Get all streak states for a user
 *
 * @example
 * ```typescript
 * const streaks = await getAllStreaks(config, userId)
 * for (const streak of streaks) {
 *   console.log(`${streak.streakId}: ${streak.current}`)
 * }
 * ```
 */
export async function getAllStreaks(config: SylphxConfig, userId: string): Promise<StreakState[]> {
	return callTrpc(config, 'engagement.getAllStreaks', { userId }, 'query')
}

/**
 * Record an activity to extend/maintain a streak
 *
 * If the streak doesn't exist, it will be auto-discovered with the provided defaults.
 * Console can override any values without deployment.
 *
 * @param config - SDK configuration
 * @param input - Activity input (streakId required)
 * @param userId - User ID
 * @param defaults - Optional inline defaults for auto-discovery
 *
 * @example
 * ```typescript
 * const result = await recordStreakActivity(config, {
 *   streakId: 'daily-challenge',
 * }, userId, {
 *   name: 'Daily Challenge',
 *   frequency: 'daily',
 *   gracePeriodHours: 12,
 * })
 *
 * if (result.extended) {
 *   console.log(`Streak extended to ${result.streak.current}!`)
 * }
 * if (result.newPersonalBest) {
 *   console.log('New personal best!')
 * }
 * ```
 */
export async function recordStreakActivity(
	config: SylphxConfig,
	input: RecordActivityInput,
	userId: string,
	defaults?: StreakDefaults
): Promise<RecordActivityResult> {
	return callTrpc(
		config,
		'engagement.recordActivity',
		{ ...input, userId, defaults },
		'mutation'
	)
}

/**
 * Recover a streak within grace period (may require payment/reward)
 *
 * @example
 * ```typescript
 * const result = await recoverStreak(config, 'daily-challenge', userId)
 * if (result.success) {
 *   console.log(`Streak recovered at ${result.streak.current}`)
 * }
 * ```
 */
export async function recoverStreak(
	config: SylphxConfig,
	streakId: string,
	userId: string
): Promise<{ success: boolean; streak: StreakState }> {
	return callTrpc(config, 'engagement.recoverStreak', { streakId, userId }, 'mutation')
}

// ============================================================================
// Leaderboard Functions
// ============================================================================

import type {
	LeaderboardQueryOptions,
	LeaderboardResult,
	SubmitScoreInput,
	SubmitScoreResult,
	LeaderboardDefaults,
} from './lib/engagement/types'

/**
 * Get leaderboard entries
 *
 * @example
 * ```typescript
 * const result = await getLeaderboard(config, 'high-scores', userId, {
 *   limit: 10,
 *   includeSurrounding: true,
 * })
 *
 * for (const entry of result.entries) {
 *   console.log(`#${entry.rank} ${entry.displayName}: ${entry.value}`)
 * }
 *
 * if (result.currentUserEntry) {
 *   console.log(`Your rank: #${result.currentUserEntry.rank}`)
 * }
 * ```
 */
export async function getLeaderboard(
	config: SylphxConfig,
	leaderboardId: string,
	userId: string | null,
	options?: LeaderboardQueryOptions
): Promise<LeaderboardResult> {
	return callTrpc(
		config,
		'engagement.getLeaderboard',
		{ leaderboardId, userId, ...options },
		'query'
	)
}

/**
 * Submit a score to a leaderboard
 *
 * If the leaderboard doesn't exist, it will be auto-discovered with the provided defaults.
 * Console can override any values without deployment.
 *
 * @param config - SDK configuration
 * @param input - Score submission input (leaderboardId, value required)
 * @param userId - User ID
 * @param defaults - Optional inline defaults for auto-discovery
 *
 * @example
 * ```typescript
 * const result = await submitScore(config, {
 *   leaderboardId: 'high-scores',
 *   value: 1500,
 *   metadata: { level: 'hard' },
 * }, userId, {
 *   name: 'High Scores',
 *   sortDirection: 'desc',
 *   resetPeriod: 'weekly',
 *   aggregation: 'max',
 * })
 *
 * if (result.newPersonalBest) {
 *   console.log('New personal best!')
 * }
 * if (result.rank !== null) {
 *   console.log(`Ranked #${result.rank}`)
 * }
 * ```
 */
export async function submitScore(
	config: SylphxConfig,
	input: SubmitScoreInput,
	userId: string,
	defaults?: LeaderboardDefaults
): Promise<SubmitScoreResult> {
	return callTrpc(
		config,
		'engagement.submitScore',
		{ ...input, userId, defaults },
		'mutation'
	)
}

/**
 * Get user's rank on a leaderboard (even if not in top entries)
 *
 * @example
 * ```typescript
 * const rank = await getUserRank(config, 'high-scores', userId)
 * if (rank) {
 *   console.log(`You are ranked #${rank.rank} with score ${rank.value}`)
 * }
 * ```
 */
export async function getUserLeaderboardRank(
	config: SylphxConfig,
	leaderboardId: string,
	userId: string
): Promise<{ rank: number; value: number } | null> {
	return callTrpc(config, 'engagement.getUserRank', { leaderboardId, userId }, 'query')
}

// ============================================================================
// Achievement Functions
// ============================================================================

import type {
	AchievementUnlockEvent,
	UserAchievement,
	AchievementDefaults,
} from './lib/engagement/types'

/**
 * Get all achievements with user progress
 *
 * @example
 * ```typescript
 * const achievements = await getAchievements(config, userId)
 *
 * const unlocked = achievements.filter(a => a.unlocked)
 * console.log(`${unlocked.length} achievements unlocked`)
 *
 * const inProgress = achievements.filter(a => !a.unlocked && a.progress > 0)
 * for (const a of inProgress) {
 *   console.log(`${a.achievementId}: ${a.progress}/${a.target}`)
 * }
 * ```
 */
export async function getAchievements(
	config: SylphxConfig,
	userId: string
): Promise<UserAchievement[]> {
	return callTrpc(config, 'engagement.getAchievements', { userId }, 'query')
}

/**
 * Get a single achievement with user progress
 *
 * @example
 * ```typescript
 * const achievement = await getAchievement(config, 'first-win', userId)
 * if (achievement?.unlocked) {
 *   console.log(`Unlocked at ${achievement.unlockedAt}`)
 * }
 * ```
 */
export async function getAchievement(
	config: SylphxConfig,
	achievementId: string,
	userId: string
): Promise<UserAchievement | null> {
	return callTrpc(config, 'engagement.getAchievement', { achievementId, userId }, 'query')
}

/**
 * Manually unlock an achievement
 *
 * If the achievement doesn't exist, it will be auto-discovered with the provided defaults.
 * Console can override any values without deployment.
 *
 * @param config - SDK configuration
 * @param achievementId - Achievement ID
 * @param userId - User ID
 * @param defaults - Optional inline defaults for auto-discovery
 *
 * @example
 * ```typescript
 * const result = await unlockAchievement(config, 'first-purchase', userId, {
 *   name: 'First Purchase',
 *   description: 'Made your first purchase',
 *   points: 100,
 *   tier: 'bronze',
 * })
 * if (result.isNew) {
 *   showAchievementToast(result.achievement)
 * }
 * ```
 */
export async function unlockAchievement(
	config: SylphxConfig,
	achievementId: string,
	userId: string,
	defaults?: AchievementDefaults
): Promise<AchievementUnlockEvent> {
	return callTrpc(
		config,
		'engagement.unlockAchievement',
		{ achievementId, userId, defaults },
		'mutation'
	)
}

/**
 * Increment progress on an incremental achievement
 *
 * If the achievement doesn't exist, it will be auto-discovered with the provided defaults.
 * Console can override any values without deployment.
 *
 * @param config - SDK configuration
 * @param achievementId - Achievement ID
 * @param amount - Amount to increment
 * @param userId - User ID
 * @param defaults - Optional inline defaults for auto-discovery
 *
 * @example
 * ```typescript
 * // User collected an item
 * const result = await incrementAchievementProgress(config, 'collector-100', 1, userId, {
 *   name: 'Collector',
 *   description: 'Collect 100 items',
 *   type: 'incremental',
 *   target: 100,
 *   tier: 'silver',
 * })
 *
 * if (result.unlocked) {
 *   console.log('Achievement unlocked!')
 * } else {
 *   console.log(`Progress: ${result.progress}/${result.target}`)
 * }
 * ```
 */
export async function incrementAchievementProgress(
	config: SylphxConfig,
	achievementId: string,
	amount: number,
	userId: string,
	defaults?: AchievementDefaults
): Promise<UserAchievement> {
	return callTrpc(
		config,
		'engagement.incrementProgress',
		{ achievementId, amount, userId, defaults },
		'mutation'
	)
}

/**
 * Get total achievement points for a user
 *
 * @example
 * ```typescript
 * const points = await getAchievementPoints(config, userId)
 * console.log(`Total points: ${points.total}`)
 * console.log(`This month: ${points.thisMonth}`)
 * ```
 */
export async function getAchievementPoints(
	config: SylphxConfig,
	userId: string
): Promise<{ total: number; thisMonth: number; rank: number | null }> {
	return callTrpc(config, 'engagement.getPoints', { userId }, 'query')
}

