/**
 * Newsletter Hooks (Part of Email Service)
 *
 * React hooks for Sylphx Platform marketing email (newsletter).
 * Newsletter is a sub-feature of the Email service for marketing/bulk emails.
 * Subscribe users and manage preferences.
 *
 * @see useEmail for transactional emails
 */

'use client'

import { useCallback, useState } from 'react'
import {
	useNewsletterContext,
	type SubscriberStatus,
	type Subscriber,
} from './services-context'
import type { NewsletterSubscribeInput, NewsletterSubscribeResult } from '../types'

// Re-export types for convenience
export type { SubscriberStatus, Subscriber, NewsletterSubscribeInput, NewsletterSubscribeResult }

// ============================================
// useNewsletter
// ============================================

import type { SubscriberPreferenceKey } from './services-context'

export interface UseNewsletterReturn {
	/** Subscribe an email to the newsletter */
	subscribe: (options: NewsletterSubscribeInput) => Promise<NewsletterSubscribeResult>
	/** Verify a subscription with token */
	verify: (token: string) => Promise<{ success: boolean; message: string; email: string }>
	/** Unsubscribe an email (requires token) */
	unsubscribe: (
		email: string,
		token: string
	) => Promise<{ success: boolean; message: string; email: string }>
	/** Resend verification email */
	resendVerification: (email: string) => Promise<{ success: boolean; message: string }>
	/** Get unsubscribe info from token */
	getUnsubscribeInfo: (token: string) => Promise<{ email: string; name?: string; isUnsubscribed: boolean }>
	/** Update subscriber preferences */
	updatePreferences: (
		email: string,
		preferences: Record<string, boolean>
	) => Promise<{ success: boolean; preferences: Array<{ key: SubscriberPreferenceKey; enabled: boolean }> }>
	/** Get subscriber preferences */
	getPreferences: (email: string) => Promise<Record<string, boolean>>
	/** Whether an operation is in progress */
	isLoading: boolean
	/** Whether the last operation was successful */
	success: boolean
	/** Last error */
	error: Error | null
	/** Reset success/error state */
	reset: () => void
}

/**
 * Hook for newsletter subscriber management
 *
 * @example
 * ```tsx
 * function NewsletterSignup() {
 *   const { subscribe, isLoading, success, error } = useNewsletter()
 *   const [email, setEmail] = useState('')
 *
 *   const handleSubmit = async (e: React.FormEvent) => {
 *     e.preventDefault()
 *     const result = await subscribe({
 *       email,
 *       preferences: { product_updates: true },
 *       source: 'website',
 *     })
 *     if (result.requiresVerification) {
 *       alert('Check your email to confirm!')
 *     }
 *   }
 *
 *   if (success) {
 *     return <p>Check your email to confirm!</p>
 *   }
 *
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input
 *         type="email"
 *         value={email}
 *         onChange={(e) => setEmail(e.target.value)}
 *         placeholder="Enter your email"
 *       />
 *       <button type="submit" disabled={isLoading}>
 *         {isLoading ? 'Subscribing...' : 'Subscribe'}
 *       </button>
 *       {error && <p className="error">{error.message}</p>}
 *     </form>
 *   )
 * }
 * ```
 */
export function useNewsletter(): UseNewsletterReturn {
	const ctx = useNewsletterContext()
	const [isLoading, setIsLoading] = useState(false)
	const [success, setSuccess] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const reset = useCallback(() => {
		setSuccess(false)
		setError(null)
	}, [])

	const subscribe = useCallback(
		async (options: NewsletterSubscribeInput): Promise<NewsletterSubscribeResult> => {
			setIsLoading(true)
			setError(null)
			setSuccess(false)

			try {
				const result = await ctx.subscribe(options)
				setSuccess(true)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to subscribe')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const verify = useCallback(
		async (token: string) => {
			setIsLoading(true)
			setError(null)

			try {
				const result = await ctx.verify(token)
				setSuccess(true)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to verify')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const unsubscribe = useCallback(
		async (email: string, token: string) => {
			setIsLoading(true)
			setError(null)

			try {
				const result = await ctx.unsubscribe(email, token)
				setSuccess(true)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to unsubscribe')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const resendVerification = useCallback(
		async (email: string) => {
			setIsLoading(true)
			setError(null)

			try {
				const result = await ctx.resendVerification(email)
				setSuccess(true)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to resend verification')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const getUnsubscribeInfo = useCallback(
		async (token: string) => {
			try {
				return await ctx.getUnsubscribeInfo(token)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to get unsubscribe info')
				setError(error)
				throw error
			}
		},
		[ctx]
	)

	const updatePreferences = useCallback(
		async (email: string, preferences: Record<string, boolean>) => {
			setIsLoading(true)
			setError(null)

			try {
				const result = await ctx.updatePreferences(email, preferences)
				setSuccess(true)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to update preferences')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const getPreferences = useCallback(
		async (email: string) => {
			try {
				return await ctx.getPreferences(email)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to get preferences')
				setError(error)
				throw error
			}
		},
		[ctx]
	)

	return {
		subscribe,
		verify,
		unsubscribe,
		resendVerification,
		getUnsubscribeInfo,
		updatePreferences,
		getPreferences,
		isLoading,
		success,
		error,
		reset,
	}
}

// ============================================
// useSubscriberForm
// ============================================

export interface UseSubscriberFormOptions {
	/** Pre-selected preferences */
	preferences?: Record<string, boolean>
	/** Source identifier */
	source?: 'website' | 'waitlist' | 'referral' | 'api' | 'import'
	/** Subscriber name */
	name?: string
	/** Additional metadata */
	metadata?: Record<string, unknown>
	/** Callback on successful subscription */
	onSuccess?: (result: NewsletterSubscribeResult) => void
	/** Callback on error */
	onError?: (error: Error) => void
}

export interface UseSubscriberFormReturn {
	/** Current email value */
	email: string
	/** Set email value */
	setEmail: (email: string) => void
	/** Current preferences */
	preferences: Record<string, boolean>
	/** Toggle a preference */
	togglePreference: (pref: string) => void
	/** Set a preference */
	setPreference: (pref: string, value: boolean) => void
	/** Submit the form */
	submit: (e?: React.FormEvent) => Promise<void>
	/** Whether submission is in progress */
	isLoading: boolean
	/** Whether submission was successful */
	success: boolean
	/** Whether verification is required */
	requiresVerification: boolean
	/** Whether user was already subscribed */
	alreadySubscribed: boolean
	/** Last error */
	error: Error | null
	/** Reset the form */
	reset: () => void
}

/**
 * Hook for newsletter signup form state management
 *
 * @example
 * ```tsx
 * function NewsletterForm() {
 *   const {
 *     email,
 *     setEmail,
 *     preferences,
 *     togglePreference,
 *     submit,
 *     isLoading,
 *     success,
 *     requiresVerification,
 *     error,
 *   } = useSubscriberForm({
 *     preferences: { product_updates: true },
 *     source: 'website',
 *     onSuccess: (result) => {
 *       if (result.requiresVerification) {
 *         toast('Check your email!')
 *       }
 *     },
 *   })
 *
 *   if (success) {
 *     return <p>Thanks for subscribing!</p>
 *   }
 *
 *   return (
 *     <form onSubmit={submit}>
 *       <input
 *         type="email"
 *         value={email}
 *         onChange={(e) => setEmail(e.target.value)}
 *       />
 *       <label>
 *         <input
 *           type="checkbox"
 *           checked={preferences.promotions ?? false}
 *           onChange={() => togglePreference('promotions')}
 *         />
 *         Promotions
 *       </label>
 *       <button type="submit" disabled={isLoading}>
 *         Subscribe
 *       </button>
 *       {error && <p className="error">{error.message}</p>}
 *     </form>
 *   )
 * }
 * ```
 */
export function useSubscriberForm(options: UseSubscriberFormOptions = {}): UseSubscriberFormReturn {
	const ctx = useNewsletterContext()
	const [email, setEmail] = useState('')
	const [preferences, setPreferences] = useState<Record<string, boolean>>(
		options.preferences || {}
	)
	const [isLoading, setIsLoading] = useState(false)
	const [success, setSuccess] = useState(false)
	const [requiresVerification, setRequiresVerification] = useState(false)
	const [alreadySubscribed, setAlreadySubscribed] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const togglePreference = useCallback((pref: string) => {
		setPreferences((prev) => ({ ...prev, [pref]: !prev[pref] }))
	}, [])

	const setPreference = useCallback((pref: string, value: boolean) => {
		setPreferences((prev) => ({ ...prev, [pref]: value }))
	}, [])

	const reset = useCallback(() => {
		setEmail('')
		setPreferences(options.preferences || {})
		setSuccess(false)
		setRequiresVerification(false)
		setAlreadySubscribed(false)
		setError(null)
	}, [options.preferences])

	const submit = useCallback(
		async (e?: React.FormEvent) => {
			e?.preventDefault()

			if (!email) {
				setError(new Error('Email is required'))
				return
			}

			setIsLoading(true)
			setError(null)

			try {
				const result = await ctx.subscribe({
					email,
					preferences,
					source: options.source,
					name: options.name,
					metadata: options.metadata,
				})
				setSuccess(result.success)
				setRequiresVerification(result.requiresVerification)
				setAlreadySubscribed(result.alreadySubscribed ?? false)
				options.onSuccess?.(result)
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to subscribe')
				setError(error)
				options.onError?.(error)
			} finally {
				setIsLoading(false)
			}
		},
		[ctx, email, preferences, options]
	)

	return {
		email,
		setEmail,
		preferences,
		togglePreference,
		setPreference,
		submit,
		isLoading,
		success,
		requiresVerification,
		alreadySubscribed,
		error,
		reset,
	}
}
