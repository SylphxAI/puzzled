/**
 * Session Replay React Hook
 *
 * Easy integration of session replay with React applications.
 * Automatically manages recording lifecycle and error correlation.
 *
 * When used within SylphxProvider, automatically uploads to the backend.
 * Otherwise, you can provide a custom upload handler or endpoint.
 *
 * @example
 * ```tsx
 * // With SylphxProvider (automatic backend integration)
 * function App() {
 *   return (
 *     <SylphxProvider appId="...">
 *       <SessionReplayRecorder />
 *       <YourApp />
 *     </SylphxProvider>
 *   )
 * }
 *
 * // Manual usage
 * function MyComponent() {
 *   const { sessionId, isRecording, markError } = useSessionReplay({
 *     privacyMode: 'balanced',
 *     errorCorrelation: true,
 *   })
 *
 *   return <div>Session: {sessionId}</div>
 * }
 * ```
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
	SessionRecorder,
	type RecorderStatus,
	type SessionReplayConfig,
	type SessionData,
} from '../../lib/monitoring'

/** REST API client interface for session replay */
interface SessionReplayAPI {
	upload: (data: {
		metadata: SessionData['metadata']
		events: SessionData['events']
		markers: SessionData['markers']
		rageClicks: SessionData['rageClicks']
		deadClicks: SessionData['deadClicks']
		networkRequests: SessionData['networkRequests']
		consoleLogs: SessionData['consoleLogs']
	}) => Promise<void>
	endSession: (sessionId: string, duration: number) => Promise<void>
}

// ==========================================
// Types
// ==========================================

export interface UseSessionReplayOptions extends Partial<SessionReplayConfig> {
	/**
	 * Start recording automatically on mount
	 * @default true
	 */
	autoStart?: boolean

	/**
	 * Stop recording on unmount
	 * @default true
	 */
	stopOnUnmount?: boolean

	/**
	 * Upload endpoint path (fallback if not using api)
	 * @default '/api/session-replay'
	 */
	uploadEndpoint?: string

	/**
	 * Custom upload handler (overrides API and endpoint)
	 */
	onUpload?: (data: SessionData) => Promise<void>

	/**
	 * Error callback
	 */
	onError?: (error: Error) => void

	/**
	 * User ID to associate with session
	 */
	userId?: string

	/**
	 * SDK API client for automatic backend integration
	 * Pass an object with upload and endSession methods
	 *
	 * @example
	 * ```tsx
	 * const { sessionId } = useSessionReplay({ api: sessionReplayApi })
	 * ```
	 */
	api?: SessionReplayAPI
}

export interface UseSessionReplayReturn {
	/** Current session ID */
	sessionId: string | null
	/** Whether recording is active */
	isRecording: boolean
	/** Recorder status */
	status: RecorderStatus
	/** Start recording */
	start: () => string
	/** Pause recording */
	pause: () => void
	/** Resume recording */
	resume: () => void
	/** Stop recording */
	stop: () => Promise<void>
	/** Mark an error in the timeline */
	markError: (errorId: string, error: Error, metadata?: Record<string, unknown>) => void
	/** Mark a navigation event */
	markNavigation: (from: string, to: string) => void
	/** Mark a conversion event */
	markConversion: (name: string, value?: number) => void
	/** Add a custom marker */
	addMarker: (type: string, payload?: Record<string, unknown>) => void
}

// ==========================================
// Hook
// ==========================================

/**
 * React hook for session replay
 *
 * Provides easy integration with automatic lifecycle management,
 * error correlation, and server upload.
 *
 * When api is provided, automatically uploads to the backend.
 * Otherwise, falls back to the uploadEndpoint or custom onUpload handler.
 */
export function useSessionReplay(options: UseSessionReplayOptions = {}): UseSessionReplayReturn {
	const {
		autoStart = true,
		stopOnUnmount = true,
		uploadEndpoint = '/api/session-replay',
		onUpload: customUpload,
		onError,
		userId,
		api,
		...recorderConfig
	} = options

	// Store API in ref for async access
	const apiRef = useRef<SessionReplayAPI | undefined>(api)

	// Update API ref when it changes
	useEffect(() => {
		apiRef.current = api
	}, [api])

	// Recorder instance
	const recorderRef = useRef<SessionRecorder | null>(null)
	const currentSessionIdRef = useRef<string | null>(null)

	// State
	const [sessionId, setSessionId] = useState<string | null>(null)
	const [status, setStatus] = useState<RecorderStatus>({
		state: 'idle',
		sessionId: null,
		eventCount: 0,
		startTime: null,
		duration: 0,
		bytesRecorded: 0,
	})

	// Initialize recorder
	useEffect(() => {
		if (typeof window === 'undefined') return

		recorderRef.current = new SessionRecorder(recorderConfig)

		// Setup upload handler with priority:
		// 1. Custom upload handler
		// 2. API client if provided
		// 3. Fallback to fetch endpoint
		const uploadHandler = customUpload
			? customUpload
			: api
				? createApiUploadHandler(apiRef)
				: createDefaultUploadHandler(uploadEndpoint)

		recorderRef.current.onUpload(uploadHandler)

		// Setup error handler
		if (onError) {
			recorderRef.current.onError(onError)
		}

		// Auto start
		if (autoStart) {
			try {
				const id = recorderRef.current.start()
				setSessionId(id)
				currentSessionIdRef.current = id
			} catch (error) {
				// Sampling may prevent recording
				if (onError && error instanceof Error) {
					onError(error)
				}
			}
		}

		// Status update interval
		const statusInterval = setInterval(() => {
			if (recorderRef.current) {
				setStatus(recorderRef.current.getStatus())
			}
		}, 1000)

		// Cleanup
		return () => {
			clearInterval(statusInterval)

			if (stopOnUnmount && recorderRef.current) {
				// End session on backend
				if (currentSessionIdRef.current && apiRef.current) {
					void apiRef.current.endSession(
						currentSessionIdRef.current,
						recorderRef.current.getStatus().duration
					)
				}
				void recorderRef.current.stop()
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Update userId when it changes
	useEffect(() => {
		if (userId && recorderRef.current) {
			recorderRef.current.addMarker('custom', { type: 'user-identified', userId })
		}
	}, [userId])

	// ==========================================
	// Actions
	// ==========================================

	const start = useCallback((): string => {
		if (!recorderRef.current) {
			throw new Error('Recorder not initialized')
		}
		const id = recorderRef.current.start()
		setSessionId(id)
		return id
	}, [])

	const pause = useCallback((): void => {
		recorderRef.current?.pause()
	}, [])

	const resume = useCallback((): void => {
		recorderRef.current?.resume()
	}, [])

	const stop = useCallback(async (): Promise<void> => {
		await recorderRef.current?.stop()
		setSessionId(null)
	}, [])

	const markError = useCallback(
		(errorId: string, error: Error, metadata?: Record<string, unknown>): void => {
			recorderRef.current?.markError(errorId, error, metadata)
		},
		[]
	)

	const markNavigation = useCallback((from: string, to: string): void => {
		recorderRef.current?.markNavigation(from, to)
	}, [])

	const markConversion = useCallback((name: string, value?: number): void => {
		recorderRef.current?.markConversion(name, value)
	}, [])

	const addMarker = useCallback((type: string, payload?: Record<string, unknown>): void => {
		recorderRef.current?.addMarker(type as 'custom', payload)
	}, [])

	return {
		sessionId,
		isRecording: status.state === 'recording',
		status,
		start,
		pause,
		resume,
		stop,
		markError,
		markNavigation,
		markConversion,
		addMarker,
	}
}

// ==========================================
// Helpers
// ==========================================

/**
 * Create upload handler that uses the SDK API client
 */
function createApiUploadHandler(
	apiRef: React.MutableRefObject<SessionReplayAPI | undefined>
): (data: SessionData) => Promise<void> {
	return async (data: SessionData) => {
		const api = apiRef.current
		if (!api) {
			throw new Error('API client not available')
		}

		await api.upload({
			metadata: data.metadata,
			events: data.events,
			markers: data.markers,
			rageClicks: data.rageClicks,
			deadClicks: data.deadClicks,
			networkRequests: data.networkRequests,
			consoleLogs: data.consoleLogs,
		})
	}
}

/**
 * Create default upload handler (fallback to fetch)
 */
function createDefaultUploadHandler(endpoint: string): (data: SessionData) => Promise<void> {
	return async (data: SessionData) => {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		})

		if (!response.ok) {
			throw new Error(`Upload failed: ${response.status}`)
		}
	}
}

// ==========================================
// Context Integration
// ==========================================

/**
 * Hook for marking errors from the error boundary
 */
export function useSessionReplayErrorMarker(): {
	markError: (error: Error, errorInfo?: { componentStack?: string }) => string
} {
	const recorderRef = useRef<SessionRecorder | null>(null)

	// Get recorder instance
	useEffect(() => {
		// Access global recorder if it exists
		if (
			typeof window !== 'undefined' &&
			(window as unknown as { __sylphxRecorder?: SessionRecorder }).__sylphxRecorder
		) {
			recorderRef.current = (window as unknown as { __sylphxRecorder: SessionRecorder })
				.__sylphxRecorder
		}
	}, [])

	const markError = useCallback(
		(error: Error, errorInfo?: { componentStack?: string }): string => {
			const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

			recorderRef.current?.markError(errorId, error, {
				componentStack: errorInfo?.componentStack?.slice(0, 500),
			})

			return errorId
		},
		[]
	)

	return { markError }
}

// ==========================================
// HOC for automatic recording
// ==========================================

export interface WithSessionReplayProps {
	sessionReplay: UseSessionReplayReturn
}

/**
 * HOC to inject session replay into a component
 */
export function withSessionReplay<P extends object>(
	Component: React.ComponentType<P & WithSessionReplayProps>,
	options?: UseSessionReplayOptions
): (props: P) => React.ReactElement {
	function WithSessionReplayWrapper(props: P): React.ReactElement {
		const sessionReplay = useSessionReplay(options)
		return <Component {...props} sessionReplay={sessionReplay} />
	}

	WithSessionReplayWrapper.displayName = `withSessionReplay(${Component.displayName || Component.name || 'Component'})`

	return WithSessionReplayWrapper
}
