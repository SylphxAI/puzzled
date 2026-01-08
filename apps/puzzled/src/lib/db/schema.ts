import { relations, sql } from 'drizzle-orm'
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

// ==================
// Enums
// ==================

// Role hierarchy: super_admin > admin > user
// Per spec: MFA required for admin and super_admin roles
export const userRoleEnum = pgEnum('user_role', ['user', 'admin', 'super_admin'])

export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'premium', 'lifetime'])

export const subscriptionStatusEnum = pgEnum('subscription_status', [
	'active',
	'cancelled',
	'past_due',
	'trialing',
])

export const gameStatusEnum = pgEnum('game_status', ['in_progress', 'won', 'lost', 'abandoned'])

export const streakTypeEnum = pgEnum('streak_type', ['game', 'play', 'super'])

export const gameModeEnum = pgEnum('game_mode', ['daily', 'archive'])

export const puzzleDifficultyEnum = pgEnum('puzzle_difficulty', ['easy', 'medium', 'hard'])

export const referralStatusEnum = pgEnum('referral_status', ['pending', 'completed', 'expired'])

export const referralRewardTypeEnum = pgEnum('referral_reward_type', [
	'streak_freeze',
	'premium_trial',
	'points',
])

export const winBackEmailTypeEnum = pgEnum('win_back_email_type', ['day7', 'day14', 'day30'])

export const securityAlertTypeEnum = pgEnum('security_alert_type', [
	'new_login',
	'password_changed',
	'email_changed',
	'2fa_enabled',
	'2fa_disabled',
	'new_device',
	'suspicious_login',
	'oauth_connected',
	'oauth_disconnected',
	'session_revoked',
	'all_sessions_revoked',
])

// Billing interval (moved to enum section to avoid forward reference)
export const billingIntervalEnum = pgEnum('billing_interval', ['monthly', 'annual', 'lifetime'])

// Billing transaction types for ledger
export const transactionTypeEnum = pgEnum('transaction_type', [
	'charge',
	'refund',
	'dispute',
	'dispute_reversal',
])

export const transactionStatusEnum = pgEnum('transaction_status', [
	'pending',
	'succeeded',
	'failed',
	'refunded',
	'disputed',
])

// DLQ status enum (defined here for forward reference in SSOT exports)
export const dlqStatusEnum = pgEnum('dlq_status', [
	'pending', // Ready for retry
	'retrying', // Currently being retried
	'resolved', // Successfully processed after retry
	'failed', // Permanently failed after all retries
])

// ==================
// Enum Type Exports (SSOT)
// ==================

/** User role type derived from schema enum */
export type UserRole = (typeof userRoleEnum.enumValues)[number]

/** Subscription plan type derived from schema enum */
export type SubscriptionPlan = (typeof subscriptionPlanEnum.enumValues)[number]

/** Subscription status type derived from schema enum */
export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number]

/** Game status type derived from schema enum */
export type GameStatus = (typeof gameStatusEnum.enumValues)[number]

/** Streak type derived from schema enum */
export type StreakType = (typeof streakTypeEnum.enumValues)[number]

/** Billing interval type derived from schema enum */
export type BillingInterval = (typeof billingIntervalEnum.enumValues)[number]

// ==================
// Enum Value Arrays (SSOT for Zod schemas)
// ==================

/** All game status values */
export const GAME_STATUS_VALUES = gameStatusEnum.enumValues

/** Game result statuses (subset: only won/lost, not in_progress/abandoned) */
export const GAME_RESULT_STATUSES = ['won', 'lost'] as const satisfies readonly GameStatus[]
export type GameResultStatus = (typeof GAME_RESULT_STATUSES)[number]

/** All game mode values */
export const GAME_MODE_VALUES = gameModeEnum.enumValues

/** Puzzle difficulty type derived from schema enum */
export type DBPuzzleDifficulty = (typeof puzzleDifficultyEnum.enumValues)[number]

/** All puzzle difficulty values */
export const PUZZLE_DIFFICULTY_DB_VALUES = puzzleDifficultyEnum.enumValues

/** DLQ status values */
export const DLQ_STATUS_VALUES = dlqStatusEnum.enumValues

// ==================
// Users & Auth (BetterAuth compatible)
// ==================

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		name: text('name'),
		email: text('email').notNull().unique(),
		emailVerified: boolean('email_verified').default(false),
		image: text('image'),
		role: userRoleEnum('role').default('user').notNull(),
		// Per spec: MFA required for admin and super_admin roles
		twoFactorEnabled: boolean('two_factor_enabled').default(false),
		referralCode: text('referral_code').unique(),
		// Email preferences (CAN-SPAM compliance)
		marketingEmailsEnabled: boolean('marketing_emails_enabled').default(true),
		// Profile settings
		username: text('username').unique(),
		bio: text('bio'),
		isPublicProfile: boolean('is_public_profile').default(false).notNull(),
		// Accessibility & UI preferences
		reduceMotion: boolean('reduce_motion').default(false).notNull(),
		compactMode: boolean('compact_mode').default(false).notNull(),
		// Locale & timezone preferences
		timezone: text('timezone').default('UTC'),
		locale: text('locale').default('en'),
		dateFormat: text('date_format').default('relative'), // 'relative' | 'absolute' | 'iso'
		// Privacy settings
		leaderboardVisible: boolean('leaderboard_visible').default(true),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [
		// PERFORMANCE: Index for leaderboard visibility filtering in JOIN queries
		index('users_leaderboard_visible_idx').on(table.leaderboardVisible),
	],
)

export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		expiresAt: timestamp('expires_at').notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		// Per spec: Track if session has verified MFA
		twoFactorVerified: boolean('two_factor_verified').default(false),
		// Re-authentication: timestamp of last identity verification (password or email code)
		// Used for sensitive operations - valid for 10 minutes (SESSION_VERIFIED_TTL_MINUTES)
		verifiedAt: timestamp('verified_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [
		index('sessions_user_idx').on(table.userId),
		index('sessions_expires_at_idx').on(table.expiresAt),
	],
)

// ==================
// Two-Factor Authentication (better-auth compatible)
// Per spec: MFA required for admin and super_admin roles
// ==================

export const twoFactors = pgTable(
	'two_factors',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// TOTP secret (encrypted by better-auth)
		secret: text('secret').notNull(),
		// Backup codes for account recovery (JSON array, encrypted)
		backupCodes: text('backup_codes').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [index('two_factors_user_idx').on(table.userId)],
)

// ==================
// Verification Codes (for re-authentication)
// Used for sensitive operations when user needs to verify identity
// OAuth users use email codes, password users can use password or email codes
// ==================

export const verificationCodeTypeEnum = pgEnum('verification_code_type', [
	'reauth', // General re-authentication
	'email_change', // Changing email address
	'delete_account', // Deleting account
	'enable_2fa', // Enabling 2FA
])

/** Valid verification code types */
export type VerificationCodeType = (typeof verificationCodeTypeEnum.enumValues)[number]

/** Array of valid verification code types for use in schemas */
export const VERIFICATION_CODE_TYPES = verificationCodeTypeEnum.enumValues

export const verificationCodes = pgTable(
	'verification_codes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// 6-digit code
		code: text('code').notNull(),
		// What operation this code is for
		type: verificationCodeTypeEnum('type').notNull(),
		// When the code expires (10 minutes from creation)
		expiresAt: timestamp('expires_at').notNull(),
		// When the code was used (null if not used)
		usedAt: timestamp('used_at'),
		// Number of failed attempts (for brute force protection)
		attempts: integer('attempts').default(0).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('verification_codes_user_idx').on(table.userId),
		index('verification_codes_expires_idx').on(table.expiresAt),
		index('verification_codes_user_type_idx').on(table.userId, table.type),
	],
)

export const accounts = pgTable(
	'accounts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		idToken: text('id_token'),
		password: text('password'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [
		index('accounts_user_idx').on(table.userId),
		index('accounts_provider_account_idx').on(table.providerId, table.accountId),
	],
)

export const verifications = pgTable(
	'verifications',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [index('verifications_identifier_expires_idx').on(table.identifier, table.expiresAt)],
)

// ==================
// Login History
// ==================

export const loginHistory = pgTable(
	'login_history',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		country: text('country'),
		city: text('city'),
		device: text('device'), // parsed from UA: 'Chrome on macOS'
		success: boolean('success').default(true).notNull(),
		failureReason: text('failure_reason'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('login_history_user_idx').on(table.userId),
		index('login_history_created_at_idx').on(table.createdAt),
	],
)

// ==================
// Subscriptions
// ==================

export const subscriptions = pgTable(
	'subscriptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
			.unique(),
		stripeCustomerId: text('stripe_customer_id').unique(),
		stripeSubscriptionId: text('stripe_subscription_id').unique(),
		plan: subscriptionPlanEnum('plan').default('free').notNull(),
		status: subscriptionStatusEnum('status').default('active').notNull(),
		currentPeriodStart: timestamp('current_period_start'),
		currentPeriodEnd: timestamp('current_period_end'),
		trialEnd: timestamp('trial_end'),
		cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [index('subscriptions_stripe_customer_idx').on(table.stripeCustomerId)],
)

// ==================
// Plans & Pricing (Admin managed, synced to Stripe)
// ==================

export const plans = pgTable('plans', {
	id: uuid('id').primaryKey().defaultRandom(),
	slug: text('slug').notNull().unique(), // 'free', 'premium'
	name: text('name').notNull(),
	description: text('description'),
	features: jsonb('features').$type<string[]>().default([]).notNull(),
	stripeProductId: text('stripe_product_id'), // null for free plan
	isActive: boolean('is_active').default(true).notNull(),
	sortOrder: integer('sort_order').default(0).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const planPrices = pgTable(
	'plan_prices',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		planId: uuid('plan_id')
			.notNull()
			.references(() => plans.id, { onDelete: 'cascade' }),
		interval: billingIntervalEnum('interval').notNull(),
		amount: integer('amount').notNull(), // in cents
		currency: text('currency').default('usd').notNull(),
		stripePriceId: text('stripe_price_id'), // synced from Stripe
		isActive: boolean('is_active').default(true).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('plan_prices_plan_interval_idx').on(table.planId, table.interval),
		index('plan_prices_stripe_idx').on(table.stripePriceId),
	],
)

// ==================
// Daily Puzzles
// ==================

export const dailyPuzzles = pgTable(
	'daily_puzzles',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		gameSlug: text('game_slug').notNull(),
		puzzleDate: timestamp('puzzle_date').notNull(),
		puzzleData: jsonb('puzzle_data').notNull(),
		solution: jsonb('solution'),
		// Difficulty level for games that support difficulty selection
		// NULL for games without difficulty support (backward compatible)
		difficulty: puzzleDifficultyEnum('difficulty'),
		// Immutable history: record seed and version for audit trail
		seed: integer('seed'), // The seed used for generation (YYYYMMDD)
		generatorVersion: text('generator_version').default('v1.0'), // Algorithm version for migration tracking
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		// Unique constraint: one puzzle per game per date per difficulty
		// For games without difficulty, difficulty is NULL (only one puzzle per day)
		// For games with difficulty, each difficulty level has its own puzzle
		uniqueIndex('daily_puzzles_game_date_difficulty_idx').on(
			table.gameSlug,
			table.puzzleDate,
			table.difficulty,
		),
		index('daily_puzzles_date_idx').on(table.puzzleDate),
		index('daily_puzzles_game_slug_idx').on(table.gameSlug),
	],
)

// ==================
// Game Sessions
// ==================

export const gameSessions = pgTable(
	'game_sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		gameSlug: text('game_slug').notNull(),
		puzzleId: uuid('puzzle_id').references(() => dailyPuzzles.id, { onDelete: 'set null' }),
		puzzleDate: timestamp('puzzle_date'),
		// Difficulty level for games that support difficulty selection
		// NULL for games without difficulty support
		difficulty: puzzleDifficultyEnum('difficulty'),
		mode: gameModeEnum('mode').default('daily').notNull(), // 'daily' | 'archive'
		archiveDate: timestamp('archive_date'), // Only set when mode = 'archive'
		status: gameStatusEnum('status').default('in_progress').notNull(),
		state: jsonb('state'),
		score: integer('score'),
		attempts: integer('attempts').default(0).notNull(),
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
		// Index for difficulty-aware queries
		index('game_sessions_difficulty_idx').on(table.difficulty),
		// PERFORMANCE: Additional indexes for common query patterns
		index('game_sessions_completed_at_idx').on(table.completedAt), // For period-based leaderboards
		index('game_sessions_status_idx').on(table.status), // For filtering won/lost
		index('game_sessions_archive_date_idx').on(table.archiveDate), // For archive mode queries
		index('game_sessions_game_slug_status_completed_idx').on(
			table.gameSlug,
			table.status,
			table.completedAt,
		), // Composite for leaderboard queries with status filter
		index('game_sessions_game_slug_completed_idx').on(table.gameSlug, table.completedAt), // For period-based queries without status filter
	],
)

// ==================
// User Stats (per game)
// ==================

export const userStats = pgTable(
	'user_stats',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		gameSlug: text('game_slug').notNull(),
		gamesPlayed: integer('games_played').default(0).notNull(),
		gamesWon: integer('games_won').default(0).notNull(),
		currentStreak: integer('current_streak').default(0).notNull(),
		maxStreak: integer('max_streak').default(0).notNull(),
		totalScore: integer('total_score').default(0).notNull(),
		averageAttempts: integer('average_attempts'),
		guessDistribution: jsonb('guess_distribution'),
		lastPlayedAt: timestamp('last_played_at'),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('user_stats_user_game_slug_idx').on(table.userId, table.gameSlug),
		index('user_stats_streak_idx').on(table.currentStreak),
		index('user_stats_game_slug_idx').on(table.gameSlug),
	],
)

// ==================
// Enhanced Streak System
// ==================

export const userStreaks = pgTable(
	'user_streaks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: streakTypeEnum('type').notNull(), // 'game' | 'play' | 'super'
		gameSlug: text('game_slug'), // null for play/super streaks
		currentStreak: integer('current_streak').default(0).notNull(),
		maxStreak: integer('max_streak').default(0).notNull(),
		lastPlayedDate: timestamp('last_played_date'),
		freezesAvailable: integer('freezes_available').default(0).notNull(),
		freezesUsed: integer('freezes_used').default(0).notNull(),
		autoFreezeEnabled: boolean('auto_freeze_enabled').default(false).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(table) => [
		// Partial unique indexes to handle NULL gameSlug correctly
		// PostgreSQL allows multiple NULLs in UNIQUE indexes, so we need two partial indexes
		uniqueIndex('user_streaks_user_type_game_slug_idx')
			.on(table.userId, table.type, table.gameSlug)
			.where(sql`${table.gameSlug} IS NOT NULL`),
		uniqueIndex('user_streaks_user_type_global_idx')
			.on(table.userId, table.type)
			.where(sql`${table.gameSlug} IS NULL`),
		index('user_streaks_user_idx').on(table.userId),
	],
)

// ==================
// Webhook Events (Idempotency + Out-of-Order Handling)
// ==================

export const webhookEvents = pgTable(
	'webhook_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		stripeEventId: text('stripe_event_id').notNull().unique(),
		eventType: text('event_type').notNull(),
		// Per spec: Store Stripe event creation time for out-of-order handling
		stripeCreatedAt: timestamp('stripe_created_at').notNull(),
		processedAt: timestamp('processed_at').defaultNow().notNull(),
		// Store subscription ID for ordering events within same subscription
		subscriptionId: text('subscription_id'),
	},
	(table) => [
		index('webhook_events_stripe_event_idx').on(table.stripeEventId),
		// Index for ordering queries
		index('webhook_events_sub_created_idx').on(table.subscriptionId, table.stripeCreatedAt),
	],
)

// ==================
// Audit Logs (Admin RBAC)
// ==================

export const auditActionEnum = pgEnum('audit_action', [
	'create',
	'update',
	'delete',
	'login',
	'logout',
	'role_change',
	'subscription_change',
	'impersonate_start',
	'impersonate_end',
	'feature_flag_toggle',
	'admin_action',
])

export const auditLogs = pgTable(
	'audit_logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
		actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }), // Admin who performed action (for impersonation)
		action: auditActionEnum('action').notNull(),
		resourceType: text('resource_type').notNull(), // 'user', 'subscription', 'game', 'feature_flag', etc.
		resourceId: text('resource_id'), // ID of affected resource
		metadata: jsonb('metadata').$type<Record<string, unknown>>(), // Additional context
		ipAddress: text('ip_address'),
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

// ==================
// Dead Letter Queue (Workflow Failures)
// ==================

export const deadLetterQueue = pgTable(
	'dead_letter_queue',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		workflowName: text('workflow_name').notNull(),
		workflowRunId: text('workflow_run_id'), // Upstash workflow run ID
		payload: jsonb('payload').$type<Record<string, unknown>>(),
		error: text('error').notNull(),
		errorStack: text('error_stack'),
		status: dlqStatusEnum('status').default('pending').notNull(),
		retryCount: integer('retry_count').default(0).notNull(),
		maxRetries: integer('max_retries').default(3).notNull(),
		lastRetryAt: timestamp('last_retry_at'),
		resolvedAt: timestamp('resolved_at'),
		metadata: jsonb('metadata').$type<Record<string, unknown>>(), // Additional context
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('dlq_workflow_name_idx').on(table.workflowName),
		index('dlq_status_idx').on(table.status),
		index('dlq_created_at_idx').on(table.createdAt),
	],
)

// ==================
// Push Subscriptions
// ==================

export const pushSubscriptions = pgTable(
	'push_subscriptions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [index('push_subscriptions_user_idx').on(table.userId)],
)

// ==================
// Notification Preferences
// ==================

export const notificationPreferences = pgTable(
	'notification_preferences',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' })
			.unique(),
		// Push notifications
		pushEnabled: boolean('push_enabled').default(true).notNull(),
		pushDailyReminder: boolean('push_daily_reminder').default(true).notNull(),
		pushStreakAlert: boolean('push_streak_alert').default(true).notNull(),
		pushNewGames: boolean('push_new_games').default(true).notNull(),
		dailyReminderTime: text('daily_reminder_time').default('09:00'), // HH:mm format
		// Email notifications
		emailEnabled: boolean('email_enabled').default(true).notNull(),
		emailWeeklyDigest: boolean('email_weekly_digest').default(true).notNull(),
		emailMarketing: boolean('email_marketing').default(true).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	// Note: userId already has unique constraint which creates an index
)

// ==================
// Referrals
// ==================

export const referrals = pgTable(
	'referrals',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		referrerId: uuid('referrer_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		referredUserId: uuid('referred_user_id').references(() => users.id, { onDelete: 'set null' }),
		referralCode: text('referral_code').notNull(),
		status: referralStatusEnum('status').default('pending').notNull(),
		rewardType: referralRewardTypeEnum('reward_type').default('streak_freeze').notNull(),
		metadata: jsonb('metadata').$type<Record<string, unknown>>(), // Additional context (e.g., reward details)
		createdAt: timestamp('created_at').defaultNow().notNull(),
		completedAt: timestamp('completed_at'),
	},
	(table) => [
		index('referrals_referrer_idx').on(table.referrerId),
		index('referrals_referred_user_idx').on(table.referredUserId),
		index('referrals_code_idx').on(table.referralCode),
		index('referrals_status_idx').on(table.status),
		uniqueIndex('referrals_referred_user_unique_idx').on(table.referredUserId), // One referral per user
	],
)

// ==================
// Win-Back Email Tracking
// ==================

export const winBackEmails = pgTable(
	'win_back_emails',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		emailType: winBackEmailTypeEnum('email_type').notNull(),
		sentAt: timestamp('sent_at').defaultNow().notNull(),
		// Store promotion code for day30 emails
		promotionCode: text('promotion_code'),
		// Track if user returned after this email
		userReturned: boolean('user_returned').default(false),
		returnedAt: timestamp('returned_at'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('win_back_emails_user_idx').on(table.userId),
		index('win_back_emails_type_idx').on(table.emailType),
		index('win_back_emails_sent_at_idx').on(table.sentAt),
		// Ensure we don't send the same email type to a user multiple times
		uniqueIndex('win_back_emails_user_type_idx').on(table.userId, table.emailType),
	],
)

// ==================
// Billing Transactions (Ledger)
// ==================

export const billingTransactions = pgTable(
	'billing_transactions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		stripeCustomerId: text('stripe_customer_id').notNull(),
		stripeInvoiceId: text('stripe_invoice_id'),
		stripeChargeId: text('stripe_charge_id'),
		stripePaymentIntentId: text('stripe_payment_intent_id'),
		/** Customer-facing invoice URL (from Stripe hosted_invoice_url) */
		hostedInvoiceUrl: text('hosted_invoice_url'),
		amountCents: integer('amount_cents').notNull(),
		currency: text('currency').default('usd').notNull(),
		type: transactionTypeEnum('type').notNull(),
		status: transactionStatusEnum('status').notNull(),
		description: text('description'),
		metadata: jsonb('metadata').$type<Record<string, unknown>>(),
		stripeCreatedAt: timestamp('stripe_created_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('billing_transactions_user_idx').on(table.userId),
		index('billing_transactions_customer_idx').on(table.stripeCustomerId),
		index('billing_transactions_invoice_idx').on(table.stripeInvoiceId),
		index('billing_transactions_charge_idx').on(table.stripeChargeId),
		index('billing_transactions_type_idx').on(table.type),
		index('billing_transactions_status_idx').on(table.status),
		index('billing_transactions_created_at_idx').on(table.createdAt),
	],
)

// ==================
// App Settings (Key-Value Store)
// ==================

export const appSettings = pgTable('app_settings', {
	key: text('key').primaryKey(),
	value: jsonb('value').$type<unknown>().notNull(),
	description: text('description'),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
	updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
})

// Type-safe setting keys
// Note: No fallback model - errors must be visible, not masked
export type AppSettingKey = 'puzzle_generator_model'

// ==================
// Relations
// ==================

export const usersRelations = relations(users, ({ many, one }) => ({
	sessions: many(sessions),
	accounts: many(accounts),
	twoFactor: one(twoFactors, {
		fields: [users.id],
		references: [twoFactors.userId],
	}),
	subscription: one(subscriptions, {
		fields: [users.id],
		references: [subscriptions.userId],
	}),
	gameSessions: many(gameSessions),
	stats: many(userStats),
	pushSubscriptions: many(pushSubscriptions),
	notificationPreference: one(notificationPreferences, {
		fields: [users.id],
		references: [notificationPreferences.userId],
	}),
	loginHistory: many(loginHistory),
	referralsMade: many(referrals, { relationName: 'referrer' }),
	// Note: referredBy relation is queried via referrals table where referredUserId = user.id
	winBackEmails: many(winBackEmails),
	billingTransactions: many(billingTransactions),
	securityAlerts: many(securityAlerts),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id],
	}),
}))

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
	user: one(users, {
		fields: [twoFactors.userId],
		references: [users.id],
	}),
}))

export const verificationCodesRelations = relations(verificationCodes, ({ one }) => ({
	user: one(users, {
		fields: [verificationCodes.userId],
		references: [users.id],
	}),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
	user: one(users, {
		fields: [subscriptions.userId],
		references: [users.id],
	}),
}))

export const plansRelations = relations(plans, ({ many }) => ({
	prices: many(planPrices),
}))

export const planPricesRelations = relations(planPrices, ({ one }) => ({
	plan: one(plans, {
		fields: [planPrices.planId],
		references: [plans.id],
	}),
}))

export const dailyPuzzlesRelations = relations(dailyPuzzles, ({ many }) => ({
	sessions: many(gameSessions),
}))

export const gameSessionsRelations = relations(gameSessions, ({ one }) => ({
	user: one(users, {
		fields: [gameSessions.userId],
		references: [users.id],
	}),
	puzzle: one(dailyPuzzles, {
		fields: [gameSessions.puzzleId],
		references: [dailyPuzzles.id],
	}),
}))

export const userStatsRelations = relations(userStats, ({ one }) => ({
	user: one(users, {
		fields: [userStats.userId],
		references: [users.id],
	}),
}))

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
	user: one(users, {
		fields: [pushSubscriptions.userId],
		references: [users.id],
	}),
}))

export const userStreaksRelations = relations(userStreaks, ({ one }) => ({
	user: one(users, {
		fields: [userStreaks.userId],
		references: [users.id],
	}),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
	user: one(users, {
		fields: [auditLogs.userId],
		references: [users.id],
	}),
	actor: one(users, {
		fields: [auditLogs.actorId],
		references: [users.id],
	}),
}))

export const referralsRelations = relations(referrals, ({ one }) => ({
	referrer: one(users, {
		fields: [referrals.referrerId],
		references: [users.id],
		relationName: 'referrer',
	}),
	referredUser: one(users, {
		fields: [referrals.referredUserId],
		references: [users.id],
		relationName: 'referred',
	}),
}))

export const winBackEmailsRelations = relations(winBackEmails, ({ one }) => ({
	user: one(users, {
		fields: [winBackEmails.userId],
		references: [users.id],
	}),
}))

export const billingTransactionsRelations = relations(billingTransactions, ({ one }) => ({
	user: one(users, {
		fields: [billingTransactions.userId],
		references: [users.id],
	}),
}))

export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
	user: one(users, {
		fields: [loginHistory.userId],
		references: [users.id],
	}),
}))

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
	user: one(users, {
		fields: [notificationPreferences.userId],
		references: [users.id],
	}),
}))

// ==================
// Types
// ==================

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert

export type DailyPuzzle = typeof dailyPuzzles.$inferSelect
export type NewDailyPuzzle = typeof dailyPuzzles.$inferInsert

export type GameSession = typeof gameSessions.$inferSelect
export type NewGameSession = typeof gameSessions.$inferInsert

export type UserStat = typeof userStats.$inferSelect
export type NewUserStat = typeof userStats.$inferInsert

export type Plan = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert

export type PlanPrice = typeof planPrices.$inferSelect
export type NewPlanPrice = typeof planPrices.$inferInsert

export type UserStreak = typeof userStreaks.$inferSelect
export type NewUserStreak = typeof userStreaks.$inferInsert

export type GameMode = (typeof gameModeEnum.enumValues)[number]

export type WebhookEvent = typeof webhookEvents.$inferSelect
export type NewWebhookEvent = typeof webhookEvents.$inferInsert

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

export type AuditAction = (typeof auditActionEnum.enumValues)[number]

export type TwoFactor = typeof twoFactors.$inferSelect
export type NewTwoFactor = typeof twoFactors.$inferInsert

export type Referral = typeof referrals.$inferSelect
export type NewReferral = typeof referrals.$inferInsert

export type ReferralStatus = (typeof referralStatusEnum.enumValues)[number]
export type ReferralRewardType = (typeof referralRewardTypeEnum.enumValues)[number]

export type WinBackEmail = typeof winBackEmails.$inferSelect
export type NewWinBackEmail = typeof winBackEmails.$inferInsert

export type WinBackEmailType = (typeof winBackEmailTypeEnum.enumValues)[number]

export type BillingTransaction = typeof billingTransactions.$inferSelect
export type NewBillingTransaction = typeof billingTransactions.$inferInsert

export type TransactionType = (typeof transactionTypeEnum.enumValues)[number]
export type TransactionStatus = (typeof transactionStatusEnum.enumValues)[number]

/** Array of valid transaction status values for use in schemas */
export const TRANSACTION_STATUS_VALUES = transactionStatusEnum.enumValues

export type LoginHistory = typeof loginHistory.$inferSelect
export type NewLoginHistory = typeof loginHistory.$inferInsert

export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert

// ==================
// Security Alerts
// ==================

export const securityAlerts = pgTable(
	'security_alerts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: securityAlertTypeEnum('type').notNull(),
		title: text('title').notNull(),
		description: text('description'),
		metadata: jsonb('metadata').$type<Record<string, unknown>>(), // device info, location, etc.
		read: boolean('read').default(false).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('security_alerts_user_idx').on(table.userId),
		index('security_alerts_user_read_idx').on(table.userId, table.read),
		index('security_alerts_created_at_idx').on(table.createdAt),
	],
)

export const securityAlertsRelations = relations(securityAlerts, ({ one }) => ({
	user: one(users, {
		fields: [securityAlerts.userId],
		references: [users.id],
	}),
}))

export type SecurityAlert = typeof securityAlerts.$inferSelect
export type NewSecurityAlert = typeof securityAlerts.$inferInsert
export type SecurityAlertType = (typeof securityAlertTypeEnum.enumValues)[number]

// ==================
// Email Change Requests
// ==================

export const emailChangeRequests = pgTable(
	'email_change_requests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		newEmail: text('new_email').notNull(),
		token: text('token').notNull().unique(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
	},
	(table) => [
		index('email_change_requests_user_idx').on(table.userId),
		// Note: token already has unique constraint which creates an index
		index('email_change_requests_expires_at_idx').on(table.expiresAt),
	],
)

export const emailChangeRequestsRelations = relations(emailChangeRequests, ({ one }) => ({
	user: one(users, {
		fields: [emailChangeRequests.userId],
		references: [users.id],
	}),
}))

export type EmailChangeRequest = typeof emailChangeRequests.$inferSelect
export type NewEmailChangeRequest = typeof emailChangeRequests.$inferInsert

// ==================
// Announcements (System-wide notifications)
// ==================

export const announcementTypeEnum = pgEnum('announcement_type', [
	'info', // General information
	'warning', // Important notice
	'success', // Positive news
	'maintenance', // Scheduled maintenance
])

export const announcements = pgTable('announcements', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: text('title').notNull(),
	content: text('content').notNull(),
	type: announcementTypeEnum('type').default('info').notNull(),
	isActive: boolean('is_active').default(true).notNull(),
	// Targeting
	targetAllUsers: boolean('target_all_users').default(true).notNull(),
	targetPremiumOnly: boolean('target_premium_only').default(false).notNull(),
	// Display options
	dismissible: boolean('dismissible').default(true).notNull(),
	showOnce: boolean('show_once').default(false).notNull(), // Show only once per user
	// Scheduling
	startsAt: timestamp('starts_at'),
	endsAt: timestamp('ends_at'),
	// Metadata
	createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const announcementsRelations = relations(announcements, ({ one }) => ({
	creator: one(users, {
		fields: [announcements.createdBy],
		references: [users.id],
	}),
}))

// Track which users have dismissed which announcements
export const announcementDismissals = pgTable(
	'announcement_dismissals',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		announcementId: uuid('announcement_id')
			.notNull()
			.references(() => announcements.id, { onDelete: 'cascade' }),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		dismissedAt: timestamp('dismissed_at').defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('announcement_dismissals_unique_idx').on(table.announcementId, table.userId),
	],
)

export type Announcement = typeof announcements.$inferSelect
export type NewAnnouncement = typeof announcements.$inferInsert
export type AnnouncementType = (typeof announcementTypeEnum.enumValues)[number]

// ==================
// Feature Flags
// ==================

export const featureFlags = pgTable('feature_flags', {
	id: uuid('id').primaryKey().defaultRandom(),
	key: text('key').notNull().unique(), // e.g., 'new_game_mode', 'beta_feature'
	name: text('name').notNull(), // Human readable name
	description: text('description'),
	enabled: boolean('enabled').default(false).notNull(),
	// Rollout percentage (0-100)
	rolloutPercentage: integer('rollout_percentage').default(0).notNull(),
	// Target specific user segments
	targetPremiumOnly: boolean('target_premium_only').default(false).notNull(),
	targetAdminOnly: boolean('target_admin_only').default(false).notNull(),
	// Metadata
	createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const featureFlagsRelations = relations(featureFlags, ({ one }) => ({
	creator: one(users, {
		fields: [featureFlags.createdBy],
		references: [users.id],
	}),
}))

export type FeatureFlag = typeof featureFlags.$inferSelect
export type NewFeatureFlag = typeof featureFlags.$inferInsert

// ==================
// Additional Type Exports
// ==================

// Session types (better-auth compatible with custom fields)
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

// Account types (OAuth provider accounts)
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert

// Verification types (better-auth email verification)
export type Verification = typeof verifications.$inferSelect
export type NewVerification = typeof verifications.$inferInsert

// Verification code types (re-authentication codes)
export type VerificationCode = typeof verificationCodes.$inferSelect
export type NewVerificationCode = typeof verificationCodes.$inferInsert

// Dead letter queue types (workflow error tracking)
export type DeadLetterQueueEntry = typeof deadLetterQueue.$inferSelect
export type NewDeadLetterQueueEntry = typeof deadLetterQueue.$inferInsert
export type DLQStatus = (typeof dlqStatusEnum.enumValues)[number]

// Push subscription types
export type PushSubscription = typeof pushSubscriptions.$inferSelect
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert

// App settings types (key-value store)
export type AppSetting = typeof appSettings.$inferSelect
export type NewAppSetting = typeof appSettings.$inferInsert
