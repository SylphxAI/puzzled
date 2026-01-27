'use client'

import * as ToastPrimitive from '@radix-ui/react-toast'
import { cva, type VariantProps } from 'class-variance-authority'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react'
import { createContext, forwardRef, useCallback, useContext, useEffect, useState } from 'react'
import { duration, easing } from '../motion/config'
import { cn } from '../utils'

const ToastProvider = ToastPrimitive.Provider

const ToastViewport = forwardRef<
	React.ComponentRef<typeof ToastPrimitive.Viewport>,
	React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
	<ToastPrimitive.Viewport
		ref={ref}
		aria-live="polite"
		aria-atomic="true"
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
	'pointer-events-auto group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg',
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
			// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
			'inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted',
			'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
			'disabled:pointer-events-none disabled:opacity-50',
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
			// min-h-11 min-w-11 = 44px minimum touch target (WCAG 2.1 AA)
			'shrink-0 rounded-md p-2.5 min-h-11 min-w-11 flex items-center justify-center opacity-60 transition-opacity hover:opacity-100',
			'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
			className,
		)}
		toast-close=""
		aria-label="Close notification"
		{...props}
	>
		<X className="h-4 w-4" aria-hidden="true" />
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

type ToastAction = {
	label: string
	onClick: () => void | Promise<void>
}

type ToastData = {
	id: string
	type: ToastType
	title: string
	description?: string
	duration?: number
	action?: ToastAction
}

type ToastOptions = {
	description?: string
	duration?: number
	action?: ToastAction
}

type ToastContextType = {
	toasts: ToastData[]
	addToast: (toast: Omit<ToastData, 'id'>) => string
	removeToast: (id: string) => void
	success: (title: string, options?: ToastOptions | string) => string
	error: (title: string, options?: ToastOptions | string) => string
	warning: (title: string, options?: ToastOptions | string) => string
	info: (title: string, options?: ToastOptions | string) => string
	/** Show toast with undo action - auto-calls undo on click and shows feedback */
	undoable: (
		title: string,
		options: { description?: string; onUndo: () => void | Promise<void>; timeoutMs?: number },
	) => string
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
	const context = useContext(ToastContext)
	if (!context) {
		throw new Error('useToast must be used within a ToastProvider')
	}
	return context
}

/**
 * Hook to detect reduced motion preference
 */
function usePrefersReducedMotion(): boolean {
	const [prefersReduced, setPrefersReduced] = useState(false)

	useEffect(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
		setPrefersReduced(mq.matches)

		const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches)
		mq.addEventListener('change', handler)
		return () => mq.removeEventListener('change', handler)
	}, [])

	return prefersReduced
}

// Toaster component that renders all toasts with smooth animations
function Toaster() {
	const { toasts, removeToast } = useToast()
	const prefersReducedMotion = usePrefersReducedMotion()

	return (
		<>
			<AnimatePresence mode="popLayout">
				{toasts.map((toast) => {
					const Icon = variantIcons[toast.type]
					return (
						<motion.div
							key={toast.id}
							layout={!prefersReducedMotion}
							initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 50, scale: 0.9 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 100, scale: 0.9 }}
							transition={prefersReducedMotion
								? { duration: 0.15 }
								: {
									type: 'spring',
									stiffness: 500,
									damping: 35,
									mass: 1,
								}}
						>
							<Toast
								variant={toast.type}
								duration={toast.duration}
								onOpenChange={(open: boolean) => !open && removeToast(toast.id)}
							>
								{Icon && <Icon className={cn('h-5 w-5 shrink-0', iconStyles[toast.type])} />}
								<div className="flex-1 min-w-0">
									<ToastTitle>{toast.title}</ToastTitle>
									{toast.description && <ToastDescription>{toast.description}</ToastDescription>}
								</div>
								{toast.action && (
									<ToastAction
										altText={toast.action.label}
										onClick={async () => {
											await toast.action?.onClick()
											removeToast(toast.id)
										}}
									>
										{toast.action.label}
									</ToastAction>
								)}
								<ToastClose />
							</Toast>
						</motion.div>
					)
				})}
			</AnimatePresence>
			<ToastViewport />
		</>
	)
}

// Helper to normalize options
function normalizeOptions(options?: ToastOptions | string): ToastOptions {
	if (typeof options === 'string') {
		return { description: options }
	}
	return options ?? {}
}

// Main provider component
export function ToastProviderWithContext({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<ToastData[]>([])

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}, [])

	const addToast = useCallback((toast: Omit<ToastData, 'id'>): string => {
		const id = crypto.randomUUID()
		setToasts((prev) => [...prev, { ...toast, id }])
		return id
	}, [])

	const success = useCallback(
		(title: string, options?: ToastOptions | string): string => {
			const opts = normalizeOptions(options)
			return addToast({
				type: 'success',
				title,
				description: opts.description,
				duration: opts.duration ?? 5000,
				action: opts.action,
			})
		},
		[addToast],
	)

	const error = useCallback(
		(title: string, options?: ToastOptions | string): string => {
			const opts = normalizeOptions(options)
			return addToast({
				type: 'error',
				title,
				description: opts.description,
				duration: opts.duration ?? 5000,
				action: opts.action,
			})
		},
		[addToast],
	)

	const warning = useCallback(
		(title: string, options?: ToastOptions | string): string => {
			const opts = normalizeOptions(options)
			return addToast({
				type: 'warning',
				title,
				description: opts.description,
				duration: opts.duration ?? 5000,
				action: opts.action,
			})
		},
		[addToast],
	)

	const info = useCallback(
		(title: string, options?: ToastOptions | string): string => {
			const opts = normalizeOptions(options)
			return addToast({
				type: 'info',
				title,
				description: opts.description,
				duration: opts.duration ?? 5000,
				action: opts.action,
			})
		},
		[addToast],
	)

	const undoable = useCallback(
		(
			title: string,
			options: { description?: string; onUndo: () => void | Promise<void>; timeoutMs?: number },
		): string => {
			const timeoutMs = options.timeoutMs ?? 5000
			return addToast({
				type: 'default',
				title,
				description: options.description,
				duration: timeoutMs,
				action: {
					label: 'Undo',
					onClick: options.onUndo,
				},
			})
		},
		[addToast],
	)

	return (
		<ToastContext.Provider
			value={{ toasts, addToast, removeToast, success, error, warning, info, undoable }}
		>
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
