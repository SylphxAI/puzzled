/**
 * Email Hooks
 *
 * React hooks for Sylphx Platform transactional email service.
 * Send emails, use templates, and send to users.
 */

'use client'

import { useCallback, useState } from 'react'
import {
	useEmailContext,
	type EmailStatus,
	type SimpleEmailOptions,
	type EmailTemplateName,
} from './services-context'

// Re-export types for convenience


// ============================================
// useEmail
// ============================================

export interface UseEmailReturn {
	/** Send an email */
	send: (options: SimpleEmailOptions) => Promise<{ success: boolean; id?: string }>
	/** Send a templated email */
	sendTemplated: (options: { template: EmailTemplateName; to: string; data?: Record<string, unknown> }) => Promise<{ success: boolean; template: string }>
	/** Send email to a user by ID */
	sendToUser: (options: { userId: string; subject: string; html: string; text?: string }) => Promise<{ success: boolean; id?: string }>
	/** Whether an operation is in progress */
	isLoading: boolean
	/** Whether the last send was successful */
	isSuccess: boolean
	/** Last error */
	error: Error | null
	/** Reset state */
	reset: () => void
}

/**
 * Hook for sending transactional emails
 *
 * @example
 * ```tsx
 * function SendEmailButton() {
 *   const { send, isLoading, isSuccess, error } = useEmail()
 *
 *   const handleSend = async () => {
 *     await send({
 *       to: 'user@example.com',
 *       subject: 'Welcome!',
 *       html: '<h1>Welcome to our app</h1>',
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleSend} disabled={isLoading}>
 *         {isLoading ? 'Sending...' : 'Send Email'}
 *       </button>
 *       {isSuccess && <p>Email sent!</p>}
 *       {error && <p className="error">{error.message}</p>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useEmail(): UseEmailReturn {
	const ctx = useEmailContext()
	const [isLoading, setIsLoading] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)
	const [error, setError] = useState<Error | null>(null)

	const reset = useCallback(() => {
		setIsSuccess(false)
		setError(null)
	}, [])

	const send = useCallback(
		async (options: SimpleEmailOptions): Promise<{ success: boolean; id?: string }> => {
			setIsLoading(true)
			setError(null)
			setIsSuccess(false)

			try {
				const result = await ctx.send(options)
				setIsSuccess(result.success)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to send email')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const sendTemplated = useCallback(
		async (options: { template: EmailTemplateName; to: string; data?: Record<string, unknown> }): Promise<{ success: boolean; template: string }> => {
			setIsLoading(true)
			setError(null)
			setIsSuccess(false)

			try {
				const result = await ctx.sendTemplated(options)
				setIsSuccess(result.success)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to send templated email')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	const sendToUser = useCallback(
		async (options: { userId: string; subject: string; html: string; text?: string }): Promise<{ success: boolean; id?: string }> => {
			setIsLoading(true)
			setError(null)
			setIsSuccess(false)

			try {
				const result = await ctx.sendToUser(options)
				setIsSuccess(result.success)
				return result
			} catch (err) {
				const error = err instanceof Error ? err : new Error('Failed to send email to user')
				setError(error)
				throw error
			} finally {
				setIsLoading(false)
			}
		},
		[ctx]
	)

	return {
		send,
		sendTemplated,
		sendToUser,
		isLoading,
		isSuccess,
		error,
		reset,
	}
}
