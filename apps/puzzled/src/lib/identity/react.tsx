'use client'

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react'
import type { AppConfig, IdentityUser } from './dest'

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
	isLoading: true,
	isLoaded: false,
	isSignedIn: false,
	isConfigured: true,
	signOut: async () => undefined,
})

async function readJson(response: Response): Promise<Record<string, unknown>> {
	return ((await response.json().catch(() => null)) as Record<string, unknown> | null) ?? {}
}

export function SylphxProvider({
	children,
}: {
	children: ReactNode
	appId?: string
	config?: AppConfig
	platformUrl?: string
	afterSignOutUrl?: string
}) {
	const [user, setUser] = useState<IdentityUser | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [isLoaded, setIsLoaded] = useState(false)

	useEffect(() => {
		let cancelled = false
		setIsLoading(true)
		fetch('/api/identity/session', { credentials: 'same-origin' })
			.then(async (response) => {
				const body = await readJson(response)
				const next = (body.user as IdentityUser | null) ?? null
				if (!cancelled) setUser(next)
			})
			.catch(() => {
				if (!cancelled) setUser(null)
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false)
					setIsLoaded(true)
				}
			})
		return () => {
			cancelled = true
		}
	}, [])

	const signOut = useCallback(async () => {
		await fetch('/api/identity/logout', { method: 'POST', credentials: 'same-origin' })
		setUser(null)
	}, [])

	const signInWithOAuth = useCallback(
		async ({ provider, redirectUrl }: { provider: string; redirectUrl?: string }) => {
			const response = await fetch('/api/identity/oidc/begin', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ provider, redirectUrl: redirectUrl ?? '/' }),
			})
			const body = await readJson(response)
			const url = typeof body.authorizationUrl === 'string' ? body.authorizationUrl : ''
			if (!response.ok || !url) throw new Error('oidc_begin_failed')
			window.location.assign(url)
		},
		[],
	)

	const value = useMemo<AuthState>(
		() => ({
			user,
			isLoading,
			isLoaded,
			isSignedIn: Boolean(user),
			isConfigured: true,
			signOut,
			signInWithOAuth,
		}),
		[user, isLoading, isLoaded, signOut, signInWithOAuth],
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

export function useSignInForm(opts: {
	afterSignInUrl?: string
	oauthHandler?: (provider: string) => Promise<void>
	providers?: unknown
	methods?: unknown
} = {}): {
	form: { email: string; password: string; name: string }
	setEmail: (value: string) => void
	setPassword: (value: string) => void
	isLoading: boolean
	loadingProvider: string | null
	error: { message?: string } | null
	handlePasswordSubmit: (event?: { preventDefault?: () => void }) => Promise<void>
	handleOAuthSignIn: (provider: string) => Promise<void>
} {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	return {
		form: { email, password, name: '' },
		setEmail,
		setPassword,
		isLoading,
		loadingProvider: null,
		error: error ? { message: error } : null,
		handlePasswordSubmit: async (event?: { preventDefault?: () => void }) => {
			event?.preventDefault?.()
			setIsLoading(true)
			setError(null)
			try {
				const response = await fetch('/api/identity/login', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					credentials: 'same-origin',
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

export function useSignUpForm(opts: {
	afterSignUpUrl?: string
	minPasswordLength?: number
	oauthHandler?: (provider: string) => Promise<void>
	providers?: unknown
} = {}) {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [name, setName] = useState('')
	const [step, setStep] = useState<number | 'verify-email'>(1)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const minLength = opts.minPasswordLength ?? 8
	return {
		form: { email, password, name },
		setEmail,
		setPassword,
		setName,
		step,
		isLoading,
		loadingProvider: null as string | null,
		error: error ? { message: error } : null,
		passwordValid: password.length >= minLength,
		handleSubmit: async (event?: { preventDefault?: () => void }) => {
			event?.preventDefault?.()
			setIsLoading(true)
			setError(null)
			try {
				const response = await fetch('/api/identity/signup', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					credentials: 'same-origin',
					body: JSON.stringify({ email, password, name }),
				})
				if (!response.ok) throw new Error('sign-up failed')
				setStep('verify-email')
			} catch (err) {
				setError(err instanceof Error ? err.message : 'sign-up failed')
			} finally {
				setIsLoading(false)
			}
		},
		handleOAuthSignUp: async (provider: string) => {
			await opts.oauthHandler?.(provider)
		},
	}
}

export function useForgotPasswordForm(_opts?: unknown) {
	const [email, setEmail] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)
	return {
		form: { email },
		email,
		setEmail,
		isLoading,
		error,
		success,
		handleSubmit: async (event?: { preventDefault?: () => void }) => {
			event?.preventDefault?.()
			setIsLoading(true)
			setError(null)
			try {
				const response = await fetch('/api/identity/recovery', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					credentials: 'same-origin',
					body: JSON.stringify({ email }),
				})
				if (!response.ok) throw new Error('recovery failed')
				setSuccess(true)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'recovery failed')
			} finally {
				setIsLoading(false)
			}
		},
	}
}

export function useResetPasswordForm(opts?: {
	token?: string
	minPasswordLength?: number
	afterResetUrl?: string
}) {
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)
	const minLength = opts?.minPasswordLength ?? 8
	const passwordsMatch = password === confirmPassword
	return {
		form: { password, email: '' },
		setPassword,
		setConfirmPassword,
		showPassword,
		toggleShowPassword: () => setShowPassword((value) => !value),
		passwordsMatch,
		isValid: passwordsMatch && password.length >= minLength,
		isLoading,
		error,
		success,
		handleSubmit: async (event?: { preventDefault?: () => void }) => {
			event?.preventDefault?.()
			setIsLoading(true)
			setError(null)
			try {
				const response = await fetch('/api/identity/recovery/complete', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					credentials: 'same-origin',
					body: JSON.stringify({
						token: opts?.token,
						secret: opts?.token,
						password,
					}),
				})
				if (!response.ok) throw new Error('reset failed')
				setSuccess(true)
			} catch (err) {
				setError(err instanceof Error ? err.message : 'reset failed')
			} finally {
				setIsLoading(false)
			}
		},
	}
}

export type Plan = {
	slug: string
	name: string
	monthlyPrice?: number
	annualPrice?: number
	features?: string[]
}

type BillingState = {
	subscription: { planSlug?: string; status?: string } | null
	isPremium: boolean
	isLoading: boolean
}

export function useBilling() {
	const [state, setState] = useState<BillingState>({
		subscription: null,
		isPremium: false,
		isLoading: true,
	})
	useEffect(() => {
		let cancelled = false
		fetch('/api/identity/billing', { credentials: 'same-origin' })
			.then(async (response) => {
				const body = await readJson(response)
				if (cancelled) return
				setState({
					subscription: (body.subscription as BillingState['subscription']) ?? null,
					isPremium: body.isPremium === true,
					isLoading: false,
				})
			})
			.catch(() => {
				if (!cancelled) setState({ subscription: null, isPremium: false, isLoading: false })
			})
		return () => {
			cancelled = true
		}
	}, [])
	return {
		...state,
		openPortal: async () => undefined,
		createCheckout: async (_plan?: unknown, _interval?: unknown) => '',
	}
}

export function usePlans() {
	return [] as Plan[]
}
export function useSafeBilling() {
	return useBilling()
}
export function useReferral() {
	const { user } = useSafeUser()
	return {
		code: user?.id ?? null,
		stats: { referrals: 0, conversions: 0 } as Record<string, ReactNode>,
		link: user?.id ? `/signup?ref=${encodeURIComponent(user.id)}` : '',
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
	const { user, isLoading } = useSafeUser()
	if (isLoading) return <p>Loading account…</p>
	if (!user) return <p>Sign in to manage your Identity dest account.</p>
	return (
		<div>
			<p>{user.name || 'Puzzled player'}</p>
			<p>{user.email}</p>
			<p>Identity principal {user.id}</p>
		</div>
	)
}
export function SecuritySettings() {
	const [sessions, setSessions] = useState<unknown[]>([])
	useEffect(() => {
		fetch('/api/identity/sessions', { credentials: 'same-origin' })
			.then(async (response) => {
				const body = await readJson(response)
				setSessions(Array.isArray(body.sessions) ? body.sessions : [])
			})
			.catch(() => setSessions([]))
	}, [])
	return (
		<div>
			<p>Active Identity dest sessions: {sessions.length}</p>
		</div>
	)
}
export function UserProfile(_props: Record<string, unknown>) {
	return <AccountSection />
}
export function BillingSection() {
	const { subscription, isPremium, isLoading } = useBilling()
	if (isLoading) return <p>Loading billing…</p>
	return (
		<div>
			<p>{isPremium ? 'Premium' : 'Free Plan'}</p>
			{subscription?.planSlug ? <p>Plan {subscription.planSlug}</p> : null}
		</div>
	)
}

function OAuthIcon({ className }: { className?: string }) {
	return <span className={className} aria-hidden />
}
const namedOAuthIcons: Record<string, (props: { className?: string }) => ReactNode> = {
	google: OAuthIcon,
	github: OAuthIcon,
	apple: OAuthIcon,
	discord: OAuthIcon,
}
export const OAuthIcons: Record<string, (props: { className?: string }) => ReactNode> = new Proxy(
	namedOAuthIcons,
	{
		get: (target, prop) =>
			typeof prop === 'string' ? (target[prop] ?? OAuthIcon) : OAuthIcon,
	},
)
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
