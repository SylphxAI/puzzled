/**
 * SignIn Component
 *
 * Flexible sign-in component supporting redirect, embedded, and modal modes.
 */

'use client'

import { useState } from 'react'
import { useSafeAuth, useSafeUser } from '../hooks'
import { SignInForm, Modal, type SignInMethod, type OAuthProvider, type ThemeVariables, defaultTheme } from '../ui'
import type { OAuthProviderId } from '../../types'

// Re-export for convenience
export type { OAuthProviderId }

export interface SignInProps {
	/** URL to redirect to after successful sign in */
	afterSignInUrl?: string
	/**
	 * Display mode:
	 * - 'redirect': Navigate to platform login page (default)
	 * - 'embedded': Show full sign-in form inline
	 * - 'modal': Show full sign-in form in a modal
	 */
	mode?: 'redirect' | 'embedded' | 'modal'
	/**
	 * OAuth providers to show (SDK-level filtering)
	 * This further filters the providers enabled at platform and app level.
	 * - undefined/null = show all app-enabled providers
	 * - [] = hide OAuth section (email only)
	 * - ['google', 'github'] = only show these (if they're app-enabled)
	 */
	providers?: OAuthProviderId[] | null
	/**
	 * Auth methods to enable for embedded/modal mode
	 * Default: ['password']
	 */
	methods?: SignInMethod[]
	/** Theme variables for embedded/modal mode */
	theme?: ThemeVariables
	/** Custom appearance for redirect button */
	appearance?: {
		baseStyle?: React.CSSProperties
		hoverStyle?: React.CSSProperties
	}
	/** Custom class name */
	className?: string
	/** Button content (for redirect mode) */
	children?: React.ReactNode
	/** URL for sign up link (embedded/modal mode) */
	signUpUrl?: string
	/** URL for forgot password (embedded/modal mode) */
	forgotPasswordUrl?: string
	/** Called on successful sign in */
	onSuccess?: () => void
	/** Called on error */
	onError?: (error: string) => void
	/** Show card wrapper (embedded mode, default: true) */
	showCard?: boolean
}

/**
 * SignIn component with multiple display modes
 *
 * @example
 * ```tsx
 * // Redirect mode (default) - navigates to platform login
 * <SignIn afterSignInUrl="/dashboard" />
 *
 * // Embedded mode - shows full form inline
 * <SignIn mode="embedded" afterSignInUrl="/dashboard" />
 *
 * // Modal mode - shows form in a modal (for buttons)
 * <SignIn mode="modal" afterSignInUrl="/dashboard">
 *   Click to Sign In
 * </SignIn>
 *
 * // With specific OAuth providers
 * <SignIn mode="embedded" providers={['google', 'github']} />
 *
 * // Email/password only
 * <SignIn mode="embedded" providers={[]} />
 * ```
 */
export function SignIn({
	afterSignInUrl,
	mode = 'redirect',
	providers,
	methods = ['password'],
	theme = defaultTheme,
	appearance,
	className,
	children,
	signUpUrl = '/sign-up',
	forgotPasswordUrl = '/forgot-password',
	onSuccess,
	onError,
	showCard = true,
}: SignInProps) {
	const { signIn, isConfigured: authConfigured } = useSafeAuth()
	const { isSignedIn, isLoaded, isConfigured: userConfigured } = useSafeUser()
	const [modalOpen, setModalOpen] = useState(false)

	// Don't render during SSR when SDK is not configured
	if (!authConfigured || !userConfigured) {
		return null
	}

	// Don't show if already signed in
	if (isLoaded && isSignedIn) {
		return null
	}

	// Convert OAuthProviderId to OAuthProvider (compatible types)
	const oauthProviders = providers as OAuthProvider[] | undefined | null

	// Redirect mode - show button that navigates to platform
	if (mode === 'redirect') {
		const handleClick = () => {
			signIn({
				redirectUrl: afterSignInUrl || window.location.href,
				providers,
			})
		}

		const defaultStyles: React.CSSProperties = {
			display: 'inline-flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: '0.5rem 1rem',
			fontSize: '0.875rem',
			fontWeight: 500,
			borderRadius: '0.375rem',
			border: '1px solid transparent',
			backgroundColor: '#000',
			color: '#fff',
			cursor: 'pointer',
			transition: 'opacity 0.2s',
			...appearance?.baseStyle,
		}

		return (
			<button
				onClick={handleClick}
				className={className}
				style={className ? undefined : defaultStyles}
				type="button"
			>
				{children || 'Sign In'}
			</button>
		)
	}

	// Embedded mode - show form inline
	if (mode === 'embedded') {
		return (
			<SignInForm
				theme={theme}
				methods={methods}
				providers={oauthProviders || []}
				afterSignInUrl={afterSignInUrl || '/dashboard'}
				signUpUrl={signUpUrl}
				forgotPasswordUrl={forgotPasswordUrl}
				onSuccess={onSuccess}
				onError={onError}
				showCard={showCard}
			/>
		)
	}

	// Modal mode - show button that opens modal
	if (mode === 'modal') {
		const defaultStyles: React.CSSProperties = {
			display: 'inline-flex',
			alignItems: 'center',
			justifyContent: 'center',
			padding: '0.5rem 1rem',
			fontSize: '0.875rem',
			fontWeight: 500,
			borderRadius: '0.375rem',
			border: '1px solid transparent',
			backgroundColor: '#000',
			color: '#fff',
			cursor: 'pointer',
			transition: 'opacity 0.2s',
			...appearance?.baseStyle,
		}

		return (
			<>
				<button
					onClick={() => setModalOpen(true)}
					className={className}
					style={className ? undefined : defaultStyles}
					type="button"
				>
					{children || 'Sign In'}
				</button>
				<Modal
					open={modalOpen}
					onClose={() => setModalOpen(false)}
					theme={theme}
				>
					<SignInForm
						theme={theme}
						methods={methods}
						providers={oauthProviders || []}
						afterSignInUrl={afterSignInUrl || '/dashboard'}
						signUpUrl={signUpUrl}
						forgotPasswordUrl={forgotPasswordUrl}
						onSuccess={() => {
							setModalOpen(false)
							onSuccess?.()
						}}
						onError={onError}
						showCard={false}
					/>
				</Modal>
			</>
		)
	}

	return null
}
