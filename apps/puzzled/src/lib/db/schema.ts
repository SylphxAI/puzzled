/**
 * Puzzled Database Schema
 *
 * ARCHITECTURE: Apps store ONLY business data.
 * Platform (Sylphx) owns: Identity, Auth, Billing, Sessions, Security
 *
 * User references use `userId: uuid('user_id').notNull()` - no FK constraint.
 * Platform is source of truth for user data.
 */

import { relations } from 'drizzle-orm'
import {
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'

// ==========================================
// ENUMS (Business Logic Only)
// ==========================================

/** Game completion status */
export const gameStatusEnum = pgEnum('game_status', ['in_progress', 'won', 'lost', 'abandoned'])

/** Game mode: daily puzzle or archive */
export const gameModeEnum = pgEnum('game_mode', ['daily', 'archive'])

/** Puzzle difficulty levels */
export const puzzleDifficultyEnum = pgEnum('puzzle_difficulty', ['easy', 'medium', 'hard'])

/** Win-back email sequence types */
export const winBackEmailTypeEnum = pgEnum('win_back_email_type', ['day7', 'day14', 'day30'])

/** Dead letter queue status */
export const dlqStatusEnum = pgEnum('dlq_status', ['pending', 'retrying', 'resolved', 'failed'])

/** Audit log action types */
export const auditActionEnum = pgEnum('audit_action', [
	'create',
	'update',
	'delete',
	'game_complete',
	'streak_update',
	'achievement_unlock',
	'admin_action',
])

/** Announcement display types */
export const announcementTypeEnum = pgEnum('announcement_type', [
	'info',
	'warning',
	'success',
	'maintenance',
])

// ==========================================
// ENUM TYPE EXPORTS (SSOT)
// ==========================================

/** Game status type */
export type GameStatus = (typeof gameStatusEnum.enumValues)[number]

/** Game mode type */
export type GameMode = (typeof gameModeEnum.enumValues)[number]

/** Puzzle difficulty type */
export type PuzzleDifficulty = (typeof puzzleDifficultyEnum.enumValues)[number]

/** Win-back email type */
export type WinBackEmailType = (typeof winBackEmailTypeEnum.enumValues)[number]

/** DLQ status type */
export type DLQStatus = (typeof dlqStatusEnum.enumValues)[number]

/** Audit action type */
export type AuditAction = (typeof auditActionEnum.enumValues)[number]

/** Announcement type */
export type AnnouncementType = (typeof announcementTypeEnum.enumValues)[number]

// ==========================================
// ENUM VALUE ARRAYS (For Zod Schemas)
// ==========================================

/** All game status values */
export const GAME_STATUS_VALUES = gameStatusEnum.enumValues

/** Game result statuses (won/lost only, not in_progress/abandoned) */
export const GAME_RESULT_STATUSES = ['won', 'lost'] as const satisfies readonly GameStatus[]
export type GameResultStatus = (typeof GAME_RESULT_STATUSES)[number]

/** All game mode values */
export const GAME_MODE_VALUES = gameModeEnum.enumValues

/** All puzzle difficulty values */
export const PUZZLE_DIFFICULTY_VALUES = puzzleDifficultyEnum.enumValues

/** DLQ status values */
export const DLQ_STATUS_VALUES = dlqStatusEnum.enumValues

// ==========================================
// USER PREFERENCES (App-Specific Settings)
// ==========================================

/**
 * App-specific user preferences.
 * userId is the platform user ID (no FK - platform is source of truth).
 */
export const userPreferences = pgTable(
	'user_preferences',
	{
		/** Platform user ID (primary key, no FK) */
		userId: uuid('user_id').primaryKey(),

		// Privacy Settings
		/** Whether user appears on public leaderboards */
		leaderboardVisible: boolean('leaderboard_visible').default(true).notNull(),

		// UI Preferences
		/** Compact mode for dense information display */
		compactMode: boolean('compact_mode').default(false).notNull(),

		// Language Preference
		/** User's preferred locale (e.g., 'en-US', 'zh-HK') */
		locale: text('locale').default('en-US'),

		// App-Specific Profile
		/** Optional in-app username (distinct from platform name) */
		username: text('username').unique(),
		/** User bio for profile display */
		bio: text('bio'),
		/** Whether profile is publicly visible */
		isPublicProfile: boolean('is_public_profile').default(false).notNull(),

		// Timestamps
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [
		// Index for leaderboard visibility filtering
		index('user_preferences_leaderboard_visible_idx').on(table.leaderboardVisible),
	],
)

// ==========================================
// USER DISPLAY CACHE (For Leaderboards)
// ==========================================

/**
 * Cached user display data from platform.
 * Refreshed via webhooks for efficient leaderboard rendering and win-back emails.
 *
 * Email is stored for CAN-SPAM compliant marketing (users have opted in via notificationPreferences).
 */
export const userDisplayCache = pgTable('user_display_cache', {
	/** Platform user ID (primary key, no FK) */
	userId: uuid('user_id').primaryKey(),

	/** User email (for win-back emails - CAN-SPAM requires storing opted-in emails) */
	email: text('email'),

	/** Cached display name from platform */
	displayName: text('display_name'),

	/** Cached avatar URL from platform */
	avatarUrl: text('avatar_url'),

	/** When this cache entry was last refreshed */
	cachedAt: timestamp('cached_at').defaultNow().notNull(),
})

// ==========================================
// DAILY PUZZLES
// ==========================================

/**
 * Daily puzzles for all games.
 * No user reference - this is pure game content.
 */
export const dailyPuzzles = pgTable(
	'daily_puzzles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		/** Game identifier (e.g., 'wordle', 'number-game') */
		gameSlug: text('game_slug').notNull(),
		/** Date this puzzle is for */
		puzzleDate: timestamp('puzzle_date').notNull(),
		/** Puzzle configuration/data (game-specific JSON) */
		puzzleData: jsonb('puzzle_data').notNull(),
		/** Puzzle solution (game-specific JSON) */
		solution: jsonb('solution'),
		/** Difficulty level (null for games without difficulty) */
		difficulty: puzzleDifficultyEnum('difficulty'),
		/** Generation seed for reproducibility (YYYYMMDD format) */
		seed: integer('seed'),
		/** Generator algorithm version for migration tracking */
		generatorVersion: text('generator_version').default('v1.0'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		// Unique: one puzzle per game per date per difficulty
		uniqueIndex('daily_puzzles_game_date_difficulty_idx').on(
			table.gameSlug,
			table.puzzleDate,
			table.difficulty,
		),
		index('daily_puzzles_date_idx').on(table.puzzleDate),
		index('daily_puzzles_game_slug_idx').on(table.gameSlug),
	],
)

// ==========================================
// GAME SESSIONS
// ==========================================

/**
 * Individual game play sessions.
 * Tracks game progress, attempts, and results.
 */
export const gameSessions = pgTable(
	'game_sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		/** Platform user ID (no FK - platform is source of truth) */
		userId: uuid('user_id').notNull(),

		/** Game identifier */
		gameSlug: text('game_slug').notNull(),

		/** Reference to the puzzle being played */
		puzzleId: uuid('puzzle_id').references(() => dailyPuzzles.id, {
			onDelete: 'set null',
		}),

		/** Puzzle date (denormalized for query efficiency) */
		puzzleDate: timestamp('puzzle_date'),

		/** Difficulty level for games that support it */
		difficulty: puzzleDifficultyEnum('difficulty'),

		/** Game mode: daily or archive */
		mode: gameModeEnum('mode').default('daily').notNull(),

		/** Archive date (only set when mode = 'archive') */
		archiveDate: timestamp('archive_date'),

		/** Current game status */
		status: gameStatusEnum('status').default('in_progress').notNull(),

		/** Game state (game-specific JSON for resuming) */
		state: jsonb('state'),

		/** Final score (set on completion) */
		score: integer('score'),

		/** Number of attempts/guesses */
		attempts: integer('attempts').default(0).notNull(),

		/** Time spent playing (milliseconds) */
		timeSpentMs: integer('time_spent_ms'),

		startedAt: timestamp('started_at').defaultNow().notNull(),
		completedAt: timestamp('completed_at'),
	},
	(table) => [
		index('game_sessions_user_idx').on(table.userId),
		index('game_sessions_game_slug_idx').on(table.gameSlug),
		uniqueIndex('game_sessions_user_puzzle_idx').on(table.userId, table.puzzleId),
		index('game_sessions_date_idx').on(table.puzzleDate),
		index('game_sessions_user_game_slug_date_mode_idx').on(
			table.userId,
			table.gameSlug,
			table.puzzleDate,
			table.mode,
		),
		index('game_sessions_difficulty_idx').on(table.difficulty),
		index('game_sessions_completed_at_idx').on(table.completedAt),
		index('game_sessions_status_idx').on(table.status),
		index('game_sessions_archive_date_idx').on(table.archiveDate),
		index('game_sessions_game_slug_status_completed_idx').on(
			table.gameSlug,
			table.status,
			table.completedAt,
		),
		index('game_sessions_game_slug_completed_idx').on(table.gameSlug, table.completedAt),
	],
)

// ==========================================
// USER FREEZE DATA (Premium Feature)
// ==========================================

/**
 * Premium streak freeze feature.
 * Allows users to "freeze" their streak when they miss a day.
 *
 * NOTE: Streak tracking itself is handled by Platform SDK useStreak().
 * This table ONLY stores the app-specific freeze feature (premium perk).
 */
export const userFreezeData = pgTable(
	'user_freeze_data',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		/** Platform user ID (no FK) */
		userId: uuid('user_id').notNull().unique(),

		/** Available streak freezes */
		freezesAvailable: integer('freezes_available').default(0).notNull(),

		/** Total freezes used */
		freezesUsed: integer('freezes_used').default(0).notNull(),

		/** Auto-freeze enabled setting */
		autoFreezeEnabled: boolean('auto_freeze_enabled').default(false).notNull(),

		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [index('user_freeze_data_user_id_idx').on(table.userId)],
)

// ==========================================
// NOTIFICATION PREFERENCES
// ==========================================

/**
 * User notification preferences for this app.
 */
export const notificationPreferences = pgTable('notification_preferences', {
	id: uuid('id').primaryKey().defaultRandom(),

	/** Platform user ID (no FK) */
	userId: uuid('user_id').notNull().unique(),

	// Push Notifications
	/** Master push toggle */
	pushEnabled: boolean('push_enabled').default(true).notNull(),
	/** Daily puzzle reminder */
	pushDailyReminder: boolean('push_daily_reminder').default(true).notNull(),
	/** Streak at risk alerts */
	pushStreakAlert: boolean('push_streak_alert').default(true).notNull(),
	/** New game announcements */
	pushNewGames: boolean('push_new_games').default(true).notNull(),
	/** Daily reminder time (HH:mm format) */
	dailyReminderTime: text('daily_reminder_time').default('09:00'),

	// Email Notifications
	/** Master email toggle */
	emailEnabled: boolean('email_enabled').default(true).notNull(),
	/** Weekly stats digest */
	emailWeeklyDigest: boolean('email_weekly_digest').default(true).notNull(),
	/** Marketing emails (CAN-SPAM compliant) */
	emailMarketing: boolean('email_marketing').default(true).notNull(),

	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ==========================================
// PUSH SUBSCRIPTIONS
// ==========================================

/**
 * Web Push subscription endpoints.
 */
export const pushSubscriptions = pgTable(
	'push_subscriptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		/** Platform user ID (no FK) */
		userId: uuid('user_id').notNull(),

		/** Push endpoint URL */
		endpoint: text('endpoint').notNull().unique(),

		/** P-256 public key */
		p256dh: text('p256dh').notNull(),

		/** Auth secret */
		auth: text('auth').notNull(),

		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [index('push_subscriptions_user_idx').on(table.userId)],
)

// NOTE: Referrals table REMOVED - Platform SDK useReferral() is used instead
// See: apps/puzzled/src/app/[locale]/(app)/referrals/_components/referrals-client.tsx

// ==========================================
// WIN-BACK EMAIL TRACKING
// ==========================================

/**
 * Track win-back email sequence for churned users.
 */
export const winBackEmails = pgTable(
	'win_back_emails',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		/** Platform user ID (no FK) */
		userId: uuid('user_id').notNull(),

		/** Email type in sequence */
		emailType: winBackEmailTypeEnum('email_type').notNull(),

		/** When email was sent */
		sentAt: timestamp('sent_at').defaultNow().notNull(),

		/** Promotion code (for day30 emails) */
		promotionCode: text('promotion_code'),

		/** Whether user returned after this email */
		userReturned: boolean('user_returned').default(false),
		returnedAt: timestamp('returned_at'),

		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('win_back_emails_user_idx').on(table.userId),
		index('win_back_emails_type_idx').on(table.emailType),
		index('win_back_emails_sent_at_idx').on(table.sentAt),
		// One email per type per user
		uniqueIndex('win_back_emails_user_type_idx').on(table.userId, table.emailType),
	],
)

// ==========================================
// AUDIT LOGS
// ==========================================

/**
 * Audit trail for important app actions.
 * Note: Auth/billing audit logs are handled by platform.
 */
export const auditLogs = pgTable(
	'audit_logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		/** User who was affected (no FK) */
		userId: uuid('user_id'),

		/** Actor who performed action (no FK) - for admin actions */
		actorId: uuid('actor_id'),

		/** Action type */
		action: auditActionEnum('action').notNull(),

		/** Resource type (e.g., 'game_session', 'achievement') */
		resourceType: text('resource_type').notNull(),

		/** Resource ID */
		resourceId: text('resource_id'),

		/** Additional context */
		metadata: jsonb('metadata').$type<Record<string, unknown>>(),

		/** Request IP (for admin actions) */
		ipAddress: text('ip_address'),

		/** User agent (for admin actions) */
		userAgent: text('user_agent'),

		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('audit_logs_user_idx').on(table.userId),
		index('audit_logs_actor_idx').on(table.actorId),
		index('audit_logs_action_idx').on(table.action),
		index('audit_logs_resource_idx').on(table.resourceType, table.resourceId),
		index('audit_logs_created_at_idx').on(table.createdAt),
	],
)

// ==========================================
// DEAD LETTER QUEUE
// ==========================================

/**
 * Failed workflow/job tracking for retry and debugging.
 */
export const deadLetterQueue = pgTable(
	'dead_letter_queue',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		/** Workflow/job name */
		workflowName: text('workflow_name').notNull(),

		/** External workflow run ID (e.g., Upstash) */
		workflowRunId: text('workflow_run_id'),

		/** Job payload */
		payload: jsonb('payload').$type<Record<string, unknown>>(),

		/** Error message */
		error: text('error').notNull(),

		/** Full error stack */
		errorStack: text('error_stack'),

		/** Current status */
		status: dlqStatusEnum('status').default('pending').notNull(),

		/** Retry count */
		retryCount: integer('retry_count').default(0).notNull(),

		/** Max retries allowed */
		maxRetries: integer('max_retries').default(3).notNull(),

		/** Last retry timestamp */
		lastRetryAt: timestamp('last_retry_at'),

		/** When successfully resolved */
		resolvedAt: timestamp('resolved_at'),

		/** Additional context */
		metadata: jsonb('metadata').$type<Record<string, unknown>>(),

		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('dlq_workflow_name_idx').on(table.workflowName),
		index('dlq_status_idx').on(table.status),
		index('dlq_created_at_idx').on(table.createdAt),
	],
)

// ==========================================
// WEBHOOK EVENTS (Idempotency)
// ==========================================

/**
 * Track processed webhook events for idempotency.
 * Note: Billing webhooks are handled by platform.
 * This is for app-specific webhooks only.
 */
export const webhookEvents = pgTable(
	'webhook_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		/** External event ID (for idempotency) */
		eventId: text('event_id').notNull().unique(),

		/** Event type/name */
		eventType: text('event_type').notNull(),

		/** External event timestamp */
		eventCreatedAt: timestamp('event_created_at').notNull(),

		/** When we processed it */
		processedAt: timestamp('processed_at').defaultNow().notNull(),

		/** Related resource ID (optional) */
		resourceId: text('resource_id'),
	},
	(table) => [
		index('webhook_events_event_idx').on(table.eventId),
		index('webhook_events_resource_created_idx').on(table.resourceId, table.eventCreatedAt),
	],
)

// ==========================================
// ANNOUNCEMENTS
// ==========================================

/**
 * System-wide announcements and notifications.
 */
export const announcements = pgTable('announcements', {
	id: uuid('id').primaryKey().defaultRandom(),

	title: text('title').notNull(),
	content: text('content').notNull(),
	type: announcementTypeEnum('type').default('info').notNull(),

	/** Whether announcement is currently active */
	isActive: boolean('is_active').default(true).notNull(),

	// Targeting
	/** Show to all users */
	targetAllUsers: boolean('target_all_users').default(true).notNull(),
	/** Show only to premium users (determined via platform SDK) */
	targetPremiumOnly: boolean('target_premium_only').default(false).notNull(),

	// Display Options
	/** Can user dismiss this announcement */
	dismissible: boolean('dismissible').default(true).notNull(),
	/** Show only once per user */
	showOnce: boolean('show_once').default(false).notNull(),

	// Scheduling
	startsAt: timestamp('starts_at'),
	endsAt: timestamp('ends_at'),

	/** Admin who created (no FK - platform user ID) */
	createdBy: uuid('created_by'),

	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

/**
 * Track which users dismissed which announcements.
 */
export const announcementDismissals = pgTable(
	'announcement_dismissals',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		announcementId: uuid('announcement_id')
			.notNull()
			.references(() => announcements.id, { onDelete: 'cascade' }),

		/** Platform user ID (no FK) */
		userId: uuid('user_id').notNull(),

		dismissedAt: timestamp('dismissed_at').defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('announcement_dismissals_unique_idx').on(table.announcementId, table.userId),
	],
)

// NOTE: Feature flags table REMOVED - Platform SDK useFeatureFlags() is used instead
// See: packages/sdk/src/react/flags-hooks.ts

// ==========================================
// APP SETTINGS (Key-Value Store)
// ==========================================

/**
 * App-wide configuration settings.
 */
export const appSettings = pgTable('app_settings', {
	/** Setting key */
	key: text('key').primaryKey(),

	/** Setting value (JSON) */
	value: jsonb('value').$type<unknown>().notNull(),

	/** Description */
	description: text('description'),

	updatedAt: timestamp('updated_at').defaultNow().notNull(),

	/** Admin who last updated (no FK - platform user ID) */
	updatedBy: uuid('updated_by'),
})

/** Type-safe setting keys */
export type AppSettingKey = 'puzzle_generator_model' | 'maintenance_mode' | 'daily_puzzle_time'

// ==========================================
// RELATIONS
// ==========================================

export const userPreferencesRelations = relations(userPreferences, ({ many: _many }) => ({
	// User preferences can be linked to game sessions for queries
	// but the actual relation is via userId, not FK
}))

export const dailyPuzzlesRelations = relations(dailyPuzzles, ({ many }) => ({
	sessions: many(gameSessions),
}))

export const gameSessionsRelations = relations(gameSessions, ({ one }) => ({
	puzzle: one(dailyPuzzles, {
		fields: [gameSessions.puzzleId],
		references: [dailyPuzzles.id],
	}),
}))

export const announcementsRelations = relations(announcements, ({ many }) => ({
	dismissals: many(announcementDismissals),
}))

export const announcementDismissalsRelations = relations(announcementDismissals, ({ one }) => ({
	announcement: one(announcements, {
		fields: [announcementDismissals.announcementId],
		references: [announcements.id],
	}),
}))

// ==========================================
// TYPE EXPORTS
// ==========================================

// User Preferences
export type UserPreferences = typeof userPreferences.$inferSelect
export type NewUserPreferences = typeof userPreferences.$inferInsert

// User Display Cache
export type UserDisplayCache = typeof userDisplayCache.$inferSelect
export type NewUserDisplayCache = typeof userDisplayCache.$inferInsert

// Daily Puzzles
export type DailyPuzzle = typeof dailyPuzzles.$inferSelect
export type NewDailyPuzzle = typeof dailyPuzzles.$inferInsert

// Game Sessions
export type GameSession = typeof gameSessions.$inferSelect
export type NewGameSession = typeof gameSessions.$inferInsert

// User Freeze Data (premium streak freeze feature)
export type UserFreezeData = typeof userFreezeData.$inferSelect
export type NewUserFreezeData = typeof userFreezeData.$inferInsert

// Notification Preferences
export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert

// Push Subscriptions
export type PushSubscription = typeof pushSubscriptions.$inferSelect
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert

// NOTE: Referral types removed - use Platform SDK useReferral() instead

// Win-Back Emails
export type WinBackEmail = typeof winBackEmails.$inferSelect
export type NewWinBackEmail = typeof winBackEmails.$inferInsert

// Audit Logs
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

// Dead Letter Queue
export type DeadLetterQueueEntry = typeof deadLetterQueue.$inferSelect
export type NewDeadLetterQueueEntry = typeof deadLetterQueue.$inferInsert

// Webhook Events
export type WebhookEvent = typeof webhookEvents.$inferSelect
export type NewWebhookEvent = typeof webhookEvents.$inferInsert

// Announcements
export type Announcement = typeof announcements.$inferSelect
export type NewAnnouncement = typeof announcements.$inferInsert

// Announcement Dismissals
export type AnnouncementDismissal = typeof announcementDismissals.$inferSelect
export type NewAnnouncementDismissal = typeof announcementDismissals.$inferInsert

// NOTE: Feature flag types removed - use Platform SDK useFeatureFlags() instead

// App Settings
export type AppSetting = typeof appSettings.$inferSelect
export type NewAppSetting = typeof appSettings.$inferInsert
