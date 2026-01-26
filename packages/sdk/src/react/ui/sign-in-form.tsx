/**
 * SignIn Form Component
 *
 * Full embedded sign-in form with email/password and OAuth support.
 * Self-contained with CSS-in-JS styles.
 *
 * NOW USES useSignInForm hook (dogfooding).
 */

'use client'

import { useEffect } from 'react'
import type { ThemeVariables } from './styles'
import {
	defaultTheme,
	baseStyles,
	mergeStyles,
	injectGlobalStyles,
} from './styles'
import { OAuthButtons, OrDivider, type OAuthProvider } from './oauth-buttons'
import { useSignInForm, type SignInMethod } from '../hooks/use-sign-in-form'
import { RequireSdk } from '../hooks'

export type { SignInMethod } from '../hooks/use-sign-in-form'

export interface SignInFormProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** Available auth methods */
	methods?: SignInMethod[]
	/** OAuth providers to show */
	providers?: OAuthProvider[]
	/** URL to redirect after sign in */
	afterSignInUrl?: string
	/** URL for sign up link */
	signUpUrl?: string
	/** URL for forgot password link */
	forgotPasswordUrl?: string
	/** Called on successful sign in */
	onSuccess?: () => void
	/** Called on error */
	onError?: (error: string) => void
	/** Custom header content */
	header?: React.ReactNode
	/** Custom footer content */
	footer?: React.ReactNode
	/** Hide the sign up link */
	hideSignUpLink?: boolean
	/** Hide the forgot password link */
	hideForgotPassword?: boolean
	/** Show the card wrapper (default: true) */
	showCard?: boolean
}

/**
 * Full sign-in form component (uses useSignInForm hook)
 */
export function SignInForm(props: SignInFormProps) {
	return (
		<RequireSdk services={['auth']} componentType="sign-in" theme={props.theme}>
			<SignInFormInner {...props} />
		</RequireSdk>
	)
}

/** Inner component that safely uses platform hooks */
function SignInFormInner({
	theme = defaultTheme,
	methods = ['password'],
	providers = [],
	afterSignInUrl = '/dashboard',
	signUpUrl = '/signup',
	forgotPasswordUrl = '/forgot-password',
	onSuccess,
	onError,
	header,
	footer,
	hideSignUpLink = false,
	hideForgotPassword = false,
	showCard = true,
}: SignInFormProps) {
	const styles = baseStyles(theme)

	// Use the headless hook (dogfooding!)
	const {
		form,
		setEmail,
		setPassword,
		setOtp,
		step,
		setStep,
		isLoading,
		loadingProvider,
		error,
		pendingTwoFactor,
		handlePasswordSubmit,
		handleOAuthSignIn,
		handleMagicLinkRequest,
		handleOtpRequest,
		handleOtpVerify,
		handleTwoFactorVerify,
	} = useSignInForm({
		methods,
		providers,
		afterSignInUrl,
		onSuccess: () => {
			onSuccess?.()
		},
		onError,
	})

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Render input with theme and accessibility
	const renderInput = (
		type: string,
		name: 'email' | 'password' | 'otp',
		placeholder: string,
		value: string,
		onChange: (value: string) => void,
		options?: {
			autoComplete?: string
			required?: boolean
			minLength?: number
			autoFocus?: boolean
		}
	) => {
		// Generate unique ID for label association
		const inputId = `signin-${name}`
		return (
			<input
				id={inputId}
				type={type}
				name={name}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				disabled={isLoading}
				autoComplete={options?.autoComplete}
				required={options?.required !== false}
				minLength={options?.minLength}
				autoFocus={options?.autoFocus}
				aria-describedby={name === 'otp' ? 'otp-hint' : undefined}
				style={mergeStyles(
					styles.input,
					isLoading ? styles.inputDisabled : {}
				)}
			/>
		)
	}

	// Render error alert with accessibility
	const renderError = () => {
		return (
			<div aria-live="assertive" aria-atomic="true">
				{error && (
					<div
						role="alert"
						style={mergeStyles(styles.alert, styles.alertError)}
					>
						{error}
					</div>
				)}
			</div>
		)
	}

	// Render submit button
	const renderButton = (text: string, loadingText: string, onClick?: () => void) => {
		const buttonProps = onClick
			? { type: 'button' as const, onClick }
			: { type: 'submit' as const }

		return (
			<button
				{...buttonProps}
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
						{loadingText}
					</>
				) : (
					text
				)}
			</button>
		)
	}

	// Method tabs
	const renderMethodTabs = () => {
		if (methods.length <= 1) return null

		return (
			<div style={styles.tabs}>
				{methods.includes('password') && (
					<button
						type="button"
						onClick={() => setStep('password')}
						style={mergeStyles(styles.tab, step === 'password' ? styles.tabActive : {})}
					>
						Password
					</button>
				)}
				{methods.includes('magic-link') && (
					<button
						type="button"
						onClick={() => setStep('email')}
						style={mergeStyles(styles.tab, step === 'email' || step === 'magic-link-sent' ? styles.tabActive : {})}
					>
						Magic Link
					</button>
				)}
				{methods.includes('otp') && (
					<button
						type="button"
						onClick={() => setStep('email')}
						style={mergeStyles(styles.tab, step === 'otp' ? styles.tabActive : {})}
					>
						Email Code
					</button>
				)}
			</div>
		)
	}

	// Render password form
	const renderPasswordForm = () => (
		<form onSubmit={handlePasswordSubmit}>
			<div style={styles.formGroup}>
				<label htmlFor="signin-email" style={styles.label}>Email</label>
				{renderInput('email', 'email', 'you@example.com', form.email, setEmail, { autoComplete: 'email' })}
			</div>
			<div style={styles.formGroup}>
				<div style={styles.flexBetween}>
					<label htmlFor="signin-password" style={styles.label}>Password</label>
					{!hideForgotPassword && (
						<a href={forgotPasswordUrl} style={mergeStyles(styles.link, styles.textSm)}>
							Forgot password?
						</a>
					)}
				</div>
				{renderInput('password', 'password', '••••••••', form.password, setPassword, {
					autoComplete: 'current-password',
					minLength: 8,
				})}
			</div>
			{renderError()}
			{renderButton('Sign In', 'Signing in...')}
		</form>
	)

	// Render magic link form
	const renderMagicLinkForm = () => (
		<form onSubmit={handleMagicLinkRequest}>
			<div style={styles.formGroup}>
				<label htmlFor="signin-email" style={styles.label}>Email</label>
				{renderInput('email', 'email', 'you@example.com', form.email, setEmail, { autoComplete: 'email' })}
			</div>
			{renderError()}
			{renderButton('Send Magic Link', 'Sending...')}
		</form>
	)

	// Render magic link sent message
	const renderMagicLinkSent = () => (
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
				We sent a magic link to <strong>{form.email}</strong>
			</p>
			<button
				type="button"
				onClick={() => setStep('email')}
				style={mergeStyles(styles.button, styles.buttonOutline, styles.buttonFullWidth)}
			>
				Use different email
			</button>
		</div>
	)

	// Render OTP form
	const renderOTPForm = () => (
		<form onSubmit={handleOtpVerify}>
			<div style={styles.formGroup}>
				<label htmlFor="signin-otp" style={styles.label}>Enter verification code</label>
				<p id="otp-hint" style={mergeStyles(styles.textMuted, styles.textSm, styles.mb2)}>Sent to {form.email}</p>
				{renderInput('text', 'otp', '000000', form.otp, setOtp, {
					autoComplete: 'one-time-code',
					autoFocus: true,
				})}
			</div>
			{renderError()}
			{renderButton('Verify', 'Verifying...')}
			<button
				type="button"
				onClick={() => setStep('email')}
				style={mergeStyles(styles.button, styles.buttonGhost, styles.buttonFullWidth, styles.mt2)}
			>
				Use different email
			</button>
		</form>
	)

	// Render email form for OTP request
	const renderEmailForm = () => (
		<form
			onSubmit={(e) => {
				e.preventDefault()
				if (methods.includes('otp')) {
					handleOtpRequest()
				} else if (methods.includes('magic-link')) {
					handleMagicLinkRequest(e)
				}
			}}
		>
			<div style={styles.formGroup}>
				<label htmlFor="signin-email" style={styles.label}>Email</label>
				{renderInput('email', 'email', 'you@example.com', form.email, setEmail, { autoComplete: 'email' })}
			</div>
			{renderError()}
			{renderButton(methods.includes('otp') ? 'Send Code' : 'Send Magic Link', 'Sending...')}
		</form>
	)

	// Main content based on step
	const renderContent = () => {
		switch (step) {
			case 'password':
				return renderPasswordForm()
			case 'email':
				return renderEmailForm()
			case 'magic-link-sent':
				return renderMagicLinkSent()
			case 'otp':
				return renderOTPForm()
			default:
				return renderPasswordForm()
		}
	}

	// Full form content
	const content = (
		<div style={styles.container}>
			{/* Header */}
			{header || (
				<div style={mergeStyles(styles.cardHeader, styles.textCenter)}>
					<h2 style={styles.cardTitle}>Welcome back</h2>
					<p style={styles.cardDescription}>Sign in to your account to continue</p>
				</div>
			)}

			{/* Card content */}
			<div style={styles.cardContent}>
				{/* Method tabs */}
				{renderMethodTabs()}

				{/* OAuth buttons (if not in verification steps) */}
				{providers.length > 0 && step !== 'otp' && step !== 'magic-link-sent' && (
					<>
						<OAuthButtons
							providers={providers}
							onProviderClick={handleOAuthSignIn}
							loadingProvider={loadingProvider}
							disabled={isLoading}
							theme={theme}
							variant="outline"
						/>
						<OrDivider theme={theme} />
					</>
				)}

				{/* Form content */}
				{renderContent()}

				{/* Sign up link */}
				{!hideSignUpLink && step !== 'magic-link-sent' && (
					<p style={mergeStyles(styles.textCenter, styles.textSm, styles.textMuted, styles.mt4)}>
						Don&apos;t have an account?{' '}
						<a href={signUpUrl} style={styles.link}>
							Sign up
						</a>
					</p>
				)}

				{/* Footer */}
				{footer}
			</div>
		</div>
	)

	// Wrap in card if needed
	if (showCard) {
		return <div style={styles.card}>{content}</div>
	}

	return content
}

// Mail icon (decorative)
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
			aria-hidden="true"
		>
			<rect width="20" height="16" x="2" y="4" rx="2" />
			<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
		</svg>
	)
}
