'use client'

import * as ToastPrimitive from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react'
import { createContext, forwardRef, useCallback, useContext, useState } from 'react'
import { cn } from '../utils'

const ToastProvider = ToastPrimitive.Provider

const ToastViewport = forwardRef<
	React.ComponentRef<typeof ToastPrimitive.Viewport>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
	<ToastPrimitive.Viewport
		ref={ref}
		className={cn(
			'fixed bottom-20 left-1/2 z-toast flex max-h-screen -translate-x-1/2 flex-col gap-2 p-4 sm:bottom-4 sm:left-auto sm:right-4 sm:translate-x-0',
			'pointer-events-none w-full max-w-sm',
			className,
		)}
		{...props}
	/>
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

const toastVariants = cva(
	'pointer-events-auto group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full sm:data-[state=open]:slide-in-from-right-full',
	{
		variants: {
			variant: {
				default: 'border-border bg-card text-card-foreground',
				success:
					'border-[var(--toast-success-border)] bg-[var(--toast-success-bg)] text-[var(--toast-success-text)]',
				error:
					'border-[var(--toast-error-border)] bg-[var(--toast-error-bg)] text-[var(--toast-error-text)]',
				warning:
					'border-[var(--toast-warning-border)] bg-[var(--toast-warning-bg)] text-[var(--toast-warning-text)]',
				info: 'border-[var(--toast-info-border)] bg-[var(--toast-info-bg)] text-[var(--toast-info-text)]',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
)

const Toast = forwardRef<
	React.ComponentRef<typeof ToastPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
	<ToastPrimitive.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props} />
))
Toast.displayName = ToastPrimitive.Root.displayName

const ToastAction = forwardRef<
	React.ComponentRef<typeof ToastPrimitive.Action>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
	<ToastPrimitive.Action
		ref={ref}
		className={cn(
			'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50',
			className,
		)}
		{...props}
	/>
))
ToastAction.displayName = ToastPrimitive.Action.displayName

const ToastClose = forwardRef<
	React.ComponentRef<typeof ToastPrimitive.Close>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
	<ToastPrimitive.Close
		ref={ref}
		className={cn(
			'shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring',
			className,
		)}
		toast-close=""
		aria-label="Close"
		{...props}
	>
		<X className="h-4 w-4" />
	</ToastPrimitive.Close>
))
ToastClose.displayName = ToastPrimitive.Close.displayName

const ToastTitle = forwardRef<
	React.ComponentRef<typeof ToastPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
	<ToastPrimitive.Title ref={ref} className={cn('font-medium', className)} {...props} />
))
ToastTitle.displayName = ToastPrimitive.Title.displayName

const ToastDescription = forwardRef<
	React.ComponentRef<typeof ToastPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
	<ToastPrimitive.Description
		ref={ref}
		className={cn('mt-1 text-sm opacity-80', className)}
		{...props}
	/>
))
ToastDescription.displayName = ToastPrimitive.Description.displayName

// Icon mapping for variants
const variantIcons = {
	default: null,
	success: CheckCircle,
	error: XCircle,
	warning: AlertCircle,
	info: Info,
}

const iconStyles = {
	default: 'text-foreground',
	success: 'text-[var(--color-success)]',
	error: 'text-[var(--color-error)]',
	warning: 'text-[var(--color-warning)]',
	info: 'text-[var(--color-info)]',
}

// Toast context for imperative API
type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info'

type ToastData = {
	id: string
	type: ToastType
	title: string
	description?: string
	duration?: number
}

type ToastContextType = {
	toasts: ToastData[]
	addToast: (toast: Omit<ToastData, 'id'>) => void
	removeToast: (id: string) => void
	success: (title: string, description?: string) => void
	error: (title: string, description?: string) => void
	warning: (title: string, description?: string) => void
	info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
	const context = useContext(ToastContext)
	if (!context) {
		throw new Error('useToast must be used within a ToastProvider')
	}
	return context
}

// Toaster component that renders all toasts
function Toaster() {
	const { toasts, removeToast } = useToast()

	return (
		<>
			{toasts.map((toast) => {
				const Icon = variantIcons[toast.type]
				return (
					<Toast
						key={toast.id}
						variant={toast.type}
						duration={toast.duration}
						onOpenChange={(open: boolean) => !open && removeToast(toast.id)}
					>
						{Icon && <Icon className={cn('h-5 w-5 shrink-0', iconStyles[toast.type])} />}
						<div className="flex-1 min-w-0">
							<ToastTitle>{toast.title}</ToastTitle>
							{toast.description && <ToastDescription>{toast.description}</ToastDescription>}
						</div>
						<ToastClose />
					</Toast>
				)
			})}
			<ToastViewport />
		</>
	)
}

// Main provider component
export function ToastProviderWithContext({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<ToastData[]>([])

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}, [])

	const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
		const id = crypto.randomUUID()
		setToasts((prev) => [...prev, { ...toast, id }])
	}, [])

	const success = useCallback(
		(title: string, description?: string) =>
			addToast({ type: 'success', title, description, duration: 5000 }),
		[addToast],
	)

	const error = useCallback(
		(title: string, description?: string) =>
			addToast({ type: 'error', title, description, duration: 5000 }),
		[addToast],
	)

	const warning = useCallback(
		(title: string, description?: string) =>
			addToast({ type: 'warning', title, description, duration: 5000 }),
		[addToast],
	)

	const info = useCallback(
		(title: string, description?: string) =>
			addToast({ type: 'info', title, description, duration: 5000 }),
		[addToast],
	)

	return (
		<ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
			<ToastProvider swipeDirection="right">
				{children}
				<Toaster />
			</ToastProvider>
		</ToastContext.Provider>
	)
}

// Primary export - use ToastProvider in your app
export { ToastProviderWithContext as ToastProvider }

export { Toast, ToastAction, ToastClose, ToastDescription, ToastTitle, ToastViewport }
