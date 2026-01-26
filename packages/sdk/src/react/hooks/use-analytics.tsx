/**
 * Analytics React Hooks
 *
 * React hooks for analytics with:
 * - Context provider for app-wide configuration
 * - Automatic user identification
 * - Page view tracking
 * - Custom event tracking
 *
 * @example
 * ```tsx
 * // 1. Wrap your app with the provider
 * function App() {
 *   return (
 *     <AnalyticsProvider
 *       config={{
 *         apiEndpoint: '/api/analytics/track',
 *         autocapture: true,
 *       }}
 *     >
 *       <YourApp />
 *     </AnalyticsProvider>
 *   )
 * }
 *
 * // 2. Use analytics in components
 * function CheckoutButton() {
 *   const { track } = useAnalytics()
 *
 *   const handleClick = () => {
 *     track('checkout_started', { cart_value: 99.99 })
 *   }
 *
 *   return <button onClick={handleClick}>Checkout</button>
 * }
 *
 * // 3. Identify users after login
 * function LoginForm() {
 *   const { identify } = useAnalytics()
 *
 *   const onLogin = (user) => {
 *     identify(user.id, { email: user.email })
 *   }
 * }
 * ```
 */

'use client'

import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from 'react'
import {
	AnalyticsTracker,
	initAnalytics,
	resetAnalyticsTracker,
} from '../../lib/analytics'
import type {
	AnalyticsConfig,
	EventProperties,
	UserProperties,
	GroupProperties,
} from '../../lib/analytics/types'

// ==========================================
// Context Types
// ==========================================

interface AnalyticsContextValue {
	/** The tracker instance */
	tracker: AnalyticsTracker
	/** Whether analytics is ready */
	isReady: boolean
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null)

// ==========================================
// Provider Props
// ==========================================

export interface AnalyticsProviderProps {
	children: React.ReactNode
	/** Analytics configuration */
	config?: Partial<AnalyticsConfig>
	/** User to identify on mount */
	user?: {
		id: string
		properties?: UserProperties
	}
	/** Disable analytics (e.g., for testing) */
	disabled?: boolean
}

// ==========================================
// Provider Component
// ==========================================

/**
 * Analytics Provider
 *
 * Provides analytics context to your app.
 */
export function AnalyticsProvider({
	children,
	config = {},
	user,
	disabled = false,
}: AnalyticsProviderProps) {
	const trackerRef = useRef<AnalyticsTracker | null>(null)
	const [isReady, setIsReady] = React.useState(false)

	// Initialize tracker
	useEffect(() => {
		if (disabled || typeof window === 'undefined') return

		const tracker = initAnalytics(config)
		trackerRef.current = tracker
		setIsReady(true)

		return () => {
			tracker.shutdown()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [disabled])

	// Identify user when provided
	useEffect(() => {
		if (user && trackerRef.current) {
			trackerRef.current.identify(user.id, user.properties)
		}
	}, [user])

	// Build context value
	const value = useMemo<AnalyticsContextValue | null>(() => {
		if (!trackerRef.current || disabled) return null

		return {
			tracker: trackerRef.current,
			isReady,
		}
	}, [isReady, disabled])

	if (disabled) {
		return <>{children}</>
	}

	return (
		<AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
	)
}

// ==========================================
// Main Hook
// ==========================================

export interface UseAnalyticsReturn {
	/** Track a custom event */
	track: (eventName: string, properties?: EventProperties) => void
	/** Identify a user */
	identify: (userId: string, properties?: UserProperties) => void
	/** Reset identity (logout) */
	reset: () => void
	/** Set user properties */
	setUserProperties: (properties: UserProperties) => void
	/** Set user properties once */
	setUserPropertiesOnce: (properties: UserProperties) => void
	/** Increment a numeric user property */
	incrementUserProperty: (property: string, value?: number) => void
	/** Associate user with a group */
	group: (groupType: string, groupKey: string, properties?: GroupProperties) => void
	/** Register super properties (added to all events) */
	register: (properties: EventProperties) => void
	/** Get current distinct ID */
	getDistinctId: () => string | null
	/** Whether analytics is ready */
	isReady: boolean
	/** Flush pending events */
	flush: () => Promise<void>
}

/**
 * Main analytics hook
 */
export function useAnalyticsHook(): UseAnalyticsReturn {
	const ctx = useContext(AnalyticsContext)

	// Create no-op implementations for when context is not available
	const noopTrack = useCallback(() => {}, [])
	const noopIdentify = useCallback(() => {}, [])
	const noopReset = useCallback(() => {}, [])
	const noopSetUserProperties = useCallback(() => {}, [])
	const noopSetUserPropertiesOnce = useCallback(() => {}, [])
	const noopIncrementUserProperty = useCallback(() => {}, [])
	const noopGroup = useCallback(() => {}, [])
	const noopRegister = useCallback(() => {}, [])
	const noopGetDistinctId = useCallback(() => null, [])
	const noopFlush = useCallback(async () => {}, [])

	// If no context, return no-op implementations
	if (!ctx) {
		return {
			track: noopTrack,
			identify: noopIdentify,
			reset: noopReset,
			setUserProperties: noopSetUserProperties,
			setUserPropertiesOnce: noopSetUserPropertiesOnce,
			incrementUserProperty: noopIncrementUserProperty,
			group: noopGroup,
			register: noopRegister,
			getDistinctId: noopGetDistinctId,
			isReady: false,
			flush: noopFlush,
		}
	}

	const { tracker, isReady } = ctx

	return {
		track: useCallback(
			(eventName: string, properties?: EventProperties) => {
				tracker.track(eventName, properties)
			},
			[tracker]
		),
		identify: useCallback(
			(userId: string, properties?: UserProperties) => {
				tracker.identify(userId, properties)
			},
			[tracker]
		),
		reset: useCallback(() => {
			tracker.reset()
		}, [tracker]),
		setUserProperties: useCallback(
			(properties: UserProperties) => {
				tracker.setUserProperties(properties)
			},
			[tracker]
		),
		setUserPropertiesOnce: useCallback(
			(properties: UserProperties) => {
				tracker.setUserPropertiesOnce(properties)
			},
			[tracker]
		),
		incrementUserProperty: useCallback(
			(property: string, value?: number) => {
				tracker.incrementUserProperty(property, value)
			},
			[tracker]
		),
		group: useCallback(
			(groupType: string, groupKey: string, properties?: GroupProperties) => {
				tracker.group(groupType, groupKey, properties)
			},
			[tracker]
		),
		register: useCallback(
			(properties: EventProperties) => {
				tracker.register(properties)
			},
			[tracker]
		),
		getDistinctId: useCallback(() => {
			return tracker.getDistinctId()
		}, [tracker]),
		isReady,
		flush: useCallback(async () => {
			await tracker.flush()
		}, [tracker]),
	}
}

// ==========================================
// Utility Hooks
// ==========================================

/**
 * Hook to track page views manually
 */
export function usePageView(pageName?: string, properties?: EventProperties): void {
	const { track, isReady } = useAnalyticsHook()
	const hasTracked = useRef(false)

	useEffect(() => {
		if (!isReady || hasTracked.current) return

		hasTracked.current = true
		track('$pageview', {
			$pathname: pageName || window.location.pathname,
			...properties,
		})
	}, [isReady, track, pageName, properties])
}

/**
 * Hook to track component renders
 */
export function useComponentTracking(
	componentName: string,
	properties?: EventProperties
): void {
	const { track, isReady } = useAnalyticsHook()
	const mountTime = useRef(Date.now())
	const hasTracked = useRef(false)

	useEffect(() => {
		if (!isReady || hasTracked.current) return

		hasTracked.current = true
		track('component_viewed', {
			component: componentName,
			...properties,
		})

		return () => {
			const timeVisible = Date.now() - mountTime.current
			track('component_hidden', {
				component: componentName,
				time_visible_ms: timeVisible,
			})
		}
	}, [isReady, track, componentName, properties])
}

/**
 * Hook to track feature usage
 */
export function useFeatureTracking(
	featureName: string
): {
	trackUsed: (properties?: EventProperties) => void
	trackError: (error: Error, properties?: EventProperties) => void
} {
	const { track } = useAnalyticsHook()

	const trackUsed = useCallback(
		(properties?: EventProperties) => {
			track('feature_used', {
				feature: featureName,
				...properties,
			})
		},
		[track, featureName]
	)

	const trackError = useCallback(
		(error: Error, properties?: EventProperties) => {
			track('feature_error', {
				feature: featureName,
				error_message: error.message,
				error_name: error.name,
				...properties,
			})
		},
		[track, featureName]
	)

	return { trackUsed, trackError }
}

/**
 * Hook to track form interactions
 */
export function useFormTracking(
	formName: string
): {
	trackStarted: () => void
	trackCompleted: (properties?: EventProperties) => void
	trackAbandoned: () => void
	trackFieldFilled: (fieldName: string) => void
	trackError: (fieldName: string, error: string) => void
} {
	const { track } = useAnalyticsHook()
	const startTime = useRef<number | null>(null)
	const fieldsFilledRef = useRef<Set<string>>(new Set())

	const trackStarted = useCallback(() => {
		startTime.current = Date.now()
		track('form_started', { form: formName })
	}, [track, formName])

	const trackCompleted = useCallback(
		(properties?: EventProperties) => {
			const duration = startTime.current ? Date.now() - startTime.current : undefined
			track('form_completed', {
				form: formName,
				duration_ms: duration,
				fields_filled: fieldsFilledRef.current.size,
				...properties,
			})
		},
		[track, formName]
	)

	const trackAbandoned = useCallback(() => {
		const duration = startTime.current ? Date.now() - startTime.current : undefined
		track('form_abandoned', {
			form: formName,
			duration_ms: duration,
			fields_filled: fieldsFilledRef.current.size,
		})
	}, [track, formName])

	const trackFieldFilled = useCallback(
		(fieldName: string) => {
			if (!fieldsFilledRef.current.has(fieldName)) {
				fieldsFilledRef.current.add(fieldName)
				track('form_field_filled', {
					form: formName,
					field: fieldName,
				})
			}
		},
		[track, formName]
	)

	const trackError = useCallback(
		(fieldName: string, error: string) => {
			track('form_field_error', {
				form: formName,
				field: fieldName,
				error,
			})
		},
		[track, formName]
	)

	return {
		trackStarted,
		trackCompleted,
		trackAbandoned,
		trackFieldFilled,
		trackError,
	}
}

/**
 * Hook to track time spent on a page/component
 */
export function useTimeTracking(
	name: string,
	options?: {
		trackOnUnmount?: boolean
		trackIntervals?: number[]
	}
): {
	getTimeSpent: () => number
	trackNow: () => void
} {
	const { track } = useAnalyticsHook()
	const startTime = useRef(Date.now())
	const trackedIntervals = useRef<Set<number>>(new Set())

	const getTimeSpent = useCallback(() => {
		return Date.now() - startTime.current
	}, [])

	const trackNow = useCallback(() => {
		track('time_spent', {
			name,
			duration_ms: getTimeSpent(),
		})
	}, [track, name, getTimeSpent])

	useEffect(() => {
		if (!options?.trackIntervals) return

		const checkIntervals = () => {
			const elapsed = getTimeSpent()

			for (const interval of options.trackIntervals!) {
				if (elapsed >= interval && !trackedIntervals.current.has(interval)) {
					trackedIntervals.current.add(interval)
					track('time_milestone', {
						name,
						milestone_ms: interval,
						actual_ms: elapsed,
					})
				}
			}
		}

		const intervalId = setInterval(checkIntervals, 1000)
		return () => clearInterval(intervalId)
	}, [track, name, getTimeSpent, options?.trackIntervals])

	useEffect(() => {
		if (!options?.trackOnUnmount) return

		return () => {
			track('time_spent', {
				name,
				duration_ms: getTimeSpent(),
			})
		}
	}, [track, name, getTimeSpent, options?.trackOnUnmount])

	return { getTimeSpent, trackNow }
}

// ==========================================
// Export Types
// ==========================================


