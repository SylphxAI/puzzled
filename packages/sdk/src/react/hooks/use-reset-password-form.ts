/**
 * useResetPasswordForm Hook
 *
 * Headless hook for reset password form logic.
 *
 * @example
 * ```tsx
 * function MyResetPassword({ token }: { token: string }) {
 *   const reset = useResetPasswordForm({
 *     token,
 *     afterResetUrl: '/login',
 *   });
 *
 *   if (reset.success) return <SuccessMessage />;
 *
 *   return (
 *     <form onSubmit={reset.handleSubmit}>
 *       <input
 *         type={reset.showPassword ? 'text' : 'password'}
 *         value={reset.form.password}
 *         onChange={e => reset.setPassword(e.target.value)}
 *       />
 *       <button onClick={reset.toggleShowPassword}>Show</button>
 *       {!reset.passwordsMatch && <p>Passwords don't match</p>}
 *       <button disabled={reset.isLoading || !reset.isValid}>Reset</button>
 *     </form>
 *   );
 * }
 * ```
 */

'use client'

import { useState, useCallback, useMemo, useContext } from 'react'
import { SdkAuthContext, type SdkAuthContextValue } from '../services-context'
import { UI_COPY_FEEDBACK_MS } from '../../constants'

// ============================================
// Types
// ============================================

export interface ResetPasswordFormState {
	password: string
	confirmPassword: string
}

export interface UseResetPasswordFormOptions {
	/** Reset token from URL */
	token: string
	/** Minimum password length */
	minPasswordLength?: number
	/** URL to redirect after reset */
	afterResetUrl?: string
	/**
	 * Custom submit handler. If provided, replaces context-based auth.
	 * Throw error to indicate failure.
	 */
	submitHandler?: (token: string, newPassword: string) => Promise<void>
	/** Callback on success */
	onSuccess?: () => void
	/** Callback on error */
	onError?: (error: string) => void
}

export interface UseResetPasswordFormReturn {
	// Form state
	form: ResetPasswordFormState
	setPassword: (password: string) => void
	setConfirmPassword: (confirmPassword: string) => void
	resetForm: () => void

	// Password visibility
	showPassword: boolean
	toggleShowPassword: () => void

	// Validation
	passwordValid: boolean
	passwordsMatch: boolean
	isValid: boolean
	minPasswordLength: number

	// UI state
	isLoading: boolean
	error: string | null
	success: boolean
	clearError: () => void

	// Handlers
	handleSubmit: (e?: React.FormEvent) => Promise<void>

	// Config
	token: string
	afterResetUrl: string
}

// ============================================
// Hook Implementation
// ============================================

export function useResetPasswordForm(options: UseResetPasswordFormOptions): UseResetPasswordFormReturn {
	const {
		token,
		minPasswordLength = 12, // NIST SP 800-63B (2023) recommends 12+ chars
		afterResetUrl = '/login',
		submitHandler,
		onSuccess,
		onError,
	} = options

	// Get auth context (may be null if outside provider)
	const authContext = useContext(SdkAuthContext) as SdkAuthContextValue | null

	// Form state
	const [form, setForm] = useState<ResetPasswordFormState>({
		password: '',
		confirmPassword: '',
	})

	// UI state
	const [showPassword, setShowPassword] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)

	// Validation
	const passwordValid = useMemo(() => form.password.length >= minPasswordLength, [form.password, minPasswordLength])
	const passwordsMatch = useMemo(
		() => form.password === form.confirmPassword && form.confirmPassword.length > 0,
		[form.password, form.confirmPassword]
	)
	const isValid = useMemo(() => passwordValid && passwordsMatch, [passwordValid, passwordsMatch])

	// Form setters
	const setPassword = useCallback((password: string) => {
		setForm((prev) => ({ ...prev, password }))
		setError(null)
	}, [])

	const setConfirmPassword = useCallback((confirmPassword: string) => {
		setForm((prev) => ({ ...prev, confirmPassword }))
		setError(null)
	}, [])

	const resetForm = useCallback(() => {
		setForm({ password: '', confirmPassword: '' })
		setError(null)
		setSuccess(false)
	}, [])

	const clearError = useCallback(() => {
		setError(null)
	}, [])

	const toggleShowPassword = useCallback(() => {
		setShowPassword((prev) => !prev)
	}, [])

	// Submit handler
	const handleSubmit = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()

			// Validate
			if (!passwordsMatch) {
				setError('Passwords do not match')
				return
			}

			if (!passwordValid) {
				setError(`Password must be at least ${minPasswordLength} characters`)
				return
			}

			setIsLoading(true)
			setError(null)

			try {
				if (submitHandler) {
					await submitHandler(token, form.password)
				} else {
					// Use auth context (SDK mode)
					if (!authContext) {
						setError('SDK not configured. Please wrap your app with SylphxProvider.')
						return
					}

					await authContext.resetPassword(token, form.password)
				}

				setSuccess(true)
				onSuccess?.()

				// Redirect after short delay
				if (typeof window !== 'undefined') {
					setTimeout(() => {
						window.location.href = afterResetUrl
					}, UI_COPY_FEEDBACK_MS)
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to reset password'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[form, token, passwordValid, passwordsMatch, minPasswordLength, submitHandler, authContext, afterResetUrl, onSuccess, onError]
	)

	return {
		// Form state
		form,
		setPassword,
		setConfirmPassword,
		resetForm,

		// Password visibility
		showPassword,
		toggleShowPassword,

		// Validation
		passwordValid,
		passwordsMatch,
		isValid,
		minPasswordLength,

		// UI state
		isLoading,
		error,
		success,
		clearError,

		// Handlers
		handleSubmit,

		// Config
		token,
		afterResetUrl,
	}
}
