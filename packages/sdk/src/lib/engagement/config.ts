/**
 * Engagement Config Builders (Code First)
 *
 * Functions to define engagement features in app code.
 * These definitions are automatically synced to the platform.
 *
 * @example
 * ```typescript
 * // engagement.config.ts
 * import { defineStreak, defineLeaderboard, defineAchievement, createEngagementConfig } from '@sylphx/sdk'
 *
 * export const dailyStreak = defineStreak({
 *   id: 'daily-challenge',
 *   name: 'Daily Challenge',
 *   frequency: 'daily',
 *   gracePeriodHours: 4,
 * })
 *
 * export const highScores = defineLeaderboard({
 *   id: 'high-scores',
 *   name: 'High Scores',
 *   sortDirection: 'desc',
 *   resetPeriod: 'weekly',
 *   aggregation: 'max',
 * })
 *
 * export const firstWin = defineAchievement({
 *   id: 'first-win',
 *   name: 'First Victory',
 *   description: 'Win your first game',
 *   type: 'standard',
 *   tier: 'bronze',
 *   category: 'progression',
 *   icon: 'mdi:trophy',
 *   criteria: { event: 'game_won', count: 1 },
 * })
 *
 * // Export config for SDK initialization
 * export const engagementConfig = createEngagementConfig({
 *   streaks: [dailyStreak],
 *   leaderboards: [highScores],
 *   achievements: [firstWin],
 * })
 * ```
 */

import type {
	AchievementDefinition,
	AchievementTier,
	AchievementType,
	EngagementConfig,
	LeaderboardDefinition,
	StreakDefinition,
} from './types'

// ============================================================================
// Streak Builder
// ============================================================================

type StreakInput = Omit<StreakDefinition, 'id'> & { id: string }

/**
 * Define a streak configuration
 *
 * @example Daily streak with grace period
 * ```typescript
 * const dailyStreak = defineStreak({
 *   id: 'daily-challenge',
 *   name: 'Daily Challenge',
 *   frequency: 'daily',
 *   gracePeriodHours: 4,
 *   resetOnMiss: true,
 * })
 * ```
 *
 * @example Weekly streak
 * ```typescript
 * const weeklyStreak = defineStreak({
 *   id: 'weekly-workout',
 *   name: 'Weekly Workout',
 *   frequency: 'weekly',
 *   gracePeriodHours: 24,
 * })
 * ```
 */
export function defineStreak(input: StreakInput): StreakDefinition {
	// Validate
	if (!input.id || input.id.length === 0) {
		throw new Error('[Engagement] Streak id is required')
	}
	if (!input.name || input.name.length === 0) {
		throw new Error('[Engagement] Streak name is required')
	}
	if (input.frequency === 'custom' && !input.customIntervalHours) {
		throw new Error('[Engagement] Custom frequency requires customIntervalHours')
	}

	return {
		gracePeriodHours: 0,
		resetOnMiss: true,
		...input,
	}
}

// ============================================================================
// Leaderboard Builder
// ============================================================================

type LeaderboardInput = Omit<LeaderboardDefinition, 'id'> & { id: string }

/**
 * Define a leaderboard configuration
 *
 * @example Weekly high scores
 * ```typescript
 * const highScores = defineLeaderboard({
 *   id: 'high-scores',
 *   name: 'High Scores',
 *   sortDirection: 'desc',
 *   resetPeriod: 'weekly',
 *   aggregation: 'max',
 * })
 * ```
 *
 * @example All-time fastest times
 * ```typescript
 * const speedrun = defineLeaderboard({
 *   id: 'speedrun',
 *   name: 'Fastest Times',
 *   sortDirection: 'asc', // Lower is better
 *   resetPeriod: 'never',
 *   aggregation: 'min',
 * })
 * ```
 */
export function defineLeaderboard(input: LeaderboardInput): LeaderboardDefinition {
	// Validate
	if (!input.id || input.id.length === 0) {
		throw new Error('[Engagement] Leaderboard id is required')
	}
	if (!input.name || input.name.length === 0) {
		throw new Error('[Engagement] Leaderboard name is required')
	}

	return {
		defaultPrivacy: 'public',
		...input,
	}
}

// ============================================================================
// Achievement Builder
// ============================================================================

type AchievementInput = Omit<AchievementDefinition, 'id'> & { id: string }

/**
 * Define an achievement configuration
 *
 * @example Simple event-based achievement
 * ```typescript
 * const firstWin = defineAchievement({
 *   id: 'first-win',
 *   name: 'First Victory',
 *   description: 'Win your first game',
 *   type: 'standard',
 *   tier: 'bronze',
 *   category: 'progression',
 *   icon: 'mdi:trophy',
 *   criteria: { event: 'game_won', count: 1 },
 * })
 * ```
 *
 * @example Incremental achievement
 * ```typescript
 * const collector = defineAchievement({
 *   id: 'collector-100',
 *   name: 'Collector',
 *   description: 'Collect 100 items',
 *   type: 'incremental',
 *   tier: 'gold',
 *   category: 'collection',
 *   icon: 'mdi:treasure-chest',
 *   criteria: { event: 'item_collected' },
 *   target: 100,
 * })
 * ```
 *
 * @example Hidden achievement
 * ```typescript
 * const secret = defineAchievement({
 *   id: 'secret-combo',
 *   name: 'Secret Master',
 *   description: '???', // Hidden until unlocked
 *   unlockedDescription: 'Discovered the secret combo!',
 *   type: 'hidden',
 *   tier: 'platinum',
 *   category: 'secrets',
 *   icon: 'mdi:eye-off',
 *   criteria: {
 *     event: 'secret_found',
 *     conditions: [{ property: 'secretId', operator: 'eq', value: 'master-combo' }],
 *   },
 *   secret: true,
 * })
 * ```
 */
export function defineAchievement(input: AchievementInput): AchievementDefinition {
	// Validate
	if (!input.id || input.id.length === 0) {
		throw new Error('[Engagement] Achievement id is required')
	}
	if (!input.name || input.name.length === 0) {
		throw new Error('[Engagement] Achievement name is required')
	}
	if (input.type === 'incremental' && !input.target) {
		throw new Error('[Engagement] Incremental achievements require a target')
	}

	return {
		points: getDefaultPoints(input.tier),
		secret: input.type === 'hidden',
		...input,
	}
}

function getDefaultPoints(tier: AchievementTier): number {
	const points: Record<AchievementTier, number> = {
		bronze: 10,
		silver: 25,
		gold: 50,
		platinum: 100,
		diamond: 200,
	}
	return points[tier]
}

// ============================================================================
// Achievement Category Builder
// ============================================================================

export interface AchievementCategoryInput {
	id: string
	name: string
	icon?: string
	order?: number
}

/**
 * Define an achievement category for grouping
 *
 * @example
 * ```typescript
 * const categories = [
 *   defineAchievementCategory({ id: 'progression', name: 'Progression', icon: 'mdi:trending-up' }),
 *   defineAchievementCategory({ id: 'collection', name: 'Collection', icon: 'mdi:treasure-chest' }),
 *   defineAchievementCategory({ id: 'social', name: 'Social', icon: 'mdi:account-group' }),
 * ]
 * ```
 */
export function defineAchievementCategory(
	input: AchievementCategoryInput
): Required<AchievementCategoryInput> {
	return {
		order: 0,
		icon: 'mdi:folder',
		...input,
	}
}

// ============================================================================
// Config Aggregator
// ============================================================================

export interface EngagementConfigInput {
	streaks?: StreakDefinition[]
	leaderboards?: LeaderboardDefinition[]
	achievements?: AchievementDefinition[]
	achievementCategories?: AchievementCategoryInput[]
}

/**
 * Create a complete engagement configuration
 *
 * This config is passed to SylphxProvider for automatic sync.
 *
 * @example
 * ```typescript
 * // engagement.config.ts
 * import { createEngagementConfig, defineStreak, defineLeaderboard, defineAchievement } from '@sylphx/sdk'
 *
 * export const engagementConfig = createEngagementConfig({
 *   streaks: [
 *     defineStreak({ id: 'daily', name: 'Daily', frequency: 'daily' }),
 *   ],
 *   leaderboards: [
 *     defineLeaderboard({ id: 'scores', name: 'Scores', sortDirection: 'desc', resetPeriod: 'weekly', aggregation: 'max' }),
 *   ],
 *   achievements: [
 *     defineAchievement({ id: 'first', name: 'First', description: 'First!', type: 'standard', tier: 'bronze', category: 'misc', icon: 'mdi:star', criteria: { event: 'start' } }),
 *   ],
 * })
 *
 * // Then in your app
 * <SylphxProvider config={config} engagement={engagementConfig}>
 * ```
 */
export function createEngagementConfig(input: EngagementConfigInput): EngagementConfig {
	// Validate unique IDs
	const streakIds = new Set<string>()
	const leaderboardIds = new Set<string>()
	const achievementIds = new Set<string>()

	for (const streak of input.streaks ?? []) {
		if (streakIds.has(streak.id)) {
			throw new Error(`[Engagement] Duplicate streak ID: ${streak.id}`)
		}
		streakIds.add(streak.id)
	}

	for (const leaderboard of input.leaderboards ?? []) {
		if (leaderboardIds.has(leaderboard.id)) {
			throw new Error(`[Engagement] Duplicate leaderboard ID: ${leaderboard.id}`)
		}
		leaderboardIds.add(leaderboard.id)
	}

	for (const achievement of input.achievements ?? []) {
		if (achievementIds.has(achievement.id)) {
			throw new Error(`[Engagement] Duplicate achievement ID: ${achievement.id}`)
		}
		achievementIds.add(achievement.id)
	}

	// Validate achievement categories exist
	const categoryIds = new Set(input.achievementCategories?.map((c) => c.id) ?? [])
	for (const achievement of input.achievements ?? []) {
		if (categoryIds.size > 0 && !categoryIds.has(achievement.category)) {
			console.warn(
				`[Engagement] Achievement "${achievement.id}" references undefined category "${achievement.category}"`
			)
		}
	}

	return {
		streaks: input.streaks ?? [],
		leaderboards: input.leaderboards ?? [],
		achievements: input.achievements ?? [],
		achievementCategories: input.achievementCategories?.map((c) => ({
			...c,
			order: c.order ?? 0,
		})),
	}
}

// ============================================================================
// Config Hash (for sync)
// ============================================================================

/**
 * Generate a hash of the config for change detection
 * Used by SDK to determine if config needs syncing
 */
export function hashEngagementConfig(config: EngagementConfig): string {
	const content = JSON.stringify({
		streaks: config.streaks?.map((s) => s.id).sort(),
		leaderboards: config.leaderboards?.map((l) => l.id).sort(),
		achievements: config.achievements?.map((a) => a.id).sort(),
	})

	// Simple hash (in production, use crypto.subtle)
	let hash = 0
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32bit integer
	}
	return Math.abs(hash).toString(36)
}
