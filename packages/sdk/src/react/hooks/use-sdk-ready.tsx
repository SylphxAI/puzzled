/**
 * useSdkReady Hook
 *
 * SSOT for SDK configuration checking across all components.
 * Handles SSR safety, mount detection, and environment-aware error display.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isReady, renderError } = useSdkReady({
 *     services: ['auth', 'user'],
 *     componentType: 'sign-in'
 *   })
 *
 *   // Early return if not ready
 *   if (!isReady) return renderError()
 *
 *   // Safe to use hooks now
 *   const { signIn } = useAuth()
 *   ...
 * }
 * ```
 */

import { useState, useEffect, useCallback, useMemo, useContext } from 'react'
import { PlatformContext } from '../platform-context'
import type { ThemeVariables } from '../ui/styles'
import { defaultTheme } from '../ui/styles'

// ============================================
// Types
// ============================================

export type SdkService =
	| 'auth'
	| 'user'
	| 'billing'
	| 'storage'
	| 'analytics'
	| 'flags'
	| 'consent'
	| 'organization'
	| 'monitoring'
	| 'ai'
	| 'jobs'
	| 'notifications'
	| 'newsletter'

export type ComponentType =
	| 'sign-in'
	| 'sign-up'
	| 'user-button'
	| 'auth'
	| 'billing'
	| 'storage'
	| 'analytics'
	| 'organization'
	| 'notifications'
	| 'protect'
	| 'referral'
	| 'general'

export interface UseSdkReadyOptions {
	/** Required services for this component */
	services?: SdkService[]
	/** Component type for error messaging */
	componentType?: ComponentType
	/** Theme for error display */
	theme?: ThemeVariables
	/** Custom retry handler */
	onRetry?: () => void
	/**
	 * Behavior when not configured:
	 * - 'error': Show ConfigurationError (default for auth components)
	 * - 'null': Return null silently (for optional UI like UserButton)
	 * - 'children': Render children anyway (for graceful degradation)
	 */
	fallback?: 'error' | 'null' | 'children'
}

export interface UseSdkReadyReturn {
	/** Whether SDK is ready to use */
	isReady: boolean
	/** Whether component is mounted (client-side) */
	isMounted: boolean
	/** Whether SDK is configured */
	isConfigured: boolean
	/** Whether we're in SSR */
	isSSR: boolean
	/** Render the appropriate error/fallback */
	renderError: () => React.ReactElement | null
	/** Service availability map */
	services: Record<SdkService, boolean>
}

// ============================================
// Environment Detection
// ============================================

/**
 * Detects if we're in a development environment
 */
function isDevelopment(): boolean {
	// Check Next.js / Node environment
	if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
		return true
	}
	// Check for localhost
	if (typeof window !== 'undefined') {
		const hostname = window.location.hostname
		return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')
	}
	return false
}

// ============================================
// Main Hook
// ============================================

/**
 * Hook for checking SDK readiness with SSOT pattern
 */
export function useSdkReady(options: UseSdkReadyOptions = {}): UseSdkReadyReturn {
	const {
		services = [],
		componentType = 'general',
		theme = defaultTheme,
		onRetry,
		fallback = 'error',
	} = options

	const [isMounted, setIsMounted] = useState(false)

	// Get platform context (null if not in provider)
	const platformContext = useContext(PlatformContext)

	// Track mount state
	useEffect(() => {
		setIsMounted(true)
	}, [])

	// Check if we're in SSR
	const isSSR = typeof window === 'undefined'

	// Check if SDK is configured (has appId and publishableKey)
	const isConfigured = Boolean(platformContext?.appId && platformContext?.publishableKey)

	// Check individual service availability
	const serviceAvailability = useMemo<Record<SdkService, boolean>>(() => {
		if (!isConfigured) {
			// If not configured, all services are unavailable
			return {
				auth: false,
				user: false,
				billing: false,
				storage: false,
				analytics: false,
				flags: false,
				consent: false,
				organization: false,
				monitoring: false,
				ai: false,
				jobs: false,
				notifications: false,
				newsletter: false,
			}
		}

		// When configured, all services are available
		// (individual service checks could be added here if needed)
		return {
			auth: true,
			user: true,
			billing: true,
			storage: true,
			analytics: true,
			flags: true,
			consent: true,
			organization: true,
			monitoring: true,
			ai: true,
			jobs: true,
			notifications: true,
			newsletter: true,
		}
	}, [isConfigured])

	// Check if all required services are available
	const requiredServicesReady =
		services.length === 0 || services.every((s) => serviceAvailability[s])

	// Overall readiness
	const isReady = !isSSR && isMounted && isConfigured && requiredServicesReady

	// Render error function
	const renderError = useCallback((): React.ReactElement | null => {
		// During SSR, always return null
		if (isSSR) {
			return null
		}

		// Still hydrating, return null
		if (!isMounted) {
			return null
		}

		// If configured and ready, no error to render
		if (isConfigured && requiredServicesReady) {
			return null
		}

		// Handle fallback modes
		if (fallback === 'null') {
			return null
		}

		if (fallback === 'children') {
			// This case is handled by the component itself
			return null
		}

		// Log error for debugging (always)
		if (typeof console !== 'undefined') {
			console.error(
				'[Sylphx SDK] Configuration missing. Please set NEXT_PUBLIC_SYLPHX_APP_ID and NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY environment variables.',
				{ services, componentType }
			)
		}

		// Import ConfigurationError dynamically to avoid circular deps
		// We inline a simple version here for performance
		return renderConfigurationError({
			theme,
			componentType,
			onRetry: onRetry ?? (() => window.location.reload()),
			isDev: isDevelopment(),
		})
	}, [
		isSSR,
		isMounted,
		isConfigured,
		requiredServicesReady,
		fallback,
		theme,
		componentType,
		onRetry,
		services,
	])

	return {
		isReady,
		isMounted,
		isConfigured,
		isSSR,
		renderError,
		services: serviceAvailability,
	}
}

// ============================================
// Inline Error Renderer
// ============================================

interface RenderErrorOptions {
	theme: ThemeVariables
	componentType: ComponentType
	onRetry: () => void
	isDev: boolean
}

function renderConfigurationError({
	theme,
	componentType,
	onRetry,
	isDev,
}: RenderErrorOptions): React.ReactElement {
	// Development: Show helpful setup card
	if (isDev) {
		return (
			<div
				style={{
					padding: '1.5rem',
					borderRadius: theme.borderRadius,
					backgroundColor: '#fef3c7',
					border: '1px solid #fcd34d',
					fontFamily: theme.fontFamily,
					maxWidth: '400px',
					margin: '0 auto',
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '0.5rem',
						marginBottom: '1rem',
					}}
				>
					<span style={{ fontSize: '1.5rem' }}>🔧</span>
					<h3
						style={{
							margin: 0,
							fontSize: theme.fontSizeLg,
							fontWeight: 600,
							color: '#92400e',
						}}
					>
						SDK Configuration Required
					</h3>
				</div>

				<p
					style={{
						margin: '0 0 1rem 0',
						fontSize: theme.fontSizeSm,
						color: '#78350f',
						lineHeight: 1.5,
					}}
				>
					Add these environment variables to your{' '}
					<code
						style={{
							backgroundColor: '#fde68a',
							padding: '0.125rem 0.375rem',
							borderRadius: '0.25rem',
							fontSize: theme.fontSizeXs,
							fontFamily: 'monospace',
						}}
					>
						.env.local
					</code>{' '}
					file:
				</p>

				<div
					style={{
						position: 'relative',
						backgroundColor: '#1e293b',
						borderRadius: theme.borderRadiusSm,
						padding: '1rem',
						marginBottom: '1rem',
						overflow: 'auto',
					}}
				>
					<code
						style={{
							display: 'block',
							color: '#e2e8f0',
							fontSize: theme.fontSizeXs,
							fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
							whiteSpace: 'pre',
							lineHeight: 1.6,
						}}
					>
						{`NEXT_PUBLIC_SYLPHX_APP_ID="your-app-id"
NEXT_PUBLIC_SYLPHX_PUBLISHABLE_KEY="pk_xxx"`}
					</code>
				</div>

				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: '0.5rem',
						marginBottom: '1rem',
					}}
				>
					<a
						href="https://sylphx.com/docs/sdk/getting-started"
						target="_blank"
						rel="noopener noreferrer"
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '0.25rem',
							color: '#0369a1',
							fontSize: theme.fontSizeSm,
							textDecoration: 'none',
							fontWeight: 500,
						}}
					>
						📚 View Setup Guide →
					</a>
					<a
						href="https://sylphx.com/console"
						target="_blank"
						rel="noopener noreferrer"
						style={{
							display: 'inline-flex',
							alignItems: 'center',
							gap: '0.25rem',
							color: '#0369a1',
							fontSize: theme.fontSizeSm,
							textDecoration: 'none',
							fontWeight: 500,
						}}
					>
						🔑 Get API Keys →
					</a>
				</div>

				<p
					style={{
						margin: 0,
						fontSize: theme.fontSizeXs,
						color: '#92400e',
						fontStyle: 'italic',
					}}
				>
					💡 This message only appears in development mode.
				</p>
			</div>
		)
	}

	// Production: Show generic user-friendly message
	const getMessage = () => {
		switch (componentType) {
			case 'sign-in':
				return 'Sign in is temporarily unavailable.'
			case 'sign-up':
				return 'Sign up is temporarily unavailable.'
			case 'billing':
				return 'Billing is temporarily unavailable.'
			case 'storage':
				return 'File upload is temporarily unavailable.'
			case 'organization':
				return 'Organization features are temporarily unavailable.'
			default:
				return 'This feature is temporarily unavailable.'
		}
	}

	return (
		<div
			style={{
				padding: '2rem',
				borderRadius: theme.borderRadius,
				backgroundColor: theme.colorBackground,
				border: `1px solid ${theme.colorBorder}`,
				fontFamily: theme.fontFamily,
				maxWidth: '400px',
				margin: '0 auto',
				textAlign: 'center',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'center',
					marginBottom: '1rem',
				}}
			>
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke={theme.colorWarning}
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
			</div>

			<h3
				style={{
					margin: '0 0 0.5rem 0',
					fontSize: theme.fontSizeLg,
					fontWeight: 600,
					color: theme.colorForeground,
				}}
			>
				{getMessage()}
			</h3>

			<p
				style={{
					margin: '0 0 1.5rem 0',
					fontSize: theme.fontSizeSm,
					color: theme.colorMutedForeground,
					lineHeight: 1.5,
				}}
			>
				Please try again later or contact support if the problem persists.
			</p>

			<button
				type="button"
				onClick={onRetry}
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					padding: '0.625rem 1.25rem',
					fontSize: theme.fontSizeSm,
					fontWeight: 500,
					borderRadius: theme.borderRadiusSm,
					border: `1px solid ${theme.colorBorder}`,
					backgroundColor: theme.colorBackground,
					color: theme.colorForeground,
					cursor: 'pointer',
					transition: 'background-color 0.2s, border-color 0.2s',
				}}
			>
				Try Again
			</button>
		</div>
	)
}

// ============================================
// RequireSdk Wrapper Component
// ============================================

export interface RequireSdkProps {
	/** Required services */
	services?: SdkService[]
	/** Component type for error messaging */
	componentType?: ComponentType
	/** Theme for error display */
	theme?: ThemeVariables
	/** Fallback behavior */
	fallback?: 'error' | 'null' | 'children'
	/** Children to render when ready */
	children: React.ReactNode
}

/**
 * Declarative wrapper for SDK configuration checking
 *
 * @example
 * ```tsx
 * <RequireSdk services={['auth', 'user']} componentType="sign-in">
 *   <SignInForm />
 * </RequireSdk>
 * ```
 */
export function RequireSdk({
	services = [],
	componentType = 'general',
	theme,
	fallback = 'error',
	children,
}: RequireSdkProps): React.ReactElement | null {
	const { isReady, renderError } = useSdkReady({
		services,
		componentType,
		theme,
		fallback,
	})

	if (!isReady) {
		const error = renderError()
		if (error) return error
		if (fallback === 'children') return <>{children}</>
		return null
	}

	return <>{children}</>
}
