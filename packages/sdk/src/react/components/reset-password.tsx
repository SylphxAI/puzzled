/**
 * ResetPassword Component
 *
 * Allows users to set a new password using a reset token.
 * Matches Clerk's ResetPassword component API.
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
import { ConfigurationError } from '../ui/configuration-error'

export interface ResetPasswordProps {
	/** Password reset token (usually from URL) */
	token?: string
	/** URL to redirect after successful reset */
	afterResetUrl?: string
	/** URL for sign in link */
	signInUrl?: string
	/** Theme variables */
	theme?: ThemeVariables
	/** Called on successful reset */
	onSuccess?: () => void
	/** Called on error */
	onError?: (error: string) => void
	/** Show card wrapper */
	showCard?: boolean
	/** Custom header content */
	header?: React.ReactNode
}

/**
 * ResetPassword component for setting a new password
 *
 * @example
 * ```tsx
 * // On /reset-password?token=xxx page
 * const searchParams = useSearchParams()
 * const token = searchParams.get('token')
 *
 * <ResetPassword
 *   token={token}
 *   afterResetUrl="/sign-in"
 * />
 * ```
 */
export function ResetPassword({
	token,
	afterResetUrl = '/sign-in',
	signInUrl = '/sign-in',
	theme = defaultTheme,
	onSuccess,
	onError,
	showCard = true,
	header,
}: ResetPasswordProps) {
	const { resetPassword, isConfigured: authConfigured } = useSafeAuth()
	const { isSignedIn, isLoaded, isConfigured: userConfigured } = useSafeUser()
	const styles = baseStyles(theme)

	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [isSuccess, setIsSuccess] = useState(false)
	const [focusedField, setFocusedField] = useState<string | null>(null)
	const [isMounted, setIsMounted] = useState(false)

	// Inject global styles and track mount
	useEffect(() => {
		injectGlobalStyles()
		setIsMounted(true)
	}, [])

	// During SSR, return null
	if (typeof window === 'undefined') {
		return null
	}

	// On client, if SDK not configured after mount, show error
	if (!authConfigured || !userConfigured) {
		if (!isMounted) {
			return null
		}
		return (
			<ConfigurationError
				theme={theme}
				componentType="auth"
				onRetry={() => window.location.reload()}
			/>
		)
	}

	// Redirect if already signed in
	if (isLoaded && isSignedIn) {
		if (typeof window !== 'undefined') {
			safeRedirect(afterResetUrl, { fallback: '/sign-in' })
		}
		return null
	}

	// Show error if no token
	if (!token) {
		return (
			<div style={showCard ? styles.card : {}}>
				<div style={styles.container}>
					<div style={mergeStyles(styles.cardHeader, styles.textCenter)}>
						<h2 style={styles.cardTitle}>Invalid reset link</h2>
						<p style={styles.cardDescription}>
							This password reset link is invalid or has expired.
						</p>
					</div>
					<div style={styles.cardContent}>
						<a
							href={signInUrl}
							style={mergeStyles(styles.button, styles.buttonPrimary, styles.buttonFullWidth)}
						>
							Back to sign in
						</a>
					</div>
				</div>
			</div>
		)
	}

	const handleSubmit = useCallback(
		async (e: FormEvent) => {
			e.preventDefault()
			setError(null)

			// Validate passwords match
			if (password !== confirmPassword) {
				setError('Passwords do not match')
				return
			}

			// Validate password length
			if (password.length < 8) {
				setError('Password must be at least 8 characters')
				return
			}

			setIsLoading(true)

			try {
				if (!resetPassword) {
					throw new Error('Authentication not configured')
				}
				await resetPassword({ token, newPassword: password })
				setIsSuccess(true)
				onSuccess?.()

				// Redirect after short delay
				if (typeof window !== 'undefined') {
					setTimeout(() => {
						safeRedirect(afterResetUrl, { fallback: '/sign-in' })
					}, 2000)
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Failed to reset password'
				setError(message)
				onError?.(message)
			} finally {
				setIsLoading(false)
			}
		},
		[token, password, confirmPassword, resetPassword, afterResetUrl, onSuccess, onError]
	)

	const renderForm = () => {
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
					<h3 style={mergeStyles(styles.cardTitle, styles.mb2)}>Password reset!</h3>
					<p style={mergeStyles(styles.textMuted, styles.textSm, styles.mb4)}>
						Your password has been updated. Redirecting to sign in...
					</p>
				</div>
			)
		}

		return (
			<form onSubmit={handleSubmit}>
				<div style={styles.formGroup}>
					<label style={styles.label}>New password</label>
					<input
						type="password"
						value={password}
						onChange={(e) => {
							setPassword(e.target.value)
							setError(null)
						}}
						onFocus={() => setFocusedField('password')}
						onBlur={() => setFocusedField(null)}
						placeholder="••••••••"
						disabled={isLoading}
						autoComplete="new-password"
						required
						minLength={8}
						style={mergeStyles(
							styles.input,
							focusedField === 'password' ? styles.inputFocus : {},
							isLoading ? styles.inputDisabled : {}
						)}
					/>
					<p style={mergeStyles(styles.textXs, styles.textMuted, styles.mt1)}>
						Must be at least 8 characters
					</p>
				</div>

				<div style={styles.formGroup}>
					<label style={styles.label}>Confirm password</label>
					<input
						type="password"
						value={confirmPassword}
						onChange={(e) => {
							setConfirmPassword(e.target.value)
							setError(null)
						}}
						onFocus={() => setFocusedField('confirmPassword')}
						onBlur={() => setFocusedField(null)}
						placeholder="••••••••"
						disabled={isLoading}
						autoComplete="new-password"
						required
						style={mergeStyles(
							styles.input,
							focusedField === 'confirmPassword' ? styles.inputFocus : {},
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
							Resetting...
						</>
					) : (
						'Reset password'
					)}
				</button>

				<p style={mergeStyles(styles.textCenter, styles.textSm, styles.textMuted, styles.mt4)}>
					<a href={signInUrl} style={styles.link}>
						Back to sign in
					</a>
				</p>
			</form>
		)
	}

	const content = (
		<div style={styles.container}>
			{header || (
				<div style={mergeStyles(styles.cardHeader, styles.textCenter)}>
					<h2 style={styles.cardTitle}>Reset password</h2>
					<p style={styles.cardDescription}>Enter your new password</p>
				</div>
			)}
			<div style={styles.cardContent}>{renderForm()}</div>
		</div>
	)

	if (showCard) {
		return <div style={styles.card}>{content}</div>
	}

	return content
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
