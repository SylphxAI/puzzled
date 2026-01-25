'use client'

/**
 * Sheet Component
 *
 * A side panel that slides in from the edge of the screen.
 * Uses Framer Motion for smooth spring-based animations.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { type VariantProps, cva } from 'class-variance-authority'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { duration, easing } from '../motion/config'
import { cn } from '../utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

// Create motion-enhanced div for overlay
const MotionOverlay = motion.create('div')

const SheetOverlay = forwardRef<
	HTMLDivElement,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-modal', className)} {...props}>
		<MotionOverlay
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: duration.normal, ease: easing.easeOut }}
			className="absolute inset-0 bg-black/50"
		/>
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

const SheetContent = forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, SheetContentProps>(
	({ side = 'right', className, children, hideCloseButton, ...props }, ref) => {
		const variants = slideVariants[side || 'right']

		return (
			<SheetPortal>
				<SheetOverlay />
				<DialogPrimitive.Content
					ref={ref}
					className={cn(sheetVariants({ side }), 'overflow-hidden', className)}
					{...props}
				>
					<MotionContent
						initial={variants.initial}
						animate={variants.animate}
						exit={variants.exit}
						transition={{
							type: 'spring',
							stiffness: 400,
							damping: 40,
						}}
						className="h-full"
					>
						{children}
						{!hideCloseButton && (
							<DialogPrimitive.Close className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground opacity-70 ring-offset-background transition-opacity hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
								<X className="h-4 w-4" />
								<span className="sr-only">Close</span>
							</DialogPrimitive.Close>
						)}
					</MotionContent>
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
