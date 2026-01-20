'use client'

/**
 * Platform Mode Provider
 *
 * Specialized provider for Platform dogfooding.
 * Uses BetterAuth and database directly instead of HTTP calls.
 *
 * This provides the same context shape as SylphxProvider but with direct implementations,
 * allowing Platform to use SDK components without HTTP overhead.
 *
 * Usage in Platform:
 * ```tsx
 * // app/layout.tsx
 * import { PlatformModeProvider } from '@sylphx/platform-sdk/react'
 * import { authClient } from '@/features/auth/lib/auth-client'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <PlatformModeProvider authClient={authClient}>
 *       {children}
 *     </PlatformModeProvider>
 *   )
 * }
 * ```
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
	type AnalyticsQuery,
	type AnalyticsQueryResult,
	type ClickIds,
	type InAppMessageWithReadStatus,
	type InboxPreferences,
	type MobilePushConfig,
	type MobilePushPreferences,
	type MobilePushPlatform,
} from './platform-context'
import {
	AIContext,
	JobsContext,
	MonitoringContext,
	ConsentContext,
	StorageContext,
	type AIContextValue,
	type JobsContextValue,
	type MonitoringContextValue,
	type ConsentContextValue,
	type StorageContextValue,
	type UploadOptions,
	type UploadProgressEvent,
} from './services-context'
import type { User } from '../types'

// Dynamic import for @vercel/blob/client to avoid SSR issues with undici
let blobUploadCache: typeof import('@vercel/blob/client').upload | null = null
async function getBlobUpload() {
	if (!blobUploadCache) {
		const { upload } = await import('@vercel/blob/client')
		blobUploadCache = upload
	}
	return blobUploadCache
}
import { safeRedirect } from './security-utils'

// ============================================
// Types
// ============================================

/**
 * BetterAuth User type - slightly different from SDK User type
 * BetterAuth uses `image?: string | null | undefined` (optional with possible undefined)
 * SDK User uses `image: string | null` (required, but nullable)
 */
interface BetterAuthUser {
	id: string
	email: string
	name: string
	image?: string | null
	emailVerified: boolean
	role?: string
	twoFactorEnabled?: boolean | null
	createdAt?: Date
	updatedAt?: Date
}

/**
 * BetterAuth Client Interface
 *
 * This is a loose interface that matches better-auth's createAuthClient return type.
 * We only strictly type the methods we actually use (useSession, signOut).
 * Other methods are typed loosely since PlatformModeProvider just redirects for auth.
 */
export interface BetterAuthClient {
	/** Get current session - the primary method we use */
	useSession: () => {
		data: { user: BetterAuthUser; session: { token: string; expiresAt: Date } } | null
		isPending: boolean
		error: Error | null
	}
	/** Sign out the current user */
	signOut: () => Promise<unknown>
	/** Sign in methods (loosely typed - not directly called by SDK) */
	signIn: {
		// biome-ignore lint/suspicious/noExplicitAny: BetterAuth types are complex, SDK just redirects
		email: (params: { email: string; password: string; rememberMe?: boolean }) => Promise<any>
		// biome-ignore lint/suspicious/noExplicitAny: Optional magic link method
		magicLink?: (...args: unknown[]) => Promise<any>
		// biome-ignore lint/suspicious/noExplicitAny: Optional social method
		social?: (...args: unknown[]) => Promise<any>
	}
	/** Sign up methods (loosely typed - not directly called by SDK) */
	signUp: {
		// biome-ignore lint/suspicious/noExplicitAny: BetterAuth types are complex
		email: (params: { email: string; password: string; name?: string }) => Promise<any>
	}
	/** Optional forgot password */
	forgetPassword?: (params: { email: string; redirectTo?: string }) => Promise<{ error?: { message: string } }>
	/** Optional reset password */
	resetPassword?: (params: { newPassword: string; token?: string }) => Promise<{ error?: { message: string } }>
	/** Optional email OTP plugin */
	emailOtp?: {
		// biome-ignore lint/suspicious/noExplicitAny: Plugin method
		sendVerificationOtp: (params: { email: string }) => Promise<any>
		// biome-ignore lint/suspicious/noExplicitAny: Plugin method
		verifyEmail: (params: { email: string; code: string }) => Promise<any>
	}
	/** Optional magic link plugin */
	magicLink?: {
		// biome-ignore lint/suspicious/noExplicitAny: Plugin method
		verify: (token: string) => Promise<any>
	}
}

export interface PlatformModeProviderProps {
	children: React.ReactNode
	/** BetterAuth client instance from Platform */
	authClient: BetterAuthClient
	/** Optional: fetch billing data function */
	getBillingData?: () => Promise<{
		subscription: Subscription | null
		plans: Plan[]
	}>
	/** Optional: fetch referral data function */
	getReferralData?: () => Promise<ReferralStats | null>
	/** After sign out, redirect to this URL */
	afterSignOutUrl?: string
}

// ============================================
// Provider Component
// ============================================

export function PlatformModeProvider({
	children,
	authClient,
	getBillingData,
	getReferralData,
	afterSignOutUrl = '/',
}: PlatformModeProviderProps) {
	// ============================================
	// Auth State from BetterAuth
	// ============================================
	const session = authClient.useSession()

	// Convert BetterAuthUser to SDK User (handle image: undefined → null)
	const user: User | null = session.data?.user
		? {
				id: session.data.user.id,
				email: session.data.user.email,
				name: session.data.user.name,
				image: session.data.user.image ?? null, // undefined → null
				emailVerified: session.data.user.emailVerified,
				role: session.data.user.role,
				createdAt: session.data.user.createdAt?.toISOString(),
			}
		: null

	const authState: AuthState = useMemo(
		() => ({
			isLoaded: !session.isPending,
			isSignedIn: !!session.data?.user,
			user,
			accessToken: session.data?.session.token ?? null,
			refreshToken: null, // BetterAuth uses cookies
			error: session.error,
		}),
		[session, user]
	)

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
	const [analyticsError] = useState<Error | null>(null)

	// Push not typically used in Platform mode
	const pushSupported = false
	const [pushSubscribed] = useState(false)
	const [pushPreferences] = useState<PushPreferences | null>(null)
	const [pushError] = useState<Error | null>(null)

	// Mobile Push not typically used in Platform mode
	const [mobilePushConfig] = useState<MobilePushConfig | null>(null)
	const [mobilePushPreferences] = useState<MobilePushPreferences | null>(null)
	const [mobilePushError] = useState<Error | null>(null)

	// In-App Messages not typically used in Platform mode
	const [inboxMessages] = useState<InAppMessageWithReadStatus[]>([])
	const [inboxUnreadCount] = useState(0)
	const [inboxLoading] = useState(false)
	const [inboxError] = useState<Error | null>(null)
	const [inboxPreferences] = useState<InboxPreferences | null>(null)

	// Anonymous ID for Platform (static)
	const anonymousId = useMemo(
		() => (typeof window !== 'undefined' ? `platform_${crypto.randomUUID()}` : 'platform_server'),
		[]
	)

	// Click IDs for conversion tracking (Platform doesn't need this but required for interface)
	const clickIds: ClickIds = useMemo(() => ({}), [])

	// ============================================
	// Load Billing Data when signed in
	// ============================================
	useEffect(() => {
		if (!authState.isSignedIn || !getBillingData) {
			setSubscription(null)
			return
		}

		const loadBilling = async () => {
			setSubscriptionLoading(true)
			setPlansLoading(true)
			try {
				const data = await getBillingData()
				setSubscription(data.subscription)
				setPlans(data.plans)
			} catch (error) {
				const err = error instanceof Error ? error : new Error('Failed to load billing')
				setSubscriptionError(err)
				setPlansError(err)
			} finally {
				setSubscriptionLoading(false)
				setPlansLoading(false)
			}
		}

		loadBilling()
	}, [authState.isSignedIn, getBillingData])

	// Load referral data
	useEffect(() => {
		if (!authState.isSignedIn || !getReferralData) {
			setReferralStats(null)
			return
		}

		const loadReferrals = async () => {
			setReferralLoading(true)
			try {
				const data = await getReferralData()
				setReferralStats(data)
			} catch (error) {
				setReferralError(error instanceof Error ? error : new Error('Failed to load referrals'))
			} finally {
				setReferralLoading(false)
			}
		}

		loadReferrals()
	}, [authState.isSignedIn, getReferralData])

	// ============================================
	// Auth Actions
	// ============================================
	const signIn = useCallback(
		(_options?: { redirectUrl?: string }) => {
			// In Platform mode, redirect to login page
			window.location.href = '/login'
		},
		[]
	)

	const signUp = useCallback(
		(_options?: { redirectUrl?: string }) => {
			window.location.href = '/signup'
		},
		[]
	)

	const signOut = useCallback(
		async (options?: { redirectUrl?: string }) => {
			await authClient.signOut()
			// Use safeRedirect to prevent XSS via malicious redirectUrl
			safeRedirect(options?.redirectUrl || afterSignOutUrl, { fallback: '/' })
		},
		[authClient, afterSignOutUrl]
	)

	const getToken = useCallback(async (): Promise<string | null> => {
		return session.data?.session.token ?? null
	}, [session.data])

	const handleCallback = useCallback(async (_code: string, _state?: string): Promise<void> => {
		// OAuth callback is handled by BetterAuth automatically
	}, [])

	const resetPassword = useCallback(
		async (options: { token: string; newPassword: string }) => {
			if (!authClient.resetPassword) {
				throw new Error('Reset password not configured')
			}
			const result = await authClient.resetPassword({
				token: options.token,
				newPassword: options.newPassword,
			})
			if (result.error) {
				throw new Error(result.error.message)
			}
		},
		[authClient]
	)

	const verifyEmail = useCallback(async (_options: { token: string }) => {
		// BetterAuth handles email verification via callback
	}, [])

	const resendVerificationEmail = useCallback(async (_options: { email: string }) => {
		// Would need additional BetterAuth configuration
	}, [])

	const forgotPassword = useCallback(
		async (options: { email: string }) => {
			if (!authClient.forgetPassword) {
				throw new Error('Forgot password not configured')
			}
			const result = await authClient.forgetPassword({
				email: options.email,
				redirectTo: '/reset-password',
			})
			if (result.error) {
				throw new Error(result.error.message)
			}
		},
		[authClient]
	)

	// ============================================
	// Billing Actions (Platform-specific)
	// ============================================
	const createCheckout = useCallback(
		async (_planSlug: string, _interval: 'monthly' | 'annual' | 'lifetime'): Promise<string> => {
			// Platform users typically use console for billing
			return '/console/billing'
		},
		[]
	)

	const openPortal = useCallback(async (): Promise<void> => {
		window.location.href = '/console/billing'
	}, [])

	const refreshSubscription = useCallback(async (): Promise<void> => {
		if (!getBillingData) return
		setSubscriptionLoading(true)
		try {
			const data = await getBillingData()
			setSubscription(data.subscription)
		} finally {
			setSubscriptionLoading(false)
		}
	}, [getBillingData])

	// ============================================
	// Analytics (no-op in Platform mode, uses separate analytics)
	// ============================================
	const track = useCallback(async (_event: string, _properties?: Record<string, unknown>) => {
		// Platform has its own analytics
	}, [])

	const page = useCallback(async (_name: string, _properties?: Record<string, unknown>) => {
		// Platform has its own analytics
	}, [])

	const identify = useCallback(async (_traits?: Record<string, unknown>) => {
		// Platform has its own analytics
	}, [])

	const queryAnalytics = useCallback(async (_query: AnalyticsQuery): Promise<AnalyticsQueryResult> => {
		throw new Error('Analytics query not available in platform mode')
	}, [])

	// ============================================
	// Push (not used in Platform mode)
	// ============================================
	const subscribePush = useCallback(async (): Promise<boolean> => false, [])
	const unsubscribePush = useCallback(async (): Promise<void> => {}, [])
	const updatePushPreferences = useCallback(async (_prefs: Partial<PushPreferences>): Promise<void> => {}, [])

	// ============================================
	// Referrals (minimal in Platform mode)
	// ============================================
	const copyReferralCode = useCallback(async (): Promise<void> => {
		if (referralCode) {
			await navigator.clipboard.writeText(referralCode)
		}
	}, [referralCode])

	const regenerateReferralCode = useCallback(async (): Promise<string> => {
		throw new Error('Referral code regeneration not available in platform mode')
	}, [])

	const getLeaderboard = useCallback(async () => {
		throw new Error('Leaderboard not available in platform mode')
	}, [])

	// ============================================
	// Service Contexts (minimal/disabled in Platform mode)
	// Platform uses its own implementations directly
	// ============================================
	const aiValue: AIContextValue = useMemo(
		() => ({
			chat: async () => {
				throw new Error('AI not available in platform mode - use Platform AI directly')
			},
			chatStream: () => ({
				[Symbol.asyncIterator]: async function* () {
					throw new Error('AI not available in platform mode')
				},
			}),
			complete: async () => {
				throw new Error('AI not available in platform mode')
			},
			embed: async () => {
				throw new Error('AI not available in platform mode')
			},
			vision: async () => {
				throw new Error('AI not available in platform mode')
			},
			getUsage: async () => {
				throw new Error('AI not available in platform mode')
			},
			getRateLimitStatus: async () => {
				throw new Error('AI not available in platform mode')
			},
			listModels: async () => {
				throw new Error('AI not available in platform mode')
			},
		}),
		[]
	)

	const jobsValue: JobsContextValue = useMemo(
		() => ({
			checkStatus: async () => {
				throw new Error('Jobs not available in platform mode')
			},
			schedule: async () => {
				throw new Error('Jobs not available in platform mode')
			},
			createCron: async () => {
				throw new Error('Jobs not available in platform mode')
			},
			pauseCron: async () => {
				throw new Error('Jobs not available in platform mode')
			},
			resumeCron: async () => {
				throw new Error('Jobs not available in platform mode')
			},
			deleteCron: async () => {
				throw new Error('Jobs not available in platform mode')
			},
			getJob: async () => {
				throw new Error('Jobs not available in platform mode')
			},
			listJobs: async () => {
				throw new Error('Jobs not available in platform mode')
			},
			cancelJob: async () => {
				throw new Error('Jobs not available in platform mode')
			},
		}),
		[]
	)

	const monitoringValue: MonitoringContextValue = useMemo(
		() => ({
			captureException: async () => ({ eventId: '', isNewError: false }),
			captureMessage: async () => ({ eventId: '', isNewError: false }),
		}),
		[]
	)

	const consentValue: ConsentContextValue = useMemo(
		() => ({
			anonymousId,
			userId: authState.user?.id ?? null,
			getConsentTypes: async () => [],
			getUserConsents: async () => [],
			setConsents: async () => ({ consents: [] }),
			acceptAll: async () => ({ consents: [] }),
			declineOptional: async () => ({ consents: [] }),
		}),
		[anonymousId, authState.user?.id]
	)

	// ============================================
	// Storage Context Value
	// ============================================

	/**
	 * Modern client upload using Vercel Blob for Platform dogfooding.
	 *
	 * Architecture (same as SylphxProvider):
	 * 1. Client calls our /api/storage/upload to get a client token
	 * 2. @vercel/blob/client uploads directly to Vercel Blob (zero server bandwidth)
	 * 3. Vercel calls our onUploadCompleted callback
	 * 4. Platform records file in DB
	 *
	 * Benefits:
	 * - Zero server bandwidth (direct to storage)
	 * - Up to 5TB file size (vs 4.5MB server limit)
	 * - Real progress tracking
	 * - Dogfooding: Platform uses same upload pattern as SDK users
	 */
	const platformUrl = typeof window !== 'undefined' ? window.location.origin : ''

	const storageValue: StorageContextValue = useMemo(
		() => ({
			upload: async (file: File, options?: UploadOptions) => {
				const blobUpload = await getBlobUpload()
				const blob = await blobUpload(file.name, file, {
					access: 'public',
					handleUploadUrl: `${platformUrl}/api/storage/upload`,
					clientPayload: JSON.stringify({
						appId: 'sylphx-console',
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
						appId: 'sylphx-console',
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
			deleteFile: async (_fileId: string) => {
				// Platform file deletion via tRPC (not directly available in this provider)
				throw new Error('File deletion requires server action - use tRPC storage.deleteFile')
			},
			getUrl: async (_fileId: string) => {
				// Platform file URL lookup via tRPC (not directly available in this provider)
				throw new Error('File URL lookup requires server action - use tRPC storage.getFile')
			},
		}),
		[platformUrl, authState.user?.id]
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
			appId: 'sylphx-console',
			publishableKey: '',
			platformUrl: typeof window !== 'undefined' ? window.location.origin : '',
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
			// Mobile Push (not used in platform mode)
			mobilePushConfig,
			mobilePushPreferences,
			mobilePushError,
			registerMobileDevice: async () => {
				throw new Error('Mobile push not available in platform mode')
			},
			unregisterMobileDevice: async () => {
				throw new Error('Mobile push not available in platform mode')
			},
			getMobilePushPreferences: async () => {
				throw new Error('Mobile push not available in platform mode')
			},
			referralStats,
			referralCode,
			referralLoading,
			referralError,
			copyReferralCode,
			regenerateReferralCode,
			getLeaderboard,
			// In-App Messages (not used in platform mode)
			inboxMessages,
			inboxUnreadCount,
			inboxLoading,
			inboxError,
			inboxPreferences,
			refreshInbox: async () => {
				// Not implemented in platform mode
			},
			markInboxMessageAsRead: async () => {
				// Not implemented in platform mode
			},
			markAllInboxMessagesAsRead: async () => {
				// Not implemented in platform mode
			},
			dismissInboxMessage: async () => {
				// Not implemented in platform mode
			},
			recordInboxMessageClick: async () => {
				// Not implemented in platform mode
			},
			updateInboxPreferences: async () => {
				// Not implemented in platform mode
			},
			getBillingBalance: async () => {
				throw new Error('getBillingBalance not available in platform mode')
			},
			getBillingUsage: async () => {
				throw new Error('getBillingUsage not available in platform mode')
			},
		}),
		[
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
			referralStats,
			referralCode,
			referralLoading,
			referralError,
			copyReferralCode,
			regenerateReferralCode,
			getLeaderboard,
			// Inbox (not used in platform mode)
			inboxMessages,
			inboxUnreadCount,
			inboxLoading,
			inboxError,
			inboxPreferences,
		]
	)

	return (
		<AuthContext.Provider value={authValue}>
			<PlatformContext.Provider value={platformValue}>
				<StorageContext.Provider value={storageValue}>
					<AIContext.Provider value={aiValue}>
						<JobsContext.Provider value={jobsValue}>
							<MonitoringContext.Provider value={monitoringValue}>
								<ConsentContext.Provider value={consentValue}>{children}</ConsentContext.Provider>
							</MonitoringContext.Provider>
						</JobsContext.Provider>
					</AIContext.Provider>
				</StorageContext.Provider>
			</PlatformContext.Provider>
		</AuthContext.Provider>
	)
}
