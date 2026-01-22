/**
 * VerifyEmail Component
 *
 * Handles email verification with a code or token.
 * Matches Clerk's email verification flow.
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

export interface VerifyEmailProps {
	/** Verification token (if using link-based verification) */
	token?: string
	/** Email address being verified (for code-based verification) */
	email?: string
	/** URL to redirect after successful verification */
	afterVerifyUrl?: string
	/** Theme variables */
	theme?: ThemeVariables
	/** Called on successful verification */
	onSuccess?: () => void
	/** Called on error */
	onError?: (error: string) => void
	/** Show card wrapper */
	showCard?: boolean
	/** Custom header content */
	header?: React.ReactNode
}

/**
 * VerifyEmail component for email verification
 *
 * @example
 * ```tsx
 * // Token-based (from URL)
 * const searchParams = useSearchParams()
 * const token = searchParams.get('token')
 * <VerifyEmail token={token} afterVerifyUrl="/dashboard" />
 *
 * // Code-based (user enters code)
 * <VerifyEmail email="user@example.com" afterVerifyUrl="/dashboard" />
 * ```
 */
export function VerifyEmail({
	token,
	email,
	afterVerifyUrl = '/dashboard',
	theme = defaultTheme,
	onSuccess,
	onError,
	showCard = true,
	header,
}: VerifyEmailProps) {
	const { verifyEmail, resendVerificationEmail, isConfigured: authConfigured } = useSafeAuth()
	const { isSignedIn, isLoaded, isConfigured: userConfigured } = useSafeUser()
	const styles = baseStyles(theme)

	// Don't render during SSR when SDK is not configured
	if (!authConfigured || !userConfigured) {
		return null
	}

	const [code, setCode] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [isResending, setIsResending] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)
	const [autoVerified, setAutoVerified] = useState(false)
	const [focusedField, setFocusedField] = useState<string | null>(null)
	const [resendCooldown, setResendCooldown] = useState(0)

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Auto-verify if token is provided
	useEffect(() => {
		if (token && !autoVerified && !isSuccess) {
			setAutoVerified(true)
			handleVerifyToken()
		}
	}, [token])

	// Resend cooldown timer
	useEffect(() => {
		if (resendCooldown > 0) {
			const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
			return () => clearTimeout(timer)
		}
	}, [resendCooldown])

	const handleVerifyToken = useCallback(async () => {
		if (!token) return

		setIsLoading(true)
		setError(null)

		try {
			if (!verifyEmail) {
				throw new Error('Authentication not configured')
			}
			await verifyEmail({ token })
			setIsSuccess(true)
			onSuccess?.()

			// Redirect after short delay
			if (typeof window !== 'undefined') {
				setTimeout(() => {
					safeRedirect(afterVerifyUrl, { fallback: '/dashboard' })
				}, 2000)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Verification failed'
			setError(message)
			onError?.(message)
		} finally {
			setIsLoading(false)
		}
	}, [token, verifyEmail, afterVerifyUrl, onSuccess, onError])

	const handleSubmitCode = useCallback(
		async (e: FormEvent) => {
			e.preventDefault()
			if (!code) return

			setIsLoading(true)
			setError(null)

			try {
				if (!verifyEmail) {
					throw new Error('Authentication not configured')
				}
				// For code-based verification, we treat the code as the token
				await verifyEmail({ token: code })
				setIsSuccess(true)
				onSuccess?.()

				// Redirect after short delay
				if (typeof window !== 'undefined') {
					setTimeout(() => {
						safeRedirect(afterVerifyUrl, { fallback: '/dashboard' })
					}, 2000)
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Invalid verification code'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[code, verifyEmail, afterVerifyUrl, onSuccess, onError]
	)

	const handleResend = useCallback(async () => {
		if (!email || resendCooldown > 0) return

		setIsResending(true)
		setError(null)

		try {
			if (!resendVerificationEmail) {
				throw new Error('Authentication not configured')
			}
			await resendVerificationEmail({ email })
			setResendCooldown(60) // 60 second cooldown
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to resend email'
			setError(message)
			onError?.(message)
		} finally {
			setIsResending(false)
		}
	}, [email, resendCooldown, resendVerificationEmail, onError])

	// Redirect if already signed in and verified
	if (isLoaded && isSignedIn) {
		if (typeof window !== 'undefined') {
			safeRedirect(afterVerifyUrl, { fallback: '/dashboard' })
		}
		return null
	}

	const renderContent = () => {
		// Loading state for auto-verification
		if (token && isLoading && !isSuccess) {
			return (
				<div style={styles.textCenter}>
					<span
						style={mergeStyles(styles.spinner, {
							width: '2rem',
							height: '2rem',
							margin: '0 auto 1rem',
						})}
					/>
					<p style={styles.textMuted}>Verifying your email...</p>
				</div>
			)
		}

		// Success state
		if (isSuccess) {
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
						<CheckIcon color={theme.colorSuccess} />
					</div>
					<h3 style={mergeStyles(styles.cardTitle, styles.mb2)}>Email verified!</h3>
					<p style={mergeStyles(styles.textMuted, styles.textSm, styles.mb4)}>
						Your email has been verified. Redirecting...
					</p>
				</div>
			)
		}

		// Error state for token verification
		if (token && error) {
			return (
				<div style={styles.textCenter}>
					<div
						style={mergeStyles(styles.flexCenter, {
							width: '3rem',
							height: '3rem',
							borderRadius: '50%',
							backgroundColor: `${theme.colorDestructive}15`,
							margin: '0 auto 1rem',
						})}
					>
						<XIcon color={theme.colorDestructive} />
					</div>
					<h3 style={mergeStyles(styles.cardTitle, styles.mb2)}>Verification failed</h3>
					<p style={mergeStyles(styles.textMuted, styles.textSm, styles.mb4)}>{error}</p>
					{email && (
						<button
							type="button"
							onClick={handleResend}
							disabled={isResending || resendCooldown > 0}
							style={mergeStyles(
								styles.button,
								styles.buttonPrimary,
								styles.buttonFullWidth,
								isResending || resendCooldown > 0 ? styles.buttonDisabled : {}
							)}
						>
							{isResending
								? 'Sending...'
								: resendCooldown > 0
									? `Resend in ${resendCooldown}s`
									: 'Resend verification email'}
						</button>
					)}
				</div>
			)
		}

		// Code entry form (when no token provided)
		return (
			<form onSubmit={handleSubmitCode}>
				<div style={mergeStyles(styles.textCenter, styles.mb4)}>
					<div
						style={mergeStyles(styles.flexCenter, {
							width: '3rem',
							height: '3rem',
							borderRadius: '50%',
							backgroundColor: `${theme.colorPrimary}15`,
							margin: '0 auto 1rem',
						})}
					>
						<MailIcon color={theme.colorPrimary} />
					</div>
					{email && (
						<p style={mergeStyles(styles.textMuted, styles.textSm)}>
							We sent a verification code to <strong>{email}</strong>
						</p>
					)}
				</div>

				<div style={styles.formGroup}>
					<label style={styles.label}>Verification code</label>
					<input
						type="text"
						value={code}
						onChange={(e) => {
							setCode(e.target.value)
							setError(null)
						}}
						onFocus={() => setFocusedField('code')}
						onBlur={() => setFocusedField(null)}
						placeholder="Enter code"
						disabled={isLoading}
						autoComplete="one-time-code"
						required
						style={mergeStyles(
							styles.input,
							focusedField === 'code' ? styles.inputFocus : {},
							isLoading ? styles.inputDisabled : {},
							{ textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.25rem' }
						)}
					/>
				</div>

				{error && (
					<div style={mergeStyles(styles.alert, styles.alertError)}>{error}</div>
				)}

				<button
					type="submit"
					disabled={isLoading || !code}
					style={mergeStyles(
						styles.button,
						styles.buttonPrimary,
						styles.buttonFullWidth,
						isLoading || !code ? styles.buttonDisabled : {}
					)}
				>
					{isLoading ? (
						<>
							<span style={styles.spinner} />
							Verifying...
						</>
					) : (
						'Verify email'
					)}
				</button>

				{email && (
					<p style={mergeStyles(styles.textCenter, styles.textSm, styles.textMuted, styles.mt4)}>
						Didn't receive it?{' '}
						<button
							type="button"
							onClick={handleResend}
							disabled={isResending || resendCooldown > 0}
							style={mergeStyles(styles.link, {
								background: 'none',
								border: 'none',
								padding: 0,
								cursor: resendCooldown > 0 ? 'default' : 'pointer',
								opacity: resendCooldown > 0 ? 0.5 : 1,
							})}
						>
							{isResending
								? 'Sending...'
								: resendCooldown > 0
									? `Resend in ${resendCooldown}s`
									: 'Resend code'}
						</button>
					</p>
				)}
			</form>
		)
	}

	const content = (
		<div style={styles.container}>
			{header || (
				<div style={mergeStyles(styles.cardHeader, styles.textCenter)}>
					<h2 style={styles.cardTitle}>Verify your email</h2>
				</div>
			)}
			<div style={styles.cardContent}>{renderContent()}</div>
		</div>
	)

	if (showCard) {
		return <div style={styles.card}>{content}</div>
	}

	return content
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

function CheckIcon({ color }: { color: string }) {
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
			<path d="M20 6 9 17l-5-5" />
		</svg>
	)
}

function XIcon({ color }: { color: string }) {
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
			<path d="M18 6 6 18" />
			<path d="m6 6 12 12" />
		</svg>
	)
}
