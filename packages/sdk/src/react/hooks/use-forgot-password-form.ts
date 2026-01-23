/**
 * useForgotPasswordForm Hook
 *
 * Headless hook for forgot password form logic.
 *
 * @example
 * ```tsx
 * function MyForgotPassword() {
 *   const forgot = useForgotPasswordForm({
 *     redirectTo: '/reset-password',
 *   });
 *
 *   if (forgot.success) return <SuccessMessage email={forgot.form.email} />;
 *
 *   return (
 *     <form onSubmit={forgot.handleSubmit}>
 *       <input value={forgot.form.email} onChange={e => forgot.setEmail(e.target.value)} />
 *       <button disabled={forgot.isLoading}>Send reset link</button>
 *     </form>
 *   );
 * }
 * ```
 */

'use client'

import { useState, useCallback, useContext } from 'react'
import { SdkAuthContext, type SdkAuthContextValue } from '../services-context'

// ============================================
// Types
// ============================================

export interface ForgotPasswordFormState {
	email: string
}

export interface UseForgotPasswordFormOptions {
	/** URL to redirect to in reset email */
	redirectTo?: string
	/**
	 * Custom submit handler. If provided, replaces context-based auth.
	 * Should NOT throw on success (even for non-existent emails - security).
	 */
	submitHandler?: (email: string, redirectTo: string) => Promise<void>
	/** Callback on success */
	onSuccess?: () => void
	/** Callback on error */
	onError?: (error: string) => void
}

export interface UseForgotPasswordFormReturn {
	// Form state
	form: ForgotPasswordFormState
	setEmail: (email: string) => void
	resetForm: () => void

	// UI state
	isLoading: boolean
	error: string | null
	success: boolean
	clearError: () => void

	// Handlers
	handleSubmit: (e?: React.FormEvent) => Promise<void>

	// Config
	redirectTo: string
}

// ============================================
// Hook Implementation
// ============================================

export function useForgotPasswordForm(options: UseForgotPasswordFormOptions = {}): UseForgotPasswordFormReturn {
	const {
		redirectTo = '/reset-password',
		submitHandler,
		onSuccess,
		onError,
	} = options

	// Get auth context (may be null if outside provider)
	const authContext = useContext(SdkAuthContext) as SdkAuthContextValue | null

	// Form state
	const [form, setForm] = useState<ForgotPasswordFormState>({ email: '' })

	// UI state
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)

	// Form setters
	const setEmail = useCallback((email: string) => {
		setForm({ email })
		setError(null)
	}, [])

	const resetForm = useCallback(() => {
		setForm({ email: '' })
		setError(null)
		setSuccess(false)
	}, [])

	const clearError = useCallback(() => {
		setError(null)
	}, [])

	// Submit handler
	const handleSubmit = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()
			setIsLoading(true)
			setError(null)

			try {
				if (submitHandler) {
					await submitHandler(form.email, redirectTo)
				} else {
					// Use auth context (SDK mode)
					if (!authContext) {
						setError('SDK not configured. Please wrap your app with SylphxProvider.')
						return
					}

					await authContext.forgotPassword(form.email)
				}

				setSuccess(true)
				onSuccess?.()
			} catch (err) {
				// Still show success to prevent email enumeration
				// But call onError for logging purposes
				setSuccess(true)
				const message = err instanceof Error ? err.message : 'Request failed'
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[form.email, redirectTo, submitHandler, authContext, onSuccess, onError]
	)

	return {
		// Form state
		form,
		setEmail,
		resetForm,

		// UI state
		isLoading,
		error,
		success,
		clearError,

		// Handlers
		handleSubmit,

		// Config
		redirectTo,
	}
}
