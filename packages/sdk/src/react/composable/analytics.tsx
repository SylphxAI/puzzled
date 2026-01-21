/**
 * Analytics Provider
 *
 * Composable analytics provider with automatic batching.
 */

'use client'

import {
	createContext,
	useContext,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	type ReactNode,
} from 'react'
import { useSylphxConfig } from './core'
import {
	trackBatch,
	generateAnonymousId,
	type BatchEvent,
} from '../../analytics'

// ============================================================================
// Types
// ============================================================================

interface AnalyticsContextValue {
	track: (event: string, properties?: Record<string, unknown>) => void
	page: (name: string, properties?: Record<string, unknown>) => void
	identify: (userId: string, traits?: Record<string, unknown>) => void
	flush: () => Promise<void>
	anonymousId: string
}

// ============================================================================
// Context
// ============================================================================

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface AnalyticsProviderProps {
	children: ReactNode
	/** User ID (optional, for authenticated users) */
	userId?: string
	/** Auto-track page views */
	autoPageView?: boolean
	/** Batch size before auto-flush */
	batchSize?: number
	/** Batch timeout in ms */
	batchTimeout?: number
}

/**
 * Analytics provider with automatic batching
 *
 * @example
 * ```tsx
 * <SylphxCore appId="my-app" secretKey={key}>
 *   <AnalyticsProvider userId={user?.id} autoPageView>
 *     <App />
 *   </AnalyticsProvider>
 * </SylphxCore>
 * ```
 */
export function AnalyticsProvider({
	children,
	userId,
	autoPageView = true,
	batchSize = 10,
	batchTimeout = 1000,
}: AnalyticsProviderProps) {
	const config = useSylphxConfig()

	// Generate stable anonymous ID
	const anonymousId = useMemo(() => {
		if (typeof window === 'undefined') return generateAnonymousId()

		const key = `sylphx_${config.appId}_anon_id`
		let id = localStorage.getItem(key)
		if (!id) {
			id = generateAnonymousId()
			localStorage.setItem(key, id)
		}
		return id
	}, [config.appId])

	// Event queue
	const queueRef = useRef<BatchEvent[]>([])
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const userIdRef = useRef(userId)
	userIdRef.current = userId

	// Flush queue
	const flush = useCallback(async () => {
		if (queueRef.current.length === 0) return

		const events = queueRef.current
		queueRef.current = []

		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
			timeoutRef.current = null
		}

		try {
			await trackBatch(config, events)
		} catch {
			// Re-queue on failure (limit to 100)
			queueRef.current = [...events, ...queueRef.current].slice(0, 100)
		}
	}, [config])

	// Enqueue event
	const enqueue = useCallback(
		(event: BatchEvent) => {
			queueRef.current.push({
				...event,
				userId: event.userId ?? userIdRef.current,
				anonymousId: event.anonymousId ?? anonymousId,
				timestamp: new Date().toISOString(),
			})

			// Auto-flush on batch size
			if (queueRef.current.length >= batchSize) {
				flush()
			} else {
				// Schedule flush
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current)
				}
				timeoutRef.current = setTimeout(flush, batchTimeout)
			}
		},
		[anonymousId, batchSize, batchTimeout, flush]
	)

	// Track event
	const track = useCallback(
		(event: string, properties?: Record<string, unknown>) => {
			enqueue({ type: 'track', event, properties })
		},
		[enqueue]
	)

	// Track page view
	const page = useCallback(
		(name: string, properties?: Record<string, unknown>) => {
			enqueue({ type: 'page', name, properties })
		},
		[enqueue]
	)

	// Identify user
	const identify = useCallback(
		(id: string, traits?: Record<string, unknown>) => {
			enqueue({ type: 'identify', userId: id, traits })
		},
		[enqueue]
	)

	// Auto page view
	useEffect(() => {
		if (!autoPageView || typeof window === 'undefined') return

		page('$pageview', {
			url: window.location.href,
			path: window.location.pathname,
			referrer: document.referrer,
			title: document.title,
		})
	}, [autoPageView, page])

	// Flush on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
			// Note: Can't await in cleanup, but best effort
			flush()
		}
	}, [flush])

	// Flush on page hide (for navigation)
	useEffect(() => {
		if (typeof window === 'undefined') return

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				flush()
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
	}, [flush])

	const value = useMemo(
		() => ({ track, page, identify, flush, anonymousId }),
		[track, page, identify, flush, anonymousId]
	)

	return (
		<AnalyticsContext.Provider value={value}>
			{children}
		</AnalyticsContext.Provider>
	)
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Full analytics context
 *
 * @example
 * ```tsx
 * function Component() {
 *   const analytics = useAnalytics()
 *   analytics.track('button_clicked', { button: 'buy' })
 * }
 * ```
 */
export function useAnalytics(): AnalyticsContextValue {
	const context = useContext(AnalyticsContext)
	if (!context) {
		throw new Error('useAnalytics must be used within an AnalyticsProvider')
	}
	return context
}

/**
 * Track event (convenience hook)
 *
 * @example
 * ```tsx
 * function BuyButton() {
 *   const track = useTrack()
 *   return <button onClick={() => track('purchase', { amount: 99 })}>Buy</button>
 * }
 * ```
 */
export function useTrack() {
	return useAnalytics().track
}

/**
 * Track page view (convenience hook)
 *
 * @example
 * ```tsx
 * function Page() {
 *   const page = usePage()
 *   useEffect(() => page('Product Page'), [])
 *   return <div>...</div>
 * }
 * ```
 */
export function usePage() {
	return useAnalytics().page
}

/**
 * Identify user (convenience hook)
 *
 * @example
 * ```tsx
 * function Profile() {
 *   const identify = useIdentify()
 *   useEffect(() => {
 *     if (user) identify(user.id, { email: user.email })
 *   }, [user])
 * }
 * ```
 */
export function useIdentify() {
	return useAnalytics().identify
}
