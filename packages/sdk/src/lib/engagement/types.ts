/**
 * Engagement Service Types
 *
 * Core types for streaks, leaderboards, and achievements.
 *
 * ## Architecture (ADR-004)
 *
 * Engagement uses **Inline Defaults + Auto-Discovery + Console Override**:
 * - Code provides optional inline defaults when calling APIs
 * - Platform auto-discovers/creates entities when first referenced
 * - Console can override names, descriptions, values without deployment
 */

// ============================================================================
// Streaks
// ============================================================================

/** Streak activity frequency */
export type StreakFrequency = 'daily' | 'weekly' | 'custom'

/** Streak definition (auto-discovered or from Console) */
export interface StreakDefinition {
	/** Unique identifier */
	id: string
	/** Display name */
	name: string
	/** Description */
	description?: string
	/** Activity frequency */
	frequency: StreakFrequency
	/** Grace period in hours (default: 0) */
	gracePeriodHours?: number
	/** Whether streak resets on miss (default: true) */
	resetOnMiss?: boolean
	/** Maximum streak value (optional cap) */
	maxValue?: number
	/** Custom interval in hours (only for 'custom' frequency) */
	customIntervalHours?: number
}

/** User's streak state (from platform) */
export interface StreakState {
	/** Streak definition ID */
	streakId: string
	/** Current streak count */
	current: number
	/** Longest streak ever */
	longest: number
	/** Last activity timestamp */
	lastActivityAt: string | null
	/** When current streak will expire */
	expiresAt: string | null
	/** Whether streak can be recovered (within grace period) */
	canRecover: boolean
	/** Time remaining until expiry in ms */
	timeRemainingMs: number | null
}

/** Activity recording input */
export interface RecordActivityInput {
	/** Streak ID */
	streakId: string
	/** Optional metadata */
	metadata?: Record<string, unknown>
}

/** Activity recording result */
export interface RecordActivityResult {
	/** Updated streak state */
	streak: StreakState
	/** Whether this activity extended the streak */
	extended: boolean
	/** Whether a new personal best was achieved */
	newPersonalBest: boolean
	/** Previous streak value (for animation) */
	previousValue: number
}

// ============================================================================
// Leaderboards
// ============================================================================

/** Leaderboard sort direction */
export type LeaderboardSortDirection = 'asc' | 'desc'

/** Leaderboard reset period */
export type LeaderboardResetPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'never'

/** Score aggregation method */
export type LeaderboardAggregation = 'max' | 'sum' | 'latest' | 'count' | 'min' | 'avg'

/** Leaderboard definition (auto-discovered or from Console) */
export interface LeaderboardDefinition {
	/** Unique identifier */
	id: string
	/** Display name */
	name: string
	/** Description */
	description?: string
	/** Sort direction (desc = higher is better) */
	sortDirection: LeaderboardSortDirection
	/** Reset period */
	resetPeriod: LeaderboardResetPeriod
	/** How to aggregate multiple scores from same user */
	aggregation: LeaderboardAggregation
	/** Default privacy for entries */
	defaultPrivacy?: 'public' | 'friends' | 'anonymous'
	/** Maximum entries to keep per period */
	maxEntries?: number
}

/** Leaderboard entry */
export interface LeaderboardEntry {
	/** Rank (1-indexed) */
	rank: number
	/** User ID (may be null for anonymous) */
	userId: string | null
	/** Display name */
	displayName: string
	/** Avatar URL */
	avatarUrl: string | null
	/** Score/value */
	value: number
	/** Whether this is the current user */
	isCurrentUser: boolean
	/** Entry metadata */
	metadata?: Record<string, unknown>
	/** When the score was submitted */
	submittedAt: string
}

/** Leaderboard query options */
export interface LeaderboardQueryOptions {
	/** Number of entries to return (default: 10) */
	limit?: number
	/** Offset for pagination */
	offset?: number
	/** Include surrounding entries for current user */
	includeSurrounding?: boolean
	/** Number of surrounding entries (default: 2) */
	surroundingCount?: number
}

/** Leaderboard query result */
export interface LeaderboardResult {
	/** Leaderboard definition ID */
	leaderboardId: string
	/** Period (for periodic leaderboards) */
	period?: string
	/** Entries */
	entries: LeaderboardEntry[]
	/** Current user's entry (may not be in top entries) */
	currentUserEntry: LeaderboardEntry | null
	/** Total participants */
	totalParticipants: number
	/** Next reset time (for periodic leaderboards) */
	nextResetAt: string | null
}

/** Score submission input */
export interface SubmitScoreInput {
	/** Leaderboard ID */
	leaderboardId: string
	/** Score value */
	value: number
	/** Optional metadata */
	metadata?: Record<string, unknown>
}

/** Score submission result */
export interface SubmitScoreResult {
	/** Whether submission was accepted */
	accepted: boolean
	/** New rank (if in leaderboard) */
	rank: number | null
	/** Previous best (if any) */
	previousBest: number | null
	/** Whether this is a new personal best */
	newPersonalBest: boolean
	/** Rank change (positive = improved) */
	rankChange: number | null
}

// ============================================================================
// Achievements
// ============================================================================

/** Achievement type */
export type AchievementType = 'standard' | 'hidden' | 'incremental'

/** Achievement tier */
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

/** Achievement category */
export type AchievementCategory = string // App-defined

/** Achievement criteria operator */
export type CriteriaOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains'

/** Single criterion */
export interface AchievementCriterion {
	/** Property to check (e.g., 'event', 'count', 'streak.daily') */
	property: string
	/** Comparison operator */
	operator: CriteriaOperator
	/** Value to compare against */
	value: string | number | boolean | string[] | number[]
}

/** Achievement criteria (AND logic within, OR between arrays) */
export interface AchievementCriteria {
	/** Event name to track (for event-based achievements) */
	event?: string
	/** Required count of events */
	count?: number
	/** Additional conditions */
	conditions?: AchievementCriterion[]
}

/** Achievement definition (auto-discovered or from Console) */
export interface AchievementDefinition {
	/** Unique identifier */
	id: string
	/** Display name */
	name: string
	/** Description (shown before unlock) */
	description: string
	/** Description shown after unlock (optional) */
	unlockedDescription?: string
	/** Achievement type */
	type: AchievementType
	/** Tier/rarity */
	tier: AchievementTier
	/** Category (app-defined) */
	category: AchievementCategory
	/** Icon (Iconify name or URL) */
	icon: string
	/** Points awarded */
	points?: number
	/** Unlock criteria */
	criteria: AchievementCriteria
	/** Target value for incremental achievements */
	target?: number
	/** Whether to show in list before unlock */
	secret?: boolean
	/** Order in list */
	order?: number
}

/** User's achievement state */
export interface UserAchievement {
	/** Achievement definition ID */
	achievementId: string
	/** Whether unlocked */
	unlocked: boolean
	/** Unlock timestamp */
	unlockedAt: string | null
	/** Progress (for incremental) */
	progress: number
	/** Target (for incremental) */
	target: number | null
	/** Progress percentage (0-100) */
	progressPercent: number
}

/** Achievement unlock event */
export interface AchievementUnlockEvent {
	/** Achievement definition */
	achievement: AchievementDefinition
	/** User achievement state */
	userAchievement: UserAchievement
	/** Whether this is a new unlock (vs already unlocked) */
	isNew: boolean
}

// ============================================================================
// Engagement Config (from Platform)
// ============================================================================

/** Complete engagement configuration (fetched from platform) */
export interface EngagementConfig {
	/** Streak definitions */
	streaks?: StreakDefinition[]
	/** Leaderboard definitions */
	leaderboards?: LeaderboardDefinition[]
	/** Achievement definitions */
	achievements?: AchievementDefinition[]
	/** Achievement categories (for UI grouping) */
	achievementCategories?: {
		id: string
		name: string
		icon?: string
		order?: number
	}[]
}

// ============================================================================
// Tier Metadata (for UI)
// ============================================================================

export const ACHIEVEMENT_TIER_CONFIG = {
	bronze: { color: '#CD7F32', points: 10 },
	silver: { color: '#C0C0C0', points: 25 },
	gold: { color: '#FFD700', points: 50 },
	platinum: { color: '#00CED1', points: 100 },
	diamond: { color: '#B9F2FF', points: 200 },
} as const

// ============================================================================
// Inline Defaults (Auto-Discovery)
// ============================================================================
// These types define the optional inline defaults that can be passed when
// calling engagement functions. If the entity doesn't exist, the platform
// will auto-create it with these defaults. Console can override any values.

/**
 * Inline defaults for streak auto-discovery
 *
 * @example
 * ```typescript
 * await recordStreakActivity(config, { streakId: 'daily-login' }, userId, {
 *   name: 'Daily Login',
 *   frequency: 'daily',
 *   gracePeriodHours: 12,
 * })
 * ```
 */
export interface StreakDefaults {
	/** Display name */
	name?: string
	/** Description */
	description?: string
	/** Activity frequency */
	frequency?: StreakFrequency
	/** Grace period in hours (default: 0) */
	gracePeriodHours?: number
	/** Whether streak resets on miss (default: true) */
	resetOnMiss?: boolean
	/** Maximum streak value (optional cap) */
	maxValue?: number
	/** Custom interval in hours (only for 'custom' frequency) */
	customIntervalHours?: number
}

/**
 * Inline defaults for leaderboard auto-discovery
 *
 * @example
 * ```typescript
 * await submitScore(config, { leaderboardId: 'high-scores', value: 1500 }, userId, {
 *   name: 'High Scores',
 *   sortDirection: 'desc',
 *   resetPeriod: 'weekly',
 * })
 * ```
 */
export interface LeaderboardDefaults {
	/** Display name */
	name?: string
	/** Description */
	description?: string
	/** Sort direction (desc = higher is better) */
	sortDirection?: LeaderboardSortDirection
	/** Reset period */
	resetPeriod?: LeaderboardResetPeriod
	/** How to aggregate multiple scores from same user */
	aggregation?: LeaderboardAggregation
	/** Maximum entries to keep per period */
	maxEntries?: number
}

/**
 * Inline defaults for achievement auto-discovery
 *
 * @example
 * ```typescript
 * await unlockAchievement(config, 'first-purchase', userId, {
 *   name: 'First Purchase',
 *   description: 'Made your first purchase',
 *   points: 100,
 *   tier: 'bronze',
 * })
 * ```
 */
export interface AchievementDefaults {
	/** Display name */
	name?: string
	/** Description (shown before unlock) */
	description?: string
	/** Description shown after unlock */
	unlockedDescription?: string
	/** Achievement type */
	type?: AchievementType
	/** Tier/rarity */
	tier?: AchievementTier
	/** Category (app-defined) */
	category?: AchievementCategory
	/** Icon (Iconify name or URL) */
	icon?: string
	/** Points awarded */
	points?: number
	/** Target value for incremental achievements */
	target?: number
	/** Whether to show in list before unlock */
	secret?: boolean
}
