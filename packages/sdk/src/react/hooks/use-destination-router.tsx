/**
 * Destination Router React Hook
 *
 * React integration for analytics destination routing.
 * Automatically syncs with consent state.
 *
 * @example
 * ```tsx
 * function App() {
 *   const router = useDestinationRouter({
 *     destinations: [
 *       { type: 'sylphx', config: { apiEndpoint: '/api/sdk/v1/analytics/track' } },
 *       { type: 'ga4', config: { measurementId: 'G-XXXXXX' }, consentRequired: 'analytics' },
 *     ],
 *   })
 *
 *   return (
 *     <button onClick={() => router.track('button_click', { label: 'CTA' })}>
 *       Click me
 *     </button>
 *   )
 * }
 * ```
 */

'use client'

import { useEffect, useRef, useMemo, useCallback } from 'react'
import {
	createDestinationRouter,
	type DestinationRouterConfig,
	type DestinationRouter,
	type DestinationType,
	type DestinationConfig,
	type EventProperties,
	type UserProperties,
} from '../../lib/analytics'
import { useConsent, type ConsentCategory } from '../consent-hooks'
import { useUser } from '../hooks'

// ============================================
// Types
// ============================================

export interface UseDestinationRouterOptions extends Omit<DestinationRouterConfig, 'checkConsent' | 'distinctId'> {
	/** Auto-sync with consent state (default: true) */
	syncConsent?: boolean
	/** Auto-sync distinct ID with user (default: true) */
	syncUser?: boolean
	/** Initialize on mount (default: true) */
	autoInit?: boolean
}

export interface UseDestinationRouterReturn extends DestinationRouter {
	/** Whether router is initialized */
	isInitialized: boolean
	/** Current enabled destinations */
	enabledDestinations: DestinationConfig[]
}

// ============================================
// Hook
// ============================================

/**
 * Hook for multi-destination analytics routing
 *
 * Automatically syncs with consent state and user identification.
 *
 * @param options - Router configuration
 * @returns Destination router with React integration
 *
 * @example
 * ```tsx
 * function Analytics() {
 *   const router = useDestinationRouter({
 *     destinations: [
 *       { type: 'sylphx', config: { apiEndpoint: '/api/sdk/v1/analytics/track' } },
 *       { type: 'ga4', config: { measurementId: 'G-XXXXXX' }, consentRequired: 'analytics' },
 *       { type: 'mixpanel', config: { token: 'xxx' }, consentRequired: 'analytics' },
 *     ],
 *   })
 *
 *   // Track to all destinations
 *   const handlePurchase = () => {
 *     router.track('purchase', { amount: 99.99 })
 *   }
 *
 *   // Track to specific destination only
 *   const handleConversion = () => {
 *     router.trackTo('ga4', 'conversion', { value: 99.99 })
 *   }
 *
 *   return <button onClick={handlePurchase}>Buy Now</button>
 * }
 * ```
 */
export function useDestinationRouter(options: UseDestinationRouterOptions): UseDestinationRouterReturn {
	const { destinations, syncConsent = true, syncUser = true, autoInit = true, debug = false } = options

	const routerRef = useRef<DestinationRouter | null>(null)
	const initializedRef = useRef(false)

	// Get consent state
	const { hasConsent: checkConsent } = useConsent()

	// Get user
	const { user } = useUser()

	// Create router once
	const router = useMemo(() => {
		if (!autoInit || typeof window === 'undefined') return null

		const newRouter = createDestinationRouter({
			destinations,
			checkConsent: syncConsent ? (category: ConsentCategory) => checkConsent(category) : undefined,
			defaultConsent: !syncConsent,
			debug,
			distinctId: syncUser && user?.id ? user.id : undefined,
		})

		routerRef.current = newRouter
		initializedRef.current = true

		return newRouter
	}, [destinations, autoInit, syncConsent, checkConsent, debug, syncUser, user?.id])

	// Sync consent changes
	useEffect(() => {
		if (!syncConsent || !routerRef.current) return
		routerRef.current.setConsentChecker((category) => checkConsent(category))
	}, [syncConsent, checkConsent])

	// Sync user changes
	useEffect(() => {
		if (!syncUser || !routerRef.current || !user?.id) return
		routerRef.current.setDistinctId(user.id)
		// Optionally identify across destinations
		routerRef.current.identify(user.id, {
			email: user.email,
			name: user.name,
		})
	}, [syncUser, user?.id, user?.email, user?.name])

	// Memoized methods to prevent unnecessary re-renders
	const track = useCallback(
		(event: string, properties?: EventProperties) => {
			router?.track(event, properties)
		},
		[router]
	)

	const trackTo = useCallback(
		(destinationType: DestinationType, event: string, properties?: EventProperties) => {
			router?.trackTo(destinationType, event, properties)
		},
		[router]
	)

	const identify = useCallback(
		(userId: string, traits?: UserProperties) => {
			router?.identify(userId, traits)
		},
		[router]
	)

	const page = useCallback(
		(name?: string, properties?: EventProperties) => {
			router?.page(name, properties)
		},
		[router]
	)

	const getEnabledDestinations = useCallback(() => {
		return router?.getEnabledDestinations() || []
	}, [router])

	const setDestinationEnabled = useCallback(
		(type: DestinationType, enabled: boolean) => {
			router?.setDestinationEnabled(type, enabled)
		},
		[router]
	)

	const setConsentChecker = useCallback(
		(fn: (category: ConsentCategory) => boolean) => {
			router?.setConsentChecker(fn)
		},
		[router]
	)

	const setDistinctId = useCallback(
		(id: string) => {
			router?.setDistinctId(id)
		},
		[router]
	)

	return {
		isInitialized: initializedRef.current,
		enabledDestinations: router?.getEnabledDestinations() || [],
		track,
		trackTo,
		identify,
		page,
		getEnabledDestinations,
		setDestinationEnabled,
		setConsentChecker,
		setDistinctId,
	}
}

// ============================================
// Context Hook
// ============================================

import { createContext, useContext, type ReactNode } from 'react'

const DestinationRouterContext = createContext<DestinationRouter | null>(null)

export interface DestinationRouterProviderProps extends UseDestinationRouterOptions {
	children: ReactNode
}

/**
 * Provider for destination router context
 *
 * @example
 * ```tsx
 * <DestinationRouterProvider
 *   destinations={[
 *     { type: 'sylphx', config: { apiEndpoint: '/api/sdk/v1/analytics/track' } },
 *     { type: 'ga4', config: { measurementId: 'G-XXXXXX' } },
 *   ]}
 * >
 *   <App />
 * </DestinationRouterProvider>
 * ```
 */
export function DestinationRouterProvider({ children, ...options }: DestinationRouterProviderProps) {
	const router = useDestinationRouter(options)

	return <DestinationRouterContext.Provider value={router}>{children}</DestinationRouterContext.Provider>
}

/**
 * Hook to access router from context
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const router = useRouterContext()
 *   router?.track('event', { property: 'value' })
 * }
 * ```
 */
export function useRouterContext(): DestinationRouter | null {
	return useContext(DestinationRouterContext)
}

// Re-export types

