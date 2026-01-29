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
import {
	ConfigurationError,
	type ConfigurationComponentType,
} from '../ui/configuration-error'

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

// Re-export for convenience
type ComponentType = ConfigurationComponentType

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

	// Check if SDK is configured (has publishableKey)
	const isConfigured = Boolean(platformContext?.publishableKey)

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

		// Use the ConfigurationError component for consistent, polished UI
		return (
			<ConfigurationError
				theme={theme}
				componentType={componentType}
				onRetry={onRetry ?? (() => window.location.reload())}
			/>
		)
	}, [isSSR, isMounted, isConfigured, requiredServicesReady, fallback, theme, componentType, onRetry])

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
