/**
 * useSignUpForm Hook
 *
 * Headless hook for sign-up form logic.
 * Supports: basic signup, invite codes, email verification, waitlist, additional fields.
 *
 * @example
 * ```tsx
 * // Basic usage
 * function MySignUp() {
 *   const signUp = useSignUpForm({ afterSignUpUrl: '/dashboard' });
 *   return <CustomSignUpUI {...signUp} />;
 * }
 *
 * // Platform mode (direct BetterAuth)
 * function PlatformSignUp() {
 *   const signUp = useSignUpForm({
 *     submitHandler: async ({ name, email, password }) => {
 *       const result = await authClient.signUp.email({ name, email, password });
 *       if (result.error) throw new Error(result.error.message);
 *       return { requiresVerification: false };
 *     },
 *   });
 *   return <CustomUI {...signUp} />;
 * }
 *
 * // With invite code
 * function InviteSignUp() {
 *   const signUp = useSignUpForm({
 *     inviteCode: 'abc123',
 *     requireInviteCode: true,
 *   });
 *   return <InviteSignUpUI {...signUp} />;
 * }
 * ```
 */

'use client'

import { useState, useCallback, useMemo, useEffect, useContext } from 'react'
import type { OAuthProvider } from '@sylphx/ui'
import { SdkAuthContext, type SdkAuthContextValue } from '../services-context'
import { safeRedirect } from '../security-utils'

// Re-export for convenience
export type { OAuthProvider } from '@sylphx/ui'

// ============================================
// Types
// ============================================

export type SignUpStep = 'form' | 'verify-email' | 'complete' | 'waitlist-joined'

export interface AdditionalField {
	name: string
	label: string
	type: 'text' | 'email' | 'tel' | 'url' | 'select'
	placeholder?: string
	required?: boolean
	options?: { label: string; value: string }[]
}

export interface InviteInfo {
	valid: boolean
	email?: string
	role?: string
}

export interface SignUpFormState {
	name: string
	email: string
	password: string
	inviteCode: string
	verificationCode: string
	[key: string]: string // for additional fields
}

export interface SignUpSubmitResult {
	requiresVerification?: boolean
	accessToken?: string
	refreshToken?: string
}

export interface UseSignUpFormOptions {
	/** OAuth providers to show */
	providers?: OAuthProvider[]
	/** URL to redirect after sign up */
	afterSignUpUrl?: string
	/** Minimum password length */
	minPasswordLength?: number
	/** Initial invite code */
	inviteCode?: string
	/** Show invite code field */
	showInviteCode?: boolean
	/** Require invite code */
	requireInviteCode?: boolean
	/** Additional fields to collect */
	additionalFields?: AdditionalField[]
	/** Waitlist URL (enables waitlist mode) */
	waitlistUrl?: string
	/**
	 * Custom submit handler. If provided, replaces context-based auth.
	 * Return { requiresVerification: true } to show email verification step.
	 * Throw error to indicate failure.
	 */
	submitHandler?: (data: SignUpFormState) => Promise<SignUpSubmitResult | void>
	/**
	 * Custom email verification handler.
	 */
	verifyEmailHandler?: (email: string, code: string) => Promise<SignUpSubmitResult | void>
	/**
	 * Custom invite verification handler.
	 */
	verifyInviteHandler?: (code: string) => Promise<InviteInfo>
	/**
	 * Custom waitlist handler.
	 */
	waitlistHandler?: (email: string, name?: string) => Promise<void>
	/**
	 * Custom OAuth handler. If provided, replaces default redirect.
	 */
	oauthHandler?: (provider: OAuthProvider) => Promise<void>
	/** Callback on successful sign up */
	onSuccess?: () => void
	/** Callback on error */
	onError?: (error: string) => void
}

export interface UseSignUpFormReturn {
	// Form state
	form: SignUpFormState
	setName: (name: string) => void
	setEmail: (email: string) => void
	setPassword: (password: string) => void
	setInviteCode: (code: string) => void
	setVerificationCode: (code: string) => void
	setField: (name: string, value: string) => void
	resetForm: () => void

	// Multi-step
	step: SignUpStep
	setStep: (step: SignUpStep) => void

	// Validation
	passwordValid: boolean
	minPasswordLength: number

	// Invite
	inviteInfo: InviteInfo | null
	isVerifyingInvite: boolean

	// UI state
	isLoading: boolean
	loadingProvider: OAuthProvider | null
	error: string | null
	clearError: () => void

	// Handlers
	handleSubmit: (e?: React.FormEvent) => Promise<void>
	handleVerifyEmail: (e?: React.FormEvent) => Promise<void>
	handleJoinWaitlist: (e?: React.FormEvent) => Promise<void>
	handleOAuthSignUp: (provider: OAuthProvider) => void

	// Config (for UI)
	providers: OAuthProvider[]
	afterSignUpUrl: string
	additionalFields: AdditionalField[]
	showInviteCode: boolean
	requireInviteCode: boolean
	isWaitlistMode: boolean
	waitlistUrl?: string
}

// ============================================
// Hook Implementation
// ============================================

export function useSignUpForm(options: UseSignUpFormOptions = {}): UseSignUpFormReturn {
	const {
		providers = [],
		afterSignUpUrl = '/dashboard',
		minPasswordLength = 12, // NIST SP 800-63B (2023) recommends 12+ chars
		inviteCode: initialInviteCode = '',
		showInviteCode = false,
		requireInviteCode = false,
		additionalFields = [],
		waitlistUrl,
		submitHandler,
		verifyEmailHandler,
		verifyInviteHandler,
		waitlistHandler,
		oauthHandler,
		onSuccess,
		onError,
	} = options

	// Get auth context (may be null if outside provider)
	const authContext = useContext(SdkAuthContext) as SdkAuthContextValue | null

	// Multi-step state
	const [step, setStep] = useState<SignUpStep>('form')

	// Form state
	const [form, setForm] = useState<SignUpFormState>({
		name: '',
		email: '',
		password: '',
		inviteCode: initialInviteCode,
		verificationCode: '',
	})

	// Invite state
	const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
	const [isVerifyingInvite, setIsVerifyingInvite] = useState(!!initialInviteCode)

	// UI state
	const [isLoading, setIsLoading] = useState(false)
	const [loadingProvider, setLoadingProvider] = useState<OAuthProvider | null>(null)
	const [error, setError] = useState<string | null>(null)

	// Derived
	const isWaitlistMode = !!waitlistUrl
	const passwordValid = useMemo(() => form.password.length >= minPasswordLength, [form.password, minPasswordLength])

	// Verify invite code on mount
	useEffect(() => {
		async function verifyInvite() {
			if (!initialInviteCode) {
				setIsVerifyingInvite(false)
				return
			}

			try {
				if (verifyInviteHandler) {
					const info = await verifyInviteHandler(initialInviteCode)
					if (info.valid) {
						setInviteInfo(info)
						if (info.email) {
							setForm((prev) => ({ ...prev, email: info.email! }))
						}
					}
				}
				// If no verifyInviteHandler, skip invite verification
			} catch {
				// Ignore - just proceed without invite validation
			} finally {
				setIsVerifyingInvite(false)
			}
		}

		verifyInvite()
	}, [initialInviteCode, verifyInviteHandler])

	// Form setters
	const setName = useCallback((name: string) => {
		setForm((prev) => ({ ...prev, name }))
		setError(null)
	}, [])

	const setEmail = useCallback((email: string) => {
		setForm((prev) => ({ ...prev, email }))
		setError(null)
	}, [])

	const setPassword = useCallback((password: string) => {
		setForm((prev) => ({ ...prev, password }))
		setError(null)
	}, [])

	const setInviteCode = useCallback((inviteCode: string) => {
		setForm((prev) => ({ ...prev, inviteCode }))
		setError(null)
	}, [])

	const setVerificationCode = useCallback((verificationCode: string) => {
		setForm((prev) => ({ ...prev, verificationCode }))
		setError(null)
	}, [])

	const setField = useCallback((name: string, value: string) => {
		setForm((prev) => ({ ...prev, [name]: value }))
		setError(null)
	}, [])

	const resetForm = useCallback(() => {
		setForm({
			name: '',
			email: '',
			password: '',
			inviteCode: initialInviteCode,
			verificationCode: '',
		})
		setError(null)
		setStep('form')
	}, [initialInviteCode])

	const clearError = useCallback(() => {
		setError(null)
	}, [])

	// Handle form submission
	const handleSubmit = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()

			// Validate invite code if required
			if (requireInviteCode && !form.inviteCode && !inviteInfo?.valid) {
				setError('Invite code is required')
				return
			}

			// Validate password
			if (!passwordValid) {
				setError(`Password must be at least ${minPasswordLength} characters`)
				return
			}

			setIsLoading(true)
			setError(null)

			try {
				let result: SignUpSubmitResult | void

				if (submitHandler) {
					result = await submitHandler(form)
				} else {
					// Use auth context (SDK mode)
					if (!authContext) {
						setError('SDK not configured. Please wrap your app with SylphxProvider.')
						return
					}

					const registerResult = await authContext.register(form.name, form.email, form.password)
					result = {
						requiresVerification: registerResult.requiresVerification,
					}
				}

				// Check if email verification is required
				if (result?.requiresVerification) {
					setStep('verify-email')
					return
				}

				// Auth cookies are set server-side by the API
				// Just complete and redirect

				setStep('complete')
				onSuccess?.()

				// Use safeRedirect to prevent XSS via malicious afterSignUpUrl
				safeRedirect(afterSignUpUrl, { fallback: '/dashboard' })
			} catch (err) {
				// Distinguish between network errors and auth errors
				let message: string
				if (err instanceof TypeError && err.message === 'Failed to fetch') {
					message = 'Unable to connect. Please check your internet connection and try again.'
				} else if (err instanceof Error) {
					message = err.message
				} else {
					message = 'Sign up failed'
				}
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[
			form,
			passwordValid,
			minPasswordLength,
			requireInviteCode,
			inviteInfo,
			submitHandler,
			authContext,
			afterSignUpUrl,
			onSuccess,
			onError,
		]
	)

	// Handle email verification
	const handleVerifyEmail = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()
			setIsLoading(true)
			setError(null)

			try {
				let result: SignUpSubmitResult | void

				if (verifyEmailHandler) {
					result = await verifyEmailHandler(form.email, form.verificationCode)
				} else {
					// Use auth context (SDK mode)
					if (!authContext) {
						setError('SDK not configured. Please wrap your app with SylphxProvider.')
						return
					}

					// verifyEmail uses the verification token
					// The verification code IS the token in this case
					await authContext.verifyEmail(form.verificationCode)
					result = {}
				}

				// Auth cookies are set server-side by the API
				// Just complete and redirect

				setStep('complete')
				onSuccess?.()

				// Use safeRedirect to prevent XSS via malicious afterSignUpUrl
				safeRedirect(afterSignUpUrl, { fallback: '/dashboard' })
			} catch (err) {
				// Distinguish between network errors and auth errors
				let message: string
				if (err instanceof TypeError && err.message === 'Failed to fetch') {
					message = 'Unable to connect. Please check your internet connection and try again.'
				} else if (err instanceof Error) {
					message = err.message
				} else {
					message = 'Verification failed'
				}
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[form.email, form.verificationCode, verifyEmailHandler, authContext, afterSignUpUrl, onSuccess, onError]
	)

	// Handle waitlist join
	const handleJoinWaitlist = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()
			setIsLoading(true)
			setError(null)

			try {
				if (waitlistHandler) {
					await waitlistHandler(form.email, form.name || undefined)
				} else {
					// Waitlist requires custom handler
					throw new Error('Waitlist join requires a custom waitlistHandler')
				}

				setStep('waitlist-joined')
				onSuccess?.()
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to join waitlist'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[form.email, form.name, waitlistHandler, onSuccess, onError]
	)

	// OAuth handler
	const handleOAuthSignUp = useCallback(
		(provider: OAuthProvider) => {
			setLoadingProvider(provider)
			setError(null)

			if (oauthHandler) {
				oauthHandler(provider).catch((err) => {
					setError(err instanceof Error ? err.message : 'OAuth sign up failed')
					setLoadingProvider(null)
				})
			} else {
				// OAuth requires redirect - this should be handled by the platform
				// SDK apps should configure oauthHandler or use <SignUp> component
				setError('OAuth sign-up requires a custom oauthHandler or use the SignUp component')
				setLoadingProvider(null)
			}
		},
		[oauthHandler]
	)

	return {
		// Form state
		form,
		setName,
		setEmail,
		setPassword,
		setInviteCode,
		setVerificationCode,
		setField,
		resetForm,

		// Multi-step
		step,
		setStep,

		// Validation
		passwordValid,
		minPasswordLength,

		// Invite
		inviteInfo,
		isVerifyingInvite,

		// UI state
		isLoading,
		loadingProvider,
		error,
		clearError,

		// Handlers
		handleSubmit,
		handleVerifyEmail,
		handleJoinWaitlist,
		handleOAuthSignUp,

		// Config
		providers,
		afterSignUpUrl,
		additionalFields,
		showInviteCode,
		requireInviteCode,
		isWaitlistMode,
		waitlistUrl,
	}
}
