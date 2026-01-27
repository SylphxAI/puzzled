'use client'

/**
 * Sheet Component
 *
 * A side panel that slides in from the edge of the screen.
 * Uses native CSS transitions via data-state attributes from Radix UI.
 * No dependency on animation plugins — transitions defined in globals.css.
 *
 * Required CSS: apps must include the sheet animation styles.
 * See: apps/sylphx/src/app/globals.css (sheet section)
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
		className={cn('sheet-overlay fixed inset-0 z-drawer bg-black/50', className)}
		{...props}
	/>
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const sheetVariants = cva('sheet-panel fixed z-drawer bg-background shadow-lg', {
	variants: {
		side: {
			top: 'sheet-panel-top inset-x-0 top-0 border-b',
			bottom: 'sheet-panel-bottom inset-x-0 bottom-0 border-t',
			left: 'sheet-panel-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
			right: 'sheet-panel-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
		},
	},
	defaultVariants: {
		side: 'right',
	},
})

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
	return (
		<div
			className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-4 border-t border-border', className)}
			{...props}
		/>
	)
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
