/**
 * Wake Lock Hook
 *
 * Prevents the screen from dimming or locking during gameplay using the Screen Wake Lock API.
 * Falls back gracefully on devices that don't support the API.
 *
 * Features:
 * - Automatically releases lock on unmount
 * - Handles visibility changes (releases when tab hidden)
 * - Graceful degradation on unsupported browsers
 * - Re-acquires lock when tab becomes visible again
 *
 * Usage:
 *   const { isActive, isSupported, request, release } = useWakeLock()
 *
 *   // Request wake lock during active gameplay
 *   useEffect(() => {
 *     if (isGameActive) {
 *       request()
 *     } else {
 *       release()
 *     }
 *   }, [isGameActive])
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type WakeLockSentinel = {
	released: boolean
	release: () => Promise<void>
	addEventListener: (type: string, listener: () => void) => void
	removeEventListener: (type: string, listener: () => void) => void
}

export function useWakeLock() {
	const [isActive, setIsActive] = useState(false)
	const sentinelRef = useRef<WakeLockSentinel | null>(null)
	const requestedRef = useRef(false)

	// Check if Wake Lock API is supported
	const isSupported = useMemo(() => {
		if (typeof window === 'undefined') return false
		return 'wakeLock' in navigator
	}, [])

	/**
	 * Request a wake lock to keep the screen on
	 */
	const request = useCallback(async () => {
		if (!isSupported) return false

		// Already have an active lock
		if (sentinelRef.current && !sentinelRef.current.released) {
			return true
		}

		try {
			const sentinel = (await (
				navigator as Navigator & {
					wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinel> }
				}
			).wakeLock.request('screen')) as WakeLockSentinel

			sentinelRef.current = sentinel
			requestedRef.current = true
			setIsActive(true)

			// Listen for release events (can happen if user switches tabs)
			const handleRelease = () => {
				setIsActive(false)
			}

			sentinel.addEventListener('release', handleRelease)

			return true
		} catch {
			// Wake lock request can fail if:
			// - Document is not visible
			// - Battery is low
			// - User denied permission
			setIsActive(false)
			requestedRef.current = false
			return false
		}
	}, [isSupported])

	/**
	 * Release the wake lock
	 */
	const release = useCallback(async () => {
		if (!sentinelRef.current) return

		try {
			await sentinelRef.current.release()
			sentinelRef.current = null
			requestedRef.current = false
			setIsActive(false)
		} catch {
			// Silently fail - lock may already be released
		}
	}, [])

	// Handle visibility changes - re-request lock when tab becomes visible
	useEffect(() => {
		if (!isSupported) return

		const handleVisibilityChange = async () => {
			if (document.visibilityState === 'visible' && requestedRef.current) {
				// Re-request the lock when tab becomes visible
				await request()
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [isSupported, request])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (sentinelRef.current) {
				sentinelRef.current.release().catch(() => {
					// Silently fail
				})
			}
		}
	}, [])

	return {
		isActive,
		isSupported,
		request,
		release,
	}
}
