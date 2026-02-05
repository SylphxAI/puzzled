'use client'

import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const AdminDialog = Dialog.Root

const AdminDialogOverlay = forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<Dialog.Backdrop
		ref={ref}
		className={cn(
			'admin-dialog-overlay fixed inset-0 z-overlay bg-black/70 backdrop-blur-sm',
			className,
		)}
		{...props}
	/>
))
AdminDialogOverlay.displayName = 'AdminDialogOverlay'

interface AdminDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
	hideCloseButton?: boolean
}

const AdminDialogContent = forwardRef<HTMLDivElement, AdminDialogContentProps>(
	({ className, children, hideCloseButton, ...props }, ref) => (
		<Dialog.Portal>
			<AdminDialogOverlay />
			<Dialog.Popup
				ref={ref}
				className={cn(
					'admin-dialog-content fixed inset-4 z-modal mx-auto flex max-w-2xl items-start justify-center overflow-y-auto pt-8',
					className,
				)}
				{...props}
			>
				<div className="admin-card w-full max-w-2xl">
					{children}
					{!hideCloseButton && (
						<Dialog.Close className="absolute right-4 top-4 admin-btn admin-btn-ghost p-2">
							<X className="h-5 w-5" />
							<span className="sr-only">Close</span>
						</Dialog.Close>
					)}
				</div>
			</Dialog.Popup>
		</Dialog.Portal>
	),
)
AdminDialogContent.displayName = 'AdminDialogContent'

function AdminDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-4',
				className,
			)}
			{...props}
		/>
	)
}
AdminDialogHeader.displayName = 'AdminDialogHeader'

const AdminDialogTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
	({ className, ...props }, ref) => (
		<Dialog.Title
			ref={ref}
			className={cn('text-lg font-semibold text-[var(--admin-text-primary)]', className)}
			{...props}
		/>
	),
)
AdminDialogTitle.displayName = 'AdminDialogTitle'

const AdminDialogDescription = forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<Dialog.Description
		ref={ref}
		className={cn('text-sm text-[var(--admin-text-muted)]', className)}
		{...props}
	/>
))
AdminDialogDescription.displayName = 'AdminDialogDescription'

function AdminDialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('p-6', className)} {...props} />
}
AdminDialogBody.displayName = 'AdminDialogBody'

function AdminDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				'flex items-center justify-between border-t border-[var(--admin-border)] px-6 py-4',
				className,
			)}
			{...props}
		/>
	)
}
AdminDialogFooter.displayName = 'AdminDialogFooter'

export {
	AdminDialog,
	AdminDialogContent,
	AdminDialogHeader,
	AdminDialogTitle,
	AdminDialogBody,
	AdminDialogFooter,
}
