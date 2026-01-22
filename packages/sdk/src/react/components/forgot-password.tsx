/**
 * ForgotPassword Component
 *
 * Allows users to request a password reset email.
 * Matches Clerk's ForgotPassword component API.
 */

'use client'

import { useState, useCallback, useEffect, type FormEvent } from 'react'
import { useSafeAuth, useSafeUser } from '../hooks'
import { safeRedirect } from '../security-utils'
import {
	type ThemeVariables,
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from '../ui/styles'
import { Modal } from '../ui/modal'

export interface ForgotPasswordProps {
	/** URL to redirect after password reset email is sent */
	afterSubmitUrl?: string
	/** URL for sign in link */
	signInUrl?: string
	/** Display mode */
	mode?: 'redirect' | 'embedded' | 'modal'
	/** Theme variables */
	theme?: ThemeVariables
	/** Custom class name */
	className?: string
	/** Button content (for redirect/modal mode) */
	children?: React.ReactNode
	/** Called on successful submission */
	onSuccess?: () => void
	/** Called on error */
	onError?: (error: string) => void
	/** Show card wrapper (embedded mode) */
	showCard?: boolean
	/** Custom header content */
	header?: React.ReactNode
}

/**
 * ForgotPassword component for requesting password reset emails
 *
 * @example
 * ```tsx
 * // Embedded mode
 * <ForgotPassword mode="embedded" afterSubmitUrl="/check-email" />
 *
 * // Modal mode
 * <ForgotPassword mode="modal">
 *   Forgot password?
 * </ForgotPassword>
 * ```
 */
export function ForgotPassword({
	afterSubmitUrl = '/check-email',
	signInUrl = '/sign-in',
	mode = 'embedded',
	theme = defaultTheme,
	className,
	children,
	onSuccess,
	onError,
	showCard = true,
	header,
}: ForgotPasswordProps) {
	const { forgotPassword, isConfigured: authConfigured } = useSafeAuth()
	const { isSignedIn, isLoaded, isConfigured: userConfigured } = useSafeUser()
	const styles = baseStyles(theme)

	const [modalOpen, setModalOpen] = useState(false)
	const [email, setEmail] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [isSubmitted, setIsSubmitted] = useState(false)
	const [focusedField, setFocusedField] = useState<string | null>(null)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Don't render during SSR when SDK is not configured
	if (!authConfigured || !userConfigured) {
		return null
	}

	// Don't show if already signed in
	if (isLoaded && isSignedIn) {
		return null
	}

	const handleSubmit = useCallback(
		async (e: FormEvent) => {
			e.preventDefault()
			setIsLoading(true)
			setError(null)

			try {
				if (!forgotPassword) {
					throw new Error('Authentication not configured')
				}
				await forgotPassword({ email })
				setIsSubmitted(true)
				onSuccess?.()

				// Redirect after short delay
				if (afterSubmitUrl && typeof window !== 'undefined') {
					setTimeout(() => {
						safeRedirect(afterSubmitUrl, { fallback: '/sign-in' })
					}, 2000)
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to send reset email'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[email, forgotPassword, afterSubmitUrl, onSuccess, onError]
	)

	const renderForm = () => {
		if (isSubmitted) {
			return (
				<div style={styles.textCenter}>
					<div
						style={mergeStyles(styles.flexCenter, {
							width: '3rem',
							height: '3rem',
							borderRadius: '50%',
							backgroundColor: `${theme.colorSuccess}15`,
							margin: '0 auto 1rem',
						})}
					>
						<MailIcon color={theme.colorSuccess} />
					</div>
					<h3 style={mergeStyles(styles.cardTitle, styles.mb2)}>Check your email</h3>
					<p style={mergeStyles(styles.textMuted, styles.textSm, styles.mb4)}>
						We sent a password reset link to <strong>{email}</strong>
					</p>
					<p style={mergeStyles(styles.textXs, styles.textMuted)}>
						Didn't receive it? Check spam or{' '}
						<button
							type="button"
							onClick={() => setIsSubmitted(false)}
							style={styles.link}
						>
							try again
						</button>
					</p>
				</div>
			)
		}

		return (
			<form onSubmit={handleSubmit}>
				<div style={styles.formGroup}>
					<label style={styles.label}>Email address</label>
					<input
						type="email"
						value={email}
						onChange={(e) => {
							setEmail(e.target.value)
							setError(null)
						}}
						onFocus={() => setFocusedField('email')}
						onBlur={() => setFocusedField(null)}
						placeholder="you@example.com"
						disabled={isLoading}
						autoComplete="email"
						required
						style={mergeStyles(
							styles.input,
							focusedField === 'email' ? styles.inputFocus : {},
							isLoading ? styles.inputDisabled : {}
						)}
					/>
				</div>

				{error && (
					<div style={mergeStyles(styles.alert, styles.alertError)}>{error}</div>
				)}

				<button
					type="submit"
					disabled={isLoading}
					style={mergeStyles(
						styles.button,
						styles.buttonPrimary,
						styles.buttonFullWidth,
						isLoading ? styles.buttonDisabled : {}
					)}
				>
					{isLoading ? (
						<>
							<span style={styles.spinner} />
							Sending...
						</>
					) : (
						'Send reset link'
					)}
				</button>

				<p style={mergeStyles(styles.textCenter, styles.textSm, styles.textMuted, styles.mt4)}>
					Remember your password?{' '}
					<a href={signInUrl} style={styles.link}>
						Sign in
					</a>
				</p>
			</form>
		)
	}

	const content = (
		<div style={styles.container}>
			{header || (
				<div style={mergeStyles(styles.cardHeader, styles.textCenter)}>
					<h2 style={styles.cardTitle}>Forgot password?</h2>
					<p style={styles.cardDescription}>
						Enter your email and we'll send you a reset link
					</p>
				</div>
			)}
			<div style={styles.cardContent}>{renderForm()}</div>
		</div>
	)

	// Embedded mode
	if (mode === 'embedded') {
		if (showCard) {
			return <div style={styles.card}>{content}</div>
		}
		return content
	}

	// Modal mode
	if (mode === 'modal') {
		const defaultStyles: React.CSSProperties = {
			background: 'none',
			border: 'none',
			padding: 0,
			cursor: 'pointer',
			color: theme.colorPrimary,
			fontSize: theme.fontSizeSm,
			textDecoration: 'underline',
		}

		return (
			<>
				<button
					onClick={() => setModalOpen(true)}
					className={className}
					style={className ? undefined : defaultStyles}
					type="button"
				>
					{children || 'Forgot password?'}
				</button>
				<Modal open={modalOpen} onClose={() => setModalOpen(false)} theme={theme}>
					{content}
				</Modal>
			</>
		)
	}

	return null
}

function MailIcon({ color }: { color: string }) {
	return (
		<svg
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect width="20" height="16" x="2" y="4" rx="2" />
			<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
		</svg>
	)
}
