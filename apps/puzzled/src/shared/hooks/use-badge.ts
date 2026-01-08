/**
 * Badge API Hook
 *
 * Provides access to the Badging API to show notification counts on the app icon.
 * Falls back gracefully on browsers that don't support the API.
 *
 * Features:
 * - Set numeric badges on app icon (PWA/installed apps)
 * - Clear badges
 * - Graceful degradation on unsupported browsers
 * - Auto-clear on unmount (optional)
 *
 * Usage:
 *   const { isSupported, setBadge, clearBadge } = useBadge()
 *
 *   // Show unread count on app icon
 *   setBadge(unreadCount)
 *
 *   // Clear badge
 *   clearBadge()
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'

type BadgeNavigator = Navigator & {
	setAppBadge?: (count?: number) => Promise<void>
	clearAppBadge?: () => Promise<void>
}

export function useBadge(autoClearOnUnmount = false) {
	const badgeCountRef = useRef<number | null>(null)

	// Check if Badge API is supported
	const isSupported = useMemo(() => {
		if (typeof window === 'undefined') return false
		const nav = navigator as BadgeNavigator
		return 'setAppBadge' in nav && 'clearAppBadge' in nav
	}, [])

	/**
	 * Set a badge count on the app icon
	 * @param count - The number to display (omit for a generic badge dot)
	 */
	const setBadge = useCallback(
		async (count?: number) => {
			if (!isSupported) return false

			const nav = navigator as BadgeNavigator

			try {
				await nav.setAppBadge?.(count)
				badgeCountRef.current = count ?? null
				return true
			} catch {
				// Badge API can fail if:
				// - App is not installed
				// - User denied permission
				// - Platform doesn't support badges
				return false
			}
		},
		[isSupported],
	)

	/**
	 * Clear the app badge
	 */
	const clearBadge = useCallback(async () => {
		if (!isSupported) return false

		const nav = navigator as BadgeNavigator

		try {
			await nav.clearAppBadge?.()
			badgeCountRef.current = null
			return true
		} catch {
			// Silently fail if badge clearing fails
			return false
		}
	}, [isSupported])

	// Auto-clear badge on unmount if requested
	useEffect(() => {
		if (!autoClearOnUnmount) return

		return () => {
			if (badgeCountRef.current !== null) {
				clearBadge().catch(() => {
					// Silently fail on cleanup
				})
			}
		}
	}, [autoClearOnUnmount, clearBadge])

	return {
		isSupported,
		setBadge,
		clearBadge,
	}
}
