/**
 * Monitoring Hooks
 *
 * React hooks for Sylphx Platform error tracking and monitoring.
 * Apps can capture errors without their own Sentry DSN.
 *
 * Uses proper React Context pattern (no module singletons).
 */

'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
	useMonitoringContext,
	type Breadcrumb,
	type ExceptionValue,
	type CaptureExceptionOptions,
	type CaptureMessageOptions,
} from './services-context'
import type { MonitoringLevel } from '../types'

// Re-export types for convenience
export type { MonitoringLevel, Breadcrumb,  CaptureExceptionOptions, CaptureMessageOptions }

// ============================================
// Helper Functions
// ============================================

/**
 * Parse an Error object into Sentry exception format
 */
function parseError(error: Error): ExceptionValue {
	const frames: ExceptionValue['stacktrace'] = { frames: [] }

	if (error.stack) {
		const lines = error.stack.split('\n').slice(1) // Skip first line (error message)
		for (const line of lines) {
			// Parse stack trace lines like "    at functionName (file:line:col)"
			const match = line.match(/^\s*at\s+(?:(.+?)\s+)?(?:\()?(.+?):(\d+):(\d+)\)?$/)
			if (match) {
				frames.frames.push({
					function: match[1] || '<anonymous>',
					filename: match[2],
					lineno: parseInt(match[3] ?? '0', 10),
					colno: parseInt(match[4] ?? '0', 10),
					in_app: !match[2]?.includes('node_modules'),
				})
			}
		}
	}

	return {
		type: error.name || 'Error',
		value: error.message,
		stacktrace: frames.frames.length > 0 ? frames : undefined,
	}
}

// ============================================
// useErrorTracking
// ============================================

export interface UseErrorTrackingReturn {
	/** Capture an error/exception */
	captureException: (error: Error, options?: CaptureExceptionOptions) => Promise<string | null>
	/** Capture a message */
	captureMessage: (message: string, options?: CaptureMessageOptions) => Promise<string | null>
	/** Add a breadcrumb */
	addBreadcrumb: (breadcrumb: Breadcrumb) => void
	/** Set current route/page for context */
	setRoute: (route: string) => void
}

/**
 * Hook for error tracking
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { captureException, captureMessage, addBreadcrumb } = useErrorTracking()
 *
 *   useEffect(() => {
 *     addBreadcrumb({ category: 'navigation', message: 'Loaded MyComponent' })
 *   }, [])
 *
 *   const handleClick = async () => {
 *     try {
 *       await riskyOperation()
 *     } catch (error) {
 *       captureException(error, { tags: { feature: 'my-feature' } })
 *     }
 *   }
 *
 *   return <button onClick={handleClick}>Do Something</button>
 * }
 * ```
 */
export function useErrorTracking(): UseErrorTrackingReturn {
	const ctx = useMonitoringContext()
	const breadcrumbsRef = useRef<Breadcrumb[]>([])
	const routeRef = useRef<string | null>(null)

	const captureException = useCallback(
		async (error: Error, options: CaptureExceptionOptions = {}): Promise<string | null> => {
			try {
				const result = await ctx.captureException(error, {
					level: options.level ?? 'error',
					tags: options.tags,
					extra: {
						...options.extra,
						breadcrumbs: breadcrumbsRef.current,
					},
					fingerprint: options.fingerprint,
					route: options.route ?? routeRef.current ?? undefined,
					userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
				})

				// Clear breadcrumbs after sending
				breadcrumbsRef.current = []

				return result.eventId
			} catch {
				console.error('[Sylphx] Failed to capture exception:', error)
				return null
			}
		},
		[ctx]
	)

	const captureMessage = useCallback(
		async (message: string, options: CaptureMessageOptions = {}): Promise<string | null> => {
			try {
				const result = await ctx.captureMessage(message, {
					level: options.level ?? 'info',
					tags: options.tags,
					extra: options.extra,
					route: options.route ?? routeRef.current ?? undefined,
				})
				return result.eventId
			} catch {
				console.error('[Sylphx] Failed to capture message:', message)
				return null
			}
		},
		[ctx]
	)

	const addBreadcrumb = useCallback((breadcrumb: Breadcrumb) => {
		breadcrumbsRef.current.push({
			...breadcrumb,
			timestamp: breadcrumb.timestamp ?? Date.now(),
		})

		// Keep only last 100 breadcrumbs
		if (breadcrumbsRef.current.length > 100) {
			breadcrumbsRef.current = breadcrumbsRef.current.slice(-100)
		}
	}, [])

	const setRoute = useCallback(
		(route: string) => {
			routeRef.current = route
			addBreadcrumb({
				type: 'navigation',
				category: 'route',
				message: route,
			})
		},
		[addBreadcrumb]
	)

	return {
		captureException,
		captureMessage,
		addBreadcrumb,
		setRoute,
	}
}

// ============================================
// ErrorBoundary Integration
// ============================================

export interface UseErrorBoundaryOptions {
	/** Called when an error is caught */
	onError?: (error: Error, eventId: string | null) => void
	/** Component name for context */
	componentName?: string
}

/**
 * Hook for error boundary integration
 * Use this inside your error boundary component
 *
 * @example
 * ```tsx
 * function MyErrorBoundary({ children }) {
 *   const { handleError, ErrorFallback } = useErrorBoundary({
 *     componentName: 'App'
 *   })
 *
 *   return (
 *     <ErrorBoundary onError={handleError} FallbackComponent={ErrorFallback}>
 *       {children}
 *     </ErrorBoundary>
 *   )
 * }
 * ```
 */
export function useErrorBoundary(options: UseErrorBoundaryOptions = {}) {
	const { captureException } = useErrorTracking()

	const handleError = useCallback(
		async (error: Error, errorInfo?: { componentStack?: string }) => {
			const eventId = await captureException(error, {
				tags: {
					errorBoundary: 'true',
					...(options.componentName && { component: options.componentName }),
				},
				extra: {
					componentStack: errorInfo?.componentStack,
				},
			})

			options.onError?.(error, eventId)
		},
		[captureException, options]
	)

	return { handleError }
}

// ============================================
// Global Error Handlers
// ============================================

export interface UseGlobalErrorHandlerOptions {
	/** Enable window.onerror handler */
	handleErrors?: boolean
	/** Enable unhandledrejection handler */
	handleRejections?: boolean
	/** Called when an error is captured */
	onCapture?: (eventId: string | null) => void
}

/**
 * Hook that sets up global error handlers
 * Should be used once at the app root
 *
 * @example
 * ```tsx
 * function App() {
 *   useGlobalErrorHandler({
 *     handleErrors: true,
 *     handleRejections: true,
 *   })
 *
 *   return <MyApp />
 * }
 * ```
 */
export function useGlobalErrorHandler(options: UseGlobalErrorHandlerOptions = {}) {
	const { handleErrors = true, handleRejections = true, onCapture } = options
	const { captureException } = useErrorTracking()

	useEffect(() => {
		if (typeof window === 'undefined') return

		const handleWindowError = async (event: ErrorEvent) => {
			if (event.error instanceof Error) {
				const eventId = await captureException(event.error, {
					tags: { source: 'window.onerror' },
					extra: {
						filename: event.filename,
						lineno: event.lineno,
						colno: event.colno,
					},
				})
				onCapture?.(eventId)
			}
		}

		const handleUnhandledRejection = async (event: PromiseRejectionEvent) => {
			const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))

			const eventId = await captureException(error, {
				tags: { source: 'unhandledrejection' },
			})
			onCapture?.(eventId)
		}

		if (handleErrors) {
			window.addEventListener('error', handleWindowError)
		}
		if (handleRejections) {
			window.addEventListener('unhandledrejection', handleUnhandledRejection)
		}

		return () => {
			if (handleErrors) {
				window.removeEventListener('error', handleWindowError)
			}
			if (handleRejections) {
				window.removeEventListener('unhandledrejection', handleUnhandledRejection)
			}
		}
	}, [handleErrors, handleRejections, captureException, onCapture])
}

// Note: The useMonitoring alias has been intentionally removed.
// Use useErrorTracking directly for clarity.
