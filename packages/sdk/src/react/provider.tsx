'use client'

/**
 * Sylphx Provider
 *
 * React context provider for Sylphx Platform.
 * Provides: Auth, Billing, Analytics, Push, Referrals, Storage, and optional services.
 *
 * ARCHITECTURE:
 * - All localStorage keys are namespaced by appId to prevent collisions
 * - Services use proper React Context (not module singletons)
 * - Auto-tracking events are deduplicated by tracking IDs
 */

'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { AuthContext, type AuthState } from './context'
import {
	PlatformContext,
	type Subscription,
	type Plan,
	type ReferralStats,
	type PushPreferences,
	type InAppMessageWithReadStatus,
	type InboxPreferences,
	type MobilePushConfig,
	type MobilePushPreferences,
	type MobilePushPlatform,
} from './platform-context'
import {
	AIContext,
	DatabaseContext,
	EmailContext,
	JobsContext,
	MonitoringContext,
	NewsletterContext,
	ConsentContext,
	StorageContext,
	WebhooksContext,
	SdkAuthContext,
	UserContext,
	SecurityContext,
	type AIContextValue,
	type DatabaseContextValue,
	type EmailContextValue,
	type JobsContextValue,
	type MonitoringContextValue,
	type NewsletterContextValue,
	type ConsentContextValue,
	type StorageContextValue,
	type UploadOptions,
	type UploadProgressEvent,
	type WebhooksContextValue,
	type SdkAuthContextValue,
	type UserContextValue,
	type SecurityContextValue,
} from './services-context'
import {
	SylphxStorage,
	STORAGE_KEYS,
	getOrCreateAnonymousId,
	autoCaptureClickIds,
	getStoredClickIds,
	getPrimaryClickId,
	type ClickIds,
} from './storage-utils'
import { safeRedirect, isValidRedirectUrl } from './security-utils'
import type { User, TokenResponse } from '../types'
import type {
	StreakState,
	RecordActivityResult,
	LeaderboardResult,
	LeaderboardQueryOptions,
	SubmitScoreResult,
	UserAchievement,
	AchievementUnlockEvent,
} from '../lib/engagement/types'

// Dynamic import for @vercel/blob/client to avoid SSR issues with undici
let blobUploadCache: typeof import('@vercel/blob/client').upload | null = null
async function getBlobUpload() {
	if (!blobUploadCache) {
		const { upload } = await import('@vercel/blob/client')
		blobUploadCache = upload
	}
	return blobUploadCache
}
import { createDynamicSylphx, type SylphxClient } from '../trpc-client'

// ============================================
// Types
// ============================================

export interface SylphxProviderProps {
	children: React.ReactNode
	/**
	 * Your app's ID (the app slug registered in Sylphx admin)
	 * Example: "my-app"
	 */
	appId: string
	/**
	 * Your app's publishable key (environment-specific secret)
	 * Format: sk_dev_xxx, sk_stg_xxx, or sk_prod_xxx
	 * Get this from Platform Admin → Apps → Your App → Environments
	 *
	 * Optional when platformMode is true (uses cookies instead)
	 */
	publishableKey?: string
	/** Platform URL (default: https://sylphx.com) */
	platformUrl?: string
	/** After sign out, redirect to this URL */
	afterSignOutUrl?: string
	/** VAPID public key for push notifications (get from platform) */
	vapidPublicKey?: string
	/**
	 * Auto-tracking configuration
	 * - true: enable all auto-tracking (default)
	 * - false: disable all auto-tracking
	 * - object: fine-grained control
	 */
	autoTracking?:
		| boolean
		| {
				pageview?: boolean
				login?: boolean
				signup?: boolean
				logout?: boolean
				purchase?: boolean
		  }
	/**
	 * Enable platform mode for same-origin requests (dogfooding)
	 *
	 * When true:
	 * - Uses cookies for authentication instead of bearer tokens
	 * - No publishableKey required
	 * - Requests use credentials: 'include'
	 *
	 * Use this when the SDK is used within the Sylphx Platform Console
	 * or other same-origin applications.
	 */
	platformMode?: boolean
}

// ============================================
// Provider Component
// ============================================

export function SylphxProvider({
	children,
	appId,
	publishableKey,
	platformUrl: providedPlatformUrl,
	afterSignOutUrl = '/',
	vapidPublicKey,
	autoTracking = true,
	platformMode = false,
}: SylphxProviderProps) {
	// In platform mode, derive URL from current origin; otherwise use provided or default
	const platformUrl = platformMode
		? (typeof window !== 'undefined' ? window.location.origin : '')
		: (providedPlatformUrl || 'https://sylphx.com')
	// ============================================
	// Storage (namespaced by appId)
	// ============================================
	const storage = useMemo(() => new SylphxStorage(appId), [appId])
	const [anonymousId] = useState(() => getOrCreateAnonymousId(storage))

	// ============================================
	// Click ID Auto-Capture (for conversion attribution)
	// ============================================
	const [clickIds, setClickIds] = useState<ClickIds>({})
	const hasInitializedClickIds = useRef(false)

	// Auto-capture click IDs from URL on mount
	useEffect(() => {
		if (hasInitializedClickIds.current) return
		hasInitializedClickIds.current = true

		// Capture and store any click IDs from URL
		const captured = autoCaptureClickIds(storage)
		setClickIds(captured)
	}, [storage])

	// ============================================
	// tRPC Client (for type-safe API calls)
	// ============================================
	const api = useMemo(
		() =>
			createDynamicSylphx({
				appId,
				appSecret: publishableKey,
				platformUrl,
				platformMode,
				getAccessToken: platformMode
					? undefined // Platform mode uses cookies, not tokens
					: () => storage.get(STORAGE_KEYS.ACCESS_TOKEN) ?? undefined,
			}),
		[appId, publishableKey, platformUrl, platformMode, storage]
	)

	// ============================================
	// Auth State
	// ============================================
	const [authState, setAuthState] = useState<AuthState>({
		isLoaded: false,
		isSignedIn: false,
		user: null,
		accessToken: null,
		refreshToken: null,
		error: null,
	})

	// ============================================
	// Platform State
	// ============================================
	const [subscription, setSubscription] = useState<Subscription | null>(null)
	const [subscriptionLoading, setSubscriptionLoading] = useState(false)
	const [subscriptionError, setSubscriptionError] = useState<Error | null>(null)
	const [plans, setPlans] = useState<Plan[]>([])
	const [plansLoading, setPlansLoading] = useState(false)
	const [plansError, setPlansError] = useState<Error | null>(null)
	const [referralStats, setReferralStats] = useState<ReferralStats | null>(null)
	const [referralCode, setReferralCode] = useState<string | null>(null)
	const [referralLoading, setReferralLoading] = useState(false)
	const [referralError, setReferralError] = useState<Error | null>(null)
	const [pushSubscribed, setPushSubscribed] = useState(false)
	const [pushPreferences, setPushPreferences] = useState<PushPreferences | null>(null)
	const [pushError, setPushError] = useState<Error | null>(null)
	const [analyticsError, setAnalyticsError] = useState<Error | null>(null)

	// Mobile Push State
	const [mobilePushConfig, setMobilePushConfig] = useState<MobilePushConfig | null>(null)
	const [mobilePushPreferences, setMobilePushPreferences] = useState<MobilePushPreferences | null>(null)
	const [mobilePushError, setMobilePushError] = useState<Error | null>(null)


	// ============================================
	// In-App Messages (Inbox) State
	// ============================================
	const [inboxMessages, setInboxMessages] = useState<InAppMessageWithReadStatus[]>([])
	const [inboxUnreadCount, setInboxUnreadCount] = useState(0)
	const [inboxLoading, setInboxLoading] = useState(false)
	const [inboxError, setInboxError] = useState<Error | null>(null)
	const [inboxPreferences, setInboxPreferences] = useState<InboxPreferences | null>(null)

	// Check if push is supported
	const pushSupported =
		typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

	// Analytics queue for batching
	const analyticsQueue = useRef<Array<{ type: string; data: Record<string, unknown>; eventId: string }>>([])
	const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const trackedEventIds = useRef<Set<string>>(new Set())

	// ============================================
	// Auto-tracking configuration
	// ============================================
	const autoTrackConfig = useMemo(() => {
		if (autoTracking === false) {
			return { pageview: false, login: false, signup: false, logout: false, purchase: false }
		}
		if (autoTracking === true) {
			return { pageview: true, login: true, signup: true, logout: true, purchase: true }
		}
		return {
			pageview: autoTracking.pageview ?? true,
			login: autoTracking.login ?? true,
			signup: autoTracking.signup ?? true,
			logout: autoTracking.logout ?? true,
			purchase: autoTracking.purchase ?? true,
		}
	}, [autoTracking])

	// ============================================
	// Token Management
	// ============================================
	const saveTokens = useCallback(
		(response: TokenResponse) => {
			const expiresAt = Date.now() + response.expiresIn * 1000

			storage.set(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken)
			storage.set(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken)
			storage.setJSON(STORAGE_KEYS.USER, response.user)
			storage.set(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString())

			setAuthState({
				isLoaded: true,
				isSignedIn: true,
				user: response.user,
				accessToken: response.accessToken,
				refreshToken: response.refreshToken,
				error: null,
			})
		},
		[storage]
	)

	const clearTokens = useCallback(
		(error?: Error) => {
			storage.remove(STORAGE_KEYS.ACCESS_TOKEN)
			storage.remove(STORAGE_KEYS.REFRESH_TOKEN)
			storage.remove(STORAGE_KEYS.USER)
			storage.remove(STORAGE_KEYS.EXPIRES_AT)

			setAuthState({
				isLoaded: true,
				isSignedIn: false,
				user: null,
				accessToken: null,
				refreshToken: null,
				error: error || null,
			})
		},
		[storage]
	)

	// Track ongoing refresh to prevent race conditions
	const refreshingRef = useRef<Promise<boolean> | null>(null)
	const refreshRetryCountRef = useRef(0)
	const MAX_REFRESH_RETRIES = 2

	const refreshTokens = useCallback(
		async (token: string, options?: { isProactive?: boolean }): Promise<boolean> => {
			// If already refreshing, return the existing promise (prevent race condition)
			if (refreshingRef.current) {
				return refreshingRef.current
			}

			const doRefresh = async (): Promise<boolean> => {
				try {
					const controller = new AbortController()
					const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

					const response = await fetch(`${platformUrl}/api/auth/token`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							grant_type: 'refresh_token',
							refresh_token: token,
							app_id: appId,
						}),
						signal: controller.signal,
					})

					clearTimeout(timeoutId)

					if (!response.ok) {
						const errorData = await response.json().catch(() => ({ message: 'Token refresh failed' }))

						// Don't clear tokens for transient errors on proactive refresh
						// These include: 429 (rate limited), 5xx (server errors), network errors
						const isTransientError = response.status === 429 || response.status >= 500
						if (isTransientError && options?.isProactive) {
							// Retry for transient errors (up to MAX_REFRESH_RETRIES)
							if (refreshRetryCountRef.current < MAX_REFRESH_RETRIES) {
								refreshRetryCountRef.current++
								// Exponential backoff: 1s, 2s
								await new Promise((resolve) =>
									setTimeout(resolve, 1000 * refreshRetryCountRef.current)
								)
								return doRefresh()
							}
						}

						// Clear tokens for auth errors (401, 403) or after max retries
						const refreshError = new Error(errorData.message || 'Token refresh failed')
						clearTokens(refreshError)
						refreshRetryCountRef.current = 0
						return false
					}

					const data: TokenResponse = await response.json()
					saveTokens(data)
					refreshRetryCountRef.current = 0
					return true
				} catch (error) {
					// Handle abort/timeout and network errors
					const isAbortError = error instanceof Error && error.name === 'AbortError'
					const isNetworkError = error instanceof TypeError // Fetch network errors are TypeErrors

					// Retry for transient errors on proactive refresh
					if ((isAbortError || isNetworkError) && options?.isProactive) {
						if (refreshRetryCountRef.current < MAX_REFRESH_RETRIES) {
							refreshRetryCountRef.current++
							await new Promise((resolve) =>
								setTimeout(resolve, 1000 * refreshRetryCountRef.current)
							)
							return doRefresh()
						}
					}

					const refreshError = error instanceof Error ? error : new Error('Token refresh failed')
					clearTokens(refreshError)
					refreshRetryCountRef.current = 0
					return false
				}
			}

			// Set the promise so concurrent calls wait on this one
			refreshingRef.current = doRefresh().finally(() => {
				refreshingRef.current = null
			})

			return refreshingRef.current
		},
		[appId, platformUrl, saveTokens, clearTokens]
	)

	// ============================================
	// Load Auth State
	// ============================================
	useEffect(() => {
		const loadState = () => {
			try {
				const accessToken = storage.get(STORAGE_KEYS.ACCESS_TOKEN)
				const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN)
				const user = storage.getJSON<User>(STORAGE_KEYS.USER)
				const expiresAtStr = storage.get(STORAGE_KEYS.EXPIRES_AT)

				if (accessToken && refreshToken && user) {
					const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0

					if (expiresAt > Date.now()) {
						setAuthState({
							isLoaded: true,
							isSignedIn: true,
							user,
							accessToken,
							refreshToken,
							error: null,
						})
						return
					}

					if (refreshToken) {
						refreshTokens(refreshToken)
						return
					}
				}

				setAuthState({
					isLoaded: true,
					isSignedIn: false,
					user: null,
					accessToken: null,
					refreshToken: null,
					error: null,
				})
			} catch (error) {
				setAuthState({
					isLoaded: true,
					isSignedIn: false,
					user: null,
					accessToken: null,
					refreshToken: null,
					error: error instanceof Error ? error : new Error('Failed to load auth state'),
				})
			}
		}

		loadState()

		// Listen for storage changes from other tabs
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key?.startsWith(`sylphx_${appId}_`)) {
				loadState()
			}
		}

		window.addEventListener('storage', handleStorageChange)
		return () => window.removeEventListener('storage', handleStorageChange)
	}, [refreshTokens, storage, appId])

	// ============================================
	// Smart Token Refresh (based on expiry, not interval)
	// ============================================
	useEffect(() => {
		if (!authState.isSignedIn || !authState.refreshToken) return

		const checkAndRefresh = () => {
			const expiresAtStr = storage.get(STORAGE_KEYS.EXPIRES_AT)
			const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0

			// Refresh if token expires within 2 minutes
			const twoMinutesFromNow = Date.now() + 2 * 60 * 1000
			if (expiresAt > 0 && expiresAt < twoMinutesFromNow) {
				const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN)
				if (refreshToken) {
					// Proactive refresh with retry for transient errors
					// isProactive: true enables retry logic for network/server errors
					refreshTokens(refreshToken, { isProactive: true })
				}
			}
		}

		// Check immediately and then every 30 seconds
		checkAndRefresh()
		const intervalId = setInterval(checkAndRefresh, 30 * 1000)

		return () => clearInterval(intervalId)
	}, [authState.isSignedIn, authState.refreshToken, refreshTokens, storage])

	// ============================================
	// Load Platform Data when signed in
	// ============================================
	useEffect(() => {
		if (!authState.isSignedIn) {
			setSubscription(null)
			setSubscriptionError(null)
			setReferralStats(null)
			setReferralError(null)
			setPushPreferences(null)
			setPushError(null)
			return
		}

		const loadSubscription = async () => {
			if (!authState.user?.id) return
			setSubscriptionLoading(true)
			setSubscriptionError(null)
			try {
				const data = await api.billing.getSubscription.query({ userId: authState.user.id })
				setSubscription(data)
			} catch (error) {
				setSubscriptionError(error instanceof Error ? error : new Error('Failed to load subscription'))
			} finally {
				setSubscriptionLoading(false)
			}
		}

		const loadReferrals = async () => {
			setReferralLoading(true)
			setReferralError(null)
			try {
				const [stats, codeData] = await Promise.all([
					api.referrals.getStats.query(),
					api.referrals.getMyCode.query(),
				])
				setReferralStats(stats)
				setReferralCode(codeData.code)
			} catch (error) {
				setReferralError(error instanceof Error ? error : new Error('Failed to load referrals'))
			} finally {
				setReferralLoading(false)
			}
		}

		const loadPushPreferences = async () => {
			setPushError(null)
			try {
				const data = await api.notifications.getPreferences.query()
				setPushPreferences(data)
			} catch (error) {
				setPushError(error instanceof Error ? error : new Error('Failed to load push preferences'))
			}
		}

		const loadMobilePushConfig = async () => {
			setMobilePushError(null)
			try {
				const config = await api.notifications.isMobileConfigured.query()
				setMobilePushConfig(config)
				const prefs = await api.notifications.getMobilePreferences.query()
				setMobilePushPreferences(prefs)
			} catch (error) {
				setMobilePushError(error instanceof Error ? error : new Error('Failed to load mobile push config'))
			}
		}

		loadSubscription()
		loadReferrals()
		loadPushPreferences()
		loadMobilePushConfig()
	}, [authState.isSignedIn, api])

	// Load plans (public, no auth needed)
	useEffect(() => {
		const loadPlans = async () => {
			setPlansLoading(true)
			setPlansError(null)
			try {
				const data = await api.billing.getPlans.query()
				setPlans(data)
			} catch (error) {
				setPlansError(error instanceof Error ? error : new Error('Failed to load plans'))
			} finally {
				setPlansLoading(false)
			}
		}

		loadPlans()
	}, [api])

	// ============================================
	// Auth Actions
	// ============================================
	const signIn = useCallback(
		(options?: { redirectUrl?: string; providers?: string[] | null }) => {
			// Validate redirectUrl to prevent open redirect attacks
			const currentHref = typeof window !== 'undefined' ? window.location.href : ''
			const redirectUri = options?.redirectUrl && isValidRedirectUrl(options.redirectUrl, { allowedOrigins: [platformUrl] })
				? options.redirectUrl
				: currentHref
			const params = new URLSearchParams({
				app_id: appId,
				redirect_uri: redirectUri,
				response_type: 'code',
			})
			if (options?.providers !== undefined && options.providers !== null) {
				params.set('providers', options.providers.join(','))
			}
			// Safe redirect to platform auth (platformUrl is trusted)
			if (typeof window !== 'undefined') {
				window.location.href = `${platformUrl}/auth/authorize?${params}`
			}
		},
		[appId, platformUrl]
	)

	const signUp = useCallback(
		(options?: { redirectUrl?: string; providers?: string[] | null }) => {
			// Validate redirectUrl to prevent open redirect attacks
			const currentHref = typeof window !== 'undefined' ? window.location.href : ''
			const redirectUri = options?.redirectUrl && isValidRedirectUrl(options.redirectUrl, { allowedOrigins: [platformUrl] })
				? options.redirectUrl
				: currentHref
			const params = new URLSearchParams({
				app_id: appId,
				redirect_uri: redirectUri,
				response_type: 'code',
				mode: 'signup',
			})
			if (options?.providers !== undefined && options.providers !== null) {
				params.set('providers', options.providers.join(','))
			}
			// Safe redirect to platform auth (platformUrl is trusted)
			if (typeof window !== 'undefined') {
				window.location.href = `${platformUrl}/auth/authorize?${params}`
			}
		},
		[appId, platformUrl]
	)

	const signOut = useCallback(
		async (options?: { redirectUrl?: string }) => {
			const { refreshToken } = authState

			if (refreshToken) {
				// Best-effort token revocation - continue with sign out even if this fails
				try {
					await fetch(`${platformUrl}/api/auth/revoke`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							refresh_token: refreshToken,
							app_id: appId,
						}),
					})
				} catch {
					// Token revocation is best-effort, continue with sign out
				}
			}

			clearTokens()

			// Use safe redirect with validation to prevent XSS
			const redirectUrl = options?.redirectUrl || afterSignOutUrl
			safeRedirect(redirectUrl, { fallback: afterSignOutUrl || '/' })
		},
		[appId, platformUrl, authState, clearTokens, afterSignOutUrl]
	)

	const getToken = useCallback(async (): Promise<string | null> => {
		const expiresAtStr = storage.get(STORAGE_KEYS.EXPIRES_AT)
		const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0

		if (authState.accessToken && expiresAt > Date.now() + 60000) {
			return authState.accessToken
		}

		if (authState.refreshToken) {
			const success = await refreshTokens(authState.refreshToken)
			if (success) {
				return storage.get(STORAGE_KEYS.ACCESS_TOKEN)
			}
		}

		return null
	}, [authState.accessToken, authState.refreshToken, refreshTokens, storage])

	const handleCallback = useCallback(
		async (code: string, state?: string) => {
			try {
				const response = await fetch(`${platformUrl}/api/auth/token`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						grant_type: 'authorization_code',
						code,
						app_id: appId,
					}),
				})

				if (!response.ok) {
					throw new Error('Token exchange failed')
				}

				const data: TokenResponse = await response.json()
				saveTokens(data)
			} catch (error) {
				throw error
			}
		},
		[appId, platformUrl, saveTokens]
	)

	const resetPassword = useCallback(
		async (options: { token: string; newPassword: string }) => {
			const response = await fetch(`${platformUrl}/api/auth/reset-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: options.token,
					new_password: options.newPassword,
					app_id: appId,
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Password reset failed' }))
				throw new Error(error.message || 'Password reset failed')
			}
		},
		[appId, platformUrl]
	)

	const verifyEmail = useCallback(
		async (options: { token: string }) => {
			const response = await fetch(`${platformUrl}/api/auth/verify-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: options.token,
					app_id: appId,
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Email verification failed' }))
				throw new Error(error.message || 'Email verification failed')
			}
		},
		[appId, platformUrl]
	)

	const resendVerificationEmail = useCallback(
		async (options: { email: string }) => {
			const response = await fetch(`${platformUrl}/api/auth/resend-verification`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: options.email,
					app_id: appId,
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Failed to resend verification email' }))
				throw new Error(error.message || 'Failed to resend verification email')
			}
		},
		[appId, platformUrl]
	)

	const forgotPassword = useCallback(
		async (options: { email: string }) => {
			const response = await fetch(`${platformUrl}/api/auth/forgot-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: options.email,
					app_id: appId,
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Failed to send password reset email' }))
				throw new Error(error.message || 'Failed to send password reset email')
			}
		},
		[appId, platformUrl]
	)

	// ============================================
	// Billing Actions
	// ============================================
	const createCheckout = useCallback(
		async (planSlug: string, interval: 'monthly' | 'annual' | 'lifetime'): Promise<string> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to create checkout')
			}
			const data = await api.billing.createCheckout.mutate({
				userId: authState.user.id,
				planSlug,
				interval,
				successUrl: window.location.href,
				cancelUrl: window.location.href,
			})
			return data.checkoutUrl ?? ''
		},
		[api, authState.user?.id]
	)

	const openPortal = useCallback(async (): Promise<void> => {
		if (!authState.user?.id) {
			throw new Error('User must be signed in to access billing portal')
		}
		const data = await api.billing.createPortalSession.mutate({ userId: authState.user.id, returnUrl: window.location.href })
		window.location.href = data.portalUrl
	}, [api, authState.user?.id])

	const refreshSubscription = useCallback(async (): Promise<void> => {
		if (!authState.user?.id) return
		setSubscriptionLoading(true)
		try {
			const data = await api.billing.getSubscription.query({ userId: authState.user.id })
			setSubscription(data)
		} finally {
			setSubscriptionLoading(false)
		}
	}, [api, authState.user?.id])

	// ============================================
	// Analytics Actions (with deduplication)
	// ============================================
	const ANALYTICS_QUEUE_LIMIT = 100

	const flushAnalytics = useCallback(async () => {
		if (analyticsQueue.current.length === 0) return

		const events = analyticsQueue.current
		analyticsQueue.current = []

		try {
			await api.analytics.trackBatch.mutate({
				events: events.map(({ type, data }) => ({
					event: type,
					properties: data,
					timestamp: data.timestamp as string | undefined,
				})),
			})
			setAnalyticsError(null)
		} catch (error) {
			setAnalyticsError(error instanceof Error ? error : new Error('Failed to send analytics'))
			// Re-queue on failure
			const requeued = [...events, ...analyticsQueue.current]
			if (requeued.length > ANALYTICS_QUEUE_LIMIT) {
				analyticsQueue.current = requeued.slice(-ANALYTICS_QUEUE_LIMIT)
			} else {
				analyticsQueue.current = requeued
			}
		}
	}, [api])

	const enqueueAnalytics = useCallback(
		(type: string, data: Record<string, unknown>, eventId?: string) => {
			// Deduplicate by eventId if provided
			const id = eventId || `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`
			if (trackedEventIds.current.has(id)) {
				return // Already tracked
			}
			trackedEventIds.current.add(id)

			// Clean up old event IDs (keep last 1000)
			if (trackedEventIds.current.size > 1000) {
				const ids = Array.from(trackedEventIds.current)
				trackedEventIds.current = new Set(ids.slice(-500))
			}

			if (analyticsQueue.current.length >= ANALYTICS_QUEUE_LIMIT) {
				analyticsQueue.current = analyticsQueue.current.slice(1)
			}

			analyticsQueue.current.push({
				type,
				data: {
					...data,
					timestamp: new Date().toISOString(),
					userId: authState.user?.id,
					anonymousId,
				},
				eventId: id,
			})

			if (analyticsQueue.current.length >= 10) {
				flushAnalytics()
			} else {
				if (flushTimeoutRef.current) {
					clearTimeout(flushTimeoutRef.current)
				}
				flushTimeoutRef.current = setTimeout(flushAnalytics, 1000)
			}
		},
		[authState.user?.id, anonymousId, flushAnalytics]
	)

	const track = useCallback(
		async (event: string, properties?: Record<string, unknown>, options?: import('./platform-context').TrackOptions) => {
			// Don't track auto-events if they're disabled
			const autoEvents = ['$pageview', '$login', '$signup', '$logout', '$purchase']
			if (autoEvents.includes(event)) {
				const configKey = event.slice(1) as keyof typeof autoTrackConfig
				if (!autoTrackConfig[configKey]) {
					return // Auto-tracking disabled for this event
				}
			}

			// Auto-enrich conversion data with click IDs and user info
			let enrichedConversion = options?.conversion
			if (options?.conversion || options?.destinations) {
				// Get current click IDs from storage (in case they were updated)
				const currentClickIds = getStoredClickIds(storage) || clickIds

				enrichedConversion = {
					// User-provided conversion data takes precedence
					...options?.conversion,
					// Auto-fill click ID if not explicitly provided
					clickId: options?.conversion?.clickId ?? getPrimaryClickId(currentClickIds),
					// Auto-fill user data from auth state (use ?? to respect explicit falsy values)
					userEmail: options?.conversion?.userEmail ?? authState.user?.email,
					userFirstName: options?.conversion?.userFirstName ?? authState.user?.name?.split(' ')[0],
					userLastName: options?.conversion?.userLastName ?? (authState.user?.name?.split(' ').slice(1).join(' ') || undefined),
				}
			}

			enqueueAnalytics('track', {
				event,
				properties: properties || {},
				// Destination options (passed to server)
				destinations: options?.destinations,
				skipDestinations: options?.skipDestinations,
				conversion: enrichedConversion,
			})
		},
		[enqueueAnalytics, autoTrackConfig, storage, clickIds, authState.user]
	)

	const page = useCallback(
		async (name: string, properties?: Record<string, unknown>) => {
			enqueueAnalytics('page', { name, properties: properties || {} })
		},
		[enqueueAnalytics]
	)

	const identify = useCallback(
		async (traits?: Record<string, unknown>) => {
			if (!authState.user?.id) return
			enqueueAnalytics('identify', { userId: authState.user.id, traits: traits || {} })
		},
		[authState.user?.id, enqueueAnalytics]
	)

	const queryAnalytics = useCallback(
		async (analyticsQuery: import('./platform-context').AnalyticsQuery): Promise<import('./platform-context').AnalyticsQueryResult> => {
			try {
				const result = await api.analytics.query.query(analyticsQuery)
				return {
					data: result.data,
					total: result.total,
				}
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Analytics query failed')
				setAnalyticsError(error)
				throw error
			}
		},
		[api]
	)

	// ============================================
	// Auto-Instrumented Events (with deduplication)
	// ============================================
	const prevAuthStateRef = useRef<AuthState | null>(null)
	const prevSubscriptionRef = useRef<Subscription | null>(null)
	const hasTrackedInitialPageview = useRef(false)

	// Auto-track $pageview
	useEffect(() => {
		if (!autoTrackConfig.pageview || hasTrackedInitialPageview.current) return

		hasTrackedInitialPageview.current = true
		const pageviewId = `pageview_${window.location.pathname}_${Date.now()}`
		enqueueAnalytics(
			'page',
			{
				name: '$pageview',
				properties: {
					url: window.location.href,
					path: window.location.pathname,
					referrer: document.referrer,
					title: document.title,
				},
			},
			pageviewId
		)
	}, [autoTrackConfig.pageview, enqueueAnalytics])

	// Auto-track route changes
	useEffect(() => {
		if (!autoTrackConfig.pageview || typeof window === 'undefined') return

		const handleRouteChange = () => {
			const pageviewId = `pageview_${window.location.pathname}_${Date.now()}`
			enqueueAnalytics(
				'page',
				{
					name: '$pageview',
					properties: {
						url: window.location.href,
						path: window.location.pathname,
						referrer: document.referrer,
						title: document.title,
					},
				},
				pageviewId
			)
		}

		window.addEventListener('popstate', handleRouteChange)
		return () => window.removeEventListener('popstate', handleRouteChange)
	}, [autoTrackConfig.pageview, enqueueAnalytics])

	// Auto-track auth events
	useEffect(() => {
		const prevState = prevAuthStateRef.current
		const currentState = authState

		// Detect sign-in transition
		if (prevState && !prevState.isSignedIn && currentState.isSignedIn && currentState.user) {
			const userCreatedAt = currentState.user.createdAt
				? new Date(currentState.user.createdAt).getTime()
				: 0
			const isNewUser = Date.now() - userCreatedAt < 60 * 1000

			const eventId = `auth_${currentState.user.id}_${isNewUser ? 'signup' : 'login'}_${Date.now()}`

			// Get click IDs for conversion attribution
			const currentClickIds = getStoredClickIds(storage) || clickIds

			if (isNewUser && autoTrackConfig.signup) {
				enqueueAnalytics(
					'track',
					{
						event: '$signup',
						properties: {
							userId: currentState.user.id,
							email: currentState.user.email,
							method: 'platform',
						},
						// Auto-forward signups as conversions (common for lead gen campaigns)
						conversion: {
							clickId: getPrimaryClickId(currentClickIds),
							userEmail: currentState.user.email,
							userFirstName: currentState.user.name?.split(' ')[0],
							userLastName: currentState.user.name?.split(' ').slice(1).join(' ') || undefined,
						},
					},
					eventId
				)
			} else if (!isNewUser && autoTrackConfig.login) {
				enqueueAnalytics(
					'track',
					{
						event: '$login',
						properties: {
							userId: currentState.user.id,
							email: currentState.user.email,
							method: 'platform',
						},
					},
					eventId
				)
			}

			// Identify user
			enqueueAnalytics('identify', {
				userId: currentState.user.id,
				traits: {
					email: currentState.user.email,
					name: currentState.user.name,
					image: currentState.user.image,
				},
			})
		}

		// Detect sign-out
		if (prevState?.isSignedIn && !currentState.isSignedIn && autoTrackConfig.logout) {
			const eventId = `auth_${prevState.user?.id}_logout_${Date.now()}`
			enqueueAnalytics(
				'track',
				{
					event: '$logout',
					properties: { userId: prevState.user?.id },
				},
				eventId
			)
		}

		prevAuthStateRef.current = currentState
	}, [authState, enqueueAnalytics, autoTrackConfig, storage, clickIds])

	// Auto-track subscription events with conversion data
	useEffect(() => {
		const prevSub = prevSubscriptionRef.current
		const currentSub = subscription

		if (
			autoTrackConfig.purchase &&
			currentSub &&
			(currentSub.status === 'active' || currentSub.status === 'trialing') &&
			(!prevSub || (prevSub.status !== 'active' && prevSub.status !== 'trialing'))
		) {
			const eventId = `purchase_${currentSub.id}_${Date.now()}`

			// Auto-enrich with conversion data for ad platform attribution
			const currentClickIds = getStoredClickIds(storage) || clickIds

			enqueueAnalytics(
				'track',
				{
					event: '$purchase',
					properties: {
						planId: currentSub.planId,
						planSlug: currentSub.planSlug,
						interval: currentSub.interval,
						isTrialing: currentSub.status === 'trialing',
					},
					// Auto-forward to all configured destinations
					// (destinations with auto-forward + 'purchase' in event filter will receive this)
					conversion: {
						clickId: getPrimaryClickId(currentClickIds),
						// Note: Value/currency not in Subscription type - will be enriched server-side if available
						orderId: currentSub.id,
						userEmail: authState.user?.email,
						userFirstName: authState.user?.name?.split(' ')[0],
						userLastName: authState.user?.name?.split(' ').slice(1).join(' ') || undefined,
					},
				},
				eventId
			)
		}

		prevSubscriptionRef.current = currentSub
	}, [subscription, enqueueAnalytics, autoTrackConfig.purchase, storage, clickIds, authState.user])

	// ============================================
	// Push Notification Actions
	// ============================================
	const subscribePush = useCallback(async (): Promise<boolean> => {
		if (!pushSupported || !vapidPublicKey) return false

		try {
			const registration = await navigator.serviceWorker.ready
			const sub = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: vapidPublicKey,
			})

			const json = sub.toJSON()

			await api.notifications.register.mutate({
				subscription: {
					endpoint: json.endpoint!,
					keys: {
						p256dh: json.keys?.p256dh!,
						auth: json.keys?.auth!,
					},
				},
			})

			setPushSubscribed(true)
			return true
		} catch {
			return false
		}
	}, [pushSupported, vapidPublicKey, api])

	const unsubscribePush = useCallback(async (): Promise<void> => {
		try {
			const registration = await navigator.serviceWorker.ready
			const sub = await registration.pushManager.getSubscription()

			if (sub) {
				await api.notifications.unregister.mutate({ endpoint: sub.endpoint })
				await sub.unsubscribe()
			}

			setPushSubscribed(false)
		} catch {
			// Push unsubscribe is best-effort
		}
	}, [api])

	const updatePushPreferences = useCallback(
		async (prefs: { enabled?: boolean; categories?: Record<string, boolean> }): Promise<void> => {
			// Web push preference updates are handled by subscribe/unsubscribe
			// Categories are managed via in-app message preferences
			if (prefs.enabled === false) {
				await unsubscribePush()
			}
			// Update local state for any custom categories
			if (prefs.categories && pushPreferences) {
				setPushPreferences({ ...pushPreferences, categories: prefs.categories })
			}
		},
		[pushPreferences, unsubscribePush]
	)

	// ============================================
	// Mobile Push Notification Actions
	// ============================================
	const registerMobileDevice = useCallback(
		async (options: {
			platform: MobilePushPlatform
			token: string
			deviceId?: string
			deviceName?: string
			appVersion?: string
			osVersion?: string
		}): Promise<{ success: boolean; tokenId: string }> => {
			try {
				// Cast platform to the API expected type (web devices are read-only)
				const result = await api.notifications.registerDevice.mutate({
					...options,
					platform: options.platform as 'ios' | 'android',
				})
				// Refresh preferences after registration
				const prefs = await api.notifications.getMobilePreferences.query()
				setMobilePushPreferences(prefs)
				return result
			} catch (err) {
				setMobilePushError(err instanceof Error ? err : new Error('Failed to register device'))
				throw err
			}
		},
		[api]
	)

	const unregisterMobileDevice = useCallback(
		async (token: string): Promise<void> => {
			try {
				await api.notifications.unregisterDevice.mutate({ token })
				// Refresh preferences after unregistration
				const prefs = await api.notifications.getMobilePreferences.query()
				setMobilePushPreferences(prefs)
			} catch (err) {
				setMobilePushError(err instanceof Error ? err : new Error('Failed to unregister device'))
				throw err
			}
		},
		[api]
	)

	const getMobilePushPreferences = useCallback(async (): Promise<MobilePushPreferences> => {
		try {
			const prefs = await api.notifications.getMobilePreferences.query()
			setMobilePushPreferences(prefs)
			return prefs
		} catch (err) {
			setMobilePushError(err instanceof Error ? err : new Error('Failed to get mobile push preferences'))
			throw err
		}
	}, [api])

	// ============================================
	// Referral Actions
	// ============================================
	const copyReferralCode = useCallback(async (): Promise<void> => {
		if (referralCode) {
			await navigator.clipboard.writeText(referralCode)
		}
	}, [referralCode])

	const regenerateReferralCode = useCallback(async (): Promise<string> => {
		const data = await api.referrals.regenerateCode.mutate()
		setReferralCode(data.code)
		return data.code
	}, [api])

	const getReferralLeaderboard = useCallback(
		async (options?: { limit?: number; period?: 'all' | 'month' | 'week' }) => {
			return api.referrals.getLeaderboard.query(options)
		},
		[api]
	)

	// ============================================
	// Engagement Actions (Streaks, Leaderboards, Achievements)
	// ============================================
	const getStreak = useCallback(
		async (streakId: string): Promise<StreakState> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to get streak')
			}
			return api.engagement.getStreak.query({ streakId, userId: authState.user.id })
		},
		[api, authState.user?.id]
	)

	const recordStreakActivity = useCallback(
		async (streakId: string, metadata?: Record<string, unknown>): Promise<RecordActivityResult> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to record activity')
			}
			return api.engagement.recordActivity.mutate({ streakId, userId: authState.user.id, metadata })
		},
		[api, authState.user?.id]
	)

	const recoverStreak = useCallback(
		async (streakId: string): Promise<{ success: boolean; streak: StreakState }> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to recover streak')
			}
			return api.engagement.recoverStreak.mutate({ streakId, userId: authState.user.id })
		},
		[api, authState.user?.id]
	)

	const getEngagementLeaderboard = useCallback(
		async (leaderboardId: string, options?: LeaderboardQueryOptions): Promise<LeaderboardResult> => {
			return api.engagement.getLeaderboard.query({
				leaderboardId,
				userId: authState.user?.id ?? null,
				...options,
			})
		},
		[api, authState.user?.id]
	)

	const submitScore = useCallback(
		async (leaderboardId: string, value: number, metadata?: Record<string, unknown>): Promise<SubmitScoreResult> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to submit score')
			}
			return api.engagement.submitScore.mutate({ leaderboardId, value, userId: authState.user.id, metadata })
		},
		[api, authState.user?.id]
	)

	const getAchievements = useCallback(async (): Promise<UserAchievement[]> => {
		if (!authState.user?.id) {
			throw new Error('User must be authenticated to get achievements')
		}
		return api.engagement.getAchievements.query({ userId: authState.user.id })
	}, [api, authState.user?.id])

	const unlockAchievement = useCallback(
		async (achievementId: string): Promise<AchievementUnlockEvent> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to unlock achievement')
			}
			return api.engagement.unlockAchievement.mutate({ achievementId, userId: authState.user.id })
		},
		[api, authState.user?.id]
	)

	const incrementAchievementProgress = useCallback(
		async (achievementId: string, amount: number): Promise<UserAchievement> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to increment progress')
			}
			return api.engagement.incrementProgress.mutate({ achievementId, amount, userId: authState.user.id })
		},
		[api, authState.user?.id]
	)


	// ============================================
	// In-App Messages (Inbox) Actions
	// ============================================
	const refreshInbox = useCallback(async (): Promise<void> => {
		if (!authState.user) return
		setInboxLoading(true)
		setInboxError(null)
		try {
			const [messages, unreadCountResult, preferences] = await Promise.all([
				api.notifications.getMessages.query({ limit: 50 }),
				api.notifications.getUnreadCount.query(),
				api.notifications.getMessagePreferences.query(),
			])
			setInboxMessages(messages as InAppMessageWithReadStatus[])
			setInboxUnreadCount(unreadCountResult.count)
			setInboxPreferences(preferences)
		} catch (err) {
			setInboxError(err instanceof Error ? err : new Error('Failed to load inbox'))
		} finally {
			setInboxLoading(false)
		}
	}, [api, authState.user])

	const markInboxMessageAsRead = useCallback(
		async (messageId: string): Promise<void> => {
			// Optimistic update
			setInboxMessages((prev) =>
				prev.map((m) => (m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m))
			)
			setInboxUnreadCount((prev) => Math.max(0, prev - 1))
			try {
				await api.notifications.markAsRead.mutate({ messageId })
			} catch (err) {
				// Rollback on error
				await refreshInbox()
				throw err
			}
		},
		[api, refreshInbox]
	)

	const markAllInboxMessagesAsRead = useCallback(async (): Promise<void> => {
		// Optimistic update
		setInboxMessages((prev) => prev.map((m) => ({ ...m, isRead: true, readAt: new Date().toISOString() })))
		setInboxUnreadCount(0)
		try {
			await api.notifications.markAllAsRead.mutate()
		} catch (err) {
			// Rollback on error
			await refreshInbox()
			throw err
		}
	}, [api, refreshInbox])

	const dismissInboxMessage = useCallback(
		async (messageId: string): Promise<void> => {
			// Optimistic update - remove from list
			setInboxMessages((prev) => prev.filter((m) => m.id !== messageId))
			try {
				await api.notifications.dismiss.mutate({ messageId })
			} catch (err) {
				// Rollback on error
				await refreshInbox()
				throw err
			}
		},
		[api, refreshInbox]
	)

	const recordInboxMessageClick = useCallback(
		async (messageId: string, action: 'primary' | 'secondary'): Promise<void> => {
			// Optimistic update - mark as read
			setInboxMessages((prev) =>
				prev.map((m) => (m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m))
			)
			try {
				await api.notifications.recordClick.mutate({ messageId, action })
			} catch (err) {
				console.error('Failed to record message click:', err)
				// Don't throw - this is a non-critical action
			}
		},
		[api]
	)

	const updateInboxPreferences = useCallback(
		async (prefs: { enabled?: boolean; mutedTopics?: string[]; highPriorityOnly?: boolean }): Promise<void> => {
			// Optimistic update
			setInboxPreferences((prev) => (prev ? { ...prev, ...prefs } : null))
			try {
				await api.notifications.updateMessagePreferences.mutate(prefs)
			} catch (err) {
				// Rollback on error
				await refreshInbox()
				throw err
			}
		},
		[api, refreshInbox]
	)

	// ============================================
	// AI API Helper (uses OpenAI-compatible endpoints)
	// ============================================
	const aiApiCall = useCallback(
		async <T,>(endpoint: string, options: RequestInit = {}): Promise<T> => {
			// AI endpoints use publishableKey as Bearer token directly
			const response = await fetch(`${platformUrl}${endpoint}`, {
				...options,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${publishableKey}`,
					...options.headers,
				},
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ error: { message: 'API call failed' } }))
				throw new Error(error.error?.message || 'API call failed')
			}

			return response.json()
		},
		[platformUrl, publishableKey]
	)

	// ============================================
	// AI Context Value (uses OpenAI-compatible /api/v1/* endpoints)
	// ============================================
	const aiValue: AIContextValue = useMemo(
		() => ({
			chat: async (input) => {
				// Convert SDK input format to OpenAI format
				const response = await aiApiCall<{
					id: string
					model: string
					choices: Array<{
						index: number
						message: { role: 'assistant'; content: string }
						finish_reason: string
					}>
					usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
				}>('/api/v1/chat/completions', {
					method: 'POST',
					body: JSON.stringify({
						model: input.model,
						messages: input.messages,
						temperature: input.temperature,
						max_tokens: input.maxTokens,
						top_p: input.topP,
						frequency_penalty: input.frequencyPenalty,
						presence_penalty: input.presencePenalty,
						stop: input.stop,
						tools: input.tools,
					}),
				})

				// Convert OpenAI response to SDK format
				return {
					id: response.id,
					model: response.model,
					choices: response.choices.map((c) => ({
						index: c.index,
						message: {
							role: c.message.role,
							content: c.message.content,
						},
						finishReason: c.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter' | null,
					})),
					usage: {
						promptTokens: response.usage.prompt_tokens,
						completionTokens: response.usage.completion_tokens,
						totalTokens: response.usage.total_tokens,
					},
				}
			},
			chatStream: (input) => {
				// Return an async iterable that yields chunks from SSE stream
				const controller = new AbortController()

				return {
					[Symbol.asyncIterator]: async function* () {
						const response = await fetch(`${platformUrl}/api/v1/chat/completions`, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								Authorization: `Bearer ${publishableKey}`,
							},
							body: JSON.stringify({
								model: input.model,
								messages: input.messages,
								temperature: input.temperature,
								max_tokens: input.maxTokens,
								top_p: input.topP,
								frequency_penalty: input.frequencyPenalty,
								presence_penalty: input.presencePenalty,
								stop: input.stop,
								tools: input.tools,
								stream: true,
							}),
							signal: controller.signal,
						})

						if (!response.ok) {
							const error = await response.json().catch(() => ({ error: { message: 'Stream request failed' } }))
							throw new Error(error.error?.message || 'Stream request failed')
						}

						const reader = response.body?.getReader()
						if (!reader) {
							throw new Error('No response body')
						}

						const decoder = new TextDecoder()
						let buffer = ''

						try {
							while (true) {
								const { done, value } = await reader.read()
								if (done) break

								buffer += decoder.decode(value, { stream: true })
								const lines = buffer.split('\n')
								buffer = lines.pop() || ''

								for (const line of lines) {
									if (line.startsWith('data: ')) {
										const data = line.slice(6).trim()
										if (data === '[DONE]') {
											return
										}

										try {
											const chunk = JSON.parse(data)

											yield {
												id: chunk.id || '',
												model: chunk.model || input.model,
												choices: (chunk.choices || []).map((c: Record<string, unknown>) => ({
													index: typeof c.index === 'number' ? c.index : 0,
													delta: {
														role: (c.delta as Record<string, unknown>)?.role as 'assistant' | undefined,
														content: (c.delta as Record<string, unknown>)?.content as string | undefined,
														toolCalls: (c.delta as Record<string, unknown>)?.tool_calls as unknown[] | undefined,
													},
													finishReason: (c.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter') || null,
												})),
											}
										} catch {
											// Skip malformed JSON lines
										}
									}
								}
							}
						} finally {
							reader.releaseLock()
						}
					},
				}
			},
			complete: async (input) => {
				// Use chat completions for text completion (completion API is deprecated)
				const response = await aiApiCall<{
					id: string
					model: string
					choices: Array<{
						message: { content: string }
						finish_reason: string
					}>
					usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
				}>('/api/v1/chat/completions', {
					method: 'POST',
					body: JSON.stringify({
						model: input.model,
						messages: [{ role: 'user', content: input.prompt }],
						temperature: input.temperature,
						max_tokens: input.maxTokens,
						stop: input.stop,
					}),
				})

				return {
					id: response.id,
					model: response.model,
					choices: [
						{
							index: 0,
							text: response.choices[0]?.message.content ?? '',
							finishReason: response.choices[0]?.finish_reason as 'stop' | 'length' | null,
						},
					],
					usage: {
						promptTokens: response.usage.prompt_tokens,
						completionTokens: response.usage.completion_tokens,
						totalTokens: response.usage.total_tokens,
					},
				}
			},
			embed: async (input) => {
				const response = await aiApiCall<{
					model: string
					data: Array<{ index: number; embedding: number[] }>
					usage: { prompt_tokens: number; total_tokens: number }
				}>('/api/v1/embeddings', {
					method: 'POST',
					body: JSON.stringify({
						model: input.model,
						input: input.input,
						dimensions: input.dimensions,
					}),
				})

				return {
					id: crypto.randomUUID(),
					model: response.model,
					data: response.data,
					usage: {
						promptTokens: response.usage.prompt_tokens,
						totalTokens: response.usage.total_tokens,
					},
				}
			},
			vision: async (input) => {
				// Vision is just chat with image content
				const response = await aiApiCall<{
					id: string
					model: string
					choices: Array<{
						index: number
						message: { role: 'assistant'; content: string }
						finish_reason: string
					}>
					usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
				}>('/api/v1/chat/completions', {
					method: 'POST',
					body: JSON.stringify({
						model: input.model,
						messages: input.messages,
						max_tokens: input.maxTokens,
					}),
				})

				return {
					id: response.id,
					model: response.model,
					choices: response.choices.map((c) => ({
						index: c.index,
						message: {
							role: c.message.role,
							content: c.message.content,
						},
						finishReason: c.finish_reason as 'stop' | 'length' | 'tool_calls' | 'content_filter' | null,
					})),
					usage: {
						promptTokens: response.usage.prompt_tokens,
						completionTokens: response.usage.completion_tokens,
						totalTokens: response.usage.total_tokens,
					},
				}
			},
			getUsage: async (period) => {
				return await api.ai.getUsage.query({ period })
			},
			getRateLimitStatus: async () => {
				return await api.ai.getRateLimitStatus.query()
			},
			listModels: async (options) => {
				const response = await api.ai.listModels.query(options ?? {})
				return {
					models: response.models.map((m) => ({
						id: m.id,
						name: m.name || m.id,
						contextWindow: m.contextWindow || 0,
						capabilities: m.capabilities || ['chat'],
						inputCostPer1M: m.inputCostPer1M ?? 0,
						outputCostPer1M: m.outputCostPer1M ?? 0,
						description: m.description || '',
					})),
					total: response.total,
					hasMore: response.hasMore,
				}
			},
		}),
		[aiApiCall, api, platformUrl]
	)

	// ============================================
	// Jobs Context Value
	// ============================================
	const jobsValue: JobsContextValue = useMemo(
		() => ({
			checkStatus: async () => {
				return await api.jobs.status.query()
			},
			schedule: async (options) => {
				return await api.jobs.schedule.mutate(options)
			},
			createCron: async (options) => {
				return await api.jobs.createCron.mutate(options)
			},
			pauseCron: async (scheduleId) => {
				const result = await api.jobs.pauseCron.mutate({ scheduleId })
				return result.success
			},
			resumeCron: async (scheduleId) => {
				const result = await api.jobs.resumeCron.mutate({ scheduleId })
				return result.success
			},
			deleteCron: async (scheduleId) => {
				const result = await api.jobs.deleteCron.mutate({ scheduleId })
				return result.success
			},
			getJob: async (jobId) => {
				return await api.jobs.get.query({ jobId })
			},
			listJobs: async (options = {}) => {
				// Cast status to exclude 'cancelled' which isn't in API enum
				const apiOptions = {
					...options,
					status: options.status === 'cancelled' ? undefined : options.status,
				} as Parameters<typeof api.jobs.list.query>[0]
				return await api.jobs.list.query(apiOptions)
			},
			cancelJob: async (jobId) => {
				const result = await api.jobs.cancel.mutate({ jobId })
				return result.success
			},
		}),
		[api]
	)

	// ============================================
	// Monitoring Context Value
	// ============================================
	const monitoringValue: MonitoringContextValue = useMemo(
		() => ({
			captureException: async (error, options = {}) => {
				// Transform Error object into structured format for API
				const frames: Array<{ filename?: string; function?: string; lineno?: number; colno?: number; in_app?: boolean }> = []
				if (error.stack) {
					const lines = error.stack.split('\n').slice(1)
					for (const line of lines) {
						const match = line.match(/^\s*at\s+(?:(.+?)\s+)?(?:\()?(.+?):(\d+):(\d+)\)?$/)
						if (match) {
							frames.push({
								function: match[1] || '<anonymous>',
								filename: match[2],
								lineno: parseInt(match[3] ?? '0', 10),
								colno: parseInt(match[4] ?? '0', 10),
								in_app: !match[2]?.includes('node_modules'),
							})
						}
					}
				}
				return await api.monitoring.captureException.mutate({
					exception: { values: [{ type: error.name || 'Error', value: error.message, stacktrace: frames.length > 0 ? { frames } : undefined }] },
					level: options.level,
					tags: options.tags,
					extra: options.extra,
					fingerprint: options.fingerprint,
					route: options.route,
					userAgent: options.userAgent,
				})
			},
			captureMessage: async (message, options = {}) => {
				return await api.monitoring.captureMessage.mutate({
					message,
					level: options.level,
					tags: options.tags,
					extra: options.extra,
					route: options.route,
				})
			},
		}),
		[api]
	)

	// ============================================
	// Consent Context Value
	// ============================================
	const consentValue: ConsentContextValue = useMemo(
		() => ({
			anonymousId,
			userId: authState.user?.id ?? null,
			getConsentTypes: async () => {
				return await api.consent.getConsentTypes.query()
			},
			getUserConsents: async () => {
				return await api.consent.getUserConsents.query({
					userId: authState.user?.id,
					anonymousId,
				})
			},
			setConsents: async (consents) => {
				return await api.consent.setConsents.mutate({
					userId: authState.user?.id,
					anonymousId,
					consents,
				})
			},
			acceptAll: async () => {
				return await api.consent.acceptAll.mutate({
					userId: authState.user?.id,
					anonymousId,
				})
			},
			declineOptional: async () => {
				return await api.consent.declineOptional.mutate({
					userId: authState.user?.id,
					anonymousId,
				})
			},
			checkConsent: async (purposeSlug, defaults) => {
				// Get user's current consents
				try {
					const consents = await api.consent.getUserConsents.query({
						userId: authState.user?.id,
						anonymousId,
					})
					// Find consent for this purpose
					const consent = consents.find((c) => c.slug === purposeSlug)
					if (consent) {
						return consent.granted
					}
					// Purpose not found - use default if provided, otherwise false
					return defaults?.defaultEnabled ?? false
				} catch {
					// On error, use default if provided
					return defaults?.defaultEnabled ?? false
				}
			},
		}),
		[api, anonymousId, authState.user?.id]
	)

	// ============================================
	// Storage Context Value
	// ============================================

	/**
	 * Modern client upload using Vercel Blob.
	 *
	 * Architecture:
	 * 1. Client calls our /api/storage/upload to get a client token
	 * 2. @vercel/blob/client uploads directly to Vercel Blob (zero server bandwidth)
	 * 3. Vercel calls our onUploadCompleted callback
	 * 4. Platform records file in DB and consumes quota
	 *
	 * Benefits:
	 * - Zero server bandwidth (direct to storage)
	 * - Up to 5TB file size (vs 4.5MB server limit)
	 * - Real progress tracking
	 * - Edge compatible
	 */
	const storageValue: StorageContextValue = useMemo(
		() => ({
			upload: async (file: File, options?: UploadOptions) => {
				const blobUpload = await getBlobUpload()
				const blob = await blobUpload(file.name, file, {
					access: 'public',
					handleUploadUrl: `${platformUrl}/api/storage/upload`,
					clientPayload: JSON.stringify({
						appId,
						userId: authState.user?.id,
						type: 'file',
						folder: options?.path,
					}),
					onUploadProgress: options?.onProgress
						? (progress) => {
								options.onProgress!({
									loaded: progress.loaded,
									total: progress.total,
									progress: progress.percentage,
								} satisfies UploadProgressEvent)
							}
						: undefined,
				})

				return blob.url
			},
			uploadAvatar: async (file: File, options?: { onProgress?: (event: UploadProgressEvent) => void }) => {
				if (!authState.user?.id) {
					throw new Error('Must be logged in to upload avatar')
				}

				const blobUpload = await getBlobUpload()
				const blob = await blobUpload(file.name, file, {
					access: 'public',
					handleUploadUrl: `${platformUrl}/api/storage/upload`,
					clientPayload: JSON.stringify({
						appId,
						userId: authState.user.id,
						type: 'avatar',
					}),
					onUploadProgress: options?.onProgress
						? (progress) => {
								options.onProgress!({
									loaded: progress.loaded,
									total: progress.total,
									progress: progress.percentage,
								} satisfies UploadProgressEvent)
							}
						: undefined,
				})

				return blob.url
			},
			deleteFile: async (fileId: string) => {
				await api.storage.deleteFile.mutate({ id: fileId })
			},
			getUrl: async (fileId: string) => {
				const data = await api.storage.getFile.query({ id: fileId })
				return data.url
			},
		}),
		[api, platformUrl, appId, authState.user?.id]
	)

	// ============================================
	// Newsletter Context Value
	// ============================================
	const newsletterValue: NewsletterContextValue = useMemo(
		() => ({
			subscribe: async (options) => {
				return await api.newsletter.sdkSubscribe.mutate(options)
			},
			verify: async (token) => {
				return await api.newsletter.sdkVerify.mutate({ token })
			},
			unsubscribe: async (email, token) => {
				return await api.newsletter.sdkUnsubscribe.mutate({ email, token })
			},
			resendVerification: async (email) => {
				return await api.newsletter.sdkResendVerification.mutate({ email })
			},
			getUnsubscribeInfo: async (token) => {
				return await api.newsletter.sdkGetUnsubscribeInfo.query({ token })
			},
			updatePreferences: async (email, preferences) => {
				return await api.newsletter.sdkUpdatePreferences.mutate({ email, preferences })
			},
			getPreferences: async (email) => {
				return await api.newsletter.sdkGetPreferences.query({ email })
			},
		}),
		[api]
	)

	// ============================================
	// Database Context Value
	// ============================================
	// NOTE: Database uses direct Neon connection, not tRPC
	// Users should use @sylphx/platform-sdk/db with DATABASE_URL from Console
	const databaseValue: DatabaseContextValue = useMemo(
		() => ({
			query: async () => {
				throw new Error(
					'Database queries through SDK hooks are not supported. ' +
						'Use @sylphx/platform-sdk/db with DATABASE_URL from the Console instead. ' +
						'See: https://sylphx.com/docs/database'
				)
			},
			execute: async () => {
				throw new Error(
					'Database mutations through SDK hooks are not supported. ' +
						'Use @sylphx/platform-sdk/db with DATABASE_URL from the Console instead. ' +
						'See: https://sylphx.com/docs/database'
				)
			},
			transaction: async () => {
				throw new Error(
					'Database transactions through SDK hooks are not supported. ' +
						'Use @sylphx/platform-sdk/db with DATABASE_URL from the Console instead. ' +
						'See: https://sylphx.com/docs/database'
				)
			},
		}),
		[]
	)

	// ============================================
	// Email Context Value (includes Newsletter/Marketing)
	// ============================================
	const emailValue: EmailContextValue = useMemo(
		() => ({
			// Transactional Email
			send: async (options) => {
				return await api.email.send.mutate(options)
			},
			sendTemplated: async (options) => {
				// Cast template to expected type - SDK accepts any string, API has fixed set
				const result = await api.email.sendTemplated.mutate({
					...options,
					template: options.template as 'welcome' | 'verification' | 'password_reset' | 'security_alert',
				})
				return { success: result.success, template: options.template }
			},
			sendToUser: async (options) => {
				return await api.email.sendToUser.mutate(options)
			},
			// Marketing Email (Newsletter)
			newsletter: {
				subscribe: async (options) => {
					return await api.newsletter.sdkSubscribe.mutate(options)
				},
				verify: async (token) => {
					return await api.newsletter.sdkVerify.mutate({ token })
				},
				unsubscribe: async (email, token) => {
					return await api.newsletter.sdkUnsubscribe.mutate({ email, token })
				},
				resendVerification: async (email) => {
					return await api.newsletter.sdkResendVerification.mutate({ email })
				},
				getUnsubscribeInfo: async (token) => {
					return await api.newsletter.sdkGetUnsubscribeInfo.query({ token })
				},
				updatePreferences: async (email, preferences) => {
					return await api.newsletter.sdkUpdatePreferences.mutate({ email, preferences })
				},
				getPreferences: async (email) => {
					return await api.newsletter.sdkGetPreferences.query({ email })
				},
			},
		}),
		[api]
	)

	// ============================================
	// Webhooks Context Value
	// ============================================
	const webhooksValue: WebhooksContextValue = useMemo(
		() => ({
			getConfig: async () => {
				return await api.webhooks.getConfig.query()
			},
			updateConfig: async (options) => {
				return await api.webhooks.updateConfig.mutate(options)
			},
			getDeliveries: async (options = {}) => {
				return await api.webhooks.getDeliveries.query(options)
			},
			replayDelivery: async (deliveryId) => {
				return await api.webhooks.replayDelivery.mutate({ deliveryId })
			},
			getStats: async (period) => {
				return await api.webhooks.getStats.query({ period })
			},
		}),
		[api]
	)

	// ============================================
	// SDK Auth Context Value (for direct API calls)
	// ============================================
	const sdkAuthValue: SdkAuthContextValue = useMemo(
		() => ({
			login: async (email, password) => {
				const result = await api.auth.login.mutate({ email, password })
				return {
					requiresTwoFactor: result.requiresTwoFactor ?? false,
					userId: result.userId,
					user: result.user ? {
						id: result.user.id,
						email: result.user.email,
						name: result.user.name ?? null,
						image: result.user.image ?? null,
						emailVerified: result.user.emailVerified ?? false,
						twoFactorEnabled: false, // Get from security settings if needed
					} : undefined,
				}
			},
			verifyTwoFactor: async (userId, code) => {
				const result = await api.auth.verifyTwoFactor.mutate({ userId, code })
				// Save tokens after successful 2FA
				saveTokens({
					accessToken: result.accessToken,
					refreshToken: result.refreshToken,
					expiresIn: result.expiresIn,
					user: result.user as User,
				})
				return {
					accessToken: result.accessToken,
					refreshToken: result.refreshToken,
					expiresIn: result.expiresIn,
					user: {
						id: result.user.id,
						email: result.user.email,
						name: result.user.name ?? null,
						image: result.user.image ?? null,
						emailVerified: result.user.emailVerified ?? false,
						twoFactorEnabled: true, // They just verified 2FA so it must be enabled
					},
				}
			},
			register: async (name, email, password) => {
				const result = await api.auth.register.mutate({ email, password, name })
				return {
					requiresVerification: true,
					message: 'Please check your email to verify your account',
					user: {
						id: result.user.id,
						email: result.user.email,
						name: result.user.name ?? null,
					},
				}
			},
			forgotPassword: async (email) => {
				const result = await api.auth.forgotPassword.mutate({ email })
				return { success: result.success, message: 'Password reset email sent' }
			},
			resetPassword: async (token, password) => {
				return await api.auth.resetPassword.mutate({ token, password })
			},
			verifyEmail: async (token) => {
				// Call platform verify email endpoint
				const response = await fetch(`${platformUrl}/api/auth/verify-email`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token, app_id: appId }),
				})
				if (!response.ok) {
					const error = await response.json().catch(() => ({ message: 'Email verification failed' }))
					throw new Error(error.message || 'Email verification failed')
				}
				return { success: true }
			},
			logout: async (refreshToken) => {
				await api.auth.logout.mutate()
				clearTokens()
				return { success: true }
			},
			me: async () => {
				const profile = await api.user.getProfile.query()
				// Get 2FA status from security settings
				const security = await api.user.getSecuritySettings.query()
				return {
					id: profile.id,
					email: profile.email,
					name: profile.name ?? null,
					image: profile.image ?? null,
					emailVerified: profile.emailVerified ?? false,
					twoFactorEnabled: security.twoFactorEnabled ?? false,
				}
			},
			getOAuthProviders: async () => {
				// Fetch from platform config
				const response = await fetch(`${platformUrl}/api/auth/providers?app_id=${appId}`)
				if (!response.ok) {
					return { providers: [] }
				}
				const data = await response.json()
				return { providers: data.providers || [] }
			},
		}),
		[api, platformUrl, appId, saveTokens, clearTokens]
	)

	// ============================================
	// User Context Value (for profile/session management)
	// ============================================
	const userValue: UserContextValue = useMemo(
		() => ({
			getProfile: async () => {
				const profile = await api.user.getProfile.query()
				const security = await api.user.getSecuritySettings.query()
				return {
					id: profile.id,
					email: profile.email,
					name: profile.name ?? null,
					image: profile.image ?? null,
					emailVerified: profile.emailVerified ?? false,
					twoFactorEnabled: security.twoFactorEnabled ?? false,
					createdAt: profile.createdAt ? new Date(profile.createdAt) : new Date(),
				}
			},
			updateProfile: async (data) => {
				const profile = await api.user.updateProfile.mutate(data)
				// Update local auth state if user info changed
				if (authState.user) {
					setAuthState({
						...authState,
						user: {
							...authState.user,
							name: profile.name ?? authState.user.name,
							image: profile.image ?? authState.user.image,
						},
					})
				}
				// updateProfile returns minimal data, fetch full profile for complete info
				const fullProfile = await api.user.getProfile.query()
				const security = await api.user.getSecuritySettings.query()
				return {
					id: profile.id,
					email: profile.email,
					name: profile.name ?? null,
					image: profile.image ?? null,
					emailVerified: fullProfile.emailVerified ?? false,
					twoFactorEnabled: security.twoFactorEnabled ?? false,
					createdAt: fullProfile.createdAt ? new Date(fullProfile.createdAt) : new Date(),
				}
			},
			changePassword: async (currentPassword, newPassword) => {
				// First verify identity with current password
				await api.challenge.verifyIdentity.mutate({ method: 'password', value: currentPassword })
				// Then change password
				return await api.user.changePassword.mutate({ newPassword })
			},
			getLoginHistory: async (options) => {
				const history = await api.user.getLoginHistory.query()
				const items = options?.limit ? history.slice(0, options.limit) : history
				return items.map((h) => ({
					id: h.id ?? '',
					ipAddress: h.ipAddress ?? null,
					userAgent: h.userAgent ?? null,
					location: h.city && h.country ? `${h.city}, ${h.country}` : h.country ?? null,
					device: h.device ?? null,
					browser: null, // Not available in LoginHistoryEntry
					os: null, // Not available in LoginHistoryEntry
					loginAt: h.createdAt ? new Date(h.createdAt) : new Date(),
					successful: h.success ?? true,
				}))
			},
			getSessions: async () => {
				const response = await api.user.getSessions.query()
				return response.map((s) => ({
					id: s.id,
					isCurrent: s.isCurrent,
					deviceName: s.deviceName,
					browser: s.browser,
					os: s.os,
					deviceType: s.deviceType,
					ipAddress: s.ipAddress,
					country: s.country,
					city: s.city,
					lastActiveAt: s.lastActiveAt,
					createdAt: s.createdAt,
				}))
			},
			revokeSession: async (sessionId) => {
				return await api.user.revokeSession.mutate({ sessionId })
			},
			revokeAllSessions: async () => {
				return await api.user.revokeAllSessions.mutate()
			},
			getConnectedAccounts: async () => {
				const accounts = await api.user.getConnectedAccounts.query()
				return accounts.map((a) => ({
					provider: a.provider,
					accountId: '', // Not available in the API response
					email: null, // Not available in the API response
					name: null, // Not available in the API response
					image: null, // Not available in the API response
					connectedAt: a.connectedAt ? new Date(a.connectedAt) : new Date(),
				}))
			},
			deleteAccount: async (password) => {
				// Challenge verification handled by user.deleteAccount via challenge system
				if (password) {
					await api.challenge.verifyIdentity.mutate({ method: 'password', value: password })
				}
				return await api.user.deleteAccount.mutate()
			},
			exportData: async () => {
				const response = await api.user.exportData.query()
				return {
					downloadUrl: response.downloadUrl as string,
					expiresAt: new Date(response.expiresAt as string),
				}
			},
		}),
		[api, authState, setAuthState]
	)

	// ============================================
	// Security Context Value (for 2FA, passkeys, etc.)
	// ============================================
	const securityValue: SecurityContextValue = useMemo(
		() => ({
			getTwoFactorStatus: async () => {
				const settings = await api.user.getSecuritySettings.query()
				// Backup codes count is retrieved separately if needed
				return {
					enabled: settings.twoFactorEnabled ?? false,
					backupCodesRemaining: 0, // Would need separate endpoint to get this
				}
			},
			twoFactorSetup: async () => {
				return await api.security.twoFactorSetup.mutate()
			},
			twoFactorVerify: async (code) => {
				return await api.security.twoFactorVerify.mutate({ code })
			},
			twoFactorDisable: async (_code) => {
				// Note: Code verification is handled by challenge middleware, not the method itself
				return await api.security.twoFactorDisable.mutate()
			},
			backupCodesView: async (_code) => {
				// Note: Code verification is handled by challenge middleware, not the method itself
				return await api.security.backupCodesView.query()
			},
			backupCodesRegenerate: async (_code) => {
				// Note: Code verification is handled by challenge middleware, not the method itself
				return await api.security.backupCodesRegenerate.mutate()
			},
			getPasswordStatus: async () => {
				const settings = await api.user.getSecuritySettings.query()
				return { hasPassword: settings.hasPassword ?? true }
			},
			passwordSet: async (password) => {
				return await api.security.passwordSet.mutate({ password })
			},
			emailChangeRequest: async (newEmail) => {
				return await api.security.emailChangeRequest.mutate({ newEmail })
			},
			emailChangeConfirm: async (token) => {
				return await api.security.emailChangeConfirm.mutate({ token })
			},
			passkeyList: async () => {
				const response = await api.security.passkeyList.query()
				return response.map((p) => ({
					id: p.id,
					name: p.deviceName ?? undefined, // API returns deviceName (null -> undefined)
					deviceType: undefined, // Not returned by API
					createdAt: new Date(p.createdAt),
					lastUsedAt: p.lastUsedAt ? new Date(p.lastUsedAt) : null,
				}))
			},
			passkeyRegisterStart: async () => {
				return await api.security.passkeyRegisterStart.mutate()
			},
			passkeyRegisterVerify: async (credential, name) => {
				return await api.security.passkeyRegisterVerify.mutate({ credential, deviceName: name ?? 'Passkey' })
			},
			passkeyRename: async (passkeyId: string, name: string) => {
				return await api.security.passkeyRename.mutate({ passkeyId, name })
			},
			passkeyDelete: async (passkeyId: string) => {
				return await api.security.passkeyDelete.mutate({ passkeyId })
			},
			oauthConnect: async (provider) => {
				const redirectUri = window.location.href
				return {
					redirectUrl: `${platformUrl}/auth/connect/${provider}?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`,
				}
			},
			oauthDisconnect: async (provider) => {
				return await api.security.oauthDisconnect.mutate({ provider })
			},
			getSecurityScore: async () => {
				return await api.security.getSecurityScore.query()
			},
		}),
		[api, platformUrl, appId]
	)

	// ============================================
	// Context Values
	// ============================================
	const authValue = useMemo(
		() => ({
			...authState,
			signIn,
			signUp,
			signOut,
			getToken,
			handleCallback,
			resetPassword,
			verifyEmail,
			resendVerificationEmail,
			forgotPassword,
		}),
		[
			authState,
			signIn,
			signUp,
			signOut,
			getToken,
			handleCallback,
			resetPassword,
			verifyEmail,
			resendVerificationEmail,
			forgotPassword,
		]
	)

	const platformValue = useMemo(
		() => ({
			appId,
			publishableKey,
			platformUrl,
			anonymousId,
			clickIds,
			subscription,
			subscriptionLoading,
			subscriptionError,
			plans,
			plansLoading,
			plansError,
			createCheckout,
			openPortal,
			refreshSubscription,
			track,
			page,
			identify,
			queryAnalytics,
			analyticsError,
			pushSupported,
			pushSubscribed,
			pushPreferences,
			pushError,
			subscribePush,
			unsubscribePush,
			updatePushPreferences,
			// Mobile Push
			mobilePushConfig,
			mobilePushPreferences,
			mobilePushError,
			registerMobileDevice,
			unregisterMobileDevice,
			getMobilePushPreferences,
			referralStats,
			referralCode,
			referralLoading,
			referralError,
			copyReferralCode,
			regenerateReferralCode,
			getReferralLeaderboard,
			// In-App Messages (Inbox)
			inboxMessages,
			inboxUnreadCount,
			inboxLoading,
			inboxError,
			inboxPreferences,
			refreshInbox,
			markInboxMessageAsRead,
			markAllInboxMessagesAsRead,
			dismissInboxMessage,
			recordInboxMessageClick,
			updateInboxPreferences,
			getBillingBalance: async () => {
				return await api.billing.getBalance.query()
			},
			getBillingUsage: async (options?: { month?: string }) => {
				return await api.billing.getUsage.query(options)
			},
			// Engagement
			user: authState.user,
			getStreak,
			recordStreakActivity,
			recoverStreak,
			getLeaderboard: getEngagementLeaderboard, // Engagement leaderboard
			submitScore,
			getAchievements,
			unlockAchievement,
			incrementAchievementProgress,
		}),
		[
			api,
			appId,
			publishableKey,
			platformUrl,
			anonymousId,
			clickIds,
			subscription,
			subscriptionLoading,
			subscriptionError,
			plans,
			plansLoading,
			plansError,
			createCheckout,
			openPortal,
			refreshSubscription,
			track,
			page,
			identify,
			queryAnalytics,
			analyticsError,
			pushSupported,
			pushSubscribed,
			pushPreferences,
			pushError,
			subscribePush,
			unsubscribePush,
			updatePushPreferences,
			// Mobile Push deps
			mobilePushConfig,
			mobilePushPreferences,
			mobilePushError,
			registerMobileDevice,
			unregisterMobileDevice,
			getMobilePushPreferences,
			referralStats,
			referralCode,
			referralLoading,
			referralError,
			copyReferralCode,
			regenerateReferralCode,
			getReferralLeaderboard,
			// Inbox deps
			inboxMessages,
			inboxUnreadCount,
			inboxLoading,
			inboxError,
			inboxPreferences,
			refreshInbox,
			markInboxMessageAsRead,
			markAllInboxMessagesAsRead,
			dismissInboxMessage,
			recordInboxMessageClick,
			updateInboxPreferences,
			// Engagement deps
			authState.user,
			getStreak,
			recordStreakActivity,
			recoverStreak,
			getEngagementLeaderboard,
			submitScore,
			getAchievements,
			unlockAchievement,
			incrementAchievementProgress,
		]
	)

	return (
		<AuthContext.Provider value={authValue}>
			<SdkAuthContext.Provider value={sdkAuthValue}>
				<UserContext.Provider value={userValue}>
					<SecurityContext.Provider value={securityValue}>
						<PlatformContext.Provider value={platformValue}>
							<StorageContext.Provider value={storageValue}>
								<AIContext.Provider value={aiValue}>
									<JobsContext.Provider value={jobsValue}>
										<MonitoringContext.Provider value={monitoringValue}>
											<ConsentContext.Provider value={consentValue}>
												<DatabaseContext.Provider value={databaseValue}>
													<EmailContext.Provider value={emailValue}>
														{/* Newsletter is now part of Email - keeping for backward compat */}
														<NewsletterContext.Provider value={newsletterValue}>
															<WebhooksContext.Provider value={webhooksValue}>
																{children}
															</WebhooksContext.Provider>
														</NewsletterContext.Provider>
													</EmailContext.Provider>
												</DatabaseContext.Provider>
											</ConsentContext.Provider>
										</MonitoringContext.Provider>
									</JobsContext.Provider>
								</AIContext.Provider>
							</StorageContext.Provider>
						</PlatformContext.Provider>
					</SecurityContext.Provider>
				</UserContext.Provider>
			</SdkAuthContext.Provider>
		</AuthContext.Provider>
	)
}
