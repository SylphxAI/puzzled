'use client'

/**
 * Browser identity chrome - contexts and providers (TD-11 split of react.tsx).
 *
 * Owns the client context objects and the provider that threads the
 * server-resolved session and entitlement snapshot to the chrome.
 */

import { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { type AppConfig, EMPTY_APP_CONFIG, type IdentityUser } from '../dest'
import type { CommercePremium } from '../index'

type AuthState = {
	user: IdentityUser | null
	isLoading: boolean
	isLoaded: boolean
	isSignedIn: boolean
	isConfigured: boolean
	signOut: () => Promise<void>
	signInWithOAuth?: (input: { provider: string; redirectUrl?: string }) => Promise<void>
}

export const AuthContext = createContext<AuthState>({
	user: null,
	isLoading: true,
	isLoaded: false,
	isSignedIn: false,
	isConfigured: true,
	signOut: async () => undefined,
})

export const AppConfigContext = createContext<AppConfig>(EMPTY_APP_CONFIG)

/** Server-resolved entitlement for this request; never resolved in the browser. */
export const BillingContext = createContext<CommercePremium | null>(null)

export async function readJson(response: Response): Promise<Record<string, unknown>> {
	return ((await response.json().catch(() => null)) as Record<string, unknown> | null) ?? {}
}

export const PlatformContext = createContext({
	submitScore: async (_board?: string, _score?: number, _metadata?: unknown, _opts?: unknown) =>
		undefined,
})

export function SylphxProvider({
	children,
	config,
	billing,
}: {
	children: ReactNode
	appId?: string
	config?: AppConfig
	platformUrl?: string
	afterSignOutUrl?: string
	/**
	 * The server-resolved entitlement snapshot (one EvaluateEntitlement per
	 * request, threaded from the layout). Client surfaces read it as data and
	 * never resolve a copy of their own.
	 */
	billing?: CommercePremium | null
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
			<BillingContext.Provider value={billing ?? null}>
				<AuthContext.Provider value={value}>{children}</AuthContext.Provider>
			</BillingContext.Provider>
		</AppConfigContext.Provider>
	)
}

export function PlatformProvider(props: {
	children: ReactNode
	appId?: string
	config?: AppConfig
	platformUrl?: string
	billing?: CommercePremium | null
}) {
	return <SylphxProvider {...props}>{props.children}</SylphxProvider>
}
