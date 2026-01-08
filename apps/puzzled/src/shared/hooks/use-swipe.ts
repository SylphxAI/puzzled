/**
 * Swipe Gesture Hook
 *
 * Detects swipe gestures for native-like navigation and interactions.
 * Supports horizontal and vertical swipes with configurable thresholds.
 *
 * Usage:
 *   const { onTouchStart, onTouchMove, onTouchEnd } = useSwipe({
 *     onSwipeLeft: () => navigateNext(),
 *     onSwipeRight: () => navigateBack(),
 *   })
 *
 *   <div {...{ onTouchStart, onTouchMove, onTouchEnd }}>
 *     Swipeable content
 *   </div>
 */

import { useCallback, useRef } from 'react'
import { triggerHaptic } from './use-haptic'

type SwipeConfig = {
	/** Callback when swiped left */
	onSwipeLeft?: () => void
	/** Callback when swiped right */
	onSwipeRight?: () => void
	/** Callback when swiped up */
	onSwipeUp?: () => void
	/** Callback when swiped down */
	onSwipeDown?: () => void
	/** Callback during swipe with progress (-1 to 1 for horizontal, vertical) */
	onSwipeProgress?: (deltaX: number, deltaY: number) => void
	/** Callback when swipe ends without triggering action */
	onSwipeCancel?: () => void
	/** Minimum distance to trigger swipe (default: 50px) */
	threshold?: number
	/** Maximum time for swipe gesture (default: 300ms) */
	maxTime?: number
	/** Minimum velocity to trigger swipe (px/ms, default: 0.3) */
	minVelocity?: number
	/** Enable haptic feedback (default: true) */
	hapticFeedback?: boolean
	/** Prevent default touch behavior (default: false) */
	preventDefault?: boolean
}

type TouchState = {
	startX: number
	startY: number
	startTime: number
	currentX: number
	currentY: number
	isTracking: boolean
}

export function useSwipe({
	onSwipeLeft,
	onSwipeRight,
	onSwipeUp,
	onSwipeDown,
	onSwipeProgress,
	onSwipeCancel,
	threshold = 50,
	maxTime = 300,
	minVelocity = 0.3,
	hapticFeedback = true,
	preventDefault = false,
}: SwipeConfig) {
	const touchState = useRef<TouchState>({
		startX: 0,
		startY: 0,
		startTime: 0,
		currentX: 0,
		currentY: 0,
		isTracking: false,
	})

	const onTouchStart = useCallback((e: React.TouchEvent) => {
		const touch = e.touches[0]
		touchState.current = {
			startX: touch.clientX,
			startY: touch.clientY,
			startTime: Date.now(),
			currentX: touch.clientX,
			currentY: touch.clientY,
			isTracking: true,
		}
	}, [])

	const onTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (!touchState.current.isTracking) return

			if (preventDefault) {
				e.preventDefault()
			}

			const touch = e.touches[0]
			touchState.current.currentX = touch.clientX
			touchState.current.currentY = touch.clientY

			if (onSwipeProgress) {
				const deltaX = touch.clientX - touchState.current.startX
				const deltaY = touch.clientY - touchState.current.startY
				onSwipeProgress(deltaX, deltaY)
			}
		},
		[onSwipeProgress, preventDefault],
	)

	const onTouchEnd = useCallback(
		(_e: React.TouchEvent) => {
			if (!touchState.current.isTracking) return

			const { startX, startY, startTime, currentX, currentY } = touchState.current
			touchState.current.isTracking = false

			const deltaX = currentX - startX
			const deltaY = currentY - startY
			const deltaTime = Date.now() - startTime
			const absX = Math.abs(deltaX)
			const absY = Math.abs(deltaY)

			// Calculate velocity
			const velocityX = absX / deltaTime
			const velocityY = absY / deltaTime

			// Determine primary direction
			const isHorizontal = absX > absY

			let callback: (() => void) | undefined

			if (isHorizontal && absX >= threshold) {
				// Check velocity or if it's a slow but intentional swipe
				if (velocityX >= minVelocity || deltaTime <= maxTime) {
					if (deltaX < 0 && onSwipeLeft) {
						callback = onSwipeLeft
					} else if (deltaX > 0 && onSwipeRight) {
						callback = onSwipeRight
					}
				}
			} else if (!isHorizontal && absY >= threshold) {
				if (velocityY >= minVelocity || deltaTime <= maxTime) {
					if (deltaY < 0 && onSwipeUp) {
						callback = onSwipeUp
					} else if (deltaY > 0 && onSwipeDown) {
						callback = onSwipeDown
					}
				}
			}

			if (callback) {
				if (hapticFeedback) {
					triggerHaptic('light')
				}
				callback()
			} else {
				onSwipeCancel?.()
			}
		},
		[
			onSwipeLeft,
			onSwipeRight,
			onSwipeUp,
			onSwipeDown,
			onSwipeCancel,
			threshold,
			maxTime,
			minVelocity,
			hapticFeedback,
		],
	)

	return {
		onTouchStart,
		onTouchMove,
		onTouchEnd,
	}
}
