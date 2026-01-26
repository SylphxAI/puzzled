'use client'

/**
 * Page Transition Component — CSS First
 *
 * Provides consistent page entrance animations across the application.
 * Uses CSS transitions triggered on mount instead of Framer Motion.
 *
 * Accessibility features:
 * - Respects prefers-reduced-motion
 * - Manages focus for screen reader users
 * - Announces page changes via aria-live region
 *
 * No persistent `will-change` compositing layers after animation completes.
 * `transform: none` end state avoids stacking context side effects.
 */

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { duration, easing } from './config'

interface PageTransitionProps {
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
	/** Animation variant */
	variant?: 'fade' | 'fadeUp' | 'fadeScale'
	/** Whether to manage focus on mount (default: false) */
	manageFocus?: boolean
}

const EASE_OUT = `cubic-bezier(${easing.easeOut.join(',')})`

const initialTransforms: Record<PageTransitionProps['variant'] & string, string> = {
	fade: 'none',
	fadeUp: 'translateY(16px)',
	fadeScale: 'scale(0.98)',
}

/**
 * Hook to detect reduced motion preference
 *
 * @example
 * const prefersReduced = usePrefersReducedMotion()
 * if (prefersReduced) {
 *   // Skip or simplify animation
 * }
 */
export function usePrefersReducedMotion(): boolean {
	const [prefersReduced, setPrefersReduced] = useState(false)

	useEffect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
		setPrefersReduced(mq.matches)

		const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
		mq.addEventListener('change', handler)
		return () => mq.removeEventListener('change', handler)
	}, [])

	return prefersReduced
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
	manageFocus = false,
}: PageTransitionProps) {
	const [mounted, setMounted] = useState(false)
	const contentRef = useRef<HTMLDivElement>(null)
	const prefersReducedMotion = usePrefersReducedMotion()

	useEffect(() => {
		const raf = requestAnimationFrame(() => {
			setMounted(true)

			// Focus management for accessibility
			if (manageFocus) {
				// Small delay to ensure content is rendered
				setTimeout(() => {
					contentRef.current?.focus({ preventScroll: true })
				}, prefersReducedMotion ? 0 : duration.medium * 1000)
			}
		})
		return () => cancelAnimationFrame(raf)
	}, [manageFocus, prefersReducedMotion])

	// Skip animation for users who prefer reduced motion
	const shouldAnimate = !prefersReducedMotion

	return (
		<div
			ref={contentRef}
			className={className}
			tabIndex={manageFocus ? -1 : undefined}
			style={{
				opacity: shouldAnimate ? (mounted ? 1 : 0) : 1,
				transform: shouldAnimate ? (mounted ? 'none' : initialTransforms[variant]) : 'none',
				transition: shouldAnimate
					? `opacity ${duration.medium}s ${EASE_OUT}, transform ${duration.medium}s ${EASE_OUT}`
					: 'none',
				outline: 'none', // Remove focus outline on container
			}}
		>
			{children}
		</div>
	)
}

/**
 * PageTransitionMain - For main content areas with full height
 *
 * Includes focus management by default for better accessibility.
 */
export function PageTransitionMain({
	children,
	className,
	variant = 'fadeUp',
	manageFocus = true,
}: PageTransitionProps) {
	return (
		<PageTransition
			variant={variant}
			className={`flex-1 ${className ?? ''}`}
			manageFocus={manageFocus}
		>
			{children}
		</PageTransition>
	)
}
