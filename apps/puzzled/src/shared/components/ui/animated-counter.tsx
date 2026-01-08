'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type AnimatedCounterProps = {
	value: number
	/** Duration in milliseconds */
	duration?: number
	/** Format function for the displayed value */
	format?: (value: number) => string
	/** Start animation when element enters viewport */
	animateOnView?: boolean
	className?: string
}

/**
 * AnimatedCounter - Smooth number counting animation
 *
 * Features:
 * - Eased animation for natural feel
 * - Viewport-triggered animation option
 * - Custom formatting support
 * - Respects reduced motion preferences
 */
export function AnimatedCounter({
	value,
	duration = 1000,
	format = (v) => v.toLocaleString(),
	animateOnView = true,
	className,
}: AnimatedCounterProps) {
	const [displayValue, setDisplayValue] = useState(0)
	const [hasAnimated, setHasAnimated] = useState(false)
	const ref = useRef<HTMLSpanElement>(null)

	useEffect(() => {
		// Check for reduced motion preference
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

		if (prefersReducedMotion) {
			setDisplayValue(value)
			setHasAnimated(true)
			return
		}

		const startAnimation = () => {
			if (hasAnimated) return

			const startTime = performance.now()
			const startValue = 0

			const animate = (currentTime: number) => {
				const elapsed = currentTime - startTime
				const progress = Math.min(elapsed / duration, 1)

				// Ease out cubic for natural deceleration
				const eased = 1 - (1 - progress) ** 3
				const current = Math.round(startValue + (value - startValue) * eased)

				setDisplayValue(current)

				if (progress < 1) {
					requestAnimationFrame(animate)
				} else {
					setHasAnimated(true)
				}
			}

			requestAnimationFrame(animate)
		}

		if (!animateOnView) {
			startAnimation()
			return
		}

		// Use Intersection Observer for viewport-triggered animation
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						startAnimation()
						observer.disconnect()
					}
				})
			},
			{ threshold: 0.1 },
		)

		if (ref.current) {
			observer.observe(ref.current)
		}

		return () => observer.disconnect()
	}, [value, duration, animateOnView, hasAnimated])

	return (
		<span ref={ref} className={cn('tabular-nums', className)}>
			{format(displayValue)}
		</span>
	)
}
