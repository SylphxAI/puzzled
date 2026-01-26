'use client'

/**
 * Session Replay Error Hook
 *
 * Hook for marking errors in session replay from error boundaries.
 * Provides correlation between errors and session recordings.
 */

import { useCallback } from 'react'

interface SessionReplayWindow extends Window {
	__puzzledSessionReplay?: {
		sessionId: string | null
		markError: (errorId: string, error: Error, metadata?: Record<string, unknown>) => void
		markNavigation: (from: string, to: string) => void
		markConversion: (name: string, value?: number) => void
	}
}

export interface UseSessionReplayErrorReturn {
	/**
	 * Mark an error in the session replay timeline
	 * Returns the error ID for correlation with error tracking
	 */
	markError: (error: Error, metadata?: Record<string, unknown>) => string | null

	/**
	 * Get the current session replay ID (for error reports)
	 */
	getSessionId: () => string | null

	/**
	 * Check if session replay is active
	 */
	isRecording: () => boolean
}

/**
 * Hook for error boundary integration with session replay
 *
 * @example
 * ```tsx
 * function ErrorBoundary({ children }) {
 *   const { markError, getSessionId } = useSessionReplayError()
 *
 *   const handleError = (error: Error) => {
 *     const errorId = markError(error, { component: 'GameBoard' })
 *     // errorId can be used for error tracking correlation
 *   }
 *
 *   return <ReactErrorBoundary onError={handleError}>{children}</ReactErrorBoundary>
 * }
 * ```
 */
export function useSessionReplayError(): UseSessionReplayErrorReturn {
	const markError = useCallback(
		(error: Error, metadata?: Record<string, unknown>): string | null => {
			if (typeof window === 'undefined') return null

			const replay = (window as SessionReplayWindow).__puzzledSessionReplay
			if (!replay) return null

			const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
			replay.markError(errorId, error, metadata)

			return errorId
		},
		[],
	)

	const getSessionId = useCallback((): string | null => {
		if (typeof window === 'undefined') return null
		return (window as SessionReplayWindow).__puzzledSessionReplay?.sessionId ?? null
	}, [])

	const isRecording = useCallback((): boolean => {
		if (typeof window === 'undefined') return false
		return !!(window as SessionReplayWindow).__puzzledSessionReplay?.sessionId
	}, [])

	return {
		markError,
		getSessionId,
		isRecording,
	}
}
