/**
 * Platform Context
 *
 * Context for platform services: billing, analytics, push, referrals.
 *
 * Type Strategy:
 * - Types that match API responses are imported from ../trpc (SSOT)
 * - SDK-specific types (transformed/computed) are defined here with Sdk prefix
 */

import { createContext } from 'react'
import type {
	Plan,
	Subscription,
	ReferralStats,
	User,
} from '../types'
import type {
	EngagementConfig,
	StreakState,
	RecordActivityResult,
	LeaderboardResult,
	LeaderboardQueryOptions,
	SubmitScoreResult,
	UserAchievement,
	AchievementUnlockEvent,
} from '../lib/engagement/types'

// Import InAppMessage types from trpc.ts (SSOT - inferred from router)
import type {
	InAppMessageType,
	InAppMessagePriority,
	InAppMessageWithReadStatus,
} from '../trpc'

// Re-export types for convenience
export type { Plan, ReferralStats, Subscription }

// Re-export InAppMessage types (SSOT from trpc.ts)
export type { InAppMessageType, InAppMessagePriority, InAppMessageWithReadStatus }

export interface PushPreferences {
	enabled: boolean
	subscriptionCount: number
	categories?: Record<string, boolean>
}

// ==========================================
// Mobile Push Types (SDK-specific)
//
// These are SDK transformations of the API types.
// The API types (MobilePushConfig, MobilePushPreferences) are in trpc.ts.
// ==========================================

/** SDK mobile push platform - includes 'web' for SDK flexibility */
export type MobilePushPlatform = 'ios' | 'android' | 'web'

/** SDK mobile device info */
export interface MobileDevice {
	id: string
	platform: MobilePushPlatform
	name: string | null
	registeredAt: string
	lastUsedAt: string | null | undefined
}

/** SDK mobile push preferences (transformed from API) */
export interface SdkMobilePushPreferences {
	enabled: boolean
	devices: MobileDevice[]
}

/** SDK mobile push config (transformed from API) */
export interface SdkMobilePushConfig {
	ios: boolean
	android: boolean
	anyConfigured: boolean
}

// Type aliases for backward compatibility
// These are the SDK versions used in the context (not the raw API types from trpc.ts)
export type MobilePushPreferences = SdkMobilePushPreferences
export type MobilePushConfig = SdkMobilePushConfig

// ==========================================
// In-App Message Types (SDK-specific)
// ==========================================

export interface InboxPreferences {
	enabled: boolean
	mutedTopics: string[]
	highPriorityOnly: boolean
}

// ==========================================
// Analytics Types
// ==========================================

/** Destination platforms for conversion tracking */
export type DestinationPlatform = 'google_ads' | 'meta' | 'tiktok'

/**
 * Conversion data for ad platform destinations
 * Used for enhanced conversion tracking (Google Ads, Meta, TikTok)
 */
export interface ConversionData {
	/** Click ID for attribution (gclid, fbclid, ttclid) */
	clickId?: string
	/** Conversion value */
	value?: number
	/** Currency code (USD, EUR, etc.) */
	currency?: string
	/** Order ID for deduplication */
	orderId?: string
	/** User email (auto-hashed by destinations) */
	userEmail?: string
	/** User phone (auto-hashed by destinations) */
	userPhone?: string
	/** User first name (auto-hashed by destinations) */
	userFirstName?: string
	/** User last name (auto-hashed by destinations) */
	userLastName?: string
}

/**
 * Track options for controlling destination forwarding
 */
export interface TrackOptions {
	/**
	 * Specific destinations to forward this event to.
	 * If not specified, events are forwarded to all active destinations with auto-forward enabled.
	 */
	destinations?: DestinationPlatform[]
	/**
	 * Skip all destination forwarding for this event.
	 * Useful for internal events that shouldn't be sent to ad platforms.
	 */
	skipDestinations?: boolean
	/**
	 * Conversion data for ad platforms.
	 * User data (email, phone, name) is automatically hashed before sending.
	 */
	conversion?: ConversionData
}

// Analytics Query Types (matches server analytics.query input)
export interface AnalyticsQuery {
	/** Date range start (ISO date string) */
	dateFrom?: string
	/** Date range end (ISO date string) */
	dateTo?: string
	/** Events to query */
	events?: string[]
	/** Time interval for grouping */
	interval?: 'hour' | 'day' | 'week' | 'month'
	/** Limit results */
	limit?: number
}

export interface AnalyticsDataPoint {
	/** Event name */
	eventName: string
	/** Event count */
	count: number
}

export interface AnalyticsQueryResult {
	/** Query results */
	data: AnalyticsDataPoint[]
	/** Total count */
	total: number
}

/**
 * Click IDs for ad platform attribution
 * Automatically captured from URL parameters (gclid, fbclid, ttclid)
 */
export interface ClickIds {
	/** Google Ads click ID */
	gclid?: string
	/** Meta/Facebook click ID */
	fbclid?: string
	/** TikTok click ID */
	ttclid?: string
}

export interface PlatformContextValue {
	/** App configuration */
	appId: string
	/** Environment secret key (sk_dev_, sk_stg_, sk_prod_) - optional in platform mode */
	publishableKey?: string
	/** Platform API URL */
	platformUrl: string
	/** Anonymous ID for tracking (persisted in localStorage) */
	anonymousId: string
	/**
	 * Auto-captured click IDs for conversion attribution
	 * Captured from URL on provider mount (gclid, fbclid, ttclid)
	 * Persisted in localStorage with 90-day expiry
	 */
	clickIds: ClickIds

	// Billing
	subscription: Subscription | null
	subscriptionLoading: boolean
	subscriptionError: Error | null
	plans: Plan[]
	plansLoading: boolean
	plansError: Error | null
	createCheckout: (planSlug: string, interval: 'monthly' | 'annual' | 'lifetime') => Promise<string>
	openPortal: () => Promise<void>
	refreshSubscription: () => Promise<void>

	// Analytics
	/**
	 * Track a custom event with optional destination forwarding
	 *
	 * @example Basic tracking
	 * ```ts
	 * track('page_view', { path: '/products' })
	 * ```
	 *
	 * @example Track purchase with conversion data
	 * ```ts
	 * track('purchase', { product: 'Premium' }, {
	 *   destinations: ['google_ads', 'meta'],
	 *   conversion: {
	 *     value: 99.99,
	 *     currency: 'USD',
	 *     orderId: 'ORDER-123',
	 *     userEmail: user.email,
	 *   }
	 * })
	 * ```
	 *
	 * @example Skip destinations for internal events
	 * ```ts
	 * track('button_click', { button: 'nav' }, { skipDestinations: true })
	 * ```
	 */
	track: (event: string, properties?: Record<string, unknown>, options?: TrackOptions) => Promise<void>
	page: (name: string, properties?: Record<string, unknown>) => Promise<void>
	identify: (traits?: Record<string, unknown>) => Promise<void>
	queryAnalytics: (query: AnalyticsQuery) => Promise<AnalyticsQueryResult>
	analyticsError: Error | null

	// Push notifications (Web)
	pushSupported: boolean
	pushSubscribed: boolean
	pushPreferences: PushPreferences | null
	pushError: Error | null
	subscribePush: () => Promise<boolean>
	unsubscribePush: () => Promise<void>
	updatePushPreferences: (prefs: { enabled?: boolean; categories?: Record<string, boolean> }) => Promise<void>

	// Push notifications (Mobile)
	mobilePushConfig: MobilePushConfig | null
	mobilePushPreferences: MobilePushPreferences | null
	mobilePushError: Error | null
	registerMobileDevice: (options: {
		platform: MobilePushPlatform
		token: string
		deviceId?: string
		deviceName?: string
		appVersion?: string
		osVersion?: string
	}) => Promise<{ success: boolean; tokenId: string }>
	unregisterMobileDevice: (token: string) => Promise<void>
	getMobilePushPreferences: () => Promise<MobilePushPreferences>

	// Referrals
	referralStats: ReferralStats | null
	referralCode: string | null
	referralLoading: boolean
	referralError: Error | null
	copyReferralCode: () => Promise<void>
	regenerateReferralCode: () => Promise<string>
	getReferralLeaderboard: (options?: { limit?: number; period?: 'all' | 'month' | 'week' }) => Promise<{
		period: 'all' | 'month' | 'week'
		entries: Array<{
			rank: number
			userId: string | null
			displayName: string
			avatarUrl: string | null
			completedReferrals: number
			totalReferrals: number
			isCurrentUser: boolean
		}>
		currentUserRank: number | null
	}>

	// In-App Messages (Inbox)
	inboxMessages: InAppMessageWithReadStatus[]
	inboxUnreadCount: number
	inboxLoading: boolean
	inboxError: Error | null
	inboxPreferences: InboxPreferences | null
	refreshInbox: () => Promise<void>
	markInboxMessageAsRead: (messageId: string) => Promise<void>
	markAllInboxMessagesAsRead: () => Promise<void>
	dismissInboxMessage: (messageId: string) => Promise<void>
	recordInboxMessageClick: (messageId: string, action: 'primary' | 'secondary') => Promise<void>
	updateInboxPreferences: (prefs: { enabled?: boolean; mutedTopics?: string[]; highPriorityOnly?: boolean }) => Promise<void>

	// Direct billing API methods (for advanced use cases)
	getBillingBalance: () => Promise<{
		balance: { current: number; currentFormatted: string }
		status: { level: string; isHealthy: boolean; isLow: boolean; alertThreshold: number }
		billingType: string
		trustLevel: string
		spendingCap: number | null
		currentMonthSpend: number
		spendingCapPercent: number | null
		gracePeriodEndsAt: string | null
		isAdminOrg: boolean
	}>
	getBillingUsage: (options?: { month?: string }) => Promise<{
		period: { type: string; start: string; end: string }
		metrics: {
			aiCostMicrodollars: number
			storageBytesUsed: number
			storageEgressBytes: number
			storageUploads: number
			dbStorageBytes: number
			dbComputeSeconds: number
			emailSentCount: number
			jobInvocationCount: number
			cronActiveCount: number
			pushSentCount?: number
			analyticsEventCount: number
			webhookDeliveryCount: number
			errorEventCount: number
			authMau: number
		} | null
	}>

	// Engagement (Streaks, Leaderboards, Achievements)
	/** Current authenticated user (needed for engagement features) */
	user: User | null
	/** Engagement config (Code First - defined in app code) */
	engagementConfig: EngagementConfig | null
	/** Whether engagement config has been synced to platform */
	engagementConfigSynced: boolean
	/** Last sync timestamp */
	engagementLastSyncAt: string | null
	/** Get streak state for a user */
	getStreak: (streakId: string) => Promise<StreakState>
	/** Record activity to extend streak */
	recordStreakActivity: (streakId: string, metadata?: Record<string, unknown>) => Promise<RecordActivityResult>
	/** Recover streak within grace period */
	recoverStreak: (streakId: string) => Promise<{ success: boolean; streak: StreakState }>
	/** Get leaderboard data */
	getLeaderboard: (leaderboardId: string, options?: LeaderboardQueryOptions) => Promise<LeaderboardResult>
	/** Submit score to leaderboard */
	submitScore: (leaderboardId: string, value: number, metadata?: Record<string, unknown>) => Promise<SubmitScoreResult>
	/** Get all user achievements */
	getAchievements: () => Promise<UserAchievement[]>
	/** Unlock an achievement */
	unlockAchievement: (achievementId: string) => Promise<AchievementUnlockEvent>
	/** Increment achievement progress */
	incrementAchievementProgress: (achievementId: string, amount: number) => Promise<UserAchievement>
}

export const PlatformContext = createContext<PlatformContextValue | null>(null)
