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
 * - React Query provides caching, deduplication, and stale-while-revalidate for server data
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { AuthContext, type AuthState } from './context'
import { validateAndSanitizePublishableKey } from '../key-validation'
import { DEFAULT_PLATFORM_URL } from '../constants'
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
	type ConsentType,
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
import type { User, TokenResponse, AIProvider, AppConfig } from '../types'
import { ConfigContext } from './hooks/use-config'
import type {
	StreakState,
	RecordActivityResult,
	LeaderboardResult,
	LeaderboardQueryOptions,
	SubmitScoreResult,
	UserAchievement,
	AchievementUnlockEvent,
	StreakDefaults,
	LeaderboardDefaults,
	AchievementDefaults,
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

// ============================================
// REST API Helper
// ============================================
interface RestConfig {
	/** Publishable key — used as x-app-secret for SDK API calls */
	publishableKey?: string
	platformUrl: string
	getAccessToken?: () => string | null | undefined
}

/**
 * Infer AI provider from model ID
 */
function inferProviderFromModelId(modelId: string): AIProvider {
	if (modelId.startsWith('gpt-') || modelId.includes('openai')) return 'openai'
	if (modelId.startsWith('claude-') || modelId.includes('anthropic')) return 'anthropic'
	if (modelId.startsWith('gemini-') || modelId.includes('google')) return 'google'
	if (modelId.startsWith('mistral-') || modelId.includes('mistral')) return 'mistral'
	if (modelId.includes('groq')) return 'groq'
	if (modelId.includes('together')) return 'together'
	return 'openai' // Default
}

function createRestApi(config: RestConfig) {
	const baseUrl = `${config.platformUrl}/api/sdk`

	const headers = () => {
		const h: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		if (config.publishableKey) h['x-app-secret'] = config.publishableKey
		const token = config.getAccessToken?.()
		if (token) h['Authorization'] = `Bearer ${token}`
		return h
	}

	const fetchOptions = (method: string, body?: unknown) => ({
		method,
		headers: headers(),
		...(body !== undefined && { body: JSON.stringify(body) }),
	})

	async function get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
		const url = new URL(`${baseUrl}${path}`)
		if (query) Object.entries(query).forEach(([k, v]) => v && url.searchParams.set(k, v))
		const res = await fetch(url.toString(), fetchOptions('GET'))
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }))
			throw new Error(err.error?.message ?? err.message ?? 'Request failed')
		}
		return res.json()
	}

	async function post<T>(path: string, body?: unknown): Promise<T> {
		const res = await fetch(`${baseUrl}${path}`, fetchOptions('POST', body))
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }))
			throw new Error(err.error?.message ?? err.message ?? 'Request failed')
		}
		return res.json()
	}

	async function put<T>(path: string, body?: unknown): Promise<T> {
		const res = await fetch(`${baseUrl}${path}`, fetchOptions('PUT', body))
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }))
			throw new Error(err.error?.message ?? err.message ?? 'Request failed')
		}
		return res.json()
	}

	async function del<T>(path: string): Promise<T> {
		const res = await fetch(`${baseUrl}${path}`, fetchOptions('DELETE'))
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }))
			throw new Error(err.error?.message ?? err.message ?? 'Request failed')
		}
		return res.json()
	}

	return { get, post, put, del }
}

type RestApiClient = ReturnType<typeof createRestApi>

// ============================================
// Types
// ============================================

export interface SylphxProviderProps {
	children: React.ReactNode
	/**
	 * Your app's publishable key (environment-specific public key)
	 * Format: pk_dev_xxx, pk_stg_xxx, or pk_prod_xxx
	 * Get this from Platform Admin → Apps → Your App → Environments
	 *
	 * The key IS the app identity — no separate app ID needed.
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
	 * App configuration fetched server-side via getAppConfig()
	 *
	 * **Required:** Use `getAppConfig()` from '@sylphx/sdk/server' in Server Components
	 * to fetch all config data and pass it here.
	 *
	 * @example
	 * ```tsx
	 * // layout.tsx (Server Component)
	 * import { getAppConfig } from '@sylphx/sdk/server'
	 *
	 * export default async function RootLayout({ children }) {
	 *   const config = await getAppConfig({
	 *     secretKey: process.env.SYLPHX_SECRET_KEY!,
	 *     publishableKey: process.env.NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY!,
	 *   })
	 *
	 *   return (
	 *     <SylphxProvider config={config} publishableKey={...}>
	 *       {children}
	 *     </SylphxProvider>
	 *   )
	 * }
	 * ```
	 */
	config: AppConfig
}

// ============================================
// Provider Component
// ============================================

/**
 * SylphxProvider
 *
 * Wrapper that sets up QueryClientProvider first, then renders the inner provider.
 * This is necessary because the inner provider uses useQuery hooks that require
 * QueryClientProvider context.
 */
export function SylphxProvider({
	children,
	publishableKey,
	platformUrl: providedPlatformUrl,
	afterSignOutUrl = '/',
	vapidPublicKey,
	autoTracking = true,
	config,
}: SylphxProviderProps) {
	// Create QueryClient at the outer level
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						// SDK default: 5 min stale time, no refetch on window focus
						staleTime: 5 * 60 * 1000,
						refetchOnWindowFocus: false,
						retry: 1,
					},
				},
			})
	)

	// Wrap with QueryClientProvider FIRST, then render inner provider
	// ConfigContext wraps everything to provide server-fetched config
	return (
		<ConfigContext.Provider value={config}>
			<QueryClientProvider client={queryClient}>
				<SylphxProviderInner
					publishableKey={publishableKey}
					platformUrl={providedPlatformUrl}
					afterSignOutUrl={afterSignOutUrl}
					vapidPublicKey={vapidPublicKey}
					autoTracking={autoTracking}
					queryClient={queryClient}
					config={config}
				>
					{children}
				</SylphxProviderInner>
			</QueryClientProvider>
		</ConfigContext.Provider>
	)
}

/**
 * SylphxProviderInner
 *
 * Inner provider that uses useQuery hooks. Must be rendered inside QueryClientProvider.
 */
function SylphxProviderInner({
	children,
	publishableKey,
	platformUrl: providedPlatformUrl,
	afterSignOutUrl = '/',
	vapidPublicKey,
	autoTracking = true,
	queryClient,
	config,
}: SylphxProviderProps & { queryClient: QueryClient }) {
	// Validate and sanitize publishable key at initialization
	// Following industry-standard "fail fast" pattern (Stripe, Clerk, Firebase)
	// - Validates key format against expected pattern
	// - Logs warning if key contains whitespace (common Vercel CLI bug)
	// - Throws error if key is completely invalid
	// biome-ignore lint/style/noParameterAssign: intentional validation at boundary
	publishableKey = validateAndSanitizePublishableKey(publishableKey)
	const platformUrl = providedPlatformUrl?.trim() || DEFAULT_PLATFORM_URL

	// Namespace identifier derived from publishable key
	// Used for storage namespacing, React Query keys, and context
	const appId = publishableKey

	// ============================================
	// Storage (namespaced by app identifier)
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
	// REST API Client
	// ============================================
	const api = useMemo(
		() =>
			createRestApi({
				publishableKey,
				platformUrl,
				getAccessToken: () => storage.get(STORAGE_KEYS.ACCESS_TOKEN) ?? undefined,
			}),
		[publishableKey, platformUrl, storage]
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
	// Platform State - React Query for server data
	// ============================================

	// Plans: Always from server-fetched config (no client-side fetching)
	const plans = config.plans
	const plansLoading = false
	const plansError: Error | null = null

	// Subscription - React Query (enabled when signed in)
	const subscriptionQuery = useQuery({
		queryKey: ['sylphx', appId, 'subscription', authState.user?.id],
		queryFn: () => api.get<Subscription | null>('/billing/subscription', { userId: authState.user!.id }),
		enabled: authState.isSignedIn && !!authState.user?.id,
		staleTime: 2 * 60 * 1000, // 2 min - subscription can change after payment
	})
	const subscription = subscriptionQuery.data ?? null
	const subscriptionLoading = subscriptionQuery.isLoading
	const subscriptionError = subscriptionQuery.error as Error | null

	// Referrals - React Query (enabled when signed in)
	const referralsQuery = useQuery({
		queryKey: ['sylphx', appId, 'referrals'],
		queryFn: async () => {
			const [stats, codeData] = await Promise.all([
				api.get<ReferralStats>('/referrals/stats'),
				api.get<{ code: string }>('/referrals/code'),
			])
			return { stats, code: codeData.code }
		},
		enabled: authState.isSignedIn,
		staleTime: 5 * 60 * 1000, // 5 min
	})
	const referralStats = referralsQuery.data?.stats ?? null
	const referralCode = referralsQuery.data?.code ?? null
	const referralLoading = referralsQuery.isLoading
	const referralError = referralsQuery.error as Error | null

	// Push Preferences - React Query (enabled when signed in)
	const pushPreferencesQuery = useQuery({
		queryKey: ['sylphx', appId, 'pushPreferences'],
		queryFn: () => api.get<PushPreferences>('/notifications/preferences'),
		enabled: authState.isSignedIn,
		staleTime: 5 * 60 * 1000, // 5 min
	})
	const pushPreferences = pushPreferencesQuery.data ?? null
	const pushError = pushPreferencesQuery.error as Error | null
	const [pushSubscribed, setPushSubscribed] = useState(false)
	const [analyticsError, setAnalyticsError] = useState<Error | null>(null)

	// Mobile Push Config/Preferences - React Query (enabled when signed in)
	const mobilePushQuery = useQuery({
		queryKey: ['sylphx', appId, 'mobilePush'],
		queryFn: async () => {
			const [config, preferences] = await Promise.all([
				api.get<MobilePushConfig>('/notifications/mobile/config'),
				api.get<MobilePushPreferences>('/notifications/mobile/preferences'),
			])
			return { config, preferences }
		},
		enabled: authState.isSignedIn,
		staleTime: 5 * 60 * 1000, // 5 min
	})
	const mobilePushConfig = mobilePushQuery.data?.config ?? null
	const mobilePushPreferences = mobilePushQuery.data?.preferences ?? null
	const mobilePushError = mobilePushQuery.error as Error | null

	// ============================================
	// In-App Messages (Inbox) - React Query (enabled when signed in)
	// ============================================
	const inboxQuery = useQuery({
		queryKey: ['sylphx', appId, 'inbox'],
		queryFn: async () => {
			const [messages, unreadCountResult, preferences] = await Promise.all([
				api.get<InAppMessageWithReadStatus[]>('/notifications/messages', { limit: '50' }),
				api.get<{ count: number }>('/notifications/messages/unread-count'),
				api.get<InboxPreferences>('/notifications/messages/preferences'),
			])
			return { messages, unreadCount: unreadCountResult.count, preferences }
		},
		enabled: authState.isSignedIn,
		staleTime: 1 * 60 * 1000, // 1 min - inbox changes frequently
	})
	const inboxMessages = inboxQuery.data?.messages ?? []
	const inboxUnreadCount = inboxQuery.data?.unreadCount ?? 0
	const inboxPreferences = inboxQuery.data?.preferences ?? null
	const inboxLoading = inboxQuery.isLoading
	const inboxError = inboxQuery.error as Error | null

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
							client_id: publishableKey || '',
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
		[publishableKey, platformUrl, saveTokens, clearTokens]
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
	// All server data is now handled by React Query:
	// - Plans (plansQuery)
	// - Subscription (subscriptionQuery)
	// - Referrals (referralsQuery)
	// - Push Preferences (pushPreferencesQuery)
	// - Mobile Push (mobilePushQuery)
	// - Inbox Messages (inboxQuery)
	// ============================================

	// ============================================
	// Auth Actions
	// ============================================

	/**
	 * Resolve a redirect URL to an absolute URL.
	 * Platform requires absolute URLs for redirect_uri validation.
	 */
	const resolveRedirectUrl = useCallback((url: string | undefined): string => {
		if (typeof window === 'undefined') return ''
		if (!url) return window.location.href

		// Relative URL starting with / - resolve against current origin
		if (url.startsWith('/') && !url.startsWith('//')) {
			return `${window.location.origin}${url}`
		}

		// Already absolute URL
		return url
	}, [])

	const signIn = useCallback(
		(options?: { redirectUrl?: string; providers?: string[] | null }) => {
			// Resolve and validate redirectUrl to prevent open redirect attacks
			const resolvedUrl = resolveRedirectUrl(options?.redirectUrl)
			const redirectUri = isValidRedirectUrl(resolvedUrl, { allowedOrigins: [platformUrl] })
				? resolvedUrl
				: (typeof window !== 'undefined' ? window.location.href : '')
			const params = new URLSearchParams({
				client_id: publishableKey || '',
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
		[publishableKey, platformUrl, resolveRedirectUrl]
	)

	const signUp = useCallback(
		(options?: { redirectUrl?: string; providers?: string[] | null }) => {
			// Resolve and validate redirectUrl to prevent open redirect attacks
			const resolvedUrl = resolveRedirectUrl(options?.redirectUrl)
			const redirectUri = isValidRedirectUrl(resolvedUrl, { allowedOrigins: [platformUrl] })
				? resolvedUrl
				: (typeof window !== 'undefined' ? window.location.href : '')
			const params = new URLSearchParams({
				client_id: publishableKey || '',
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
		[publishableKey, platformUrl, resolveRedirectUrl]
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
							client_id: publishableKey || '',
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
		[publishableKey, platformUrl, authState, clearTokens, afterSignOutUrl]
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
						client_id: publishableKey || '',
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
		[publishableKey, platformUrl, saveTokens]
	)

	const resetPassword = useCallback(
		async (options: { token: string; newPassword: string }) => {
			const response = await fetch(`${platformUrl}/api/auth/reset-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: options.token,
					new_password: options.newPassword,
					client_id: publishableKey || '',
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Password reset failed' }))
				throw new Error(error.message || 'Password reset failed')
			}
		},
		[publishableKey, platformUrl]
	)

	const verifyEmail = useCallback(
		async (options: { token: string }) => {
			const response = await fetch(`${platformUrl}/api/auth/verify-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: options.token,
					client_id: publishableKey || '',
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Email verification failed' }))
				throw new Error(error.message || 'Email verification failed')
			}
		},
		[publishableKey, platformUrl]
	)

	const resendVerificationEmail = useCallback(
		async (options: { email: string }) => {
			const response = await fetch(`${platformUrl}/api/auth/resend-verification`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: options.email,
					client_id: publishableKey || '',
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Failed to resend verification email' }))
				throw new Error(error.message || 'Failed to resend verification email')
			}
		},
		[publishableKey, platformUrl]
	)

	const forgotPassword = useCallback(
		async (options: { email: string }) => {
			const response = await fetch(`${platformUrl}/api/auth/forgot-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: options.email,
					client_id: publishableKey || '',
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Failed to send password reset email' }))
				throw new Error(error.message || 'Failed to send password reset email')
			}
		},
		[publishableKey, platformUrl]
	)

	// ============================================
	// Direct OAuth Methods (Firebase/Supabase pattern)
	// User goes directly to OAuth provider - no platform UI
	// ============================================

	/**
	 * Sign in with OAuth provider directly.
	 * Fetches authorization URL from platform, then redirects user to OAuth provider.
	 * No platform login UI is shown - user goes straight to Google/GitHub/etc.
	 */
	const signInWithOAuth = useCallback(
		async (options: { provider: string; redirectUrl?: string }) => {
			const { provider, redirectUrl } = options
			const resolvedRedirect = resolveRedirectUrl(redirectUrl)

			// Fetch OAuth authorization URL from platform
			const response = await fetch(`${platformUrl}/api/sdk/oauth/authorize`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-app-secret': publishableKey || '',
				},
				body: JSON.stringify({
					provider,
					redirect_uri: resolvedRedirect,
				}),
			})

			if (!response.ok) {
				const error = await response.json().catch(() => ({ message: 'Failed to initiate OAuth' }))
				throw new Error(error.message || `Failed to initiate ${provider} sign-in`)
			}

			const { authorization_url } = await response.json()

			// Redirect directly to OAuth provider (no platform UI)
			if (typeof window !== 'undefined') {
				window.location.href = authorization_url
			}
		},
		[platformUrl, publishableKey, resolveRedirectUrl]
	)

	// Convenience methods for common OAuth providers
	const signInWithGoogle = useCallback(
		(redirectUrl?: string) => signInWithOAuth({ provider: 'google', redirectUrl }),
		[signInWithOAuth]
	)

	const signInWithGithub = useCallback(
		(redirectUrl?: string) => signInWithOAuth({ provider: 'github', redirectUrl }),
		[signInWithOAuth]
	)

	const signInWithApple = useCallback(
		(redirectUrl?: string) => signInWithOAuth({ provider: 'apple', redirectUrl }),
		[signInWithOAuth]
	)

	const signInWithDiscord = useCallback(
		(redirectUrl?: string) => signInWithOAuth({ provider: 'discord', redirectUrl }),
		[signInWithOAuth]
	)

	const signInWithTwitter = useCallback(
		(redirectUrl?: string) => signInWithOAuth({ provider: 'twitter', redirectUrl }),
		[signInWithOAuth]
	)

	const signInWithMicrosoft = useCallback(
		(redirectUrl?: string) => signInWithOAuth({ provider: 'microsoft', redirectUrl }),
		[signInWithOAuth]
	)

	// ============================================
	// Billing Actions
	// ============================================
	const createCheckout = useCallback(
		async (planSlug: string, interval: 'monthly' | 'annual' | 'lifetime'): Promise<string> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to create checkout')
			}
			const data = await api.post<{ checkoutUrl?: string }>('/billing/checkout', {
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
		const data = await api.post<{ portalUrl: string }>('/billing/portal', { userId: authState.user.id, returnUrl: window.location.href })
		window.location.href = data.portalUrl
	}, [api, authState.user?.id])

	const refreshSubscription = useCallback(async (): Promise<void> => {
		// Use React Query invalidation to refetch subscription
		await queryClient.invalidateQueries({ queryKey: ['sylphx', appId, 'subscription'] })
	}, [queryClient, appId])

	// ============================================
	// Analytics Actions (with deduplication)
	// ============================================
	const ANALYTICS_QUEUE_LIMIT = 100

	const flushAnalytics = useCallback(async () => {
		if (analyticsQueue.current.length === 0) return

		const events = analyticsQueue.current
		analyticsQueue.current = []

		try {
			await api.post('/analytics/track', {
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
				const result = await api.post<import('./platform-context').AnalyticsQueryResult>('/analytics/query', analyticsQuery)
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

			await api.post('/notifications/register', {
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
				await api.post('/notifications/unregister', { endpoint: sub.endpoint })
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
			// Optimistic update for categories via React Query
			if (prefs.categories && pushPreferences) {
				queryClient.setQueryData<PushPreferences>(['sylphx', appId, 'pushPreferences'], (old) => {
					if (!old) return old
					return { ...old, categories: prefs.categories! }
				})
			}
		},
		[pushPreferences, unsubscribePush, queryClient, appId]
	)

	// ============================================
	// Mobile Push Notification Actions - React Query cache updates
	// ============================================
	const mobilePushQueryKey = ['sylphx', appId, 'mobilePush']

	const registerMobileDevice = useCallback(
		async (options: {
			platform: MobilePushPlatform
			token: string
			deviceId?: string
			deviceName?: string
			appVersion?: string
			osVersion?: string
		}): Promise<{ success: boolean; tokenId: string }> => {
			// Cast platform to the API expected type (web devices are read-only)
			const result = await api.post<{ success: boolean; tokenId: string }>('/notifications/mobile/register', {
				...options,
				platform: options.platform as 'ios' | 'android',
			})
			// Refresh mobile push data via React Query
			void queryClient.invalidateQueries({ queryKey: mobilePushQueryKey })
			return result
		},
		[api, queryClient, appId]
	)

	const unregisterMobileDevice = useCallback(
		async (token: string): Promise<void> => {
			await api.post('/notifications/mobile/unregister', { token })
			// Refresh mobile push data via React Query
			void queryClient.invalidateQueries({ queryKey: mobilePushQueryKey })
		},
		[api, queryClient, appId]
	)

	const getMobilePushPreferences = useCallback(async (): Promise<MobilePushPreferences> => {
		// Trigger refetch via React Query and wait for fresh data
		await queryClient.invalidateQueries({ queryKey: mobilePushQueryKey })
		const data = queryClient.getQueryData<{ config: MobilePushConfig; preferences: MobilePushPreferences }>(mobilePushQueryKey)
		if (!data?.preferences) {
			throw new Error('Failed to get mobile push preferences')
		}
		return data.preferences
	}, [queryClient, appId])

	// ============================================
	// Referral Actions
	// ============================================
	const copyReferralCode = useCallback(async (): Promise<void> => {
		if (referralCode) {
			await navigator.clipboard.writeText(referralCode)
		}
	}, [referralCode])

	const regenerateReferralCode = useCallback(async (): Promise<string> => {
		const data = await api.post<{ code: string }>('/referrals/code/regenerate')
		// Invalidate referrals query to refetch the new code
		void queryClient.invalidateQueries({ queryKey: ['sylphx', appId, 'referrals'] })
		return data.code
	}, [api, queryClient, appId])

	const redeemReferralCode = useCallback(
		async (code: string, _defaults?: import('../referrals').ReferralRewardDefaults): Promise<import('../referrals').RedeemResult> => {
			// Note: defaults parameter is for future use when server supports auto-discovery
			// Currently the server uses Console-configured rewards
			return api.post<import('../referrals').RedeemResult>('/referrals/redeem', { code })
		},
		[api]
	)

	const getReferralLeaderboard = useCallback(
		async (options?: { limit?: number; period?: 'all' | 'month' | 'week' }): Promise<{
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
		}> => {
			return api.get('/referrals/leaderboard', {
				limit: options?.limit?.toString(),
				period: options?.period,
			})
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
			return api.get<StreakState>(`/engagement/streaks/${streakId}`, { userId: authState.user.id })
		},
		[api, authState.user?.id]
	)

	const recordStreakActivity = useCallback(
		async (
			streakId: string,
			metadata?: Record<string, unknown>,
			defaults?: StreakDefaults
		): Promise<RecordActivityResult> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to record activity')
			}
			return api.post<RecordActivityResult>(`/engagement/streaks/${streakId}/activity`, { userId: authState.user.id, metadata, defaults })
		},
		[api, authState.user?.id]
	)

	const recoverStreak = useCallback(
		async (streakId: string): Promise<{ success: boolean; streak: StreakState }> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to recover streak')
			}
			return api.post<{ success: boolean; streak: StreakState }>(`/engagement/streaks/${streakId}/recover`, { userId: authState.user.id })
		},
		[api, authState.user?.id]
	)

	const getEngagementLeaderboard = useCallback(
		async (
			leaderboardId: string,
			options?: LeaderboardQueryOptions & { defaults?: LeaderboardDefaults; period?: string }
		): Promise<LeaderboardResult> => {
			return api.get<LeaderboardResult>(`/engagement/leaderboards/${leaderboardId}`, {
				userId: authState.user?.id ?? undefined,
				limit: options?.limit?.toString(),
				offset: options?.offset?.toString(),
				period: options?.period,
			})
		},
		[api, authState.user?.id]
	)

	const submitScore = useCallback(
		async (
			leaderboardId: string,
			value: number,
			metadata?: Record<string, unknown>,
			defaults?: LeaderboardDefaults
		): Promise<SubmitScoreResult> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to submit score')
			}
			return api.post<SubmitScoreResult>(`/engagement/leaderboards/${leaderboardId}/score`, { value, userId: authState.user.id, metadata, defaults })
		},
		[api, authState.user?.id]
	)

	const getAchievements = useCallback(async (): Promise<UserAchievement[]> => {
		if (!authState.user?.id) {
			throw new Error('User must be authenticated to get achievements')
		}
		return api.get<UserAchievement[]>('/engagement/achievements', { userId: authState.user.id })
	}, [api, authState.user?.id])

	const unlockAchievement = useCallback(
		async (achievementId: string, defaults?: AchievementDefaults): Promise<AchievementUnlockEvent> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to unlock achievement')
			}
			return api.post<AchievementUnlockEvent>(`/engagement/achievements/${achievementId}/unlock`, { userId: authState.user.id, defaults })
		},
		[api, authState.user?.id]
	)

	const incrementAchievementProgress = useCallback(
		async (achievementId: string, amount: number, defaults?: AchievementDefaults): Promise<UserAchievement> => {
			if (!authState.user?.id) {
				throw new Error('User must be authenticated to increment progress')
			}
			return api.post<UserAchievement>(`/engagement/achievements/${achievementId}/progress`, { amount, userId: authState.user.id, defaults })
		},
		[api, authState.user?.id]
	)


	// ============================================
	// In-App Messages (Inbox) Actions - React Query optimistic updates
	// ============================================
	type InboxQueryData = {
		messages: InAppMessageWithReadStatus[]
		unreadCount: number
		preferences: InboxPreferences | null
	}
	const inboxQueryKey = ['sylphx', appId, 'inbox']

	const refreshInbox = useCallback(async (): Promise<void> => {
		await queryClient.invalidateQueries({ queryKey: inboxQueryKey })
	}, [queryClient, appId])

	const markInboxMessageAsRead = useCallback(
		async (messageId: string): Promise<void> => {
			// Optimistic update via React Query
			const previousData = queryClient.getQueryData<InboxQueryData>(inboxQueryKey)
			queryClient.setQueryData<InboxQueryData>(inboxQueryKey, (old) => {
				if (!old) return old
				return {
					...old,
					messages: old.messages.map((m) =>
						m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
					),
					unreadCount: Math.max(0, old.unreadCount - 1),
				}
			})
			try {
				await api.post(`/notifications/messages/${messageId}/read`)
			} catch (err) {
				// Rollback on error
				if (previousData) queryClient.setQueryData(inboxQueryKey, previousData)
				throw err
			}
		},
		[api, queryClient, appId]
	)

	const markAllInboxMessagesAsRead = useCallback(async (): Promise<void> => {
		// Optimistic update via React Query
		const previousData = queryClient.getQueryData<InboxQueryData>(inboxQueryKey)
		queryClient.setQueryData<InboxQueryData>(inboxQueryKey, (old) => {
			if (!old) return old
			return {
				...old,
				messages: old.messages.map((m) => ({ ...m, isRead: true, readAt: new Date().toISOString() })),
				unreadCount: 0,
			}
		})
		try {
			await api.post('/notifications/messages/mark-all-read')
		} catch (err) {
			// Rollback on error
			if (previousData) queryClient.setQueryData(inboxQueryKey, previousData)
			throw err
		}
	}, [api, queryClient, appId])

	const dismissInboxMessage = useCallback(
		async (messageId: string): Promise<void> => {
			// Optimistic update via React Query - remove from list
			const previousData = queryClient.getQueryData<InboxQueryData>(inboxQueryKey)
			queryClient.setQueryData<InboxQueryData>(inboxQueryKey, (old) => {
				if (!old) return old
				return {
					...old,
					messages: old.messages.filter((m) => m.id !== messageId),
				}
			})
			try {
				await api.post(`/notifications/messages/${messageId}/dismiss`)
			} catch (err) {
				// Rollback on error
				if (previousData) queryClient.setQueryData(inboxQueryKey, previousData)
				throw err
			}
		},
		[api, queryClient, appId]
	)

	const recordInboxMessageClick = useCallback(
		async (messageId: string, action: 'primary' | 'secondary'): Promise<void> => {
			// Optimistic update via React Query - mark as read
			queryClient.setQueryData<InboxQueryData>(inboxQueryKey, (old) => {
				if (!old) return old
				return {
					...old,
					messages: old.messages.map((m) =>
						m.id === messageId ? { ...m, isRead: true, readAt: new Date().toISOString() } : m
					),
				}
			})
			try {
				await api.post(`/notifications/messages/${messageId}/click`, { action })
			} catch (err) {
				console.error('Failed to record message click:', err)
				// Don't throw - this is a non-critical action
			}
		},
		[api, queryClient, appId]
	)

	const updateInboxPreferences = useCallback(
		async (prefs: { enabled?: boolean; mutedTopics?: string[]; highPriorityOnly?: boolean }): Promise<void> => {
			// Optimistic update via React Query
			const previousData = queryClient.getQueryData<InboxQueryData>(inboxQueryKey)
			queryClient.setQueryData<InboxQueryData>(inboxQueryKey, (old) => {
				if (!old) return old
				return {
					...old,
					preferences: old.preferences ? { ...old.preferences, ...prefs } : null,
				}
			})
			try {
				await api.put('/notifications/messages/preferences', prefs)
			} catch (err) {
				// Rollback on error
				if (previousData) queryClient.setQueryData(inboxQueryKey, previousData)
				throw err
			}
		},
		[api, queryClient, appId]
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
					embeddings: response.data.map(d => d.embedding),
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
				return await api.get('/ai/usage', { period })
			},
			getRateLimitStatus: async () => {
				return await api.get('/ai/rate-limit')
			},
			listModels: async (options) => {
				const response = await api.get<{
					models: Array<{
						id: string
						name?: string
						contextWindow?: number
						capabilities?: string[]
						inputCostPer1M?: number
						outputCostPer1M?: number
						description?: string
					}>
					total: number
					hasMore: boolean
				}>('/ai/models', {
					capability: options?.capability,
					search: options?.search,
					limit: options?.limit?.toString(),
					offset: options?.offset?.toString(),
				})
				return {
					models: response.models.map((m) => ({
						id: m.id,
						name: m.name || m.id,
						provider: inferProviderFromModelId(m.id),
						contextWindow: m.contextWindow || 0,
						maxOutputTokens: Math.floor((m.contextWindow || 4096) / 4),
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
		[aiApiCall, api, platformUrl, publishableKey]
	)

	// ============================================
	// Jobs Context Value
	// ============================================
	const jobsValue: JobsContextValue = useMemo(
		() => ({
			checkStatus: async () => {
				return await api.get('/jobs/status')
			},
			schedule: async (options) => {
				return await api.post('/jobs/schedule', options)
			},
			createCron: async (options) => {
				return await api.post('/jobs/cron', options)
			},
			pauseCron: async (scheduleId) => {
				const result = await api.post<{ success: boolean }>(`/jobs/cron/${scheduleId}/pause`)
				return result.success
			},
			resumeCron: async (scheduleId) => {
				const result = await api.post<{ success: boolean }>(`/jobs/cron/${scheduleId}/resume`)
				return result.success
			},
			deleteCron: async (scheduleId) => {
				const result = await api.del<{ success: boolean }>(`/jobs/cron/${scheduleId}`)
				return result.success
			},
			getJob: async (jobId) => {
				return await api.get(`/jobs/${jobId}`)
			},
			listJobs: async (options = {}) => {
				// Cast status to exclude 'cancelled' which isn't in API enum
				const status = options.status === 'cancelled' ? undefined : options.status
				return await api.get('/jobs', {
					status,
					limit: options.limit?.toString(),
					offset: options.offset?.toString(),
				})
			},
			cancelJob: async (jobId) => {
				const result = await api.post<{ success: boolean }>(`/jobs/${jobId}/cancel`)
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
				return await api.post('/monitoring/exception', {
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
				return await api.post('/monitoring/message', {
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
			// Consent types from server-fetched config
			initialConsentTypes: config.consentTypes,
			getConsentTypes: async () => {
				// Return types from server-fetched config (no client fetch needed)
				return config.consentTypes
			},
			getUserConsents: async () => {
				const consents = await api.get<Array<{ slug: string; enabled: boolean; consentTypeId?: string; updatedAt?: string }>>('/consent', {
					userId: authState.user?.id,
					anonymousId,
				})
				// Map API response to UserConsent shape
				return consents.map((c) => ({
					consentTypeId: c.consentTypeId ?? '',
					slug: c.slug,
					enabled: c.enabled,
					granted: c.enabled, // Alias
					updatedAt: c.updatedAt ?? new Date().toISOString(),
				}))
			},
			setConsents: async (consents) => {
				return await api.post('/consent', {
					userId: authState.user?.id,
					anonymousId,
					consents,
				})
			},
			acceptAll: async () => {
				return await api.post('/consent/accept-all', {
					userId: authState.user?.id,
					anonymousId,
				})
			},
			declineOptional: async () => {
				return await api.post('/consent/decline-optional', {
					userId: authState.user?.id,
					anonymousId,
				})
			},
			checkConsent: async (purposeSlug, defaults) => {
				// Get user's current consents
				try {
					const consents = await api.get<Array<{ slug: string; granted: boolean }>>('/consent', {
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
		[api, anonymousId, authState.user?.id, config]
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
	// Multipart threshold: files > 5MB should use multipart upload
	const MULTIPART_THRESHOLD = 5 * 1024 * 1024

	const storageValue: StorageContextValue = useMemo(
		() => ({
			upload: async (file: File, options?: UploadOptions) => {
				const blobUpload = await getBlobUpload()

				// Determine if multipart should be used
				// Default is 'auto' which enables multipart for files > 5MB
				const shouldUseMultipart =
					options?.multipart === true ||
					(options?.multipart !== false && file.size > MULTIPART_THRESHOLD)

				const blob = await blobUpload(file.name, file, {
					access: 'public',
					handleUploadUrl: `${platformUrl}/api/storage/upload`,
					multipart: shouldUseMultipart,
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
				await api.del(`/storage/files/${fileId}`)
			},
			getUrl: async (fileId: string) => {
				const data = await api.get<{ url: string }>(`/storage/files/${fileId}`)
				return data.url
			},
		}),
		[api, platformUrl, publishableKey, authState.user?.id]
	)

	// ============================================
	// Newsletter Context Value
	// ============================================
	const newsletterValue: NewsletterContextValue = useMemo(
		() => ({
			subscribe: async (options) => {
				return await api.post('/newsletter/subscribe', options)
			},
			verify: async (token) => {
				return await api.post('/newsletter/verify', { token })
			},
			unsubscribe: async (email, token) => {
				return await api.post('/newsletter/unsubscribe', { email, token })
			},
			resendVerification: async (email) => {
				return await api.post('/newsletter/resend-verification', { email })
			},
			getUnsubscribeInfo: async (token) => {
				return await api.get('/newsletter/unsubscribe-info', { token })
			},
			updatePreferences: async (email, preferences) => {
				return await api.put('/newsletter/preferences', { email, preferences })
			},
			getPreferences: async (email) => {
				return await api.get('/newsletter/preferences', { email })
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
				return await api.post('/email/send', options)
			},
			sendTemplated: async (options) => {
				// Cast template to expected type - SDK accepts any string, API has fixed set
				const result = await api.post<{ success: boolean }>('/email/send-templated', {
					...options,
					template: options.template as 'welcome' | 'verification' | 'password_reset' | 'security_alert',
				})
				return { success: result.success, template: options.template }
			},
			sendToUser: async (options) => {
				return await api.post('/email/send-to-user', options)
			},
			// Marketing Email (Newsletter)
			newsletter: {
				subscribe: async (options) => {
					return await api.post('/newsletter/subscribe', options)
				},
				verify: async (token) => {
					return await api.post('/newsletter/verify', { token })
				},
				unsubscribe: async (email, token) => {
					return await api.post('/newsletter/unsubscribe', { email, token })
				},
				resendVerification: async (email) => {
					return await api.post('/newsletter/resend-verification', { email })
				},
				getUnsubscribeInfo: async (token) => {
					return await api.get('/newsletter/unsubscribe-info', { token })
				},
				updatePreferences: async (email, preferences) => {
					return await api.put('/newsletter/preferences', { email, preferences })
				},
				getPreferences: async (email) => {
					return await api.get('/newsletter/preferences', { email })
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
				return await api.get('/webhooks/config')
			},
			updateConfig: async (options) => {
				return await api.put('/webhooks/config', options)
			},
			getDeliveries: async (options = {}) => {
				return await api.get('/webhooks/deliveries', {
					limit: options.limit?.toString(),
					offset: options.offset?.toString(),
					status: options.status,
				})
			},
			replayDelivery: async (deliveryId) => {
				return await api.post(`/webhooks/deliveries/${deliveryId}/replay`)
			},
			getStats: async (period) => {
				return await api.get('/webhooks/stats', { period })
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
				const result = await api.post<{
					requiresTwoFactor?: boolean
					userId?: string
					user?: { id: string; email: string; name?: string | null; image?: string | null; emailVerified?: boolean }
				}>('/auth/login', { email, password })
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
				const result = await api.post<{
					accessToken: string
					refreshToken: string
					expiresIn: number
					user: { id: string; email: string; name?: string | null; image?: string | null; emailVerified?: boolean }
				}>('/auth/verify-2fa', { userId, code })
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
				const result = await api.post<{
					user: { id: string; email: string; name?: string | null }
				}>('/auth/register', { email, password, name })
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
				const result = await api.post<{ success: boolean }>('/auth/forgot-password', { email })
				return { success: result.success, message: 'Password reset email sent' }
			},
			resetPassword: async (token, password) => {
				return await api.post('/auth/reset-password', { token, newPassword: password })
			},
			verifyEmail: async (token) => {
				// Call platform verify email endpoint
				const response = await fetch(`${platformUrl}/api/auth/verify-email`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ token, client_id: publishableKey || '' }),
				})
				if (!response.ok) {
					const error = await response.json().catch(() => ({ message: 'Email verification failed' }))
					throw new Error(error.message || 'Email verification failed')
				}
				return { success: true }
			},
			logout: async (_refreshToken) => {
				await api.post('/auth/logout')
				clearTokens()
				return { success: true }
			},
			me: async () => {
				const profile = await api.get<{
					id: string
					email: string
					name?: string | null
					image?: string | null
					emailVerified?: boolean
					createdAt?: string
				}>('/user/profile')
				// Get 2FA status from security settings
				const security = await api.get<{ twoFactorEnabled?: boolean }>('/user/security')
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
				if (!publishableKey) return { providers: [] }
				const response = await fetch(`${platformUrl}/api/auth/providers`, {
					headers: { 'X-Publishable-Key': publishableKey },
				})
				if (!response.ok) {
					return { providers: [] }
				}
				const data = await response.json()
				return { providers: data.providers || [] }
			},
		}),
		[api, platformUrl, publishableKey, saveTokens, clearTokens]
	)

	// ============================================
	// User Context Value (for profile/session management)
	// ============================================
	// Type definitions for user API responses
	type ProfileResponse = {
		id: string
		email: string
		name?: string | null
		image?: string | null
		emailVerified?: boolean
		createdAt?: string
	}
	type SecuritySettingsResponse = { twoFactorEnabled?: boolean; hasPassword?: boolean }
	type SessionResponse = {
		id: string
		isCurrent: boolean
		deviceName?: string
		browser?: string
		os?: string
		deviceType?: string
		ipAddress?: string
		country?: string
		city?: string
		lastActiveAt?: string
		createdAt?: string
	}
	type LoginHistoryEntry = {
		id?: string
		ipAddress?: string
		userAgent?: string
		city?: string
		country?: string
		device?: string
		createdAt?: string
		success?: boolean
	}
	type ConnectedAccountResponse = { provider: string; connectedAt?: string }

	const userValue: UserContextValue = useMemo(
		() => ({
			getProfile: async () => {
				const profile = await api.get<ProfileResponse>('/user/profile')
				const security = await api.get<SecuritySettingsResponse>('/user/security')
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
				const profile = await api.put<ProfileResponse>('/user/profile', data)
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
				const fullProfile = await api.get<ProfileResponse>('/user/profile')
				const security = await api.get<SecuritySettingsResponse>('/user/security')
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
				await api.post('/challenge/verify', { method: 'password', value: currentPassword })
				// Then change password
				return await api.post('/user/profile', { password: newPassword })
			},
			getLoginHistory: async (options) => {
				const history = await api.get<LoginHistoryEntry[]>('/user/sessions')
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
				const response = await api.get<SessionResponse[]>('/user/sessions')
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
				return await api.del(`/user/sessions/${sessionId}`)
			},
			revokeAllSessions: async () => {
				return await api.post('/user/sessions/revoke-all')
			},
			getConnectedAccounts: async () => {
				// Connected accounts are part of security settings
				const security = await api.get<{ connectedAccounts?: ConnectedAccountResponse[] }>('/user/security')
				const accounts = security.connectedAccounts ?? []
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
					await api.post('/challenge/verify', { method: 'password', value: password })
				}
				return await api.del('/user/account')
			},
			exportData: async () => {
				const response = await api.get<{ downloadUrl: string; expiresAt: string }>('/user/export')
				return {
					downloadUrl: response.downloadUrl,
					expiresAt: new Date(response.expiresAt),
				}
			},
		}),
		[api, authState, setAuthState]
	)

	// ============================================
	// Security Context Value (for 2FA, passkeys, etc.)
	// ============================================
	// Type definitions for security API responses
	type PasskeyResponse = {
		id: string
		deviceName?: string | null
		createdAt: string
		lastUsedAt?: string | null
	}

	const securityValue: SecurityContextValue = useMemo(
		() => ({
			getTwoFactorStatus: async () => {
				const settings = await api.get<SecuritySettingsResponse>('/user/security')
				// Backup codes count is retrieved separately if needed
				return {
					enabled: settings.twoFactorEnabled ?? false,
					backupCodesRemaining: 0, // Would need separate endpoint to get this
				}
			},
			twoFactorSetup: async () => {
				return await api.post('/security/2fa/setup')
			},
			twoFactorVerify: async (code) => {
				return await api.post('/security/2fa/verify', { code })
			},
			twoFactorDisable: async (_code) => {
				// Note: Code verification is handled by challenge middleware, not the method itself
				return await api.post('/security/2fa/disable')
			},
			backupCodesView: async (_code) => {
				// Note: Code verification is handled by challenge middleware, not the method itself
				return await api.get('/security/backup-codes')
			},
			backupCodesRegenerate: async (_code) => {
				// Note: Code verification is handled by challenge middleware, not the method itself
				return await api.post('/security/backup-codes/regenerate')
			},
			getPasswordStatus: async () => {
				const settings = await api.get<SecuritySettingsResponse>('/user/security')
				return { hasPassword: settings.hasPassword ?? true }
			},
			passwordSet: async (password) => {
				return await api.post('/security/password/set', { password })
			},
			emailChangeRequest: async (newEmail) => {
				return await api.post('/security/email/change', { newEmail })
			},
			emailChangeConfirm: async (token) => {
				return await api.post('/security/email/confirm', { token })
			},
			passkeyList: async () => {
				const response = await api.get<PasskeyResponse[]>('/security/passkeys')
				return response.map((p) => ({
					id: p.id,
					name: p.deviceName ?? undefined, // API returns deviceName (null -> undefined)
					deviceType: undefined, // Not returned by API
					createdAt: new Date(p.createdAt),
					lastUsedAt: p.lastUsedAt ? new Date(p.lastUsedAt) : null,
				}))
			},
			passkeyRegisterStart: async () => {
				return await api.post('/security/passkeys/register/start')
			},
			passkeyRegisterVerify: async (credential, name) => {
				return await api.post('/security/passkeys/register/verify', { credential, deviceName: name ?? 'Passkey' })
			},
			passkeyRename: async (passkeyId: string, name: string) => {
				return await api.put(`/security/passkeys/${passkeyId}`, { name })
			},
			passkeyDelete: async (passkeyId: string) => {
				return await api.del(`/security/passkeys/${passkeyId}`)
			},
			oauthConnect: async (provider) => {
				const redirectUri = window.location.href
				return {
					redirectUrl: `${platformUrl}/auth/connect/${provider}?client_id=${publishableKey || ''}&redirect_uri=${encodeURIComponent(redirectUri)}`,
				}
			},
			oauthDisconnect: async (provider) => {
				return await api.post('/security/oauth/disconnect', { provider })
			},
			getSecurityScore: async () => {
				return await api.get('/security/score')
			},
		}),
		[api, platformUrl, publishableKey]
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
			// Direct OAuth methods (Firebase/Supabase pattern)
			signInWithOAuth,
			signInWithGoogle,
			signInWithGithub,
			signInWithApple,
			signInWithDiscord,
			signInWithTwitter,
			signInWithMicrosoft,
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
			signInWithOAuth,
			signInWithGoogle,
			signInWithGithub,
			signInWithApple,
			signInWithDiscord,
			signInWithTwitter,
			signInWithMicrosoft,
		]
	)

	const platformValue = useMemo(
		() => ({
			appId,
			publishableKey,
			platformUrl,
			anonymousId,
			queryClient,
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
			redeemReferralCode,
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
				return await api.get<{
					balance: { current: number; currentFormatted: string }
					status: { level: string; isHealthy: boolean; isLow: boolean; alertThreshold: number }
					billingType: string
					trustLevel: string
					spendingCap: number | null
					currentMonthSpend: number
					spendingCapPercent: number | null
					gracePeriodEndsAt: string | null
					isAdminOrg: boolean
				}>('/billing/balance')
			},
			getBillingUsage: async (options?: { month?: string }) => {
				return await api.get<{
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
				}>('/billing/usage', { month: options?.month })
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
			queryClient,
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
			redeemReferralCode,
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

	// QueryClientProvider is now provided by the outer SylphxProvider wrapper
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
														{/* Newsletter: Marketing/bulk email subscriptions */}
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
