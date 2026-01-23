'use client'

/**
 * Page Transition Component
 *
 * Provides consistent page entrance animations across the application.
 * Use in layouts to animate page content on navigation.
 */

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { duration, easing } from './config'

interface PageTransitionProps {
	/** Children to animate */
	children: ReactNode
	/** Additional class name */
	className?: string
	/** Animation variant */
	variant?: 'fade' | 'fadeUp' | 'fadeScale'
}

const variants = {
	fade: {
		initial: { opacity: 0 },
		animate: { opacity: 1 },
		exit: { opacity: 0 },
	},
	fadeUp: {
		initial: { opacity: 0, y: 16 },
		animate: { opacity: 1, y: 0 },
		exit: { opacity: 0, y: -8 },
	},
	fadeScale: {
		initial: { opacity: 0, scale: 0.98 },
		animate: { opacity: 1, scale: 1 },
		exit: { opacity: 0, scale: 0.98 },
	},
}

/**
 * PageTransition - Wraps page content with entrance animation
 *
 * Use in layout files to provide consistent page transitions.
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
	const selectedVariant = variants[variant]

	return (
		<motion.div
			initial={selectedVariant.initial}
			animate={selectedVariant.animate}
			transition={{
				duration: duration.medium,
				ease: easing.easeOut,
			}}
			className={className}
		>
			{children}
		</motion.div>
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
