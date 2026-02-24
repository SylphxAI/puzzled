'use client'

/**
 * Global Error Handler
 *
 * Automatically captures unhandled errors and promise rejections
 * and reports them to the Sylphx Platform via SDK.
 *
 * DOGFOODING: This component uses the SDK's useGlobalErrorHandler hook
 * to demonstrate real error tracking integration.
 */

import { useGlobalErrorHandler } from '@sylphx/sdk/react'

interface GlobalErrorHandlerProps {
	children: React.ReactNode
}

/**
 * Global error handler that captures:
 * - window.onerror (unhandled JavaScript errors)
 * - unhandledrejection (unhandled Promise rejections)
 *
 * Must be placed inside SylphxProvider to have access to monitoring context.
 *
 * @example
 * ```tsx
 * <SylphxProvider>
 *   <GlobalErrorHandler>
 *     <App />
 *   </GlobalErrorHandler>
 * </SylphxProvider>
 * ```
 */
export function GlobalErrorHandler({ children }: GlobalErrorHandlerProps) {
	// SDK hook automatically sets up global error handlers
	useGlobalErrorHandler({
		handleErrors: true,
		handleRejections: true,
		onCapture: (eventId) => {
			if (eventId && process.env.NODE_ENV === 'development') {
				console.log('[Sylphx] Error captured:', eventId)
			}
		},
	})

	return <>{children}</>
}
