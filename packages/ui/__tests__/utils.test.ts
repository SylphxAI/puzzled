/**
 * Utils Tests
 *
 * Tests for the cn() class merging utility.
 */

import { describe, expect, test } from 'bun:test'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ============================================================================
// cn() Implementation (from utils.ts)
// ============================================================================

function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

// ============================================================================
// Basic Class Merging Tests
// ============================================================================

describe('cn() basic merging', () => {
	test('merges simple class names', () => {
		const result = cn('foo', 'bar')
		expect(result).toBe('foo bar')
	})

	test('handles single class name', () => {
		const result = cn('foo')
		expect(result).toBe('foo')
	})

	test('handles empty inputs', () => {
		const result = cn()
		expect(result).toBe('')
	})

	test('filters out falsy values', () => {
		const result = cn('foo', null, undefined, false, '', 'bar')
		expect(result).toBe('foo bar')
	})

	test('handles conditional classes', () => {
		const isActive = true
		const isDisabled = false
		const result = cn('base', isActive && 'active', isDisabled && 'disabled')
		expect(result).toBe('base active')
	})
})

// ============================================================================
// Array and Object Input Tests
// ============================================================================

describe('cn() array and object inputs', () => {
	test('handles array of classes', () => {
		const result = cn(['foo', 'bar'])
		expect(result).toBe('foo bar')
	})

	test('handles object syntax', () => {
		const result = cn({ foo: true, bar: false, baz: true })
		expect(result).toBe('foo baz')
	})

	test('handles mixed inputs', () => {
		const result = cn('foo', ['bar', 'baz'], { qux: true, quux: false })
		expect(result).toBe('foo bar baz qux')
	})

	test('handles nested arrays', () => {
		const result = cn('foo', ['bar', ['baz', 'qux']])
		expect(result).toBe('foo bar baz qux')
	})
})

// ============================================================================
// Tailwind Class Conflict Resolution
// ============================================================================

describe('cn() Tailwind conflict resolution', () => {
	test('resolves padding conflicts - last wins', () => {
		const result = cn('p-4', 'p-8')
		expect(result).toBe('p-8')
	})

	test('resolves margin conflicts', () => {
		const result = cn('m-2', 'm-4')
		expect(result).toBe('m-4')
	})

	test('resolves text color conflicts', () => {
		const result = cn('text-red-500', 'text-blue-500')
		expect(result).toBe('text-blue-500')
	})

	test('resolves background color conflicts', () => {
		const result = cn('bg-white', 'bg-black')
		expect(result).toBe('bg-black')
	})

	test('resolves width conflicts', () => {
		const result = cn('w-full', 'w-1/2')
		expect(result).toBe('w-1/2')
	})

	test('resolves height conflicts', () => {
		const result = cn('h-10', 'h-12')
		expect(result).toBe('h-12')
	})

	test('resolves font size conflicts', () => {
		const result = cn('text-sm', 'text-lg')
		expect(result).toBe('text-lg')
	})

	test('resolves display conflicts', () => {
		const result = cn('block', 'flex')
		expect(result).toBe('flex')
	})

	test('resolves flex direction conflicts', () => {
		const result = cn('flex-row', 'flex-col')
		expect(result).toBe('flex-col')
	})

	test('resolves rounded conflicts', () => {
		const result = cn('rounded', 'rounded-lg')
		expect(result).toBe('rounded-lg')
	})
})

// ============================================================================
// Direction-Specific Class Tests
// ============================================================================

describe('cn() direction-specific classes', () => {
	test('keeps non-conflicting directional padding', () => {
		const result = cn('px-4', 'py-2')
		expect(result).toBe('px-4 py-2')
	})

	test('resolves horizontal padding conflicts', () => {
		const result = cn('px-4', 'px-6')
		expect(result).toBe('px-6')
	})

	test('resolves vertical margin conflicts', () => {
		const result = cn('my-2', 'my-4')
		expect(result).toBe('my-4')
	})

	test('keeps non-conflicting margin directions', () => {
		const result = cn('mt-2', 'mb-4', 'mx-auto')
		expect(result).toBe('mt-2 mb-4 mx-auto')
	})

	test('p-* overrides px-* and py-*', () => {
		const result = cn('px-4', 'py-2', 'p-6')
		expect(result).toBe('p-6')
	})
})

// ============================================================================
// State Variant Tests
// ============================================================================

describe('cn() state variants', () => {
	test('keeps hover variants separate from base', () => {
		const result = cn('bg-blue-500', 'hover:bg-blue-600')
		expect(result).toBe('bg-blue-500 hover:bg-blue-600')
	})

	test('resolves conflicting hover states', () => {
		const result = cn('hover:bg-red-500', 'hover:bg-blue-500')
		expect(result).toBe('hover:bg-blue-500')
	})

	test('keeps multiple state variants', () => {
		const result = cn('hover:bg-blue-600', 'focus:ring-2', 'active:scale-95')
		expect(result).toBe('hover:bg-blue-600 focus:ring-2 active:scale-95')
	})

	test('handles disabled state', () => {
		const result = cn('opacity-100', 'disabled:opacity-50')
		expect(result).toBe('opacity-100 disabled:opacity-50')
	})
})

// ============================================================================
// Responsive Variant Tests
// ============================================================================

describe('cn() responsive variants', () => {
	test('keeps responsive breakpoints separate', () => {
		const result = cn('text-sm', 'md:text-base', 'lg:text-lg')
		expect(result).toBe('text-sm md:text-base lg:text-lg')
	})

	test('resolves conflicts within same breakpoint', () => {
		const result = cn('md:text-sm', 'md:text-lg')
		expect(result).toBe('md:text-lg')
	})

	test('keeps different properties at same breakpoint', () => {
		const result = cn('md:text-lg', 'md:font-bold')
		expect(result).toBe('md:text-lg md:font-bold')
	})
})

// ============================================================================
// Real-World Component Pattern Tests
// ============================================================================

describe('cn() real-world patterns', () => {
	test('button base + variant override', () => {
		const base = 'inline-flex items-center justify-center rounded-lg'
		const variant = 'bg-primary text-primary-foreground'
		const size = 'h-11 px-5'
		const custom = 'w-full'

		const result = cn(base, variant, size, custom)
		expect(result).toContain('inline-flex')
		expect(result).toContain('bg-primary')
		expect(result).toContain('h-11')
		expect(result).toContain('w-full')
	})

	test('component with conditional disabled state', () => {
		const isDisabled = true
		const result = cn(
			'bg-primary text-white',
			isDisabled && 'opacity-50 pointer-events-none',
		)
		expect(result).toBe('bg-primary text-white opacity-50 pointer-events-none')
	})

	test('merge className prop with defaults', () => {
		const defaults = 'text-sm font-medium'
		const className = 'text-lg'

		const result = cn(defaults, className)
		expect(result).toBe('font-medium text-lg')
	})

	test('complex component with multiple conditions', () => {
		const isActive = true
		const isLoading = false
		const variant = 'primary'

		const result = cn(
			'base-class',
			variant === 'primary' && 'bg-blue-500',
			variant === 'secondary' && 'bg-gray-500',
			isActive && 'ring-2 ring-blue-300',
			isLoading && 'animate-pulse',
		)

		expect(result).toBe('base-class bg-blue-500 ring-2 ring-blue-300')
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('cn() edge cases', () => {
	test('handles only falsy values', () => {
		const result = cn(null, undefined, false, '')
		expect(result).toBe('')
	})

	test('handles whitespace in class names', () => {
		// clsx trims whitespace
		const result = cn('  foo  ', '  bar  ')
		expect(result).toBe('foo bar')
	})

	test('handles duplicate class names (clsx passes through)', () => {
		// clsx does not deduplicate - this is expected behavior
		const result = cn('foo', 'foo', 'foo')
		expect(result).toBe('foo foo foo')
	})

	test('preserves arbitrary values', () => {
		const result = cn('w-[100px]', 'h-[50px]')
		expect(result).toBe('w-[100px] h-[50px]')
	})

	test('resolves arbitrary value conflicts', () => {
		const result = cn('w-[100px]', 'w-[200px]')
		expect(result).toBe('w-[200px]')
	})

	test('handles important modifier (keeps both)', () => {
		// Important modifier doesn't override non-important in twMerge
		const result = cn('text-red-500', '!text-blue-500')
		expect(result).toContain('!text-blue-500')
	})
})

// ============================================================================
// Special Tailwind Classes
// ============================================================================

describe('cn() special Tailwind classes', () => {
	test('handles sr-only', () => {
		const result = cn('text-lg', 'sr-only')
		expect(result).toBe('text-lg sr-only')
	})

	test('handles aspect ratio', () => {
		const result = cn('aspect-video', 'aspect-square')
		expect(result).toBe('aspect-square')
	})

	test('handles container class', () => {
		const result = cn('container', 'mx-auto')
		expect(result).toBe('container mx-auto')
	})

	test('handles transition classes', () => {
		const result = cn('transition', 'transition-colors')
		expect(result).toBe('transition-colors')
	})

	test('handles animation classes', () => {
		const result = cn('animate-spin', 'animate-pulse')
		expect(result).toBe('animate-pulse')
	})
})
