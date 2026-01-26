'use client'

/**
 * Sheet Component
 *
 * A side panel that slides in from the edge of the screen.
 * Uses Framer Motion for smooth spring-based animations.
 * Respects prefers-reduced-motion for accessibility.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { type VariantProps, cva } from 'class-variance-authority'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { forwardRef, useEffect, useState } from 'react'
import { duration, easing } from '../motion/config'
import { cn } from '../utils'

/**
 * Hook to detect reduced motion preference
 */
function usePrefersReducedMotion(): boolean {
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

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

// Create motion-enhanced div for overlay
const MotionOverlay = motion.create('div')

function OverlayAnimation() {
	const prefersReduced = usePrefersReducedMotion()

	return (
		<MotionOverlay
			initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={prefersReduced ? { opacity: 0 } : { opacity: 0 }}
			transition={prefersReduced ? { duration: 0 } : { duration: duration.normal, ease: easing.easeOut }}
			className="absolute inset-0 bg-black/50"
		/>
	)
}

const SheetOverlay = forwardRef<
	HTMLDivElement,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-modal', className)} {...props}>
		<OverlayAnimation />
	</DialogPrimitive.Overlay>
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const sheetVariants = cva('fixed z-modal gap-4 bg-background shadow-lg', {
	variants: {
		side: {
			top: 'inset-x-0 top-0 border-b',
			bottom: 'inset-x-0 bottom-0 border-t',
			left: 'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
			right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
		},
	},
	defaultVariants: {
		side: 'right',
	},
})

// Motion variants for each side
const slideVariants = {
	top: { initial: { y: '-100%' }, animate: { y: 0 }, exit: { y: '-100%' } },
	bottom: { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } },
	left: { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } },
	right: { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } },
}

// Create motion-enhanced div for content
const MotionContent = motion.create('div')

interface SheetContentProps
	extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
		VariantProps<typeof sheetVariants> {
	hideCloseButton?: boolean
}

function ContentAnimation({
	children,
	hideCloseButton,
	side,
}: {
	children: React.ReactNode
	hideCloseButton?: boolean
	side: 'top' | 'bottom' | 'left' | 'right'
}) {
	const prefersReduced = usePrefersReducedMotion()
	const variants = slideVariants[side]

	return (
		<MotionContent
			initial={prefersReduced ? {} : variants.initial}
			animate={variants.animate}
			exit={prefersReduced ? {} : variants.exit}
			transition={
				prefersReduced
					? { duration: 0 }
					: {
							type: 'spring',
							stiffness: 400,
							damping: 40,
						}
			}
			className="h-full"
		>
			{children}
			{!hideCloseButton && (
				<DialogPrimitive.Close
					className={cn(
						// min-h-11 min-w-11 = 44px minimum touch target (WCAG 2.1 AA)
						'absolute right-4 top-4 flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground opacity-70 ring-offset-background transition-opacity',
						'hover:bg-muted hover:opacity-100',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						'disabled:pointer-events-none',
					)}
					aria-label="Close panel"
				>
					<X className="h-4 w-4" aria-hidden="true" />
				</DialogPrimitive.Close>
			)}
		</MotionContent>
	)
}

const SheetContent = forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, SheetContentProps>(
	({ side = 'right', className, children, hideCloseButton, ...props }, ref) => {
		return (
			<SheetPortal>
				<SheetOverlay />
				<DialogPrimitive.Content
					ref={ref}
					className={cn(sheetVariants({ side }), 'overflow-hidden', className)}
					{...props}
				>
					<ContentAnimation side={side || 'right'} hideCloseButton={hideCloseButton}>
						{children}
					</ContentAnimation>
				</DialogPrimitive.Content>
			</SheetPortal>
		)
	},
)
SheetContent.displayName = DialogPrimitive.Content.displayName

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex flex-col space-y-2 p-4 border-b border-border', className)} {...props} />
}
SheetHeader.displayName = 'SheetHeader'

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-4 border-t border-border', className)} {...props} />
}
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export {
	Sheet,
	SheetPortal,
	SheetOverlay,
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
}
