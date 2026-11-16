'use client'

import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../utils'

// ==================
// Dialog Root
// ==================

interface DialogProps {
	/** Whether the dialog is open (controlled) */
	open?: boolean
	/** Default open state (uncontrolled) */
	defaultOpen?: boolean
	/** Handler fired when open state changes */
	onOpenChange?: (open: boolean) => void
	/** Whether the dialog is modal */
	modal?: boolean | 'trap-focus'
	/** Children */
	children?: React.ReactNode
}

function Dialog({ open, defaultOpen, onOpenChange, modal = true, children }: DialogProps) {
	return (
		<BaseDialog.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
			modal={modal}
		>
			{children}
		</BaseDialog.Root>
	)
}

// ==================
// Dialog Trigger
// ==================

interface DialogTriggerProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Whether to render as child */
	asChild?: boolean
}

const DialogTrigger = forwardRef<HTMLButtonElement, DialogTriggerProps>(
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
DialogTrigger.displayName = 'DialogTrigger'

// ==================
// Dialog Portal
// ==================

function DialogPortal({ children }: { children: React.ReactNode }) {
	return <BaseDialog.Portal keepMounted={false}>{children}</BaseDialog.Portal>
}

// ==================
// Dialog Overlay (Backdrop)
// ==================

interface DialogOverlayProps {
	/** Additional CSS classes */
	className?: string
}

const DialogOverlay = forwardRef<HTMLDivElement, DialogOverlayProps>(({ className }, ref) => (
	<BaseDialog.Backdrop
		ref={ref}
		className={cn(
			'fixed inset-0 z-modal bg-black/40 backdrop-blur-[2px] transition-opacity duration-150 ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
			className,
		)}
	/>
))
DialogOverlay.displayName = 'DialogOverlay'

// ==================
// Dialog Close
// ==================

interface DialogCloseProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Accessible label */
	'aria-label'?: string
}

const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(
	({ className, children, 'aria-label': ariaLabel }, ref) => (
		<BaseDialog.Close ref={ref} className={className} aria-label={ariaLabel}>
			{children}
		</BaseDialog.Close>
	),
)
DialogClose.displayName = 'DialogClose'

// ==================
// Dialog Content (Popup)
// ==================

interface DialogContentProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Whether to hide the default close button */
	hideCloseButton?: boolean
}

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
	({ className, children, hideCloseButton }, ref) => (
		<DialogPortal>
			<DialogOverlay />
			<BaseDialog.Popup
				ref={ref}
				className={cn(
					// Phone: a bottom sheet above the home indicator. From sm: a centred card.
					'fixed inset-x-0 bottom-0 z-modal max-h-[92dvh] w-full overflow-hidden rounded-t-[1.75rem] border border-b-0 bg-card pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-sheet)] transition-[opacity,transform] duration-200 ease-out data-[starting-style]:translate-y-6 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 data-[ending-style]:translate-y-6 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0',
					'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88vh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.75rem] sm:border-b sm:pb-0 sm:shadow-lg',
					className,
				)}
			>
				<div className="max-h-[92dvh] overflow-auto overscroll-contain sm:max-h-[88vh]">
					<div
						className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border sm:hidden"
						aria-hidden="true"
					/>
					{children}
					{!hideCloseButton && (
						<BaseDialog.Close
							className={cn(
								// min-h-11 min-w-11 = 44px minimum touch target (WCAG 2.1 AA)
								'absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground opacity-70 ring-offset-background transition-opacity',
								'hover:bg-muted hover:opacity-100',
								'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
								'disabled:pointer-events-none',
							)}
							aria-label="Close dialog"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</BaseDialog.Close>
					)}
				</div>
			</BaseDialog.Popup>
		</DialogPortal>
	),
)
DialogContent.displayName = 'DialogContent'

// ==================
// Dialog Header
// ==================

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex flex-col space-y-1.5 p-6 pb-0', className)} {...props} />
}
DialogHeader.displayName = 'DialogHeader'

// ==================
// Dialog Footer
// ==================

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex justify-end gap-2 p-6 pt-4', className)} {...props} />
}
DialogFooter.displayName = 'DialogFooter'

// ==================
// Dialog Title
// ==================

interface DialogTitleProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(
	({ className, children }, ref) => (
		<BaseDialog.Title ref={ref} className={cn('text-lg font-semibold', className)}>
			{children}
		</BaseDialog.Title>
	),
)
DialogTitle.displayName = 'DialogTitle'

// ==================
// Dialog Description
// ==================

interface DialogDescriptionProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
	({ className, children }, ref) => (
		<BaseDialog.Description ref={ref} className={cn('text-sm text-muted-foreground', className)}>
			{children}
		</BaseDialog.Description>
	),
)
DialogDescription.displayName = 'DialogDescription'

// ==================
// Dialog Body
// ==================

function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('p-6 pt-4', className)} {...props} />
}
DialogBody.displayName = 'DialogBody'

export type {
	DialogCloseProps,
	DialogContentProps,
	DialogDescriptionProps,
	DialogOverlayProps,
	DialogProps,
	DialogTitleProps,
	DialogTriggerProps,
}
export {
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogPortal,
	DialogTitle,
	DialogTrigger,
}
