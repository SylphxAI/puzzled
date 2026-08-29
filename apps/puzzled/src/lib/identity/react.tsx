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
import { DEST_CONSENT_PURPOSES, EMPTY_APP_CONFIG, type AppConfig, type IdentityUser, type Plan } from './dest'

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

const AppConfigContext = createContext<AppConfig>(EMPTY_APP_CONFIG)

async function readJson(response: Response): Promise<Record<string, unknown>> {
	return ((await response.json().catch(() => null)) as Record<string, unknown> | null) ?? {}
}

export function SylphxProvider({
	children,
	config,
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
	return (
		<AppConfigContext.Provider value={config ?? EMPTY_APP_CONFIG}>
			<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
		</AppConfigContext.Provider>
	)
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

export type { Plan }

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
		openPortal: async () => {
			const response = await fetch('/api/identity/billing/portal', {
				method: 'POST',
				credentials: 'same-origin',
			})
			const body = await readJson(response)
			const url = typeof body.portalUrl === 'string' ? body.portalUrl : ''
			if (!response.ok || !url) throw new Error('commerce_portal_failed')
			window.location.assign(url)
			return url
		},
		createCheckout: async (plan?: unknown, interval?: unknown) => {
			const response = await fetch('/api/identity/billing/checkout', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ planSlug: plan, interval }),
			})
			const body = await readJson(response)
			const url = typeof body.checkoutUrl === 'string' ? body.checkoutUrl : ''
			if (!response.ok || !url) {
				throw new Error(typeof body.error === 'string' ? body.error : 'checkout_failed')
			}
			return url
		},
	}
}

export function usePlans() {
	return useContext(AppConfigContext).plans
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
	return {
		track: async (event?: string, props?: Record<string, unknown>) => {
			if (!event?.trim()) return
			await fetch('/api/observability/analytics', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ event, properties: props }),
			})
		},
	}
}
export function useSafeAnalytics() {
	return useAnalytics()
}
export function useSafeConsent() {
	const [consent, setConsent] = useState<Record<string, boolean>>({})
	const [hasConsented, setHasConsented] = useState(false)
	const [isLoading, setIsLoading] = useState(true)
	useEffect(() => {
		const stored =
			typeof window === 'undefined' ? null : window.localStorage.getItem('puzzled-consent')
		if (stored) {
			try {
				setConsent(JSON.parse(stored) as Record<string, boolean>)
				setHasConsented(true)
			} catch {
				setConsent({})
			}
		}
		setIsLoading(false)
	}, [])
	return {
		consent,
		hasConsent: (kind?: string) => (kind ? consent[kind] === true : hasConsented),
		hasConsented,
		isLoading,
		isConfigured: true,
		setConsent: async (next: Record<string, boolean>) => {
			setConsent(next)
			setHasConsented(true)
			if (typeof window !== 'undefined') {
				window.localStorage.setItem('puzzled-consent', JSON.stringify(next))
			}
			await Promise.all(
				DEST_CONSENT_PURPOSES.filter((purpose) => purpose !== 'necessary').map((purpose) =>
					fetch('/api/identity/consent', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						credentials: 'same-origin',
						body: JSON.stringify({
							purpose,
							state: next[purpose] ? 'granted' : 'denied',
						}),
					}),
				),
			)
		},
	}
}
export function useNotifications() {
	const [permission, setPermission] = useState<NotificationPermission>(
		typeof Notification === 'undefined' ? 'denied' : Notification.permission,
	)
	const [deviceId, setDeviceId] = useState<string | null>(null)
	const [error, setError] = useState<{ message?: string } | null>(null)
	const [preferences, setPreferences] = useState<Record<string, unknown>>({})
	useEffect(() => {
		fetch('/api/events/inbox', { credentials: 'same-origin' })
			.then(async (response) => {
				const body = await readJson(response)
				setPreferences({ messages: body.messages ?? [] })
			})
			.catch(() => undefined)
	}, [])
	return {
		permission,
		isSupported: typeof Notification !== 'undefined',
		isSubscribed: Boolean(deviceId),
		subscribe: async () => {
			if (typeof Notification === 'undefined') return false
			const next = await Notification.requestPermission()
			setPermission(next)
			if (next !== 'granted') return false
			const registration = await navigator.serviceWorker?.ready.catch(() => undefined)
			const push = await registration?.pushManager
				.subscribe({ userVisibleOnly: true })
				.catch(() => undefined)
			const response = await fetch('/api/events/devices', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({
					token: push?.endpoint ?? `web-push-${crypto.randomUUID()}`,
					p256dh: push ? arrayBufferToB64(push.getKey('p256dh')) : '',
					auth: push ? arrayBufferToB64(push.getKey('auth')) : '',
				}),
			})
			const body = await readJson(response)
			if (!response.ok) {
				setError({ message: typeof body.error === 'string' ? body.error : 'subscribe_failed' })
				return false
			}
			setDeviceId(typeof body.deviceId === 'string' ? body.deviceId : 'events-device')
			setError(null)
			return true
		},
		unsubscribe: async () => {
			if (!deviceId) return
			await fetch('/api/events/devices', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ unregister: true, deviceId }),
			})
			setDeviceId(null)
		},
		error,
		preferences,
	}
}

function arrayBufferToB64(value: ArrayBuffer | null): string {
	if (!value) return ''
	return btoa(String.fromCharCode(...new Uint8Array(value)))
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
export function useGlobalErrorHandler(opts?: {
	handleErrors?: boolean
	handleRejections?: boolean
	onCapture?: (eventId?: string) => void
}) {
	useEffect(() => {
		if (opts?.handleErrors === false && opts.handleRejections === false) return
		const capture = (message: string) => {
			void fetch('/api/observability/error-events', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ message, service: 'puzzled-web' }),
			})
				.then(async (response) => {
					const body = await readJson(response)
					opts?.onCapture?.(typeof body.eventId === 'string' ? body.eventId : undefined)
				})
				.catch(() => undefined)
		}
		const onError = (event: ErrorEvent) => capture(event.message)
		const onRejection = (event: PromiseRejectionEvent) =>
			capture(event.reason instanceof Error ? event.reason.message : String(event.reason))
		if (opts?.handleErrors !== false) window.addEventListener('error', onError)
		if (opts?.handleRejections !== false) window.addEventListener('unhandledrejection', onRejection)
		return () => {
			window.removeEventListener('error', onError)
			window.removeEventListener('unhandledrejection', onRejection)
		}
	}, [opts])
}
export function useSessionReplay(opts?: {
	onError?: (error: { message: string }) => void
	autoStart?: boolean
	userId?: string
	[key: string]: unknown
}) {
	const [sessionId, setSessionId] = useState<string | null>(null)
	const [isRecording, setIsRecording] = useState(false)
	const start = useCallback(async () => {
		const nextId = sessionId ?? crypto.randomUUID()
		const response = await fetch('/api/observability/session-replays', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			credentials: 'same-origin',
			body: JSON.stringify({ sessionId: nextId, consent: true, masked: true }),
		})
		if (!response.ok) {
			opts?.onError?.({ message: 'observability_replay_failed' })
			return
		}
		setSessionId(nextId)
		setIsRecording(true)
	}, [opts, sessionId])
	const stop = useCallback(() => {
		setIsRecording(false)
	}, [])
	useEffect(() => {
		if (opts?.autoStart) void start()
	}, [opts?.autoStart, start])
	const mark = useCallback(
		async (kind: string, payload?: unknown) => {
			if (!sessionId) return
			await fetch('/api/observability/session-replays', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({
					sessionId,
					chunk: { sequence: Date.now(), payload: JSON.stringify({ kind, payload }) },
				}),
			}).catch((error) => {
				opts?.onError?.({
					message: error instanceof Error ? error.message : 'observability_replay_failed',
				})
			})
		},
		[opts, sessionId],
	)
	return {
		start,
		stop,
		sessionId,
		isRecording,
		markError: (...args: unknown[]) => void mark('error', args),
		markNavigation: (...args: unknown[]) => void mark('navigation', args),
		markConversion: (...args: unknown[]) => void mark('conversion', args),
	}
}
export const PlatformContext = createContext({
	submitScore: async (_board?: string, _score?: number, _metadata?: unknown, _opts?: unknown) =>
		undefined,
})
export function CookieBanner(props: {
	position?: string
	privacyPolicyUrl?: string
	variant?: string
	onSave?: () => void
}) {
	const { hasConsented, setConsent } = useSafeConsent()
	if (hasConsented) return null
	return (
		<div className={props.position === 'bottom' ? 'fixed inset-x-0 bottom-0 z-50 p-4' : undefined}>
			<div className="mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-lg border bg-background p-4">
				<p>
					Puzzled uses Identity dest consent for analytics.{' '}
					{props.privacyPolicyUrl ? <a href={props.privacyPolicyUrl}>Privacy</a> : null}
				</p>
				<button
					type="button"
					onClick={() => {
						void setConsent({ analytics: true, marketing: false }).then(() => props.onSave?.())
					}}
				>
					Accept
				</button>
			</div>
		</div>
	)
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
