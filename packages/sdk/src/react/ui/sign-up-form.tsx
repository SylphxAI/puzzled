/**
 * SignUp Form Component
 *
 * Full embedded sign-up form with email/password and OAuth support.
 * Self-contained with CSS-in-JS styles.
 *
 * NOW USES useSignUpForm hook (dogfooding).
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
import { RequireSdk } from '../hooks'
import {
	useSignUpForm,
	type AdditionalField,
	type SignUpStep,
} from '../hooks/use-sign-up-form'



export interface SignUpFormProps {
	/** Theme variables */
	theme?: ThemeVariables
	/** OAuth providers to show */
	providers?: OAuthProvider[]
	/** URL to redirect after sign up */
	afterSignUpUrl?: string
	/** URL for sign in link */
	signInUrl?: string
	/** Terms of Service URL */
	termsUrl?: string
	/** Privacy Policy URL */
	privacyUrl?: string
	/** URL to redirect to waitlist page (Clerk feature - shows waitlist instead of signup) */
	waitlistUrl?: string
	/** Called on successful sign up */
	onSuccess?: () => void
	/** Called on error */
	onError?: (error: string) => void
	/** Custom header content */
	header?: React.ReactNode
	/** Custom footer content */
	footer?: React.ReactNode
	/** Hide the sign in link */
	hideSignInLink?: boolean
	/** Hide the legal links */
	hideLegalLinks?: boolean
	/** Show the card wrapper (default: true) */
	showCard?: boolean
	/** Initial invite code */
	inviteCode?: string
	/** Show invite code field */
	showInviteCode?: boolean
	/** Require invite code */
	requireInviteCode?: boolean
	/** Additional fields to collect */
	additionalFields?: AdditionalField[]
}

/**
 * Full sign-up form component (uses useSignUpForm hook)
 */
export function SignUpForm(props: SignUpFormProps) {
	return (
		<RequireSdk services={['auth']} componentType="sign-up" theme={props.theme}>
			<SignUpFormInner {...props} />
		</RequireSdk>
	)
}

/** Inner component that safely uses platform hooks */
function SignUpFormInner({
	theme = defaultTheme,
	providers = [],
	afterSignUpUrl = '/dashboard',
	signInUrl = '/sign-in',
	termsUrl = '/terms',
	privacyUrl = '/privacy',
	waitlistUrl,
	onSuccess,
	onError,
	header,
	footer,
	hideSignInLink = false,
	hideLegalLinks = false,
	showCard = true,
	inviteCode: initialInviteCode = '',
	showInviteCode = false,
	requireInviteCode = false,
	additionalFields = [],
}: SignUpFormProps) {
	const styles = baseStyles(theme)

	// Use the headless hook (dogfooding!)
	const {
		form,
		setName,
		setEmail,
		setPassword,
		setInviteCode,
		setVerificationCode,
		setField,
		step,
		setStep,
		inviteInfo,
		isVerifyingInvite,
		isLoading,
		loadingProvider,
		error,
		handleSubmit,
		handleVerifyEmail,
		handleJoinWaitlist,
		handleOAuthSignUp,
		isWaitlistMode,
	} = useSignUpForm({
		providers,
		afterSignUpUrl,
		inviteCode: initialInviteCode,
		showInviteCode,
		requireInviteCode,
		additionalFields,
		waitlistUrl,
		onSuccess,
		onError,
	})

	// Inject global styles
	useEffect(() => {
		injectGlobalStyles()
	}, [])

	// Render input with theme and accessibility
	const renderInput = (
		type: string,
		name: string,
		placeholder: string,
		value: string,
		onChange: (value: string) => void,
		options?: {
			autoComplete?: string
			required?: boolean
			minLength?: number
			readOnly?: boolean
			autoFocus?: boolean
		}
	) => {
		// Generate unique ID for label association
		const inputId = `signup-${name}`
		return (
			<input
				id={inputId}
				type={type}
				name={name}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				disabled={isLoading}
				readOnly={options?.readOnly}
				autoComplete={options?.autoComplete}
				required={options?.required !== false}
				minLength={options?.minLength}
				autoFocus={options?.autoFocus}
				aria-describedby={name === 'password' ? 'password-hint' : name === 'verificationCode' ? 'verification-hint' : undefined}
				style={mergeStyles(
					styles.input,
					isLoading || options?.readOnly ? styles.inputDisabled : {}
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

	// Render invite info banner
	const renderInviteBanner = () => {
		if (!inviteInfo?.valid) return null

		return (
			<div
				style={mergeStyles(styles.alert, {
					backgroundColor: `${theme.colorSuccess}15`,
					color: theme.colorSuccess,
					border: `1px solid ${theme.colorSuccess}30`,
					display: 'flex',
					alignItems: 'center',
					gap: '0.75rem',
				})}
			>
				<CheckIcon color={theme.colorSuccess} />
				<div>
					<p style={{ fontWeight: 500, margin: 0 }}>Valid invitation</p>
					<p style={{ fontSize: theme.fontSizeXs, margin: 0, opacity: 0.8 }}>
						{inviteInfo.email}
						{inviteInfo.role && inviteInfo.role !== 'user' && (
							<> &bull; {inviteInfo.role.replace('_', ' ')}</>
						)}
					</p>
				</div>
			</div>
		)
	}

	// Render sign up form
	const renderSignUpForm = () => (
		<form onSubmit={handleSubmit}>
			{/* Invite banner */}
			{renderInviteBanner()}

			{/* Name field */}
			<div style={styles.formGroup}>
				<label htmlFor="signup-name" style={styles.label}>Name</label>
				{renderInput('text', 'name', 'Your name', form.name, setName, {
					autoComplete: 'name',
				})}
			</div>

			{/* Email field */}
			<div style={styles.formGroup}>
				<label htmlFor="signup-email" style={styles.label}>Email</label>
				{renderInput('email', 'email', 'you@example.com', form.email, setEmail, {
					autoComplete: 'email',
					readOnly: !!inviteInfo?.email,
				})}
				{inviteInfo?.email && (
					<p style={mergeStyles(styles.textXs, styles.textMuted, styles.mt1)}>
						Email is locked to the invitation address
					</p>
				)}
			</div>

			{/* Password field */}
			<div style={styles.formGroup}>
				<label htmlFor="signup-password" style={styles.label}>Password</label>
				{renderInput('password', 'password', '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', form.password, setPassword, {
					autoComplete: 'new-password',
					minLength: 8,
				})}
				<p id="password-hint" style={mergeStyles(styles.textXs, styles.textMuted, styles.mt1)}>
					Must be at least 8 characters
				</p>
			</div>

			{/* Invite code field */}
			{(showInviteCode || requireInviteCode) && !inviteInfo?.valid && (
				<div style={styles.formGroup}>
					<label htmlFor="signup-inviteCode" style={styles.label}>
						Invite Code{' '}
						{requireInviteCode && (
							<span style={{ color: theme.colorDestructive }}>*</span>
						)}
					</label>
					{renderInput('text', 'inviteCode', 'Enter invite code', form.inviteCode, setInviteCode, {
						required: requireInviteCode,
					})}
				</div>
			)}

			{/* Additional fields */}
			{additionalFields.map((field) => (
				<div key={field.name} style={styles.formGroup}>
					<label htmlFor={`signup-${field.name}`} style={styles.label}>
						{field.label}
						{field.required && (
							<span style={{ color: theme.colorDestructive }}> *</span>
						)}
					</label>
					{field.type === 'select' ? (
						<select
							id={`signup-${field.name}`}
							name={field.name}
							value={form[field.name] || ''}
							onChange={(e) => setField(field.name, e.target.value)}
							disabled={isLoading}
							required={field.required}
							style={styles.input}
						>
							<option value="">Select...</option>
							{field.options?.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
					) : (
						renderInput(
							field.type,
							field.name,
							field.placeholder || '',
							form[field.name] || '',
							(v) => setField(field.name, v),
							{ required: field.required }
						)
					)}
				</div>
			))}

			{renderError()}
			{renderButton('Create Account', 'Creating account...')}

			{/* Legal links */}
			{!hideLegalLinks && (
				<p style={mergeStyles(styles.textCenter, styles.textXs, styles.textMuted, styles.mt4)}>
					By creating an account, you agree to our{' '}
					<a href={termsUrl} style={styles.link}>
						Terms of Service
					</a>{' '}
					and{' '}
					<a href={privacyUrl} style={styles.link}>
						Privacy Policy
					</a>
				</p>
			)}
		</form>
	)

	// Render email verification form
	const renderVerifyEmailForm = () => (
		<div>
			<div style={styles.textCenter}>
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
				<h3 style={mergeStyles(styles.cardTitle, styles.mb2)}>Verify your email</h3>
				<p style={mergeStyles(styles.textMuted, styles.textSm, styles.mb4)}>
					We sent a verification code to <strong>{form.email}</strong>
				</p>
			</div>

			<form onSubmit={handleVerifyEmail}>
				<div style={styles.formGroup}>
					<label htmlFor="signup-verificationCode" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
						Verification code
					</label>
					<p id="verification-hint" style={mergeStyles(styles.textMuted, styles.textSm, styles.mb2)}>
						Enter the 6-digit code from your email
					</p>
					{renderInput(
						'text',
						'verificationCode',
						'000000',
						form.verificationCode,
						setVerificationCode,
						{ autoComplete: 'one-time-code', autoFocus: true }
					)}
				</div>
				{renderError()}
				{renderButton('Verify Email', 'Verifying...')}
			</form>

			<button
				type="button"
				onClick={() => setStep('form')}
				style={mergeStyles(
					styles.button,
					styles.buttonGhost,
					styles.buttonFullWidth,
					styles.mt2
				)}
			>
				Use different email
			</button>
		</div>
	)

	// Render complete step
	const renderComplete = () => (
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
			<h3 style={mergeStyles(styles.cardTitle, styles.mb2)}>Account created!</h3>
			<p style={mergeStyles(styles.textMuted, styles.textSm, styles.mb4)}>
				Welcome aboard! Redirecting you...
			</p>
		</div>
	)

	// Render waitlist form
	const renderWaitlistForm = () => (
		<form onSubmit={handleJoinWaitlist}>
			<div style={styles.formGroup}>
				<label htmlFor="signup-email" style={styles.label}>Email</label>
				{renderInput('email', 'email', 'you@example.com', form.email, setEmail, {
					autoComplete: 'email',
				})}
			</div>

			<div style={styles.formGroup}>
				<label htmlFor="signup-name" style={styles.label}>Name (optional)</label>
				{renderInput('text', 'name', 'Your name', form.name, setName, {
					autoComplete: 'name',
					required: false,
				})}
			</div>

			{renderError()}
			{renderButton('Join Waitlist', 'Joining...')}
		</form>
	)

	// Render waitlist joined confirmation
	const renderWaitlistJoined = () => (
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
			<h3 style={mergeStyles(styles.cardTitle, styles.mb2)}>You're on the list!</h3>
			<p style={mergeStyles(styles.textMuted, styles.textSm, styles.mb4)}>
				We'll let you know when it's your turn.
			</p>
			{waitlistUrl && (
				<a
					href={waitlistUrl}
					style={mergeStyles(styles.button, styles.buttonPrimary, styles.buttonFullWidth)}
				>
					View Waitlist Status
				</a>
			)}
		</div>
	)

	// Show loading while verifying invite
	if (isVerifyingInvite) {
		return (
			<div style={showCard ? styles.card : {}}>
				<div style={mergeStyles(styles.cardContent, styles.flexCenter, { minHeight: '12rem' })}>
					<div style={styles.flexCol}>
						<span
							style={mergeStyles(styles.spinner, {
								width: '2rem',
								height: '2rem',
								margin: '0 auto 1rem',
							})}
						/>
						<p style={styles.textMuted}>Verifying invitation...</p>
					</div>
				</div>
			</div>
		)
	}

	// Render content based on step
	const renderContent = () => {
		// If waitlistUrl is provided, show waitlist flow instead of signup
		if (isWaitlistMode && step === 'form') {
			return renderWaitlistForm()
		}
		if (step === 'waitlist-joined') {
			return renderWaitlistJoined()
		}

		switch (step) {
			case 'verify-email':
				return renderVerifyEmailForm()
			case 'complete':
				return renderComplete()
			default:
				return renderSignUpForm()
		}
	}

	// Full form content
	const content = (
		<div style={styles.container}>
			{/* Header */}
			{header || (
				<div style={mergeStyles(styles.cardHeader, styles.textCenter)}>
					<h2 style={styles.cardTitle}>
						{isWaitlistMode ? 'Join the waitlist' : 'Create account'}
					</h2>
					<p style={styles.cardDescription}>
						{isWaitlistMode
							? 'Be the first to know when we launch'
							: inviteInfo?.valid
								? "You've been invited to join"
								: 'Sign up to get started'}
					</p>
				</div>
			)}

			{/* Card content */}
			<div style={styles.cardContent}>
				{/* OAuth buttons (hide for waitlist mode) */}
				{providers.length > 0 && step === 'form' && !isWaitlistMode && (
					<>
						<OAuthButtons
							providers={providers}
							onProviderClick={handleOAuthSignUp}
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

				{/* Sign in link (hide for waitlist mode) */}
				{!hideSignInLink && step === 'form' && !isWaitlistMode && (
					<p style={mergeStyles(styles.textCenter, styles.textSm, styles.textMuted, styles.mt4)}>
						Already have an account?{' '}
						<a href={signInUrl} style={styles.link}>
							Sign in
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

// Decorative icons
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
			aria-hidden="true"
		>
			<path d="M20 6 9 17l-5-5" />
		</svg>
	)
}
