/**
 * Unsubscribe Confirm Component
 *
 * Standalone unsubscribe page component with confirmation flow.
 * Self-contained with CSS-in-JS styles.
 */

'use client'

import { useState, useEffect } from 'react'
import type { ThemeVariables } from './styles'
import { safeRedirect } from '../security-utils'
import {
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from './styles'
import { useNewsletter } from '../newsletter-hooks'
import { UI_REDIRECT_DELAY_MS } from '../../constants'

export interface UnsubscribeConfirmProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Email address from URL token */
	email: string
	/** Unsubscribe token from URL */
	token?: string
	/** Called on successful unsubscribe */
	onSuccess?: () => void
	/** Called on error */
	onError?: (error: string) => void
	/** Custom class name */
	className?: string
	/** Page title */
	title?: string
	/** Confirmation message */
	confirmMessage?: string
	/** Success message */
	successMessage?: string
	/** Show resubscribe option */
	showResubscribe?: boolean
	/** Show reason selector */
	showReasonSelector?: boolean
	/** Custom unsubscribe reasons */
	reasons?: Array<{ id: string; label: string }>
	/** Redirect URL after unsubscribe */
	redirectUrl?: string
	/** Redirect delay in ms */
	redirectDelay?: number
}

const DEFAULT_REASONS = [
	{ id: 'too_many', label: 'Too many emails' },
	{ id: 'not_relevant', label: 'Content not relevant to me' },
	{ id: 'never_signed_up', label: 'I never signed up' },
	{ id: 'other', label: 'Other reason' },
]

/**
 * Unsubscribe confirmation page
 *
 * @example
 * ```tsx
 * // In your /unsubscribe page
 * export default function UnsubscribePage({ searchParams }) {
 *   return (
 *     <UnsubscribeConfirm
 *       email={searchParams.email}
 *       token={searchParams.token}
 *       showReasonSelector
 *       redirectUrl="/"
 *     />
 *   )
 * }
 * ```
 */
export function UnsubscribeConfirm({
	theme = defaultTheme,
	email,
	token,
	onSuccess,
	onError,
	className,
	title = 'Unsubscribe',
	confirmMessage = 'Are you sure you want to unsubscribe from our newsletter?',
	successMessage = 'You have been successfully unsubscribed.',
	showResubscribe = true,
	showReasonSelector = false,
	reasons = DEFAULT_REASONS,
	redirectUrl,
	redirectDelay = UI_REDIRECT_DELAY_MS,
}: UnsubscribeConfirmProps) {
	const { unsubscribe, subscribe } = useNewsletter()
	const styles = baseStyles(theme)

	const [status, setStatus] = useState<'pending' | 'processing' | 'success' | 'error' | 'resubscribed' | 'missing_token'>(() =>
		token ? 'pending' : 'missing_token'
	)
	const [selectedReason, setSelectedReason] = useState<string>('')
	const [error, setError] = useState<string | null>(null)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Handle redirect after success
	useEffect(() => {
		if (status === 'success' && redirectUrl) {
			const timer = setTimeout(() => {
				safeRedirect(redirectUrl, { fallback: '/' })
			}, redirectDelay)
			return () => clearTimeout(timer)
		}
	}, [status, redirectUrl, redirectDelay])

	const handleUnsubscribe = async () => {
		if (!token) {
			setError('Missing unsubscribe token')
			setStatus('missing_token')
			return
		}

		setStatus('processing')
		setError(null)

		try {
			await unsubscribe(email, token)
			setStatus('success')
			onSuccess?.()
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to unsubscribe'
			setError(message)
			setStatus('error')
			onError?.(message)
		}
	}

	const handleResubscribe = async () => {
		setStatus('processing')
		setError(null)

		try {
			await subscribe({ email })
			setStatus('resubscribed')
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to resubscribe'
			setError(message)
			setStatus('error')
		}
	}

	const renderContent = () => {
		switch (status) {
			case 'pending':
				return (
					<>
						<div style={{ color: theme.colorWarning }}>
							<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
								<circle cx="12" cy="12" r="10" />
								<line x1="12" y1="8" x2="12" y2="12" />
								<line x1="12" y1="16" x2="12.01" y2="16" />
							</svg>
						</div>
						<p style={{ marginTop: '1rem', marginBottom: '1.5rem', fontSize: theme.fontSizeBase }}>
							{confirmMessage}
						</p>
						<p style={mergeStyles(styles.textSm, styles.textMuted, { marginBottom: '1.5rem' })}>
							Email: <strong>{email}</strong>
						</p>

						{showReasonSelector && (
							<div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
								<label style={mergeStyles(styles.label, { marginBottom: '0.5rem', display: 'block' })}>
									Why are you unsubscribing? (Optional)
								</label>
								<select
									value={selectedReason}
									onChange={(e) => setSelectedReason(e.target.value)}
									style={styles.input}
								>
									<option value="">Select a reason...</option>
									{reasons.map((reason) => (
										<option key={reason.id} value={reason.id}>
											{reason.label}
										</option>
									))}
								</select>
							</div>
						)}

						<div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
							<button
								type="button"
								onClick={handleUnsubscribe}
								style={mergeStyles(styles.button, styles.buttonDestructive)}
							>
								Unsubscribe
							</button>
							{redirectUrl && (
								<a
									href={redirectUrl}
									style={mergeStyles(styles.button, styles.buttonSecondary, { textDecoration: 'none' })}
								>
									Cancel
								</a>
							)}
						</div>
					</>
				)

			case 'processing':
				return (
					<div style={{ textAlign: 'center', padding: '2rem' }}>
						<span style={styles.spinner} />
						<p style={{ marginTop: '1rem', fontSize: theme.fontSizeBase }}>Processing...</p>
					</div>
				)

			case 'success':
				return (
					<>
						<div style={{ color: theme.colorSuccess }}>
							<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
								<polyline points="22 4 12 14.01 9 11.01" />
							</svg>
						</div>
						<p style={{ marginTop: '1rem', color: theme.colorSuccess, fontSize: theme.fontSizeBase }}>
							{successMessage}
						</p>

						{showResubscribe && (
							<div style={{ marginTop: '1.5rem' }}>
								<p style={mergeStyles(styles.textSm, styles.textMuted)}>Changed your mind?</p>
								<button
									type="button"
									onClick={handleResubscribe}
									style={mergeStyles(styles.button, styles.buttonSecondary, { marginTop: '0.5rem' })}
								>
									Resubscribe
								</button>
							</div>
						)}

						{redirectUrl && (
							<p style={mergeStyles(styles.textSm, styles.textMuted, { marginTop: '1.5rem' })}>
								Redirecting in {Math.ceil(redirectDelay / 1000)} seconds...
							</p>
						)}
					</>
				)

			case 'resubscribed':
				return (
					<>
						<div style={{ color: theme.colorSuccess }}>
							<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
								<polyline points="22 4 12 14.01 9 11.01" />
							</svg>
						</div>
						<p style={{ marginTop: '1rem', color: theme.colorSuccess, fontSize: theme.fontSizeBase }}>
							Welcome back! You have been resubscribed.
						</p>
						{redirectUrl && (
							<a
								href={redirectUrl}
								style={mergeStyles(styles.button, styles.buttonPrimary, { marginTop: '1.5rem', display: 'inline-block', textDecoration: 'none' })}
							>
								Continue
							</a>
						)}
					</>
				)

			case 'error':
				return (
					<>
						<div style={{ color: theme.colorDestructive }}>
							<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
								<circle cx="12" cy="12" r="10" />
								<line x1="15" y1="9" x2="9" y2="15" />
								<line x1="9" y1="9" x2="15" y2="15" />
							</svg>
						</div>
						<p style={{ marginTop: '1rem', color: theme.colorDestructive, fontSize: theme.fontSizeBase }}>
							{error || 'Something went wrong'}
						</p>
						<button
							type="button"
							onClick={() => setStatus('pending')}
							style={mergeStyles(styles.button, styles.buttonSecondary, { marginTop: '1.5rem' })}
						>
							Try Again
						</button>
					</>
				)

			case 'missing_token':
				return (
					<>
						<div style={{ color: theme.colorDestructive }}>
							<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
								<circle cx="12" cy="12" r="10" />
								<line x1="15" y1="9" x2="9" y2="15" />
								<line x1="9" y1="9" x2="15" y2="15" />
							</svg>
						</div>
						<p style={{ marginTop: '1rem', color: theme.colorDestructive, fontSize: theme.fontSizeBase }}>
							Invalid unsubscribe link
						</p>
						<p style={mergeStyles(styles.textSm, styles.textMuted, { marginTop: '0.5rem' })}>
							The unsubscribe link is missing or expired. Please use the link from your email.
						</p>
						{redirectUrl && (
							<a
								href={redirectUrl}
								style={mergeStyles(styles.button, styles.buttonSecondary, { marginTop: '1.5rem', display: 'inline-block', textDecoration: 'none' })}
							>
								Go Back
							</a>
						)}
					</>
				)
		}
	}

	return (
		<div
			className={className}
			style={mergeStyles(styles.card, {
				maxWidth: '480px',
				margin: '0 auto',
				textAlign: 'center' as const,
				padding: '2rem',
			})}
		>
			<h2 style={styles.cardTitle}>{title}</h2>
			{renderContent()}
		</div>
	)
}
