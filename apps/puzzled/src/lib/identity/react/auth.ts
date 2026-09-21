'use client'

/**
 * Browser identity chrome - auth surface (TD-11 split of react.tsx).
 *
 * Session/user reads over the auth context plus the sign-in/sign-up and
 * recovery form hooks.
 */

import { useContext, useState } from 'react'
import { AuthContext } from './context'

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

export function useSignInForm(
	opts: {
		afterSignInUrl?: string
		oauthHandler?: (provider: string) => Promise<void>
		providers?: unknown
		methods?: unknown
	} = {},
): {
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

export function useSignUpForm(
	opts: {
		afterSignUpUrl?: string
		minPasswordLength?: number
		oauthHandler?: (provider: string) => Promise<void>
		providers?: unknown
	} = {},
) {
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
		form: { password, confirmPassword, email: '' },
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

export type OAuthProvider = string
