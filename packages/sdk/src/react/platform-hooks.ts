/**
 * Platform Hooks
 *
 * Hooks for billing, analytics, notifications, and referrals.
 */

'use client'

import { useContext, useCallback, useState, useEffect } from 'react'
import {
	PlatformContext,
	type Subscription,
	type Plan,
	type ReferralStats,
	type PushPreferences,
	type AnalyticsQuery,
	type AnalyticsQueryResult,
	type TrackOptions,
	type ConversionData,
	type DestinationPlatform,
	type ClickIds,
	type InAppMessageWithReadStatus,
	type InAppMessageType,
	type InAppMessagePriority,
	type InboxPreferences,
} from './platform-context'

// Re-export types for convenience
export type { AnalyticsQuery, AnalyticsQueryResult, TrackOptions, ConversionData, DestinationPlatform, ClickIds }
export type { InAppMessageWithReadStatus, InAppMessageType, InAppMessagePriority, InboxPreferences }

/** Alias for easier naming */
export type InAppMessage = InAppMessageWithReadStatus

/**
 * Internal hook to get platform context
 */
function usePlatformContext() {
	const context = useContext(PlatformContext)
	if (!context) {
		throw new Error('Platform hooks must be used within a SylphxProvider')
	}
	return context
}

// ============================================
// useBilling
// ============================================

export interface UseBillingReturn {
	/** Current subscription (null if free/none) */
	subscription: Subscription | null
	/** Whether subscription is loading */
	isLoading: boolean
	/** Error loading subscription */
	error: Error | null
	/** Whether there was an error loading subscription */
	isError: boolean
	/** All available plans */
	plans: Plan[]
	/** Whether plans are loading */
	plansLoading: boolean
	/** Error loading plans */
	plansError: Error | null
	/** Whether user has an active paid subscription */
	isPremium: boolean
	/** Whether user is on a trial */
	isTrialing: boolean
	/** Create checkout session and get URL */
	createCheckout: (
		planSlug: string,
		interval: 'monthly' | 'annual' | 'lifetime'
	) => Promise<string>
	/** Open billing portal to manage subscription */
	openPortal: () => Promise<void>
	/** Refresh subscription data */
	refresh: () => Promise<void>
}

/**
 * Hook for billing and subscription management
 *
 * @example
 * ```tsx
 * function PricingPage() {
 *   const { plans, subscription, isPremium, createCheckout } = useBilling()
 *
 *   if (isPremium) {
 *     return <div>You're on {subscription?.planName}!</div>
 *   }
 *
 *   return (
 *     <div>
 *       {plans.map(plan => (
 *         <button
 *           key={plan.id}
 *           onClick={() => createCheckout(plan.slug, 'monthly')}
 *         >
 *           Subscribe to {plan.name}
 *         </button>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useBilling(): UseBillingReturn {
	const ctx = usePlatformContext()

	const isPremium =
		ctx.subscription?.status === 'active' ||
		ctx.subscription?.status === 'trialing'

	const isTrialing = ctx.subscription?.status === 'trialing'

	return {
		subscription: ctx.subscription,
		isLoading: ctx.subscriptionLoading,
		error: ctx.subscriptionError,
		isError: ctx.subscriptionError !== null,
		plans: ctx.plans,
		plansLoading: ctx.plansLoading,
		plansError: ctx.plansError,
		isPremium,
		isTrialing,
		createCheckout: ctx.createCheckout,
		openPortal: ctx.openPortal,
		refresh: ctx.refreshSubscription,
	}
}

// ============================================
// useAnalytics
// ============================================

export interface UseAnalyticsReturn {
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
	/** Track a page view */
	page: (name: string, properties?: Record<string, unknown>) => Promise<void>
	/** Identify user with traits */
	identify: (traits?: Record<string, unknown>) => Promise<void>
	/** Error from analytics operations */
	error: Error | null
	/** Whether there was an error */
	isError: boolean
}

/**
 * Hook for analytics tracking with conversion destinations
 *
 * @example Basic tracking
 * ```tsx
 * function GameComplete() {
 *   const { track } = useAnalytics()
 *
 *   useEffect(() => {
 *     track('game_completed', {
 *       score: 100,
 *       timeMs: 5000,
 *       difficulty: 'hard',
 *     })
 *   }, [])
 *
 *   return <div>Game Complete!</div>
 * }
 * ```
 *
 * @example Track conversion with ad platform forwarding
 * ```tsx
 * function CheckoutSuccess() {
 *   const { track } = useAnalytics()
 *
 *   useEffect(() => {
 *     track('purchase', { product: 'Premium Plan' }, {
 *       destinations: ['google_ads', 'meta', 'tiktok'],
 *       conversion: {
 *         value: 99.99,
 *         currency: 'USD',
 *         orderId: order.id,
 *         userEmail: user.email,
 *         clickId: gclid || fbclid || ttclid,
 *       }
 *     })
 *   }, [])
 *
 *   return <div>Thank you for your purchase!</div>
 * }
 * ```
 */
export function useAnalytics(): UseAnalyticsReturn {
	const ctx = usePlatformContext()

	return {
		track: ctx.track,
		page: ctx.page,
		identify: ctx.identify,
		error: ctx.analyticsError,
		isError: ctx.analyticsError !== null,
	}
}

// ============================================
// useNotifications
// ============================================

export interface UseNotificationsReturn {
	/** Whether push notifications are supported in this browser */
	isSupported: boolean
	/** Whether user is subscribed to push */
	isSubscribed: boolean
	/** User's notification preferences */
	preferences: PushPreferences | null
	/** Error from notification operations */
	error: Error | null
	/** Whether there was an error */
	isError: boolean
	/** Subscribe to notifications */
	subscribe: () => Promise<boolean>
	/** Unsubscribe from notifications */
	unsubscribe: () => Promise<void>
	/** Update notification preferences */
	updatePreferences: (prefs: Partial<PushPreferences>) => Promise<void>
}

/**
 * Hook for notification management
 *
 * @example
 * ```tsx
 * function NotificationSettings() {
 *   const { isSupported, isSubscribed, subscribe, unsubscribe, preferences } = useNotifications()
 *
 *   if (!isSupported) {
 *     return <div>Notifications not supported</div>
 *   }
 *
 *   return (
 *     <button onClick={isSubscribed ? unsubscribe : subscribe}>
 *       {isSubscribed ? 'Disable' : 'Enable'} Notifications
 *     </button>
 *   )
 * }
 * ```
 */
export function useNotifications(): UseNotificationsReturn {
	const ctx = usePlatformContext()

	return {
		isSupported: ctx.pushSupported,
		isSubscribed: ctx.pushSubscribed,
		preferences: ctx.pushPreferences,
		error: ctx.pushError,
		isError: ctx.pushError !== null,
		subscribe: ctx.subscribePush,
		unsubscribe: ctx.unsubscribePush,
		updatePreferences: ctx.updatePushPreferences,
	}
}

// ============================================
// useMobilePush
// ============================================

export interface MobileDevice {
	id: string
	platform: 'ios' | 'android' | 'web'
	name: string | null
	registeredAt: string
	lastUsedAt: string | null | undefined
}

export interface UseMobilePushReturn {
	/** Whether iOS push is configured for this app */
	iosConfigured: boolean
	/** Whether Android push is configured for this app */
	androidConfigured: boolean
	/** Whether any mobile push is configured */
	isConfigured: boolean
	/** List of registered devices for current user */
	devices: MobileDevice[]
	/** Whether mobile push is enabled (has registered devices) */
	isEnabled: boolean
	/** Error from mobile push operations */
	error: Error | null
	/** Whether there was an error */
	isError: boolean
	/**
	 * Register a mobile device for push notifications
	 *
	 * Call this after obtaining a device token from APNs (iOS) or FCM (Android).
	 *
	 * @example iOS with react-native-push-notification
	 * ```tsx
	 * import PushNotification from 'react-native-push-notification'
	 *
	 * PushNotification.configure({
	 *   onRegister: async (token) => {
	 *     await registerDevice({
	 *       platform: 'ios',
	 *       token: token.token,
	 *       deviceName: DeviceInfo.getDeviceId(),
	 *       appVersion: DeviceInfo.getVersion(),
	 *       osVersion: DeviceInfo.getSystemVersion(),
	 *     })
	 *   },
	 * })
	 * ```
	 *
	 * @example Android with firebase messaging
	 * ```tsx
	 * import messaging from '@react-native-firebase/messaging'
	 *
	 * const token = await messaging().getToken()
	 * await registerDevice({
	 *   platform: 'android',
	 *   token,
	 *   deviceName: DeviceInfo.getDeviceId(),
	 *   appVersion: DeviceInfo.getVersion(),
	 *   osVersion: DeviceInfo.getSystemVersion(),
	 * })
	 * ```
	 */
	registerDevice: (options: {
		platform: 'ios' | 'android'
		token: string
		deviceId?: string
		deviceName?: string
		appVersion?: string
		osVersion?: string
	}) => Promise<{ success: boolean; tokenId: string }>
	/**
	 * Unregister a mobile device
	 *
	 * Call this when the user logs out or disables notifications.
	 */
	unregisterDevice: (token: string) => Promise<void>
	/** Refresh device list */
	refresh: () => Promise<void>
}

/**
 * Hook for mobile push notification management (iOS/Android)
 *
 * Use this hook in React Native apps to register device tokens and manage
 * push notification settings.
 *
 * @example
 * ```tsx
 * function PushNotificationSetup() {
 *   const { isConfigured, registerDevice, devices } = useMobilePush()
 *
 *   useEffect(() => {
 *     if (!isConfigured) return
 *
 *     // Get device token from native push service
 *     messaging().getToken().then(token => {
 *       registerDevice({
 *         platform: Platform.OS === 'ios' ? 'ios' : 'android',
 *         token,
 *       })
 *     })
 *
 *     // Listen for token refresh
 *     return messaging().onTokenRefresh(token => {
 *       registerDevice({
 *         platform: Platform.OS === 'ios' ? 'ios' : 'android',
 *         token,
 *       })
 *     })
 *   }, [isConfigured])
 *
 *   return (
 *     <View>
 *       <Text>Registered devices: {devices.length}</Text>
 *     </View>
 *   )
 * }
 * ```
 */
export function useMobilePush(): UseMobilePushReturn {
	const ctx = usePlatformContext()

	const config = ctx.mobilePushConfig
	const prefs = ctx.mobilePushPreferences

	return {
		iosConfigured: config?.ios ?? false,
		androidConfigured: config?.android ?? false,
		isConfigured: config?.anyConfigured ?? false,
		devices: prefs?.devices ?? [],
		isEnabled: prefs?.enabled ?? false,
		error: ctx.mobilePushError,
		isError: ctx.mobilePushError !== null,
		registerDevice: ctx.registerMobileDevice,
		unregisterDevice: ctx.unregisterMobileDevice,
		refresh: ctx.getMobilePushPreferences as unknown as () => Promise<void>,
	}
}

// ============================================
// useReferral
// ============================================

/** Leaderboard entry */
export interface LeaderboardEntry {
	rank: number
	userId: string | null
	displayName: string
	avatarUrl: string | null
	completedReferrals: number
	totalReferrals: number
	isCurrentUser: boolean
}

/** Leaderboard result */
export interface LeaderboardResult {
	period: 'all' | 'month' | 'week'
	entries: LeaderboardEntry[]
	currentUserRank: number | null
}

export interface UseReferralReturn {
	/** Referral statistics */
	stats: ReferralStats | null
	/** Whether referral data is loading */
	isLoading: boolean
	/** Error loading referral data */
	error: Error | null
	/** Whether there was an error */
	isError: boolean
	/** User's referral code */
	code: string | null
	/** Referral link to share */
	link: string | null
	/** Copy referral code to clipboard */
	copyCode: () => Promise<void>
	/** Copy referral link to clipboard */
	copyLink: () => Promise<void>
	/** Regenerate referral code */
	regenerateCode: () => Promise<string>
	/**
	 * Get leaderboard of top referrers
	 *
	 * @param options - Leaderboard options
	 * @param options.limit - Maximum entries (1-100, default: 10)
	 * @param options.period - Time period ('all', 'month', 'week')
	 */
	getLeaderboard: (options?: { limit?: number; period?: 'all' | 'month' | 'week' }) => Promise<LeaderboardResult>
}

/**
 * Hook for referral program
 *
 * @example
 * ```tsx
 * function ReferralCard() {
 *   const { code, link, stats, copyLink } = useReferral()
 *
 *   return (
 *     <div>
 *       <p>Your code: {code}</p>
 *       <p>Successful referrals: {stats?.successfulReferrals || 0}</p>
 *       <button onClick={copyLink}>Share Link</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useReferral(): UseReferralReturn {
	const ctx = usePlatformContext()

	const code = ctx.referralCode || null
	const link = code ? `${ctx.platformUrl}/r/${code}` : null

	const copyCode = useCallback(async () => {
		if (code) {
			await navigator.clipboard.writeText(code)
		}
	}, [code])

	const copyLink = useCallback(async () => {
		if (link) {
			await navigator.clipboard.writeText(link)
		}
	}, [link])

	return {
		stats: ctx.referralStats,
		isLoading: ctx.referralLoading,
		error: ctx.referralError,
		isError: ctx.referralError !== null,
		code,
		link,
		copyCode,
		copyLink,
		regenerateCode: ctx.regenerateReferralCode,
		getLeaderboard: ctx.getLeaderboard,
	}
}

// ============================================
// useAnalyticsQuery
// ============================================

export interface UseAnalyticsQueryOptions {
	/** The query parameters */
	query: AnalyticsQuery
	/** Whether to skip initial fetch */
	skip?: boolean
	/** Refetch interval in ms */
	refetchInterval?: number
}

export interface UseAnalyticsQueryReturn {
	/** Query results */
	data: AnalyticsQueryResult | null
	/** Whether query is loading */
	isLoading: boolean
	/** Whether initial load is complete */
	isInitialized: boolean
	/** Error from query */
	error: Error | null
	/** Whether there was an error */
	isError: boolean
	/** Refetch the query */
	refetch: () => Promise<void>
}

/**
 * Hook for querying analytics data
 *
 * @example
 * ```tsx
 * function AnalyticsDashboard() {
 *   const { data, isLoading, refetch } = useAnalyticsQuery({
 *     query: {
 *       type: 'events',
 *       dateRange: { start: '2024-01-01', end: '2024-01-31' },
 *       groupBy: ['day'],
 *       metrics: ['count'],
 *     },
 *   })
 *
 *   if (isLoading) return <Spinner />
 *
 *   return (
 *     <div>
 *       <p>Rows: {data?.meta.rowCount}</p>
 *       <Chart data={data?.data} />
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAnalyticsQuery(options: UseAnalyticsQueryOptions): UseAnalyticsQueryReturn {
	const ctx = usePlatformContext()
	const [data, setData] = useState<AnalyticsQueryResult | null>(null)
	const [isLoading, setIsLoading] = useState(!options.skip)
	const [isInitialized, setIsInitialized] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	// Stable query reference to prevent infinite loops when query object is inline
	const queryKey = JSON.stringify(options.query)

	const refetch = useCallback(async () => {
		setIsLoading(true)
		setError(null)

		try {
			// Call the analytics query API
			const result = await ctx.queryAnalytics(options.query)
			setData(result)
			setIsInitialized(true)
		} catch (err) {
			const error = err instanceof Error ? err : new Error('Analytics query failed')
			setError(error)
		} finally {
			setIsLoading(false)
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey is stable serialization of options.query
	}, [ctx, queryKey])

	// Initial fetch
	useEffect(() => {
		if (!options.skip) {
			refetch()
		}
	}, [options.skip, refetch])

	// Refetch interval
	useEffect(() => {
		if (options.refetchInterval && options.refetchInterval > 0) {
			const interval = setInterval(refetch, options.refetchInterval)
			return () => clearInterval(interval)
		}
	}, [options.refetchInterval, refetch])

	return {
		data,
		isLoading,
		isInitialized,
		error,
		isError: error !== null,
		refetch,
	}
}

// ============================================
// useConversionTracking
// ============================================

export interface UseConversionTrackingReturn {
	/**
	 * Track a conversion event with automatic enrichment
	 *
	 * Automatically includes:
	 * - Click IDs (gclid, fbclid, ttclid) from URL capture
	 * - User data from auth state (email, name)
	 *
	 * Events are forwarded to all configured destinations with auto-forward enabled.
	 */
	trackConversion: (
		event: string,
		data: {
			value?: number
			currency?: string
			orderId?: string
			properties?: Record<string, unknown>
		},
		options?: {
			/** Override auto-captured click ID */
			clickId?: string
			/** Override auto-captured user email */
			userEmail?: string
			/** Override auto-captured user phone */
			userPhone?: string
			/** Only forward to specific destinations (default: all with auto-forward enabled) */
			destinations?: DestinationPlatform[]
		}
	) => Promise<void>
	/**
	 * Auto-captured click IDs from URL parameters
	 */
	clickIds: ClickIds
	/**
	 * Get the primary click ID (gclid > fbclid > ttclid)
	 */
	primaryClickId: string | undefined
}

/**
 * Hook for conversion tracking with automatic click ID and user data enrichment
 *
 * This is a convenience hook that wraps useAnalytics.track() with
 * conversion-specific defaults and automatic data enrichment.
 *
 * @example Basic conversion tracking
 * ```tsx
 * function CheckoutSuccess({ order }) {
 *   const { trackConversion } = useConversionTracking()
 *
 *   useEffect(() => {
 *     // Click IDs and user data are automatically included
 *     trackConversion('purchase', {
 *       value: order.total,
 *       currency: 'USD',
 *       orderId: order.id,
 *     })
 *   }, [order])
 *
 *   return <div>Thank you for your purchase!</div>
 * }
 * ```
 *
 * @example With custom properties
 * ```tsx
 * function SignupComplete({ user }) {
 *   const { trackConversion } = useConversionTracking()
 *
 *   useEffect(() => {
 *     trackConversion('signup', {
 *       properties: {
 *         plan: 'free',
 *         source: 'landing_page',
 *       }
 *     })
 *   }, [])
 * }
 * ```
 *
 * @example Check for click IDs
 * ```tsx
 * function LandingPage() {
 *   const { clickIds, primaryClickId } = useConversionTracking()
 *
 *   // Show different content for ad traffic
 *   if (primaryClickId) {
 *     return <AdLandingPage />
 *   }
 *
 *   return <OrganicLandingPage />
 * }
 * ```
 */
export function useConversionTracking(): UseConversionTrackingReturn {
	const ctx = usePlatformContext()

	const trackConversion = useCallback(
		async (
			event: string,
			data: {
				value?: number
				currency?: string
				orderId?: string
				properties?: Record<string, unknown>
			},
			options?: {
				clickId?: string
				userEmail?: string
				userPhone?: string
				destinations?: DestinationPlatform[]
			}
		) => {
			// Track with conversion data (auto-enriched by ctx.track)
			await ctx.track(
				event,
				data.properties || {},
				{
					destinations: options?.destinations,
					conversion: {
						value: data.value,
						currency: data.currency,
						orderId: data.orderId,
						clickId: options?.clickId,
						userEmail: options?.userEmail,
						userPhone: options?.userPhone,
					},
				}
			)
		},
		[ctx]
	)

	const primaryClickId = ctx.clickIds.gclid || ctx.clickIds.fbclid || ctx.clickIds.ttclid

	return {
		trackConversion,
		clickIds: ctx.clickIds,
		primaryClickId,
	}
}

// ============================================
// useInbox (In-App Messages / Notification Center)
// ============================================

export interface UseInboxReturn {
	/** List of in-app messages */
	messages: InAppMessage[]
	/** Number of unread messages */
	unreadCount: number
	/** Whether inbox is loading */
	isLoading: boolean
	/** Error loading inbox */
	error: Error | null
	/** Whether there was an error */
	isError: boolean
	/** User preferences for inbox */
	preferences: InboxPreferences | null
	/** Mark a specific message as read */
	markAsRead: (messageId: string) => Promise<void>
	/** Mark all messages as read */
	markAllAsRead: () => Promise<void>
	/** Dismiss a message (user closed it) */
	dismiss: (messageId: string) => Promise<void>
	/** Record that user clicked an action button */
	recordClick: (messageId: string, action: 'primary' | 'secondary') => Promise<void>
	/** Update inbox preferences */
	updatePreferences: (prefs: Partial<InboxPreferences>) => Promise<void>
	/** Refresh the inbox data */
	refresh: () => Promise<void>
	/** Get messages filtered by topic */
	getByTopic: (topic: string) => InAppMessage[]
	/** Get messages filtered by type */
	getByType: (type: InAppMessageType) => InAppMessage[]
	/** Get unread messages only */
	unreadMessages: InAppMessage[]
}

/**
 * Hook for in-app messages / notification center
 *
 * @example Basic usage
 * ```tsx
 * function NotificationBell() {
 *   const { unreadCount, messages, markAsRead } = useInbox()
 *
 *   return (
 *     <div>
 *       <Bell />
 *       {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
 *       <Dropdown>
 *         {messages.map(msg => (
 *           <NotificationItem
 *             key={msg.id}
 *             message={msg}
 *             onClick={() => markAsRead(msg.id)}
 *           />
 *         ))}
 *       </Dropdown>
 *     </div>
 *   )
 * }
 * ```
 *
 * @example With action buttons
 * ```tsx
 * function NotificationCard({ message }: { message: InAppMessage }) {
 *   const { recordClick, dismiss } = useInbox()
 *
 *   const handleAction = async () => {
 *     await recordClick(message.id, 'primary')
 *     if (message.actionUrl) {
 *       window.open(message.actionUrl, '_blank')
 *     }
 *   }
 *
 *   return (
 *     <Card>
 *       <h3>{message.title}</h3>
 *       <p>{message.body}</p>
 *       {message.actionText && (
 *         <Button onClick={handleAction}>{message.actionText}</Button>
 *       )}
 *       <CloseButton onClick={() => dismiss(message.id)} />
 *     </Card>
 *   )
 * }
 * ```
 *
 * @example Filtering by topic
 * ```tsx
 * function SystemAlerts() {
 *   const { getByType } = useInbox()
 *   const alerts = getByType('warning').concat(getByType('error'))
 *
 *   return (
 *     <AlertBanner>
 *       {alerts.map(alert => (
 *         <Alert key={alert.id} severity={alert.type}>
 *           {alert.title}
 *         </Alert>
 *       ))}
 *     </AlertBanner>
 *   )
 * }
 * ```
 */
export function useInbox(): UseInboxReturn {
	const ctx = usePlatformContext()

	const getByTopic = useCallback(
		(topic: string): InAppMessage[] => {
			return ctx.inboxMessages.filter((m) => m.topic === topic)
		},
		[ctx.inboxMessages]
	)

	const getByType = useCallback(
		(type: InAppMessageType): InAppMessage[] => {
			return ctx.inboxMessages.filter((m) => m.type === type)
		},
		[ctx.inboxMessages]
	)

	const unreadMessages = ctx.inboxMessages.filter((m) => !m.isRead && !m.isDismissed)

	return {
		messages: ctx.inboxMessages,
		unreadCount: ctx.inboxUnreadCount,
		isLoading: ctx.inboxLoading,
		error: ctx.inboxError,
		isError: ctx.inboxError !== null,
		preferences: ctx.inboxPreferences,
		markAsRead: ctx.markInboxMessageAsRead,
		markAllAsRead: ctx.markAllInboxMessagesAsRead,
		dismiss: ctx.dismissInboxMessage,
		recordClick: ctx.recordInboxMessageClick,
		updatePreferences: ctx.updateInboxPreferences,
		refresh: ctx.refreshInbox,
		getByTopic,
		getByType,
		unreadMessages,
	}
}
