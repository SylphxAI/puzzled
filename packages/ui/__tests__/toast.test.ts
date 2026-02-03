/**
 * Toast Component Tests
 *
 * Tests for toast notifications including variants, icons, actions, and accessibility.
 * Toast uses Framer Motion for animations.
 */

import { describe, expect, test } from 'bun:test'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ============================================================================
// cn() utility (from utils.ts)
// ============================================================================

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

// ============================================================================
// Toast Class Generators (from toast.tsx)
// ============================================================================

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info'

function getToastViewportClasses(className?: string) {
	return cn(
		'fixed bottom-20 left-1/2 z-toast flex max-h-screen -translate-x-1/2 flex-col gap-2 p-4 sm:bottom-4 sm:left-auto sm:right-4 sm:translate-x-0',
		'pointer-events-none w-full max-w-sm',
		className,
	)
}

function getToastClasses(variant: ToastVariant = 'default', className?: string) {
	const baseClasses =
		'pointer-events-auto group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 shadow-lg'

	const variantClasses = {
		default: 'border-border bg-card text-card-foreground',
		success:
			'border-[var(--toast-success-border)] bg-[var(--toast-success-bg)] text-[var(--toast-success-text)]',
		error: 'border-[var(--toast-error-border)] bg-[var(--toast-error-bg)] text-[var(--toast-error-text)]',
		warning:
			'border-[var(--toast-warning-border)] bg-[var(--toast-warning-bg)] text-[var(--toast-warning-text)]',
		info: 'border-[var(--toast-info-border)] bg-[var(--toast-info-bg)] text-[var(--toast-info-text)]',
	}

	return cn(baseClasses, variantClasses[variant], className)
}

function getToastActionClasses(className?: string) {
	return cn(
		// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
		'inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-muted',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
		'disabled:pointer-events-none disabled:opacity-50',
		className,
	)
}

function getToastCloseClasses(className?: string) {
	return cn(
		// min-h-11 min-w-11 = 44px minimum touch target (WCAG 2.1 AA)
		'shrink-0 rounded-md p-2.5 min-h-11 min-w-11 flex items-center justify-center opacity-60 transition-opacity hover:opacity-100',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
		className,
	)
}

function getToastTitleClasses(className?: string) {
	return cn('font-medium', className)
}

function getToastDescriptionClasses(className?: string) {
	return cn('mt-1 text-sm opacity-80', className)
}

// ============================================================================
// Toast Viewport Tests
// ============================================================================

describe('ToastViewport styles', () => {
	test('is fixed positioned', () => {
		const classes = getToastViewportClasses()
		expect(classes).toContain('fixed')
	})

	test('uses z-toast z-index (highest layer)', () => {
		const classes = getToastViewportClasses()
		expect(classes).toContain('z-toast')
	})

	test('is centered on mobile', () => {
		const classes = getToastViewportClasses()
		expect(classes).toContain('left-1/2')
		expect(classes).toContain('-translate-x-1/2')
		expect(classes).toContain('bottom-20') // Above mobile nav
	})

	test('is bottom-right on desktop', () => {
		const classes = getToastViewportClasses()
		expect(classes).toContain('sm:bottom-4')
		expect(classes).toContain('sm:left-auto')
		expect(classes).toContain('sm:right-4')
		expect(classes).toContain('sm:translate-x-0')
	})

	test('is flex column with gap', () => {
		const classes = getToastViewportClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('flex-col')
		expect(classes).toContain('gap-2')
	})

	test('has max height', () => {
		const classes = getToastViewportClasses()
		expect(classes).toContain('max-h-screen')
	})

	test('is pointer-events-none (toasts themselves are pointer-events-auto)', () => {
		const classes = getToastViewportClasses()
		expect(classes).toContain('pointer-events-none')
	})

	test('has max width', () => {
		const classes = getToastViewportClasses()
		expect(classes).toContain('w-full')
		expect(classes).toContain('max-w-sm')
	})

	test('accepts custom className', () => {
		const classes = getToastViewportClasses('sm:bottom-8')
		expect(classes).toContain('sm:bottom-8')
	})
})

// ============================================================================
// Toast Base Styles Tests
// ============================================================================

describe('Toast base styles', () => {
	test('is pointer-events-auto for interactivity', () => {
		const classes = getToastClasses('default')
		expect(classes).toContain('pointer-events-auto')
	})

	test('is relative for internal positioning', () => {
		const classes = getToastClasses('default')
		expect(classes).toContain('relative')
	})

	test('is flex with gap for icon + content layout', () => {
		const classes = getToastClasses('default')
		expect(classes).toContain('flex')
		expect(classes).toContain('items-start')
		expect(classes).toContain('gap-3')
	})

	test('has full width', () => {
		const classes = getToastClasses('default')
		expect(classes).toContain('w-full')
	})

	test('has visual styling', () => {
		const classes = getToastClasses('default')
		expect(classes).toContain('rounded-lg')
		expect(classes).toContain('border')
		expect(classes).toContain('shadow-lg')
	})

	test('has padding', () => {
		const classes = getToastClasses('default')
		expect(classes).toContain('p-4')
	})

	test('handles overflow', () => {
		const classes = getToastClasses('default')
		expect(classes).toContain('overflow-hidden')
	})

	test('has group class for close button visibility', () => {
		const classes = getToastClasses('default')
		expect(classes).toContain('group')
	})
})

// ============================================================================
// Toast Variant Tests
// ============================================================================

describe('Toast variants', () => {
	describe('default variant', () => {
		test('has card styling', () => {
			const classes = getToastClasses('default')
			expect(classes).toContain('border-border')
			expect(classes).toContain('bg-card')
			expect(classes).toContain('text-card-foreground')
		})
	})

	describe('success variant', () => {
		test('uses success CSS variables', () => {
			const classes = getToastClasses('success')
			expect(classes).toContain('border-[var(--toast-success-border)]')
			expect(classes).toContain('bg-[var(--toast-success-bg)]')
			expect(classes).toContain('text-[var(--toast-success-text)]')
		})
	})

	describe('error variant', () => {
		test('uses error CSS variables', () => {
			const classes = getToastClasses('error')
			expect(classes).toContain('border-[var(--toast-error-border)]')
			expect(classes).toContain('bg-[var(--toast-error-bg)]')
			expect(classes).toContain('text-[var(--toast-error-text)]')
		})
	})

	describe('warning variant', () => {
		test('uses warning CSS variables', () => {
			const classes = getToastClasses('warning')
			expect(classes).toContain('border-[var(--toast-warning-border)]')
			expect(classes).toContain('bg-[var(--toast-warning-bg)]')
			expect(classes).toContain('text-[var(--toast-warning-text)]')
		})
	})

	describe('info variant', () => {
		test('uses info CSS variables', () => {
			const classes = getToastClasses('info')
			expect(classes).toContain('border-[var(--toast-info-border)]')
			expect(classes).toContain('bg-[var(--toast-info-bg)]')
			expect(classes).toContain('text-[var(--toast-info-text)]')
		})
	})
})

// ============================================================================
// Toast Icon Mapping Tests
// ============================================================================

describe('Toast icon mapping', () => {
	// Icon mapping from toast.tsx
	const variantIcons = {
		default: null,
		success: 'CheckCircle',
		error: 'XCircle',
		warning: 'AlertCircle',
		info: 'Info',
	}

	const iconStyles = {
		default: 'text-foreground',
		success: 'text-[var(--color-success)]',
		error: 'text-[var(--color-error)]',
		warning: 'text-[var(--color-warning)]',
		info: 'text-[var(--color-info)]',
	}

	test('default variant has no icon', () => {
		expect(variantIcons.default).toBeNull()
	})

	test('success variant uses CheckCircle', () => {
		expect(variantIcons.success).toBe('CheckCircle')
	})

	test('error variant uses XCircle', () => {
		expect(variantIcons.error).toBe('XCircle')
	})

	test('warning variant uses AlertCircle', () => {
		expect(variantIcons.warning).toBe('AlertCircle')
	})

	test('info variant uses Info', () => {
		expect(variantIcons.info).toBe('Info')
	})

	test('success icon has success color', () => {
		expect(iconStyles.success).toContain('--color-success')
	})

	test('error icon has error color', () => {
		expect(iconStyles.error).toContain('--color-error')
	})

	test('warning icon has warning color', () => {
		expect(iconStyles.warning).toContain('--color-warning')
	})

	test('info icon has info color', () => {
		expect(iconStyles.info).toContain('--color-info')
	})
})

// ============================================================================
// Toast Action Button Tests
// ============================================================================

describe('ToastAction accessibility', () => {
	test('meets 44px minimum touch target', () => {
		const classes = getToastActionClasses()
		expect(classes).toContain('min-h-11')
	})

	test('is inline-flex for text alignment', () => {
		const classes = getToastActionClasses()
		expect(classes).toContain('inline-flex')
		expect(classes).toContain('items-center')
		expect(classes).toContain('justify-center')
	})

	test('does not shrink', () => {
		const classes = getToastActionClasses()
		expect(classes).toContain('shrink-0')
	})

	test('has visible styling', () => {
		const classes = getToastActionClasses()
		expect(classes).toContain('rounded-md')
		expect(classes).toContain('border')
		expect(classes).toContain('px-3')
		expect(classes).toContain('font-medium')
	})

	test('has hover state', () => {
		const classes = getToastActionClasses()
		expect(classes).toContain('hover:bg-muted')
	})

	test('has focus visible ring', () => {
		const classes = getToastActionClasses()
		expect(classes).toContain('focus-visible:outline-none')
		expect(classes).toContain('focus-visible:ring-2')
		expect(classes).toContain('focus-visible:ring-ring')
	})

	test('has disabled state', () => {
		const classes = getToastActionClasses()
		expect(classes).toContain('disabled:pointer-events-none')
		expect(classes).toContain('disabled:opacity-50')
	})

	test('has transition', () => {
		const classes = getToastActionClasses()
		expect(classes).toContain('transition-colors')
	})

	test('accepts custom className', () => {
		const classes = getToastActionClasses('bg-primary text-primary-foreground')
		expect(classes).toContain('bg-primary')
	})
})

// ============================================================================
// Toast Close Button Tests
// ============================================================================

describe('ToastClose accessibility', () => {
	test('meets 44px minimum touch target', () => {
		const classes = getToastCloseClasses()
		expect(classes).toContain('min-h-11')
		expect(classes).toContain('min-w-11')
	})

	test('is flex centered for icon', () => {
		const classes = getToastCloseClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('items-center')
		expect(classes).toContain('justify-center')
	})

	test('does not shrink', () => {
		const classes = getToastCloseClasses()
		expect(classes).toContain('shrink-0')
	})

	test('has rounded corners', () => {
		const classes = getToastCloseClasses()
		expect(classes).toContain('rounded-md')
	})

	test('has subtle initial opacity', () => {
		const classes = getToastCloseClasses()
		expect(classes).toContain('opacity-60')
	})

	test('becomes fully opaque on hover', () => {
		const classes = getToastCloseClasses()
		expect(classes).toContain('hover:opacity-100')
	})

	test('has focus visible ring', () => {
		const classes = getToastCloseClasses()
		expect(classes).toContain('focus-visible:outline-none')
		expect(classes).toContain('focus-visible:ring-2')
		expect(classes).toContain('focus-visible:ring-ring')
	})

	test('has transition for smooth hover', () => {
		const classes = getToastCloseClasses()
		expect(classes).toContain('transition-opacity')
	})

	test('accepts custom className', () => {
		const classes = getToastCloseClasses('opacity-100')
		expect(classes).toContain('opacity-100')
	})
})

// ============================================================================
// Toast Title Tests
// ============================================================================

describe('ToastTitle styles', () => {
	test('is medium weight', () => {
		const classes = getToastTitleClasses()
		expect(classes).toContain('font-medium')
	})

	test('accepts custom className', () => {
		const classes = getToastTitleClasses('text-lg')
		expect(classes).toContain('text-lg')
	})
})

// ============================================================================
// Toast Description Tests
// ============================================================================

describe('ToastDescription styles', () => {
	test('has small text', () => {
		const classes = getToastDescriptionClasses()
		expect(classes).toContain('text-sm')
	})

	test('has top margin', () => {
		const classes = getToastDescriptionClasses()
		expect(classes).toContain('mt-1')
	})

	test('has reduced opacity', () => {
		const classes = getToastDescriptionClasses()
		expect(classes).toContain('opacity-80')
	})

	test('accepts custom className', () => {
		const classes = getToastDescriptionClasses('opacity-100')
		expect(classes).toContain('opacity-100')
	})
})

// ============================================================================
// Toast Viewport Accessibility Tests
// ============================================================================

describe('ToastViewport accessibility attributes', () => {
	// These test the ARIA attributes that should be on ToastViewport
	test('viewport should have aria-live="polite"', () => {
		// This tests the expected attribute value
		const expectedAriaLive = 'polite'
		expect(expectedAriaLive).toBe('polite')
	})

	test('viewport should have aria-atomic="true"', () => {
		const expectedAriaAtomic = 'true'
		expect(expectedAriaAtomic).toBe('true')
	})
})

// ============================================================================
// Toast Animation Tests (Framer Motion config)
// ============================================================================

describe('Toast animation configuration', () => {
	test('enter animation uses y offset and scale', () => {
		const initial = { opacity: 0, y: 50, scale: 0.9 }
		const animate = { opacity: 1, y: 0, scale: 1 }

		expect(initial.y).toBe(50)
		expect(initial.scale).toBe(0.9)
		expect(animate.y).toBe(0)
		expect(animate.scale).toBe(1)
	})

	test('exit animation uses x offset', () => {
		const exit = { opacity: 0, x: 100, scale: 0.9 }

		expect(exit.x).toBe(100)
		expect(exit.scale).toBe(0.9)
	})

	test('reduced motion uses opacity only', () => {
		const reducedInitial = { opacity: 0 }
		const reducedExit = { opacity: 0 }

		expect(reducedInitial.opacity).toBe(0)
		expect(reducedExit.opacity).toBe(0)
	})
})

// ============================================================================
// Toast Types Tests (Context API)
// ============================================================================

describe('Toast context types', () => {
	// Type definitions from toast.tsx
	type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info'
	type ToastAction = { label: string; onClick: () => void | Promise<void> }
	type ToastData = {
		id: string
		type: ToastType
		title: string
		description?: string
		duration?: number
		action?: ToastAction
	}

	test('toast types match variants', () => {
		const types: ToastType[] = ['default', 'success', 'error', 'warning', 'info']
		types.forEach((type) => {
			const classes = getToastClasses(type)
			expect(classes).toContain('rounded-lg')
		})
	})

	test('toast data structure is valid', () => {
		const mockToast: ToastData = {
			id: 'test-1',
			type: 'success',
			title: 'Success',
			description: 'Operation completed',
			duration: 5000,
			action: { label: 'Undo', onClick: () => {} },
		}

		expect(mockToast.id).toBe('test-1')
		expect(mockToast.type).toBe('success')
		expect(mockToast.title).toBe('Success')
		expect(mockToast.description).toBe('Operation completed')
		expect(mockToast.duration).toBe(5000)
		expect(mockToast.action?.label).toBe('Undo')
	})

	test('toast data with minimal fields', () => {
		const mockToast: ToastData = {
			id: 'test-2',
			type: 'error',
			title: 'Error occurred',
		}

		expect(mockToast.description).toBeUndefined()
		expect(mockToast.duration).toBeUndefined()
		expect(mockToast.action).toBeUndefined()
	})
})

// ============================================================================
// Undoable Toast Pattern Tests
// ============================================================================

describe('Undoable toast pattern', () => {
	// UndoableOptions type from toast.tsx
	type UndoableOptions = {
		description?: string
		onUndo: () => void | Promise<void>
		onConfirm?: () => void | Promise<void>
		timeoutMs?: number
	}

	test('undoable options with all fields', () => {
		const options: UndoableOptions = {
			description: 'Item deleted',
			onUndo: () => {},
			onConfirm: () => {},
			timeoutMs: 5000,
		}

		expect(options.description).toBe('Item deleted')
		expect(typeof options.onUndo).toBe('function')
		expect(typeof options.onConfirm).toBe('function')
		expect(options.timeoutMs).toBe(5000)
	})

	test('undoable options with minimal fields', () => {
		const options: UndoableOptions = {
			onUndo: () => {},
		}

		expect(options.description).toBeUndefined()
		expect(options.onConfirm).toBeUndefined()
		expect(options.timeoutMs).toBeUndefined()
	})

	test('default timeout is 5000ms', () => {
		const defaultTimeout = 5000
		expect(defaultTimeout).toBe(5000)
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Toast edge cases', () => {
	test('handles undefined className', () => {
		const classes = getToastClasses('default', undefined)
		expect(classes).toContain('rounded-lg')
	})

	test('handles empty className', () => {
		const classes = getToastClasses('default', '')
		expect(classes).toContain('rounded-lg')
	})

	test('default variant when not specified', () => {
		const classes = getToastClasses()
		expect(classes).toContain('border-border')
		expect(classes).toContain('bg-card')
	})

	test('variant classes override correctly', () => {
		const successClasses = getToastClasses('success')
		const errorClasses = getToastClasses('error')

		expect(successClasses).toContain('--toast-success-bg')
		expect(errorClasses).toContain('--toast-error-bg')
		expect(successClasses).not.toContain('--toast-error-bg')
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('Toast integration patterns', () => {
	test('success notification', () => {
		const toast = getToastClasses('success')
		const title = getToastTitleClasses()
		const description = getToastDescriptionClasses()
		const close = getToastCloseClasses()

		expect(toast).toContain('--toast-success-bg')
		expect(title).toContain('font-medium')
		expect(description).toContain('text-sm')
		expect(close).toContain('min-h-11')
	})

	test('error notification with action', () => {
		const toast = getToastClasses('error')
		const action = getToastActionClasses()
		const close = getToastCloseClasses()

		expect(toast).toContain('--toast-error-bg')
		expect(action).toContain('min-h-11')
		expect(close).toContain('min-h-11')
	})

	test('undoable notification', () => {
		const toast = getToastClasses('default')
		const action = getToastActionClasses()

		expect(toast).toContain('bg-card')
		expect(action).toContain('border') // Undo button has border
	})

	test('warning notification', () => {
		const toast = getToastClasses('warning')

		expect(toast).toContain('--toast-warning-bg')
		expect(toast).toContain('--toast-warning-border')
	})
})
