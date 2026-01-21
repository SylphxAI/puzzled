/**
 * useSignInForm Hook
 *
 * Headless hook for sign-in form logic.
 * Can be used with SDK's default UI or custom UI.
 *
 * @example
 * ```tsx
 * // With SDK default UI
 * function MySignIn() {
 *   const signIn = useSignInForm({ afterSignInUrl: '/dashboard' });
 *   return <SignInFormUI {...signIn} />;
 * }
 *
 * // With custom lockout protection (Platform)
 * function PlatformLogin() {
 *   const signIn = useSignInForm({
 *     onBeforeSubmit: preCheckLogin,
 *     onSubmitError: recordLoginFailure,
 *     submitHandler: async ({ email, password }) => {
 *       const result = await authClient.signIn.email({ email, password });
 *       if (result.error) throw new Error(result.error.message);
 *     },
 *   });
 *   return <CustomUI {...signIn} />;
 * }
 * ```
 */

'use client'

import { useState, useCallback, useContext } from 'react'
import type { OAuthProvider } from '@sylphx/ui'
import { SdkAuthContext, type SdkAuthContextValue } from '../services-context'
import { safeRedirect } from '../security-utils'

// Re-export for convenience
export type { OAuthProvider } from '@sylphx/ui'

// ============================================
// Types
// ============================================

export type SignInMethod = 'password' | 'magic-link' | 'otp'

export interface SignInFormState {
	email: string
	password: string
	otp: string
}

export type SignInStep = 'email' | 'password' | 'otp' | 'otp-verify' | 'magic-link-sent'

export interface PreSubmitResult {
	success: boolean
	error?: string
	lockoutUntil?: string
}

export interface UseSignInFormOptions {
	/** Auth methods to enable */
	methods?: SignInMethod[]
	/** OAuth providers to show */
	providers?: OAuthProvider[]
	/** URL to redirect after sign in */
	afterSignInUrl?: string
	/**
	 * Called before submit to validate/check lockout.
	 * Return { success: false, error: '...' } to block submit.
	 */
	onBeforeSubmit?: (credentials: { email: string; password: string }) => Promise<PreSubmitResult>
	/**
	 * Called on submit error (e.g., to record failure).
	 */
	onSubmitError?: (email: string, error: string) => Promise<void>
	/**
	 * Custom submit handler. If provided, replaces context-based auth.
	 * Throw error to indicate failure.
	 */
	submitHandler?: (credentials: { email: string; password: string }) => Promise<void>
	/**
	 * Custom OAuth handler. If provided, replaces default redirect.
	 */
	oauthHandler?: (provider: OAuthProvider) => Promise<void>
	/**
	 * Custom magic link handler.
	 */
	magicLinkHandler?: (email: string) => Promise<void>
	/**
	 * Custom OTP request handler.
	 */
	otpRequestHandler?: (email: string) => Promise<void>
	/**
	 * Custom OTP verify handler.
	 */
	otpVerifyHandler?: (email: string, code: string) => Promise<void>
	/** Callback on successful sign in */
	onSuccess?: () => void
	/** Callback on error */
	onError?: (error: string) => void
}

export interface UseSignInFormReturn {
	// Form state
	form: SignInFormState
	setEmail: (email: string) => void
	setPassword: (password: string) => void
	setOtp: (otp: string) => void
	resetForm: () => void

	// UI state
	step: SignInStep
	setStep: (step: SignInStep) => void
	isLoading: boolean
	loadingProvider: OAuthProvider | null
	error: string | null
	lockoutUntil: string | null
	clearError: () => void

	// 2FA state
	pendingTwoFactor: { userId: string; email: string } | null

	// Handlers
	handlePasswordSubmit: (e?: React.FormEvent) => Promise<void>
	handleOAuthSignIn: (provider: OAuthProvider) => void
	handleMagicLinkRequest: (e?: React.FormEvent) => Promise<void>
	handleOtpRequest: () => Promise<void>
	handleOtpVerify: (e?: React.FormEvent) => Promise<void>
	handleTwoFactorVerify: (e?: React.FormEvent) => Promise<void>

	// Config (for UI)
	methods: SignInMethod[]
	providers: OAuthProvider[]
	afterSignInUrl: string
}

// ============================================
// Hook Implementation
// ============================================

export function useSignInForm(options: UseSignInFormOptions = {}): UseSignInFormReturn {
	const {
		methods = ['password'],
		providers = [],
		afterSignInUrl = '/dashboard',
		onBeforeSubmit,
		onSubmitError,
		submitHandler,
		oauthHandler,
		magicLinkHandler,
		otpRequestHandler,
		otpVerifyHandler,
		onSuccess,
		onError,
	} = options

	// Get auth context (may be null if outside provider)
	const authContext = useContext(SdkAuthContext) as SdkAuthContextValue | null

	// Form state
	const [form, setForm] = useState<SignInFormState>({
		email: '',
		password: '',
		otp: '',
	})

	// UI state
	const [step, setStep] = useState<SignInStep>(methods.includes('password') ? 'password' : 'email')
	const [isLoading, setIsLoading] = useState(false)
	const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [lockoutUntil, setLockoutUntil] = useState<string | null>(null)

	// 2FA state
	const [pendingTwoFactor, setPendingTwoFactor] = useState<{ userId: string; email: string } | null>(null)

	// Form setters
	const setEmail = useCallback((email: string) => {
		setForm((prev) => ({ ...prev, email }))
		setError(null)
		setLockoutUntil(null)
	}, [])

	const setPassword = useCallback((password: string) => {
		setForm((prev) => ({ ...prev, password }))
		setError(null)
	}, [])

	const setOtp = useCallback((otp: string) => {
		setForm((prev) => ({ ...prev, otp }))
		setError(null)
	}, [])

	const resetForm = useCallback(() => {
		setForm({ email: '', password: '', otp: '' })
		setError(null)
		setLockoutUntil(null)
		setPendingTwoFactor(null)
	}, [])

	const clearError = useCallback(() => {
		setError(null)
		setLockoutUntil(null)
	}, [])

	// Password submit handler
	const handlePasswordSubmit = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()
			setIsLoading(true)
			setError(null)
			setLockoutUntil(null)

			try {
				// Pre-submit check (e.g., lockout protection)
				if (onBeforeSubmit) {
					const preCheck = await onBeforeSubmit({
						email: form.email,
						password: form.password,
					})
					if (!preCheck.success) {
						setError(preCheck.error || 'Login blocked')
						if (preCheck.lockoutUntil) {
							setLockoutUntil(preCheck.lockoutUntil)
						}
						return
					}
				}

				// Custom submit handler (Platform mode)
				if (submitHandler) {
					await submitHandler({
						email: form.email,
						password: form.password,
					})
					onSuccess?.()
					// Use safeRedirect to prevent XSS via malicious afterSignInUrl
					safeRedirect(afterSignInUrl, { fallback: '/dashboard' })
					return
				}

				// Use auth context (SDK mode)
				if (!authContext) {
					throw new Error('Sign-in requires SylphxProvider or a custom submitHandler')
				}

				const result = await authContext.login(form.email, form.password)

				// Check if 2FA is required
				if (result.requiresTwoFactor) {
					setPendingTwoFactor({ userId: result.userId!, email: form.email })
					setStep('otp-verify')
					return
				}

				onSuccess?.()

				// Use safeRedirect to prevent XSS via malicious afterSignInUrl
				safeRedirect(afterSignInUrl, { fallback: '/dashboard' })
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Sign in failed'
				setError(message)
				onError?.(message)

				// Record failure if handler provided
				if (onSubmitError) {
					await onSubmitError(form.email, message).catch(() => {
						// Silently ignore failure recording errors
					})
				}
			} finally {
				setIsLoading(false)
			}
		},
		[form, onBeforeSubmit, submitHandler, authContext, afterSignInUrl, onSuccess, onError, onSubmitError]
	)

	// 2FA verification handler
	const handleTwoFactorVerify = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()
			if (!pendingTwoFactor) {
				setError('No pending two-factor authentication')
				return
			}

			setIsLoading(true)
			setError(null)

			try {
				if (!authContext) {
					throw new Error('Two-factor verification requires SylphxProvider')
				}

				await authContext.verifyTwoFactor(pendingTwoFactor.userId, form.otp)

				onSuccess?.()
				setPendingTwoFactor(null)

				// Use safeRedirect to prevent XSS via malicious afterSignInUrl
				safeRedirect(afterSignInUrl, { fallback: '/dashboard' })
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Invalid verification code'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[pendingTwoFactor, form.otp, authContext, afterSignInUrl, onSuccess, onError]
	)

	// OAuth handler
	const handleOAuthSignIn = useCallback(
		(provider: OAuthProvider) => {
			setLoadingProvider(provider)
			setError(null)

			if (oauthHandler) {
				oauthHandler(provider).catch((err) => {
					setError(err instanceof Error ? err.message : 'OAuth sign in failed')
					setLoadingProvider(null)
				})
			} else {
				// OAuth requires redirect - this should be handled by the platform
				// SDK apps should configure oauthHandler or use <SignIn> component
				setError('OAuth sign-in requires a custom oauthHandler or use the SignIn component')
				setLoadingProvider(null)
			}
		},
		[oauthHandler]
	)

	// Magic link request
	const handleMagicLinkRequest = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()
			setIsLoading(true)
			setError(null)

			try {
				if (magicLinkHandler) {
					await magicLinkHandler(form.email)
				} else {
					// Magic link requires custom handler
					throw new Error('Magic link sign-in requires a custom magicLinkHandler')
				}

				setStep('magic-link-sent')
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to send magic link'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[form.email, magicLinkHandler, onError]
	)

	// OTP request
	const handleOtpRequest = useCallback(async () => {
		setIsLoading(true)
		setError(null)

		try {
			if (otpRequestHandler) {
				await otpRequestHandler(form.email)
			} else {
				// OTP requires custom handler
				throw new Error('OTP sign-in requires a custom otpRequestHandler')
			}

			setStep('otp')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to send code'
			setError(message)
			onError?.(message)
		} finally {
			setIsLoading(false)
		}
	}, [form.email, otpRequestHandler, onError])

	// OTP verify
	const handleOtpVerify = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()
			setIsLoading(true)
			setError(null)

			try {
				if (otpVerifyHandler) {
					await otpVerifyHandler(form.email, form.otp)
				} else {
					// OTP requires custom handler
					throw new Error('OTP verification requires a custom otpVerifyHandler')
				}

				onSuccess?.()

				// Use safeRedirect to prevent XSS via malicious afterSignInUrl
				safeRedirect(afterSignInUrl, { fallback: '/dashboard' })
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Verification failed'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[form, otpVerifyHandler, afterSignInUrl, onSuccess, onError]
	)

	return {
		// Form state
		form,
		setEmail,
		setPassword,
		setOtp,
		resetForm,

		// UI state
		step,
		setStep,
		isLoading,
		loadingProvider,
		error,
		lockoutUntil,
		clearError,

		// 2FA state
		pendingTwoFactor,

		// Handlers
		handlePasswordSubmit,
		handleOAuthSignIn,
		handleMagicLinkRequest,
		handleOtpRequest,
		handleOtpVerify,
		handleTwoFactorVerify,

		// Config
		methods,
		providers,
		afterSignInUrl,
	}
}
