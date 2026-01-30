'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const AdminDialog = DialogPrimitive.Root
const AdminDialogPortal = DialogPrimitive.Portal

const AdminDialogOverlay = forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		className={cn(
			'fixed inset-0 z-overlay bg-black/70 backdrop-blur-sm',
			'data-[state=open]:animate-in data-[state=closed]:animate-out',
			'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
			className,
		)}
		{...props}
	/>
))
AdminDialogOverlay.displayName = 'AdminDialogOverlay'

const AdminDialogContent = forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
		hideCloseButton?: boolean
	}
>(({ className, children, hideCloseButton, ...props }, ref) => (
	<AdminDialogPortal>
		<AdminDialogOverlay />
		<DialogPrimitive.Content
			ref={ref}
			className={cn(
				'fixed inset-4 z-modal mx-auto flex max-w-2xl items-start justify-center overflow-y-auto pt-8',
				'data-[state=open]:animate-in data-[state=closed]:animate-out',
				'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
				'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
				className,
			)}
			{...props}
		>
			<div className="admin-card w-full max-w-2xl">
				{children}
				{!hideCloseButton && (
					<DialogPrimitive.Close className="absolute right-4 top-4 admin-btn admin-btn-ghost p-2">
						<X className="h-5 w-5" />
						<span className="sr-only">Close</span>
					</DialogPrimitive.Close>
				)}
			</div>
		</DialogPrimitive.Content>
	</AdminDialogPortal>
))
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

const AdminDialogTitle = forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title
		ref={ref}
		className={cn('text-lg font-semibold text-[var(--admin-text-primary)]', className)}
		{...props}
	/>
))
AdminDialogTitle.displayName = 'AdminDialogTitle'

const AdminDialogDescription = forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description
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
