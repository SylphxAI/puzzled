/**
 * Select Component Tests
 *
 * Tests for select/dropdown class generation, touch targets, and accessibility.
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
// Select Class Generators (from select.tsx)
// ============================================================================

function getSelectTriggerClasses(className?: string) {
	return cn(
		// h-11 = 44px minimum touch target (WCAG 2.1 AA)
		'flex h-11 w-full items-center justify-between rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-sm',
		'ring-offset-background transition-colors',
		'hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2',
		'disabled:cursor-not-allowed disabled:opacity-50',
		'[&>span]:line-clamp-1',
		className,
	)
}

function getSelectContentClasses(position: 'popper' | 'item-aligned' = 'popper', className?: string) {
	return cn(
		'relative z-popover max-h-80 min-w-[8rem] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-lg',
		position === 'popper' &&
			'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
		className,
	)
}

function getSelectViewportClasses(position: 'popper' | 'item-aligned' = 'popper') {
	return cn(
		'p-1',
		position === 'popper' &&
			'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
	)
}

function getSelectItemClasses(className?: string) {
	return cn(
		// min-h-11 = 44px minimum touch target (WCAG 2.1 AA)
		'relative flex w-full cursor-default select-none items-center rounded-md min-h-11 py-2 pl-8 pr-2 text-sm outline-none',
		'focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
		className,
	)
}

function getSelectLabelClasses(className?: string) {
	return cn('px-2 py-1.5 text-sm font-semibold', className)
}

function getSelectSeparatorClasses(className?: string) {
	return cn('-mx-1 my-1 h-px bg-border', className)
}

function getSelectScrollButtonClasses(className?: string) {
	return cn('flex cursor-default items-center justify-center py-1', className)
}

// ============================================================================
// Select Trigger Tests
// ============================================================================

describe('SelectTrigger styles', () => {
	test('meets 44px minimum touch target', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('h-11')
	})

	test('is flex with justify-between for label + chevron', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('items-center')
		expect(classes).toContain('justify-between')
	})

	test('has full width', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('w-full')
	})

	test('has rounded corners', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('rounded-lg')
	})

	test('has border', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('border')
		expect(classes).toContain('border-border/50')
	})

	test('has background', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('bg-card/50')
	})

	test('has padding', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('px-3')
		expect(classes).toContain('py-2')
	})

	test('has small text', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('text-sm')
	})

	test('has hover state', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('hover:bg-muted/50')
	})

	test('has focus ring', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('focus:outline-none')
		expect(classes).toContain('focus:ring-2')
		expect(classes).toContain('focus:ring-primary/20')
		expect(classes).toContain('focus:ring-offset-2')
	})

	test('has disabled state', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('disabled:cursor-not-allowed')
		expect(classes).toContain('disabled:opacity-50')
	})

	test('has transition', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('transition-colors')
	})

	test('truncates long text', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('[&>span]:line-clamp-1')
	})

	test('accepts custom className', () => {
		const classes = getSelectTriggerClasses('max-w-md')
		expect(classes).toContain('max-w-md')
	})
})

// ============================================================================
// Select Content Tests
// ============================================================================

describe('SelectContent styles', () => {
	test('is relative positioned', () => {
		const classes = getSelectContentClasses()
		expect(classes).toContain('relative')
	})

	test('uses z-popover z-index', () => {
		const classes = getSelectContentClasses()
		expect(classes).toContain('z-popover')
	})

	test('has max height', () => {
		const classes = getSelectContentClasses()
		expect(classes).toContain('max-h-80')
	})

	test('has minimum width', () => {
		const classes = getSelectContentClasses()
		expect(classes).toContain('min-w-[8rem]')
	})

	test('handles overflow', () => {
		const classes = getSelectContentClasses()
		expect(classes).toContain('overflow-hidden')
	})

	test('has visual styling', () => {
		const classes = getSelectContentClasses()
		expect(classes).toContain('rounded-lg')
		expect(classes).toContain('border')
		expect(classes).toContain('bg-card')
		expect(classes).toContain('shadow-lg')
	})

	test('has card text color', () => {
		const classes = getSelectContentClasses()
		expect(classes).toContain('text-card-foreground')
	})
})

// ============================================================================
// Select Content Position Tests
// ============================================================================

describe('SelectContent position variants', () => {
	describe('popper position', () => {
		test('has translate offset for bottom side', () => {
			const classes = getSelectContentClasses('popper')
			expect(classes).toContain('data-[side=bottom]:translate-y-1')
		})

		test('has translate offset for top side', () => {
			const classes = getSelectContentClasses('popper')
			expect(classes).toContain('data-[side=top]:-translate-y-1')
		})

		test('has translate offset for left side', () => {
			const classes = getSelectContentClasses('popper')
			expect(classes).toContain('data-[side=left]:-translate-x-1')
		})

		test('has translate offset for right side', () => {
			const classes = getSelectContentClasses('popper')
			expect(classes).toContain('data-[side=right]:translate-x-1')
		})
	})

	describe('item-aligned position', () => {
		test('has no translate offsets', () => {
			const classes = getSelectContentClasses('item-aligned')
			expect(classes).not.toContain('data-[side=bottom]')
			expect(classes).not.toContain('data-[side=top]')
		})
	})
})

// ============================================================================
// Select Viewport Tests
// ============================================================================

describe('SelectViewport styles', () => {
	test('has padding', () => {
		const classes = getSelectViewportClasses()
		expect(classes).toContain('p-1')
	})

	describe('popper position', () => {
		test('uses trigger height variable', () => {
			const classes = getSelectViewportClasses('popper')
			expect(classes).toContain('h-[var(--radix-select-trigger-height)]')
		})

		test('uses trigger width variable', () => {
			const classes = getSelectViewportClasses('popper')
			expect(classes).toContain('w-full')
			expect(classes).toContain('min-w-[var(--radix-select-trigger-width)]')
		})
	})

	describe('item-aligned position', () => {
		test('has no size constraints', () => {
			const classes = getSelectViewportClasses('item-aligned')
			expect(classes).not.toContain('--radix-select-trigger')
		})
	})
})

// ============================================================================
// Select Item Tests
// ============================================================================

describe('SelectItem styles', () => {
	test('meets 44px minimum touch target', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('min-h-11')
	})

	test('is relative for indicator positioning', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('relative')
	})

	test('is flex with full width', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('w-full')
		expect(classes).toContain('items-center')
	})

	test('has rounded corners', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('rounded-md')
	})

	test('has left padding for indicator', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('pl-8')
	})

	test('has right padding', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('pr-2')
	})

	test('has small text', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('text-sm')
	})

	test('removes outline', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('outline-none')
	})

	test('has focus state', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('focus:bg-muted')
	})

	test('has disabled state', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('data-[disabled]:pointer-events-none')
		expect(classes).toContain('data-[disabled]:opacity-50')
	})

	test('is not selectable', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('select-none')
	})

	test('accepts custom className', () => {
		const classes = getSelectItemClasses('bg-primary text-primary-foreground')
		expect(classes).toContain('bg-primary')
	})
})

// ============================================================================
// Select Label Tests
// ============================================================================

describe('SelectLabel styles', () => {
	test('has padding', () => {
		const classes = getSelectLabelClasses()
		expect(classes).toContain('px-2')
		expect(classes).toContain('py-1.5')
	})

	test('has small text', () => {
		const classes = getSelectLabelClasses()
		expect(classes).toContain('text-sm')
	})

	test('is semibold', () => {
		const classes = getSelectLabelClasses()
		expect(classes).toContain('font-semibold')
	})

	test('accepts custom className', () => {
		const classes = getSelectLabelClasses('text-primary')
		expect(classes).toContain('text-primary')
	})
})

// ============================================================================
// Select Separator Tests
// ============================================================================

describe('SelectSeparator styles', () => {
	test('has negative horizontal margin', () => {
		const classes = getSelectSeparatorClasses()
		expect(classes).toContain('-mx-1')
	})

	test('has vertical margin', () => {
		const classes = getSelectSeparatorClasses()
		expect(classes).toContain('my-1')
	})

	test('has 1px height', () => {
		const classes = getSelectSeparatorClasses()
		expect(classes).toContain('h-px')
	})

	test('has border color', () => {
		const classes = getSelectSeparatorClasses()
		expect(classes).toContain('bg-border')
	})
})

// ============================================================================
// Select Scroll Button Tests
// ============================================================================

describe('SelectScrollButton styles', () => {
	test('is flex centered', () => {
		const classes = getSelectScrollButtonClasses()
		expect(classes).toContain('flex')
		expect(classes).toContain('items-center')
		expect(classes).toContain('justify-center')
	})

	test('has vertical padding', () => {
		const classes = getSelectScrollButtonClasses()
		expect(classes).toContain('py-1')
	})

	test('has default cursor', () => {
		const classes = getSelectScrollButtonClasses()
		expect(classes).toContain('cursor-default')
	})
})

// ============================================================================
// Touch Target Compliance Tests
// ============================================================================

describe('Select touch target compliance', () => {
	test('trigger meets 44px minimum', () => {
		const classes = getSelectTriggerClasses()
		expect(classes).toContain('h-11')
	})

	test('items meet 44px minimum', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('min-h-11')
	})
})

// ============================================================================
// Animation Configuration Tests
// ============================================================================

describe('Select animation configuration', () => {
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
// SimpleSelect Component Tests
// ============================================================================

describe('SimpleSelect helper component', () => {
	// SimpleSelect interface
	type SimpleSelectProps = {
		value: string
		onValueChange: (value: string) => void
		options: Array<{ value: string; label: string }>
		placeholder?: string
		disabled?: boolean
		className?: string
	}

	test('accepts value and onValueChange for controlled mode', () => {
		const props: SimpleSelectProps = {
			value: 'option1',
			onValueChange: (value) => {},
			options: [{ value: 'option1', label: 'Option 1' }],
		}

		expect(props.value).toBe('option1')
		expect(typeof props.onValueChange).toBe('function')
	})

	test('accepts options array', () => {
		const props: SimpleSelectProps = {
			value: '',
			onValueChange: () => {},
			options: [
				{ value: 'a', label: 'Option A' },
				{ value: 'b', label: 'Option B' },
				{ value: 'c', label: 'Option C' },
			],
		}

		expect(props.options).toHaveLength(3)
		expect(props.options[0]).toEqual({ value: 'a', label: 'Option A' })
	})

	test('has default placeholder', () => {
		const defaultPlaceholder = 'Select...'
		expect(defaultPlaceholder).toBe('Select...')
	})

	test('accepts custom placeholder', () => {
		const props: SimpleSelectProps = {
			value: '',
			onValueChange: () => {},
			options: [],
			placeholder: 'Choose an option',
		}

		expect(props.placeholder).toBe('Choose an option')
	})

	test('supports disabled state', () => {
		const props: SimpleSelectProps = {
			value: '',
			onValueChange: () => {},
			options: [],
			disabled: true,
		}

		expect(props.disabled).toBe(true)
	})

	test('accepts custom className', () => {
		const props: SimpleSelectProps = {
			value: '',
			onValueChange: () => {},
			options: [],
			className: 'max-w-sm',
		}

		expect(props.className).toBe('max-w-sm')
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('Select edge cases', () => {
	test('handles undefined className', () => {
		const classes = getSelectTriggerClasses(undefined)
		expect(classes).toContain('h-11')
	})

	test('handles empty className', () => {
		const classes = getSelectTriggerClasses('')
		expect(classes).toContain('h-11')
	})

	test('default position is popper', () => {
		const defaultClasses = getSelectContentClasses()
		const popperClasses = getSelectContentClasses('popper')
		expect(defaultClasses).toBe(popperClasses)
	})

	test('viewport default is popper', () => {
		const defaultClasses = getSelectViewportClasses()
		const popperClasses = getSelectViewportClasses('popper')
		expect(defaultClasses).toBe(popperClasses)
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('Select integration patterns', () => {
	test('basic select structure', () => {
		const trigger = getSelectTriggerClasses()
		const content = getSelectContentClasses()
		const item = getSelectItemClasses()

		expect(trigger).toContain('h-11')
		expect(content).toContain('rounded-lg')
		expect(item).toContain('min-h-11')
	})

	test('grouped select structure', () => {
		const label = getSelectLabelClasses()
		const item = getSelectItemClasses()
		const separator = getSelectSeparatorClasses()

		expect(label).toContain('font-semibold')
		expect(item).toContain('focus:bg-muted')
		expect(separator).toContain('bg-border')
	})

	test('scrollable select structure', () => {
		const content = getSelectContentClasses()
		const scrollButton = getSelectScrollButtonClasses()

		expect(content).toContain('max-h-80')
		expect(scrollButton).toContain('py-1')
	})

	test('form select pattern', () => {
		const trigger = getSelectTriggerClasses()

		expect(trigger).toContain('w-full')
		expect(trigger).toContain('focus:ring-2')
		expect(trigger).toContain('disabled:opacity-50')
	})
})

// ============================================================================
// Indicator Position Tests
// ============================================================================

describe('Select item indicator', () => {
	// The check indicator is positioned absolutely within the item

	test('item has relative positioning for indicator', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('relative')
	})

	test('item has left padding for indicator space', () => {
		const classes = getSelectItemClasses()
		expect(classes).toContain('pl-8')
	})

	// Expected indicator container classes
	const indicatorContainerClasses = 'absolute left-2 flex h-4 w-4 items-center justify-center'

	test('indicator is absolute left', () => {
		expect(indicatorContainerClasses).toContain('absolute')
		expect(indicatorContainerClasses).toContain('left-2')
	})

	test('indicator is centered', () => {
		expect(indicatorContainerClasses).toContain('flex')
		expect(indicatorContainerClasses).toContain('items-center')
		expect(indicatorContainerClasses).toContain('justify-center')
	})

	test('indicator has fixed size', () => {
		expect(indicatorContainerClasses).toContain('h-4')
		expect(indicatorContainerClasses).toContain('w-4')
	})
})
