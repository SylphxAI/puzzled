/**
 * Engagement Functions
 *
 * Pure functions for streaks, leaderboards, and achievements.
 * Config is defined in app code (Code First) and synced automatically.
 */

import { type SylphxConfig, callTrpc } from './config'

// Re-export types and config builders
export type {
	// Streaks
	StreakDefinition,
	StreakState,
	StreakFrequency,
	RecordActivityInput,
	RecordActivityResult,
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
	// Config
	EngagementConfig,
} from './lib/engagement/types'

export {
	defineStreak,
	defineLeaderboard,
	defineAchievement,
	defineAchievementCategory,
	createEngagementConfig,
	hashEngagementConfig,
	type EngagementConfigInput,
	type AchievementCategoryInput,
} from './lib/engagement/config'

export { ACHIEVEMENT_TIER_CONFIG } from './lib/engagement/types'

// ============================================================================
// Streak Functions
// ============================================================================

import type { RecordActivityInput, RecordActivityResult, StreakState } from './lib/engagement/types'

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
 * @example
 * ```typescript
 * const result = await recordStreakActivity(config, {
 *   streakId: 'daily-challenge',
 * }, userId)
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
	userId: string
): Promise<RecordActivityResult> {
	return callTrpc(config, 'engagement.recordActivity', { ...input, userId }, 'mutation')
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
 * @example
 * ```typescript
 * const result = await submitScore(config, {
 *   leaderboardId: 'high-scores',
 *   value: 1500,
 *   metadata: { level: 'hard' },
 * }, userId)
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
	userId: string
): Promise<SubmitScoreResult> {
	return callTrpc(config, 'engagement.submitScore', { ...input, userId }, 'mutation')
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

import type { AchievementUnlockEvent, UserAchievement } from './lib/engagement/types'

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
 * Manually unlock an achievement (for achievements that can't be auto-detected)
 *
 * Most achievements are unlocked automatically via event tracking.
 * Use this for edge cases like admin grants or migrations.
 *
 * @example
 * ```typescript
 * const result = await unlockAchievement(config, 'special-event-2024', userId)
 * if (result.isNew) {
 *   showAchievementToast(result.achievement)
 * }
 * ```
 */
export async function unlockAchievement(
	config: SylphxConfig,
	achievementId: string,
	userId: string
): Promise<AchievementUnlockEvent> {
	return callTrpc(config, 'engagement.unlockAchievement', { achievementId, userId }, 'mutation')
}

/**
 * Increment progress on an incremental achievement
 *
 * @example
 * ```typescript
 * // User collected an item
 * const result = await incrementAchievementProgress(config, 'collector-100', 1, userId)
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
	userId: string
): Promise<UserAchievement> {
	return callTrpc(
		config,
		'engagement.incrementProgress',
		{ achievementId, amount, userId },
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

// ============================================================================
// Config Sync (Internal - called by SDK on init)
// ============================================================================

import type { EngagementConfig } from './lib/engagement/types'
import { hashEngagementConfig } from './lib/engagement/config'

/**
 * Sync engagement config to platform (called automatically by SDK)
 *
 * This is called during SylphxProvider initialization to ensure
 * the platform has the latest config from app code.
 *
 * @internal
 */
export async function syncEngagementConfig(
	config: SylphxConfig,
	engagement: EngagementConfig
): Promise<{ synced: boolean; hash: string }> {
	const hash = hashEngagementConfig(engagement)

	return callTrpc(
		config,
		'engagement.syncConfig',
		{
			hash,
			config: engagement,
		},
		'mutation'
	)
}
