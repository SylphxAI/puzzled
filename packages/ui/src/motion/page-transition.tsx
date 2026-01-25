'use client'

/**
 * Page Transition Component — CSS First
 *
 * Provides consistent page entrance animations across the application.
 * Uses CSS transitions triggered on mount instead of Framer Motion.
 *
 * No persistent `will-change` compositing layers after animation completes.
 * `transform: none` end state avoids stacking context side effects.
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { duration, easing } from './config'

interface PageTransitionProps {
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
	/** Animation variant */
	variant?: 'fade' | 'fadeUp' | 'fadeScale'
}

const EASE_OUT = `cubic-bezier(${easing.easeOut.join(',')})`

const initialTransforms: Record<PageTransitionProps['variant'] & string, string> = {
	fade: 'none',
	fadeUp: 'translateY(16px)',
	fadeScale: 'scale(0.98)',
}

/**
 * PageTransition - Wraps page content with CSS entrance animation
 *
 * Triggers on mount via requestAnimationFrame to ensure the browser
 * paints the initial (hidden) state before transitioning.
 *
 * @example
 * // In layout.tsx
 * <PageTransition>
 *   {children}
 * </PageTransition>
 */
export function PageTransition({
	children,
	className,
	variant = 'fadeUp',
}: PageTransitionProps) {
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		const raf = requestAnimationFrame(() => setMounted(true))
		return () => cancelAnimationFrame(raf)
	}, [])

	return (
		<div
			className={className}
			style={{
				opacity: mounted ? 1 : 0,
				transform: mounted ? 'none' : initialTransforms[variant],
				transition: `opacity ${duration.medium}s ${EASE_OUT}, transform ${duration.medium}s ${EASE_OUT}`,
			}}
		>
			{children}
		</div>
	)
}

/**
 * PageTransitionMain - For main content areas with full height
 */
export function PageTransitionMain({
	children,
	className,
	variant = 'fadeUp',
}: PageTransitionProps) {
	return (
		<PageTransition variant={variant} className={`flex-1 ${className ?? ''}`}>
			{children}
		</PageTransition>
	)
}
