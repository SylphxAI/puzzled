'use client'

import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog'
import { AlertTriangle } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { cn } from '../utils'
import { buttonVariants } from './button'

// ==================
// AlertDialog Root
// ==================

interface AlertDialogProps {
	/** Whether the dialog is open (controlled) */
	open?: boolean
	/** Handler fired when open state changes */
	onOpenChange?: (open: boolean) => void
	/** Children */
	children?: React.ReactNode
}

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
	return (
		<BaseAlertDialog.Root open={open} onOpenChange={onOpenChange}>
			{children}
		</BaseAlertDialog.Root>
	)
}

// ==================
// AlertDialog Trigger
// ==================

interface AlertDialogTriggerProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Whether to render as child element */
	asChild?: boolean
}

const AlertDialogTrigger = forwardRef<HTMLButtonElement, AlertDialogTriggerProps>(
	({ className, children, asChild }, ref) => (
		<BaseAlertDialog.Trigger
			ref={ref}
			className={className}
			render={asChild ? (children as React.ReactElement) : undefined}
		>
			{asChild ? undefined : children}
		</BaseAlertDialog.Trigger>
	),
)
AlertDialogTrigger.displayName = 'AlertDialogTrigger'

// ==================
// AlertDialog Portal
// ==================

function AlertDialogPortal({ children }: { children: React.ReactNode }) {
	return <BaseAlertDialog.Portal>{children}</BaseAlertDialog.Portal>
}

// ==================
// AlertDialog Overlay (Backdrop)
// ==================

interface AlertDialogOverlayProps {
	/** Additional CSS classes */
	className?: string
}

const AlertDialogOverlay = forwardRef<HTMLDivElement, AlertDialogOverlayProps>(
	({ className }, ref) => (
		<BaseAlertDialog.Backdrop
			ref={ref}
			className={cn('alert-dialog-overlay fixed inset-0 z-modal bg-black/50', className)}
		/>
	),
)
AlertDialogOverlay.displayName = 'AlertDialogOverlay'

// ==================
// AlertDialog Content (Popup)
// ==================

interface AlertDialogContentProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const AlertDialogContent = forwardRef<HTMLDivElement, AlertDialogContentProps>(
	({ className, children }, ref) => (
		<AlertDialogPortal>
			<AlertDialogOverlay />
			<BaseAlertDialog.Popup
				ref={ref}
				className={cn(
					'alert-dialog-content fixed left-1/2 top-1/2 z-modal max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border bg-card p-6 shadow-lg',
					className,
				)}
			>
				{children}
			</BaseAlertDialog.Popup>
		</AlertDialogPortal>
	),
)
AlertDialogContent.displayName = 'AlertDialogContent'

// ==================
// AlertDialog Header
// ==================

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex flex-col space-y-2', className)} {...props} />
}
AlertDialogHeader.displayName = 'AlertDialogHeader'

// ==================
// AlertDialog Footer
// ==================

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex justify-end gap-2 pt-4', className)} {...props} />
}
AlertDialogFooter.displayName = 'AlertDialogFooter'

// ==================
// AlertDialog Title
// ==================

interface AlertDialogTitleProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const AlertDialogTitle = forwardRef<HTMLHeadingElement, AlertDialogTitleProps>(
	({ className, children }, ref) => (
		<BaseAlertDialog.Title ref={ref} className={cn('text-lg font-semibold', className)}>
			{children}
		</BaseAlertDialog.Title>
	),
)
AlertDialogTitle.displayName = 'AlertDialogTitle'

// ==================
// AlertDialog Description
// ==================

interface AlertDialogDescriptionProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
}

const AlertDialogDescription = forwardRef<HTMLParagraphElement, AlertDialogDescriptionProps>(
	({ className, children }, ref) => (
		<BaseAlertDialog.Description ref={ref} className={cn('text-sm text-muted-foreground', className)}>
			{children}
		</BaseAlertDialog.Description>
	),
)
AlertDialogDescription.displayName = 'AlertDialogDescription'

// ==================
// AlertDialog Action
// ==================

interface AlertDialogActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	/** Visual variant */
	variant?: 'default' | 'destructive'
}

const AlertDialogAction = forwardRef<HTMLButtonElement, AlertDialogActionProps>(
	({ className, variant = 'default', ...props }, ref) => (
		<button ref={ref} className={cn(buttonVariants({ variant }), className)} {...props} />
	),
)
AlertDialogAction.displayName = 'AlertDialogAction'

// ==================
// AlertDialog Cancel
// ==================

interface AlertDialogCancelProps {
	/** Children */
	children?: React.ReactNode
	/** Additional CSS classes */
	className?: string
	/** Whether the cancel button is disabled */
	disabled?: boolean
	/** Click handler */
	onClick?: () => void
}

const AlertDialogCancel = forwardRef<HTMLButtonElement, AlertDialogCancelProps>(
	({ className, children, disabled, onClick }, ref) => (
		<BaseAlertDialog.Close
			ref={ref}
			disabled={disabled}
			onClick={onClick}
			className={cn(buttonVariants({ variant: 'outline' }), disabled && 'opacity-50 cursor-not-allowed', className)}
		>
			{children}
		</BaseAlertDialog.Close>
	),
)
AlertDialogCancel.displayName = 'AlertDialogCancel'

// ==================
// Confirm Dialog (Convenience Component)
// ==================

type ConfirmDialogProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	confirmLabel?: string
	cancelLabel?: string
	onConfirm: () => void
	variant?: 'default' | 'destructive'
}

function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	onConfirm,
	variant = 'default',
}: ConfirmDialogProps) {
	const handleConfirm = () => {
		onConfirm()
		onOpenChange(false)
	}

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<div className="flex items-center gap-3">
						<div
							className={cn(
								'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
								variant === 'destructive' ? 'bg-destructive/10' : 'bg-warning/10',
							)}
							aria-hidden="true"
						>
							<AlertTriangle
								className={cn(
									'h-5 w-5',
									variant === 'destructive' ? 'text-destructive' : 'text-warning',
								)}
							/>
						</div>
						<AlertDialogTitle>{title}</AlertDialogTitle>
					</div>
					<AlertDialogDescription className="pl-[52px]">{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
					<AlertDialogAction variant={variant} onClick={handleConfirm}>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

// ==================
// useAlertDialog Hook
// ==================

function useAlertDialog() {
	const [isOpen, setIsOpen] = useState(false)
	const [config, setConfig] = useState<{
		title: string
		description: string
		confirmLabel?: string
		cancelLabel?: string
		variant?: 'default' | 'destructive'
		onConfirm: () => void
	} | null>(null)

	const showAlert = (alertConfig: typeof config) => {
		setConfig(alertConfig)
		setIsOpen(true)
	}

	const AlertDialogComponent = config ? (
		<ConfirmDialog
			open={isOpen}
			onOpenChange={setIsOpen}
			title={config.title}
			description={config.description}
			confirmLabel={config.confirmLabel}
			cancelLabel={config.cancelLabel}
			variant={config.variant}
			onConfirm={config.onConfirm}
		/>
	) : null

	return { showAlert, AlertDialog: AlertDialogComponent }
}

export {
	AlertDialog,
	AlertDialogPortal,
	AlertDialogOverlay,
	AlertDialogTrigger,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogFooter,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogAction,
	AlertDialogCancel,
	ConfirmDialog,
	useAlertDialog,
}

export type {
	AlertDialogProps,
	AlertDialogTriggerProps,
	AlertDialogOverlayProps,
	AlertDialogContentProps,
	AlertDialogTitleProps,
	AlertDialogDescriptionProps,
	AlertDialogActionProps,
	AlertDialogCancelProps,
	ConfirmDialogProps,
}
