'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { motion } from 'motion/react'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { duration, easing } from '../motion/config'
import { cn } from '../utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

// Create motion-enhanced div for overlay
const MotionOverlay = motion.create('div')

const DialogOverlay = forwardRef<
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
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// Create motion-enhanced div for content
const MotionContent = motion.create('div')

const DialogContent = forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
		hideCloseButton?: boolean
	}
>(({ className, children, hideCloseButton, ...props }, ref) => (
	<DialogPortal>
		<DialogOverlay />
		<DialogPrimitive.Content
			ref={ref}
			className={cn(
				'fixed left-1/2 top-1/2 z-modal max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-card shadow-lg',
				className,
			)}
			{...props}
		>
			<MotionContent
				initial={{ opacity: 0, scale: 0.95, y: -10 }}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				transition={{
					type: 'spring',
					stiffness: 400,
					damping: 30,
				}}
				className="overflow-auto max-h-[90vh]"
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
	</DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex flex-col space-y-1.5 p-6 pb-0', className)} {...props} />
}
DialogHeader.displayName = 'DialogHeader'

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex justify-end gap-2 p-6 pt-4', className)} {...props} />
}
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description
		ref={ref}
		className={cn('text-sm text-muted-foreground', className)}
		{...props}
	/>
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

// Body wrapper for content between header and footer
function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('p-6 pt-4', className)} {...props} />
}
DialogBody.displayName = 'DialogBody'

export {
	Dialog,
	DialogPortal,
	DialogOverlay,
	DialogClose,
	DialogTrigger,
	DialogContent,
	DialogHeader,
	DialogFooter,
	DialogTitle,
	DialogDescription,
	DialogBody,
}
