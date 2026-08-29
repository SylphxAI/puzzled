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

export function FeatureFlagProvider({ children }: { children: ReactNode; endpoint?: string; userContext?: unknown; refreshInterval?: number; enableCache?: boolean }) {
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
	return { user: ctx.user, isLoading: ctx.isLoading, isLoaded: ctx.isLoaded, isSignedIn: ctx.isSignedIn, isConfigured: ctx.isConfigured }
}

export function useUser() {
	return useSafeUser()
}

export function useSafeAuth() {
	const ctx = useContext(AuthContext)
	return { signOut: ctx.signOut, signInWithOAuth: ctx.signInWithOAuth, oauthError: null as string | null }
}

export function useAuth() {
	return useSafeAuth()
}

export function useSignInForm(opts: {
	methods?: string[]
	providers?: string[]
	afterSignInUrl?: string
	oauthHandler?: (provider: string) => Promise<void>
}) {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	return {
		form: { email, password },
		setEmail,
		setPassword,
		isLoading,
		loadingProvider: null as string | null,
		error,
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

export function useSignUpForm(opts: Parameters<typeof useSignInForm>[0]) {
	return useSignInForm(opts)
}

export function useForgotPasswordForm() {
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

export function useResetPasswordForm() {
	return useForgotPasswordForm()
}

export type Plan = { slug?: string; name?: string }
export function useBilling() {
	return { subscription: null as { planSlug?: string } | null, isPremium: false }
}
export function usePlans() {
	return { plans: [] as Plan[] }
}
export function useSafeBilling() {
	return useBilling()
}
export function useReferral() {
	return { code: null as string | null }
}
export function useAnalytics() {
	return { track: async () => undefined }
}
export function useSafeAnalytics() {
	return useAnalytics()
}
export function useFeatureFlag(_name: string) {
	return { enabled: false }
}
export function useSafeConsent() {
	return { consent: {} as Record<string, boolean> }
}
export function useNotifications() {
	return { permission: 'default' as NotificationPermission }
}
export function useSafeAchievements() {
	return { achievements: [] as never[] }
}
export function useGlobalErrorHandler() {
	return
}
export function useSessionReplay() {
	return { start: () => undefined, stop: () => undefined }
}
export const PlatformContext = createContext({})
export function CookieBanner() {
	return null
}
export function AccountSection() {
	return null
}
export function SecuritySettings() {
	return null
}
export function UserProfile() {
	return null
}
export function BillingSection() {
	return null
}
export const OAuthIcons: Record<string, (props: { className?: string }) => ReactNode> = {}
export type OAuthProvider = string
export type PrivacyMode = string
export type SessionReplayConfig = Record<string, unknown>
export type { AppConfig }
