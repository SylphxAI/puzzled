'use client'

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react'
import type { AppConfig, IdentityUser } from './server'

type AuthState = {
	user: IdentityUser | null
	isLoading: boolean
	isLoaded: boolean
	isSignedIn: boolean
	isConfigured: boolean
	signOut: () => Promise<void>
	signInWithOAuth?: (input: { provider: string; redirectUrl?: string }) => Promise<void>
}

const AuthContext = createContext<AuthState>({
	user: null,
	isLoading: false,
	isLoaded: true,
	isSignedIn: false,
	isConfigured: true,
	signOut: async () => undefined,
})

export function SylphxProvider({
	children,
}: {
	children: ReactNode
	appId?: string
	config?: AppConfig
	platformUrl?: string
	afterSignOutUrl?: string
}) {
	const value = useMemo<AuthState>(
		() => ({
			user: null,
			isLoading: false,
			isLoaded: true,
			isSignedIn: false,
			isConfigured: true,
			signOut: async () => {
				document.cookie = 'sylphx_identity_session=; Max-Age=0; path=/'
			},
			signInWithOAuth: async ({ provider, redirectUrl }) => {
				window.location.assign(
					`https://api.identity.sylphx.com/v1/oidc/begin?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectUrl ?? '/')}`,
				)
			},
		}),
		[],
	)
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function FeatureFlagProvider({
	children,
}: {
	children: ReactNode
	endpoint?: string
	userContext?: unknown
	refreshInterval?: number
	enableCache?: boolean
}) {
	return <>{children}</>
}

export function PlatformProvider(props: {
	children: ReactNode
	appId?: string
	config?: AppConfig
	platformUrl?: string
}) {
	return <SylphxProvider {...props}>{props.children}</SylphxProvider>
}

export function useSafeUser() {
	const ctx = useContext(AuthContext)
	return {
		user: ctx.user,
		isLoading: ctx.isLoading,
		isLoaded: ctx.isLoaded,
		isSignedIn: ctx.isSignedIn,
		isConfigured: ctx.isConfigured,
	}
}

export function useUser() {
	return useSafeUser()
}

export function useSafeAuth() {
	const ctx = useContext(AuthContext)
	return {
		signOut: ctx.signOut,
		signInWithOAuth: ctx.signInWithOAuth,
		oauthError: null as { message?: string } | null,
		verifyEmail: async (_arg?: unknown) => undefined,
		resendVerificationEmail: async (_arg?: unknown) => undefined,
	}
}

export function useAuth() {
	return useSafeAuth()
}

export function useSignInForm(opts: any = {}): any {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	return {
		form: { email, password, name: '' },
		setEmail,
		setPassword,
		isLoading,
		loadingProvider: null as string | null,
		error: error ? { message: error } : null,
		handlePasswordSubmit: async (event?: { preventDefault?: () => void }) => {
			event?.preventDefault?.()
			setIsLoading(true)
			setError(null)
			try {
				const response = await fetch('/api/identity/login', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ email, password }),
				})
				if (!response.ok) throw new Error('sign-in failed')
				window.location.href = opts.afterSignInUrl ?? '/'
			} catch (err) {
				setError(err instanceof Error ? err.message : 'sign-in failed')
			} finally {
				setIsLoading(false)
			}
		},
		handleOAuthSignIn: async (provider: string) => {
			await opts.oauthHandler?.(provider)
		},
	}
}

export function useSignUpForm(opts: any = {}): any {
	return {
		...useSignInForm(opts),
		setName: () => undefined,
		step: 1,
		passwordValid: true,
		handleSubmit: async () => undefined,
		handleOAuthSignUp: async () => undefined,
	}
}

export function useForgotPasswordForm(_opts?: unknown): any {
	const [email, setEmail] = useState('')
	return {
		email,
		setEmail,
		isLoading: false,
		error: null as string | null,
		handleSubmit: async (event?: { preventDefault?: () => void }) => {
			event?.preventDefault?.()
			await fetch('/api/identity/recovery', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email }),
			})
		},
	}
}

export function useResetPasswordForm(_opts?: unknown): any {
	return {
		...useForgotPasswordForm(),
		setConfirmPassword: () => undefined,
		showPassword: false,
		toggleShowPassword: () => undefined,
		passwordsMatch: true,
		isValid: true,
		success: false,
		setPassword: () => undefined,
	}
}

export type Plan = {
	slug: string
	name: string
	monthlyPrice?: number
	annualPrice?: number
	features?: string[]
}
export function useBilling() {
	return {
		subscription: null as { planSlug?: string } | null,
		isPremium: false,
		openPortal: async () => undefined,
		createCheckout: async (_plan?: unknown, _interval?: unknown) => '',
		isLoading: false,
	}
}
export function usePlans() {
	return [] as Plan[]
}
export function useSafeBilling() {
	return useBilling()
}
export function useReferral() {
	return {
		code: null as string | null,
		stats: { referrals: 0, conversions: 0 } as Record<string, ReactNode>,
		link: '',
		isLoading: false,
		error: null as { message?: string } | null,
		copyCode: async () => undefined,
		copyLink: async () => undefined,
		regenerateCode: async () => undefined,
	}
}
export function useAnalytics() {
	return { track: async (_event?: string, _props?: Record<string, unknown>) => undefined }
}
export function useSafeAnalytics() {
	return useAnalytics()
}
export function useFeatureFlag(_name: string) {
	return { enabled: false, variant: 'control' as string, isLoading: false }
}
export function useSafeConsent() {
	return {
		consent: {} as Record<string, boolean>,
		hasConsent: (_kind?: string) => false,
		hasConsented: false,
		isLoading: false,
		isConfigured: true,
	}
}
export function useNotifications() {
	return {
		permission: 'default' as NotificationPermission,
		isSupported: false,
		isSubscribed: false,
		subscribe: async () => false,
		unsubscribe: async () => undefined,
		error: null as { message?: string } | null,
		preferences: {} as Record<string, unknown>,
	}
}
export function useSafeAchievements() {
	return {
		achievements: [] as Array<{
			unlocked: boolean
			achievementId: string
			achievement: { id: string }
		}>,
		unlock: async (_id?: string, _meta?: unknown) => undefined,
		recentUnlock: null as { achievement: { id: string } } | null,
		dismissRecentUnlock: () => undefined,
		isLoading: false,
		isConfigured: true,
	}
}
export function useGlobalErrorHandler(_opts?: {
	handleErrors?: boolean
	handleRejections?: boolean
	onCapture?: (eventId?: string) => void
}) {
	return
}
export function useSessionReplay(_opts?: {
	onError?: (error: { message: string }) => void
	[key: string]: unknown
}) {
	return {
		start: () => undefined,
		stop: () => undefined,
		sessionId: null as string | null,
		isRecording: false,
		markError: (..._args: unknown[]) => undefined,
		markNavigation: (..._args: unknown[]) => undefined,
		markConversion: (..._args: unknown[]) => undefined,
	}
}
export const PlatformContext = createContext({
	submitScore: async (_board?: string, _score?: number, _metadata?: unknown, _opts?: unknown) =>
		undefined,
})
export function CookieBanner(_props: {
	position?: string
	privacyPolicyUrl?: string
	variant?: string
	onSave?: () => void
}) {
	return null
}
export function AccountSection() {
	return null
}
export function SecuritySettings() {
	return null
}
export function UserProfile(_props: Record<string, unknown>) {
	return null
}
export function BillingSection() {
	return null
}
export const OAuthIcons: Record<string, (props: { className?: string }) => ReactNode> = {}
export type OAuthProvider = string
export type PrivacyMode = string
export type SessionReplayConfig = {
	sampling?: { rate?: number; alwaysRecordErrors?: boolean }
	privacyMode?: PrivacyMode
	maskSelectors?: string[]
	blockSelectors?: string[]
	autoStart?: boolean
	stopOnUnmount?: boolean
	uploadEndpoint?: string
	userId?: string
	enabled?: boolean
	errorCorrelation?: unknown
	rageClickDetection?: boolean
	deadClickDetection?: boolean
	networkCapture?: boolean
	consoleCapture?: boolean
	maxDuration?: number
	compress?: boolean
	batchSize?: number
	uploadInterval?: number
	onError?: (error: { message: string }) => void
}
export type { AppConfig }
