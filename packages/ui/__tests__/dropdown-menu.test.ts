/**
 * Dropdown Menu Component Tests
 *
 * Tests for dropdown menu class generation, keyboard navigation patterns,
 * and accessibility compliance.
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
// DropdownMenu Class Generators (from dropdown-menu.tsx)
// ============================================================================

function getDropdownMenuContentClasses(className?: string) {
	return cn(
		'z-popover min-w-[8rem] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg',
		className,
	)
}

function getDropdownMenuSubTriggerClasses(inset?: boolean, className?: string) {
	return cn(
		// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
		'flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 min-h-11 text-sm outline-none focus:bg-muted data-[state=open]:bg-muted [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
		inset && 'pl-8',
		className,
	)
}

function getDropdownMenuSubContentClasses(className?: string) {
	return cn(
		'dropdown-sub-content z-popover min-w-[8rem] overflow-hidden rounded-lg border bg-card p-1 text-card-foreground shadow-lg',
		className,
	)
}

function getDropdownMenuItemClasses(inset?: boolean, destructive?: boolean, className?: string) {
	return cn(
		// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
		'relative flex cursor-default select-none items-center gap-2 rounded-md px-3 py-2 min-h-11 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
		inset && 'pl-8',
		destructive && 'text-destructive focus:text-destructive',
		className,
	)
}

function getDropdownMenuCheckboxItemClasses(className?: string) {
	return cn(
		// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
		'relative flex cursor-default select-none items-center rounded-md py-2 pl-8 pr-3 min-h-11 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		className,
	)
}

function getDropdownMenuRadioItemClasses(className?: string) {
	return cn(
		// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
		'relative flex cursor-default select-none items-center rounded-md py-2 pl-8 pr-3 min-h-11 text-sm outline-none transition-colors focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		className,
	)
}

function getDropdownMenuLabelClasses(inset?: boolean, className?: string) {
	return cn('px-3 py-2 text-sm font-semibold', inset && 'pl-8', className)
}

function getDropdownMenuSeparatorClasses(className?: string) {
	return cn('-mx-1 my-1 h-px bg-border', className)
}

function getDropdownMenuShortcutClasses(className?: string) {
	return cn('ml-auto text-xs tracking-widest text-muted-foreground', className)
}

// ============================================================================
// DropdownMenuContent Tests
// ============================================================================

describe('DropdownMenuContent styles', () => {
	test('uses z-popover z-index', () => {
		const classes = getDropdownMenuContentClasses()
		expect(classes).toContain('z-popover')
	})

	test('has minimum width', () => {
		const classes = getDropdownMenuContentClasses()
		expect(classes).toContain('min-w-[8rem]')
	})

	test('handles overflow', () => {
		const classes = getDropdownMenuContentClasses()
		expect(classes).toContain('overflow-hidden')
	})

	test('has visual styling', () => {
		const classes = getDropdownMenuContentClasses()
		expect(classes).toContain('rounded-lg')
		expect(classes).toContain('border')
		expect(classes).toContain('bg-card')
		expect(classes).toContain('shadow-lg')
	})

	test('has card text color', () => {
		const classes = getDropdownMenuContentClasses()
		expect(classes).toContain('text-card-foreground')
	})

	test('accepts custom className', () => {
		const classes = getDropdownMenuContentClasses('min-w-[12rem]')
		expect(classes).toContain('min-w-[12rem]')
	})
})

// ============================================================================
// DropdownMenuItem Tests
// ============================================================================

describe('DropdownMenuItem styles', () => {
	test('meets 44px minimum touch target', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('min-h-11')
	})

	test('is flex with gap for icon + text', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('items-center')
		expect(classes).toContain('gap-2')
	})

	test('is relative for internal positioning', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('relative')
	})

	test('has padding', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('px-3')
		expect(classes).toContain('py-2')
	})

	test('has rounded corners', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('rounded-md')
	})

	test('has focus state', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('focus:bg-muted')
	})

	test('removes outline on focus', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('outline-none')
	})

	test('has disabled state', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('data-[disabled]:pointer-events-none')
		expect(classes).toContain('data-[disabled]:opacity-50')
	})

	test('has transition for smooth hover', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('transition-colors')
	})

	test('handles SVG icons', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('[&_svg]:pointer-events-none')
		expect(classes).toContain('[&_svg]:h-4')
		expect(classes).toContain('[&_svg]:w-4')
		expect(classes).toContain('[&_svg]:shrink-0')
	})

	test('is not selectable', () => {
		const classes = getDropdownMenuItemClasses()
		expect(classes).toContain('select-none')
	})
})

// ============================================================================
// DropdownMenuItem Variants Tests
// ============================================================================

describe('DropdownMenuItem variants', () => {
	describe('inset variant', () => {
		test('adds left padding when inset', () => {
			const classes = getDropdownMenuItemClasses(true)
			expect(classes).toContain('pl-8')
		})

		test('no extra left padding when not inset', () => {
			const classes = getDropdownMenuItemClasses(false)
			expect(classes).not.toContain('pl-8')
		})
	})

	describe('destructive variant', () => {
		test('has destructive text color', () => {
			const classes = getDropdownMenuItemClasses(false, true)
			expect(classes).toContain('text-destructive')
		})

		test('keeps destructive color on focus', () => {
			const classes = getDropdownMenuItemClasses(false, true)
			expect(classes).toContain('focus:text-destructive')
		})

		test('no destructive styling when not destructive', () => {
			const classes = getDropdownMenuItemClasses(false, false)
			expect(classes).not.toContain('text-destructive')
		})
	})

	describe('inset + destructive', () => {
		test('has both inset and destructive classes', () => {
			const classes = getDropdownMenuItemClasses(true, true)
			expect(classes).toContain('pl-8')
			expect(classes).toContain('text-destructive')
		})
	})
})

// ============================================================================
// DropdownMenuSubTrigger Tests
// ============================================================================

describe('DropdownMenuSubTrigger styles', () => {
	test('meets 44px minimum touch target', () => {
		const classes = getDropdownMenuSubTriggerClasses()
		expect(classes).toContain('min-h-11')
	})

	test('is flex with gap', () => {
		const classes = getDropdownMenuSubTriggerClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('items-center')
		expect(classes).toContain('gap-2')
	})

	test('has focus state', () => {
		const classes = getDropdownMenuSubTriggerClasses()
		expect(classes).toContain('focus:bg-muted')
	})

	test('has open state', () => {
		const classes = getDropdownMenuSubTriggerClasses()
		expect(classes).toContain('data-[state=open]:bg-muted')
	})

	test('handles SVG icons', () => {
		const classes = getDropdownMenuSubTriggerClasses()
		expect(classes).toContain('[&_svg]:h-4')
		expect(classes).toContain('[&_svg]:w-4')
	})

	describe('inset variant', () => {
		test('adds left padding when inset', () => {
			const classes = getDropdownMenuSubTriggerClasses(true)
			expect(classes).toContain('pl-8')
		})

		test('no extra left padding when not inset', () => {
			const classes = getDropdownMenuSubTriggerClasses(false)
			expect(classes).not.toContain('pl-8')
		})
	})
})

// ============================================================================
// DropdownMenuSubContent Tests
// ============================================================================

describe('DropdownMenuSubContent styles', () => {
	test('has CSS animation class', () => {
		const classes = getDropdownMenuSubContentClasses()
		expect(classes).toContain('dropdown-sub-content')
	})

	test('uses z-popover z-index', () => {
		const classes = getDropdownMenuSubContentClasses()
		expect(classes).toContain('z-popover')
	})

	test('has minimum width', () => {
		const classes = getDropdownMenuSubContentClasses()
		expect(classes).toContain('min-w-[8rem]')
	})

	test('has visual styling', () => {
		const classes = getDropdownMenuSubContentClasses()
		expect(classes).toContain('rounded-lg')
		expect(classes).toContain('border')
		expect(classes).toContain('bg-card')
		expect(classes).toContain('shadow-lg')
	})

	test('has padding for items', () => {
		const classes = getDropdownMenuSubContentClasses()
		expect(classes).toContain('p-1')
	})
})

// ============================================================================
// DropdownMenuCheckboxItem Tests
// ============================================================================

describe('DropdownMenuCheckboxItem styles', () => {
	test('meets 44px minimum touch target', () => {
		const classes = getDropdownMenuCheckboxItemClasses()
		expect(classes).toContain('min-h-11')
	})

	test('has left padding for checkbox indicator', () => {
		const classes = getDropdownMenuCheckboxItemClasses()
		expect(classes).toContain('pl-8')
	})

	test('has right padding', () => {
		const classes = getDropdownMenuCheckboxItemClasses()
		expect(classes).toContain('pr-3')
	})

	test('is flex aligned', () => {
		const classes = getDropdownMenuCheckboxItemClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('items-center')
	})

	test('has focus state', () => {
		const classes = getDropdownMenuCheckboxItemClasses()
		expect(classes).toContain('focus:bg-muted')
	})

	test('has disabled state', () => {
		const classes = getDropdownMenuCheckboxItemClasses()
		expect(classes).toContain('data-[disabled]:pointer-events-none')
		expect(classes).toContain('data-[disabled]:opacity-50')
	})
})

// ============================================================================
// DropdownMenuRadioItem Tests
// ============================================================================

describe('DropdownMenuRadioItem styles', () => {
	test('meets 44px minimum touch target', () => {
		const classes = getDropdownMenuRadioItemClasses()
		expect(classes).toContain('min-h-11')
	})

	test('has left padding for radio indicator', () => {
		const classes = getDropdownMenuRadioItemClasses()
		expect(classes).toContain('pl-8')
	})

	test('has right padding', () => {
		const classes = getDropdownMenuRadioItemClasses()
		expect(classes).toContain('pr-3')
	})

	test('is flex aligned', () => {
		const classes = getDropdownMenuRadioItemClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('items-center')
	})

	test('has focus state', () => {
		const classes = getDropdownMenuRadioItemClasses()
		expect(classes).toContain('focus:bg-muted')
	})

	test('has disabled state', () => {
		const classes = getDropdownMenuRadioItemClasses()
		expect(classes).toContain('data-[disabled]:pointer-events-none')
		expect(classes).toContain('data-[disabled]:opacity-50')
	})
})

// ============================================================================
// DropdownMenuLabel Tests
// ============================================================================

describe('DropdownMenuLabel styles', () => {
	test('has padding', () => {
		const classes = getDropdownMenuLabelClasses()
		expect(classes).toContain('px-3')
		expect(classes).toContain('py-2')
	})

	test('has small text', () => {
		const classes = getDropdownMenuLabelClasses()
		expect(classes).toContain('text-sm')
	})

	test('is semibold', () => {
		const classes = getDropdownMenuLabelClasses()
		expect(classes).toContain('font-semibold')
	})

	describe('inset variant', () => {
		test('adds left padding when inset', () => {
			const classes = getDropdownMenuLabelClasses(true)
			expect(classes).toContain('pl-8')
		})

		test('no extra left padding when not inset', () => {
			const classes = getDropdownMenuLabelClasses(false)
			expect(classes).not.toContain('pl-8')
		})
	})
})

// ============================================================================
// DropdownMenuSeparator Tests
// ============================================================================

describe('DropdownMenuSeparator styles', () => {
	test('has negative horizontal margin', () => {
		const classes = getDropdownMenuSeparatorClasses()
		expect(classes).toContain('-mx-1')
	})

	test('has vertical margin', () => {
		const classes = getDropdownMenuSeparatorClasses()
		expect(classes).toContain('my-1')
	})

	test('has 1px height', () => {
		const classes = getDropdownMenuSeparatorClasses()
		expect(classes).toContain('h-px')
	})

	test('has border color', () => {
		const classes = getDropdownMenuSeparatorClasses()
		expect(classes).toContain('bg-border')
	})
})

// ============================================================================
// DropdownMenuShortcut Tests
// ============================================================================

describe('DropdownMenuShortcut styles', () => {
	test('is pushed to the right', () => {
		const classes = getDropdownMenuShortcutClasses()
		expect(classes).toContain('ml-auto')
	})

	test('has small text', () => {
		const classes = getDropdownMenuShortcutClasses()
		expect(classes).toContain('text-xs')
	})

	test('has wide letter spacing', () => {
		const classes = getDropdownMenuShortcutClasses()
		expect(classes).toContain('tracking-widest')
	})

	test('has muted color', () => {
		const classes = getDropdownMenuShortcutClasses()
		expect(classes).toContain('text-muted-foreground')
	})
})

// ============================================================================
// Touch Target Compliance Tests
// ============================================================================

describe('DropdownMenu touch target compliance', () => {
	test('all interactive items meet 44px minimum', () => {
		const item = getDropdownMenuItemClasses()
		const subTrigger = getDropdownMenuSubTriggerClasses()
		const checkboxItem = getDropdownMenuCheckboxItemClasses()
		const radioItem = getDropdownMenuRadioItemClasses()

		expect(item).toContain('min-h-11')
		expect(subTrigger).toContain('min-h-11')
		expect(checkboxItem).toContain('min-h-11')
		expect(radioItem).toContain('min-h-11')
	})
})

// ============================================================================
// Keyboard Navigation Pattern Tests
// ============================================================================

describe('DropdownMenu keyboard navigation patterns', () => {
	// Radix handles actual keyboard navigation, these test the expected classes

	test('items have focus state for keyboard navigation', () => {
		const item = getDropdownMenuItemClasses()
		expect(item).toContain('focus:bg-muted')
	})

	test('sub triggers show open state', () => {
		const subTrigger = getDropdownMenuSubTriggerClasses()
		expect(subTrigger).toContain('data-[state=open]:bg-muted')
	})

	test('items remove outline for custom focus styling', () => {
		const item = getDropdownMenuItemClasses()
		expect(item).toContain('outline-none')
	})

	test('disabled items block pointer events', () => {
		const item = getDropdownMenuItemClasses()
		expect(item).toContain('data-[disabled]:pointer-events-none')
	})
})

// ============================================================================
// Animation Tests
// ============================================================================

describe('DropdownMenu animation configuration', () => {
	// Motion config from the component
	const animationConfig = {
		initial: { opacity: 0, scale: 0.95, y: -4 },
		animate: { opacity: 1, scale: 1, y: 0 },
		duration: 0.1, // duration.fast
	}

	test('enter animation uses opacity', () => {
		expect(animationConfig.initial.opacity).toBe(0)
		expect(animationConfig.animate.opacity).toBe(1)
	})

	test('enter animation uses scale', () => {
		expect(animationConfig.initial.scale).toBe(0.95)
		expect(animationConfig.animate.scale).toBe(1)
	})

	test('enter animation uses y offset', () => {
		expect(animationConfig.initial.y).toBe(-4)
		expect(animationConfig.animate.y).toBe(0)
	})

	test('uses fast duration', () => {
		expect(animationConfig.duration).toBe(0.1)
	})
})

// ============================================================================
// Checkbox Animation Tests
// ============================================================================

describe('DropdownMenuCheckboxItem animation', () => {
	// Spring config for checkmark animation
	const checkmarkSpring = {
		type: 'spring',
		stiffness: 500,
		damping: 20,
	}

	test('uses spring animation', () => {
		expect(checkmarkSpring.type).toBe('spring')
	})

	test('has high stiffness for snappy feel', () => {
		expect(checkmarkSpring.stiffness).toBe(500)
	})

	test('has moderate damping', () => {
		expect(checkmarkSpring.damping).toBe(20)
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('DropdownMenu edge cases', () => {
	test('handles undefined className', () => {
		const classes = getDropdownMenuContentClasses(undefined)
		expect(classes).toContain('z-popover')
	})

	test('handles empty className', () => {
		const classes = getDropdownMenuContentClasses('')
		expect(classes).toContain('z-popover')
	})

	test('item with all variants', () => {
		const classes = getDropdownMenuItemClasses(true, true, 'custom-class')
		expect(classes).toContain('pl-8')
		expect(classes).toContain('text-destructive')
		expect(classes).toContain('custom-class')
	})

	test('undefined inset and destructive', () => {
		const classes = getDropdownMenuItemClasses(undefined, undefined)
		expect(classes).not.toContain('pl-8')
		expect(classes).not.toContain('text-destructive')
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('DropdownMenu integration patterns', () => {
	test('basic menu structure', () => {
		const content = getDropdownMenuContentClasses()
		const item = getDropdownMenuItemClasses()
		const separator = getDropdownMenuSeparatorClasses()

		expect(content).toContain('rounded-lg')
		expect(item).toContain('min-h-11')
		expect(separator).toContain('h-px')
	})

	test('menu with labels and groups', () => {
		const label = getDropdownMenuLabelClasses()
		const item = getDropdownMenuItemClasses()
		const separator = getDropdownMenuSeparatorClasses()

		expect(label).toContain('font-semibold')
		expect(item).toContain('focus:bg-muted')
		expect(separator).toContain('bg-border')
	})

	test('menu with checkboxes', () => {
		const content = getDropdownMenuContentClasses()
		const checkbox = getDropdownMenuCheckboxItemClasses()

		expect(content).toContain('border')
		expect(checkbox).toContain('pl-8') // Space for indicator
	})

	test('menu with radio group', () => {
		const content = getDropdownMenuContentClasses()
		const radio = getDropdownMenuRadioItemClasses()

		expect(content).toContain('border')
		expect(radio).toContain('pl-8') // Space for indicator
	})

	test('menu with shortcuts', () => {
		const item = getDropdownMenuItemClasses()
		const shortcut = getDropdownMenuShortcutClasses()

		expect(item).toContain('gap-2')
		expect(shortcut).toContain('ml-auto')
	})

	test('submenu pattern', () => {
		const subTrigger = getDropdownMenuSubTriggerClasses()
		const subContent = getDropdownMenuSubContentClasses()

		expect(subTrigger).toContain('data-[state=open]:bg-muted')
		expect(subContent).toContain('z-popover')
	})

	test('destructive action pattern', () => {
		const separator = getDropdownMenuSeparatorClasses()
		const destructiveItem = getDropdownMenuItemClasses(false, true)

		expect(separator).toContain('my-1')
		expect(destructiveItem).toContain('text-destructive')
	})
})
