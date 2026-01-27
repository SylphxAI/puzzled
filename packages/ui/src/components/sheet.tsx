'use client'

/**
 * Sheet Component
 *
 * A side panel that slides in from the edge of the screen.
 * Uses CSS transitions for reliable, performant animations.
 * Respects prefers-reduced-motion for accessibility.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { type VariantProps, cva } from 'class-variance-authority'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

const SheetOverlay = forwardRef<
	HTMLDivElement,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		className={cn(
			'fixed inset-0 z-modal bg-black/50',
			'data-[state=open]:animate-in data-[state=closed]:animate-out',
			'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
			className,
		)}
		{...props}
	/>
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const sheetVariants = cva(
	cn(
		'fixed z-modal gap-4 bg-background shadow-lg',
		'transition-transform duration-300 ease-out',
		'data-[state=open]:animate-in data-[state=closed]:animate-out',
	),
	{
		variants: {
			side: {
				top: cn(
					'inset-x-0 top-0 border-b',
					'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
				),
				bottom: cn(
					'inset-x-0 bottom-0 border-t',
					'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
				),
				left: cn(
					'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
					'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
				),
				right: cn(
					'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
					'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
				),
			},
		},
		defaultVariants: {
			side: 'right',
		},
	},
)

interface SheetContentProps
	extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
		VariantProps<typeof sheetVariants> {
	hideCloseButton?: boolean
}

const SheetContent = forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, SheetContentProps>(
	({ side = 'right', className, children, hideCloseButton, ...props }, ref) => {
		return (
			<SheetPortal>
				<SheetOverlay />
				<DialogPrimitive.Content
					ref={ref}
					className={cn(sheetVariants({ side }), className)}
					{...props}
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
