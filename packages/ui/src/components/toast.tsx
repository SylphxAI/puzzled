'use client'

/**
 * Toast Component — Sonner-based
 *
 * Uses Sonner for toast notifications with:
 * - Built-in animations and transitions
 * - Stacking behavior
 * - Swipe to dismiss
 * - Action buttons
 *
 * The useToast hook provides the same API as before for backward compatibility.
 */

import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner'

// Re-export Sonner's toast for direct access when needed
export { sonnerToast as toast }

// ==========================================
// Types
// ==========================================

type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info'

type ToastAction = {
	label: string
	onClick: () => void | Promise<void>
}

type ToastOptions = {
	description?: string
	duration?: number
	action?: ToastAction
}

type UndoableOptions = {
	description?: string
	/** Called when user clicks Undo - should restore the item */
	onUndo: () => void | Promise<void>
	/** Called when timeout passes without undo - should perform the actual delete */
	onConfirm?: () => void | Promise<void>
	/** Timeout in milliseconds (default: 5000) */
	timeoutMs?: number
}

// ==========================================
// Icons for variants
// ==========================================

const variantIcons: Record<ToastType, ReactNode | null> = {
	default: null,
	success: <CheckCircle className="h-5 w-5 text-[var(--color-success)]" />,
	error: <XCircle className="h-5 w-5 text-[var(--color-error)]" />,
	warning: <AlertCircle className="h-5 w-5 text-[var(--color-warning)]" />,
	info: <Info className="h-5 w-5 text-[var(--color-info)]" />,
}

// ==========================================
// Helper Functions
// ==========================================

function normalizeOptions(options?: ToastOptions | string): ToastOptions {
	if (typeof options === 'string') {
		return { description: options }
	}
	return options ?? {}
}

// ==========================================
// useToast Hook
// ==========================================

type UseToastReturn = {
	success: (title: string, options?: ToastOptions | string) => string | number
	error: (title: string, options?: ToastOptions | string) => string | number
	warning: (title: string, options?: ToastOptions | string) => string | number
	info: (title: string, options?: ToastOptions | string) => string | number
	/**
	 * Show toast with undo action - delays actual deletion until timeout passes
	 *
	 * Pattern:
	 * 1. Optimistically remove item from UI immediately
	 * 2. Show toast with Undo button
	 * 3. If user clicks Undo, call onUndo to restore item
	 * 4. If timeout passes, call onConfirm to actually delete
	 */
	undoable: (title: string, options: UndoableOptions) => string | number
	dismiss: (id?: string | number) => void
}

/**
 * Hook to show toast notifications
 *
 * @example
 * ```tsx
 * const toast = useToast()
 *
 * toast.success('Saved successfully')
 * toast.error('Something went wrong', 'Please try again')
 * toast.undoable('Item deleted', {
 *   onUndo: () => restoreItem(),
 *   onConfirm: () => deleteItem(),
 * })
 * ```
 */
export function useToast(): UseToastReturn {
	const success = (title: string, options?: ToastOptions | string): string | number => {
		const opts = normalizeOptions(options)
		return sonnerToast.success(title, {
			description: opts.description,
			duration: opts.duration ?? 5000,
			icon: variantIcons.success,
			action: opts.action
				? {
						label: opts.action.label,
						onClick: opts.action.onClick,
					}
				: undefined,
		})
	}

	const error = (title: string, options?: ToastOptions | string): string | number => {
		const opts = normalizeOptions(options)
		return sonnerToast.error(title, {
			description: opts.description,
			duration: opts.duration ?? 5000,
			icon: variantIcons.error,
			action: opts.action
				? {
						label: opts.action.label,
						onClick: opts.action.onClick,
					}
				: undefined,
		})
	}

	const warning = (title: string, options?: ToastOptions | string): string | number => {
		const opts = normalizeOptions(options)
		return sonnerToast.warning(title, {
			description: opts.description,
			duration: opts.duration ?? 5000,
			icon: variantIcons.warning,
			action: opts.action
				? {
						label: opts.action.label,
						onClick: opts.action.onClick,
					}
				: undefined,
		})
	}

	const info = (title: string, options?: ToastOptions | string): string | number => {
		const opts = normalizeOptions(options)
		return sonnerToast.info(title, {
			description: opts.description,
			duration: opts.duration ?? 5000,
			icon: variantIcons.info,
			action: opts.action
				? {
						label: opts.action.label,
						onClick: opts.action.onClick,
					}
				: undefined,
		})
	}

	const undoable = (title: string, options: UndoableOptions): string | number => {
		const timeoutMs = options.timeoutMs ?? 5000
		let undoClicked = false

		const id = sonnerToast(title, {
			description: options.description,
			duration: timeoutMs,
			action: {
				label: 'Undo',
				onClick: async () => {
					undoClicked = true
					await options.onUndo()
				},
			},
		})

		// Schedule the confirm callback when timeout passes
		if (options.onConfirm) {
			setTimeout(async () => {
				if (!undoClicked) {
					try {
						await options.onConfirm?.()
					} catch (err) {
						// If confirm fails, we can't easily undo at this point
						// The toast is already gone, but we log for debugging
						console.error('Undoable action confirm failed:', err)
					}
				}
			}, timeoutMs)
		}

		return id
	}

	const dismiss = (id?: string | number) => {
		sonnerToast.dismiss(id)
	}

	return { success, error, warning, info, undoable, dismiss }
}

// ==========================================
// Toaster Component
// ==========================================

type ToasterProps = {
	/** Position on screen */
	position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
	/** Whether to expand toasts by default */
	expand?: boolean
	/** Rich colors for success/error/warning variants */
	richColors?: boolean
	/** Theme mode */
	theme?: 'light' | 'dark' | 'system'
	/** Close button on all toasts */
	closeButton?: boolean
}

/**
 * Toast container component — place once in your app layout
 *
 * @example
 * ```tsx
 * // In your root layout
 * import { Toaster } from '@sylphx/ui'
 *
 * export default function Layout({ children }) {
 *   return (
 *     <>
 *       {children}
 *       <Toaster />
 *     </>
 *   )
 * }
 * ```
 */
export function Toaster({
	position = 'bottom-right',
	expand = false,
	richColors = true,
	theme = 'system',
	closeButton = true,
}: ToasterProps = {}) {
	return (
		<SonnerToaster
			position={position}
			expand={expand}
			richColors={richColors}
			theme={theme}
			closeButton={closeButton}
			toastOptions={{
				classNames: {
					toast:
						'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
					description: 'group-[.toast]:text-muted-foreground',
					actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
					cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
					closeButton:
						'group-[.toast]:bg-card group-[.toast]:border-border group-[.toast]:text-foreground',
				},
			}}
		/>
	)
}

// ==========================================
// Toast Provider (for backward compatibility)
// ==========================================

/**
 * Toast Provider — wraps your app and renders the Toaster
 *
 * This is provided for backward compatibility. You can also use
 * just the Toaster component directly in your layout.
 *
 * @example
 * ```tsx
 * import { ToastProvider } from '@sylphx/ui'
 *
 * export default function App({ children }) {
 *   return (
 *     <ToastProvider>
 *       {children}
 *     </ToastProvider>
 *   )
 * }
 * ```
 */
export function ToastProvider({ children }: { children: ReactNode }) {
	return (
		<>
			{children}
			<Toaster />
		</>
	)
}

// Alias for backward compatibility
export { ToastProvider as ToastProviderWithContext }
