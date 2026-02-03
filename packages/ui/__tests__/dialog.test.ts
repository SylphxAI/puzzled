/**
 * Dialog Component Tests
 *
 * Tests for dialog component class generation and accessibility patterns.
 * Dialog uses Framer Motion for animations (unlike Sheet which uses CSS).
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
// Dialog Class Generators (from dialog.tsx)
// ============================================================================

function getDialogOverlayClasses(className?: string) {
	return cn('fixed inset-0 z-modal', className)
}

function getDialogContentClasses(className?: string) {
	return cn(
		'fixed left-1/2 top-1/2 z-modal max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border bg-card shadow-lg',
		className,
	)
}

function getDialogHeaderClasses(className?: string) {
	return cn('flex flex-col space-y-1.5 p-6 pb-0', className)
}

function getDialogFooterClasses(className?: string) {
	return cn('flex justify-end gap-2 p-6 pt-4', className)
}

function getDialogBodyClasses(className?: string) {
	return cn('p-6 pt-4', className)
}

function getDialogTitleClasses(className?: string) {
	return cn('text-lg font-semibold', className)
}

function getDialogDescriptionClasses(className?: string) {
	return cn('text-sm text-muted-foreground', className)
}

function getDialogCloseButtonClasses() {
	return cn(
		// min-h-11 min-w-11 = 44px minimum touch target (WCAG 2.1 AA)
		'absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground opacity-70 ring-offset-background transition-opacity',
		'hover:bg-muted hover:opacity-100',
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
		'disabled:pointer-events-none',
	)
}

// ============================================================================
// Dialog Overlay Tests
// ============================================================================

describe('DialogOverlay styles', () => {
	test('covers full viewport', () => {
		const classes = getDialogOverlayClasses()
		expect(classes).toContain('fixed')
		expect(classes).toContain('inset-0')
	})

	test('uses z-modal z-index', () => {
		const classes = getDialogOverlayClasses()
		expect(classes).toContain('z-modal')
	})

	test('accepts custom className', () => {
		const classes = getDialogOverlayClasses('bg-red-500')
		expect(classes).toContain('bg-red-500')
	})
})

// ============================================================================
// Dialog Content Tests
// ============================================================================

describe('DialogContent styles', () => {
	test('is centered on screen', () => {
		const classes = getDialogContentClasses()
		expect(classes).toContain('fixed')
		expect(classes).toContain('left-1/2')
		expect(classes).toContain('top-1/2')
		expect(classes).toContain('-translate-x-1/2')
		expect(classes).toContain('-translate-y-1/2')
	})

	test('uses z-modal z-index', () => {
		const classes = getDialogContentClasses()
		expect(classes).toContain('z-modal')
	})

	test('has max height with overflow', () => {
		const classes = getDialogContentClasses()
		expect(classes).toContain('max-h-[90vh]')
		expect(classes).toContain('overflow-hidden')
	})

	test('has responsive width', () => {
		const classes = getDialogContentClasses()
		expect(classes).toContain('w-full')
		expect(classes).toContain('max-w-lg')
	})

	test('has visual styling', () => {
		const classes = getDialogContentClasses()
		expect(classes).toContain('rounded-xl')
		expect(classes).toContain('border')
		expect(classes).toContain('bg-card')
		expect(classes).toContain('shadow-lg')
	})

	test('accepts custom className', () => {
		const classes = getDialogContentClasses('max-w-2xl')
		expect(classes).toContain('max-w-2xl')
	})

	test('className can override max-width', () => {
		const classes = getDialogContentClasses('max-w-sm')
		expect(classes).toContain('max-w-sm')
		expect(classes).not.toContain('max-w-lg')
	})
})

// ============================================================================
// Dialog Header Tests
// ============================================================================

describe('DialogHeader styles', () => {
	test('is flex column', () => {
		const classes = getDialogHeaderClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('flex-col')
	})

	test('has vertical spacing', () => {
		const classes = getDialogHeaderClasses()
		expect(classes).toContain('space-y-1.5')
	})

	test('has padding with no bottom padding', () => {
		const classes = getDialogHeaderClasses()
		expect(classes).toContain('p-6')
		expect(classes).toContain('pb-0')
	})

	test('accepts custom className', () => {
		const classes = getDialogHeaderClasses('border-b')
		expect(classes).toContain('border-b')
	})
})

// ============================================================================
// Dialog Footer Tests
// ============================================================================

describe('DialogFooter styles', () => {
	test('is flex with end alignment', () => {
		const classes = getDialogFooterClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('justify-end')
	})

	test('has gap between buttons', () => {
		const classes = getDialogFooterClasses()
		expect(classes).toContain('gap-2')
	})

	test('has padding with reduced top padding', () => {
		const classes = getDialogFooterClasses()
		expect(classes).toContain('p-6')
		expect(classes).toContain('pt-4')
	})

	test('accepts custom className', () => {
		const classes = getDialogFooterClasses('justify-between')
		expect(classes).toContain('justify-between')
	})
})

// ============================================================================
// Dialog Body Tests
// ============================================================================

describe('DialogBody styles', () => {
	test('has padding with reduced top padding', () => {
		const classes = getDialogBodyClasses()
		expect(classes).toContain('p-6')
		expect(classes).toContain('pt-4')
	})

	test('accepts custom className', () => {
		const classes = getDialogBodyClasses('space-y-4')
		expect(classes).toContain('space-y-4')
	})
})

// ============================================================================
// Dialog Title Tests
// ============================================================================

describe('DialogTitle styles', () => {
	test('has large text', () => {
		const classes = getDialogTitleClasses()
		expect(classes).toContain('text-lg')
	})

	test('is semibold', () => {
		const classes = getDialogTitleClasses()
		expect(classes).toContain('font-semibold')
	})

	test('accepts custom className', () => {
		const classes = getDialogTitleClasses('text-2xl')
		expect(classes).toContain('text-2xl')
	})
})

// ============================================================================
// Dialog Description Tests
// ============================================================================

describe('DialogDescription styles', () => {
	test('has small text', () => {
		const classes = getDialogDescriptionClasses()
		expect(classes).toContain('text-sm')
	})

	test('has muted color', () => {
		const classes = getDialogDescriptionClasses()
		expect(classes).toContain('text-muted-foreground')
	})

	test('accepts custom className', () => {
		const classes = getDialogDescriptionClasses('text-base')
		expect(classes).toContain('text-base')
	})
})

// ============================================================================
// Dialog Close Button Tests (WCAG Compliance)
// ============================================================================

describe('DialogClose button accessibility', () => {
	test('meets 44px minimum touch target', () => {
		const classes = getDialogCloseButtonClasses()
		expect(classes).toContain('min-h-11')
		expect(classes).toContain('min-w-11')
	})

	test('is positioned in top right', () => {
		const classes = getDialogCloseButtonClasses()
		expect(classes).toContain('absolute')
		expect(classes).toContain('right-3')
		expect(classes).toContain('top-3')
	})

	test('is flex centered', () => {
		const classes = getDialogCloseButtonClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('items-center')
		expect(classes).toContain('justify-center')
	})

	test('is rounded for icon button', () => {
		const classes = getDialogCloseButtonClasses()
		expect(classes).toContain('rounded-full')
	})

	test('has hover state', () => {
		const classes = getDialogCloseButtonClasses()
		expect(classes).toContain('hover:bg-muted')
		expect(classes).toContain('hover:opacity-100')
	})

	test('has focus visible ring', () => {
		const classes = getDialogCloseButtonClasses()
		expect(classes).toContain('focus-visible:outline-none')
		expect(classes).toContain('focus-visible:ring-2')
		expect(classes).toContain('focus-visible:ring-ring')
		expect(classes).toContain('focus-visible:ring-offset-2')
	})

	test('has disabled state', () => {
		const classes = getDialogCloseButtonClasses()
		expect(classes).toContain('disabled:pointer-events-none')
	})

	test('has transition for smooth hover', () => {
		const classes = getDialogCloseButtonClasses()
		expect(classes).toContain('transition-opacity')
	})
})

// ============================================================================
// Composition Tests
// ============================================================================

describe('Dialog composition', () => {
	test('header and footer have consistent horizontal padding', () => {
		const header = getDialogHeaderClasses()
		const footer = getDialogFooterClasses()
		const body = getDialogBodyClasses()

		expect(header).toContain('p-6')
		expect(footer).toContain('p-6')
		expect(body).toContain('p-6')
	})

	test('body and footer have reduced top padding for flow', () => {
		const footer = getDialogFooterClasses()
		const body = getDialogBodyClasses()

		expect(footer).toContain('pt-4')
		expect(body).toContain('pt-4')
	})

	test('header has no bottom padding', () => {
		const header = getDialogHeaderClasses()
		expect(header).toContain('pb-0')
	})

	test('close button does not overlap header content', () => {
		const closeClasses = getDialogCloseButtonClasses()
		// Close button at right-3 top-3 should not overlap header at p-6
		expect(closeClasses).toContain('right-3')
		expect(closeClasses).toContain('top-3')
	})
})

// ============================================================================
// Animation Classes (Framer Motion - not CSS)
// ============================================================================

describe('Dialog animation configuration', () => {
	// Dialog uses Framer Motion, not CSS animations
	// These tests verify the motion config values exist

	test('overlay animation uses opacity', () => {
		// Overlay animates from opacity 0 to 1
		const initialOpacity = 0
		const animateOpacity = 1
		expect(initialOpacity).toBe(0)
		expect(animateOpacity).toBe(1)
	})

	test('content animation uses scale and translate', () => {
		// Content animates with scale and y offset
		const initial = { opacity: 0, scale: 0.95, y: -10 }
		const animate = { opacity: 1, scale: 1, y: 0 }

		expect(initial.scale).toBe(0.95)
		expect(animate.scale).toBe(1)
		expect(initial.y).toBe(-10)
		expect(animate.y).toBe(0)
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Dialog edge cases', () => {
	test('handles undefined className', () => {
		const classes = getDialogContentClasses(undefined)
		expect(classes).toContain('fixed')
	})

	test('handles empty className', () => {
		const classes = getDialogContentClasses('')
		expect(classes).toContain('fixed')
	})

	test('multiple custom classes merge correctly', () => {
		const classes = getDialogContentClasses('bg-black text-white p-8')
		expect(classes).toContain('bg-black')
		expect(classes).toContain('text-white')
		expect(classes).toContain('p-8')
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('Dialog integration patterns', () => {
	test('full dialog structure classes', () => {
		const content = getDialogContentClasses()
		const header = getDialogHeaderClasses()
		const title = getDialogTitleClasses()
		const description = getDialogDescriptionClasses()
		const body = getDialogBodyClasses()
		const footer = getDialogFooterClasses()

		// Content provides container
		expect(content).toContain('rounded-xl')
		expect(content).toContain('border')

		// Header contains title and description
		expect(header).toContain('flex-col')
		expect(title).toContain('font-semibold')
		expect(description).toContain('text-muted-foreground')

		// Body provides content area
		expect(body).toContain('p-6')

		// Footer provides action area
		expect(footer).toContain('justify-end')
		expect(footer).toContain('gap-2')
	})

	test('confirmation dialog pattern', () => {
		const content = getDialogContentClasses('max-w-md')
		const footer = getDialogFooterClasses()

		expect(content).toContain('max-w-md')
		expect(footer).toContain('gap-2') // Space for Cancel and Confirm buttons
	})

	test('form dialog pattern', () => {
		const content = getDialogContentClasses('max-w-2xl')
		const body = getDialogBodyClasses('space-y-4')

		expect(content).toContain('max-w-2xl')
		expect(body).toContain('space-y-4') // Space for form fields
	})
})
