'use client'

/**
 * Sheet Component
 *
 * A side panel that slides in from the edge of the screen.
 * Uses Base UI Dialog with custom positioning.
 * No dependency on animation plugins — transitions defined in globals.css.
 *
 * Required CSS: apps must include the sheet animation styles.
 * See: apps/sylphx/src/app/globals.css (sheet section)
 */

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { type VariantProps, cva } from 'class-variance-authority'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../utils'

// ==================
// Sheet Root
// ==================

interface SheetProps {
	/** Whether the sheet is open (controlled) */
	open?: boolean
	/** Default open state (uncontrolled) */
	defaultOpen?: boolean
	/** Handler fired when open state changes */
	onOpenChange?: (open: boolean) => void
	/** Whether the sheet is modal */
	modal?: boolean
	/** Children */
	children?: React.ReactNode
}

function Sheet({ open, defaultOpen, onOpenChange, modal = true, children }: SheetProps) {
	return (
		<BaseDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
			{children}
		</BaseDialog.Root>
	)
}

// ==================
// Sheet Trigger
// ==================

interface SheetTriggerProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Whether to render as child */
	asChild?: boolean
}

const SheetTrigger = forwardRef<HTMLButtonElement, SheetTriggerProps>(
	({ className, children, asChild }, ref) => (
		<BaseDialog.Trigger
			ref={ref}
			className={className}
			render={asChild ? (children as React.ReactElement) : undefined}
		>
			{asChild ? undefined : children}
		</BaseDialog.Trigger>
	),
)
SheetTrigger.displayName = 'SheetTrigger'

// ==================
// Sheet Close
// ==================

interface SheetCloseProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const SheetClose = forwardRef<HTMLButtonElement, SheetCloseProps>(
	({ className, children }, ref) => (
		<BaseDialog.Close ref={ref} className={className}>
			{children}
		</BaseDialog.Close>
	),
)
SheetClose.displayName = 'SheetClose'

// ==================
// Sheet Portal
// ==================

function SheetPortal({ children }: { children: React.ReactNode }) {
	return <BaseDialog.Portal>{children}</BaseDialog.Portal>
}

// ==================
// Sheet Overlay
// ==================

interface SheetOverlayProps {
	/** Additional CSS classes */
	className?: string
}

const SheetOverlay = forwardRef<HTMLDivElement, SheetOverlayProps>(
	({ className }, ref) => (
		<BaseDialog.Backdrop
			ref={ref}
			className={cn('sheet-overlay fixed inset-0 z-drawer bg-black/50', className)}
		/>
	),
)
SheetOverlay.displayName = 'SheetOverlay'

// ==================
// Sheet Content
// ==================

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

interface SheetContentProps extends VariantProps<typeof sheetVariants> {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Whether to hide the close button */
	hideCloseButton?: boolean
}

const SheetContent = forwardRef<HTMLDivElement, SheetContentProps>(
	({ side = 'right', className, children, hideCloseButton }, ref) => (
		<SheetPortal>
			<SheetOverlay />
			<BaseDialog.Popup
				ref={ref}
				className={cn(sheetVariants({ side }), className)}
			>
				{children}
				{!hideCloseButton && (
					<BaseDialog.Close
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
					</BaseDialog.Close>
				)}
			</BaseDialog.Popup>
		</SheetPortal>
	),
)
SheetContent.displayName = 'SheetContent'

// ==================
// Sheet Header
// ==================

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex flex-col space-y-2 p-4 border-b border-border', className)} {...props} />
}
SheetHeader.displayName = 'SheetHeader'

// ==================
// Sheet Footer
// ==================

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-4 border-t border-border', className)}
			{...props}
		/>
	)
}
SheetFooter.displayName = 'SheetFooter'

// ==================
// Sheet Title
// ==================

interface SheetTitleProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const SheetTitle = forwardRef<HTMLHeadingElement, SheetTitleProps>(
	({ className, children }, ref) => (
		<BaseDialog.Title ref={ref} className={cn('text-lg font-semibold', className)}>
			{children}
		</BaseDialog.Title>
	),
)
SheetTitle.displayName = 'SheetTitle'

// ==================
// Sheet Description
// ==================

interface SheetDescriptionProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const SheetDescription = forwardRef<HTMLParagraphElement, SheetDescriptionProps>(
	({ className, children }, ref) => (
		<BaseDialog.Description ref={ref} className={cn('text-sm text-muted-foreground', className)}>
			{children}
		</BaseDialog.Description>
	),
)
SheetDescription.displayName = 'SheetDescription'

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

export type {
	SheetProps,
	SheetTriggerProps,
	SheetCloseProps,
	SheetOverlayProps,
	SheetContentProps,
	SheetTitleProps,
	SheetDescriptionProps,
}
