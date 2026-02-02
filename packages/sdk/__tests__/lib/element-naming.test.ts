/**
 * Element Naming Utilities Tests
 *
 * Tests for pure utility functions from element-naming.ts.
 * DOM-dependent functions are tested in E2E tests.
 */

import { describe, expect, test } from 'bun:test'

// ============================================================================
// Pure Functions (Extracted for Testing)
// ============================================================================

// Replicated from element-naming.ts to avoid DOM dependency issues
function humanizeId(id: string): string {
	return id
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function humanizeName(name: string): string {
	return name
		.replace(/\[\]/g, '')
		.replace(/\[(\d+)\]/g, ' $1')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

function isMeaningfulId(id: string): boolean {
	if (/^[a-f0-9]{8,}$/i.test(id)) return false
	if (/^:r[0-9]+:$/i.test(id)) return false
	if (/^[a-z]+-[0-9]+$/i.test(id)) return false
	if (/^radix-/.test(id)) return false
	if (/^headlessui-/.test(id)) return false
	if (id.length > 50) return false
	return true
}

function sanitizeText(text: string): string {
	return text
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 100)
		.replace(/[<>]/g, '')
}

function getActionVerb(eventType: string, tagName: string, inputType?: string): string {
	const actionMap: Record<string, string> = {
		click: 'clicked',
		submit: 'submitted',
		change: 'changed',
		focus: 'focused',
		blur: 'left',
		input: 'updated',
	}

	if (eventType === 'change') {
		if (tagName === 'input' && (inputType === 'checkbox' || inputType === 'radio')) {
			return 'toggled'
		}
		if (tagName === 'select') {
			return 'selected'
		}
	}

	return actionMap[eventType] || eventType
}

// ============================================================================
// humanizeId Tests
// ============================================================================

describe('humanizeId', () => {
	describe('camelCase conversion', () => {
		test('converts camelCase to spaces', () => {
			expect(humanizeId('userProfile')).toBe('user Profile')
		})

		test('converts PascalCase to spaces', () => {
			expect(humanizeId('UserProfile')).toBe('User Profile')
		})

		test('handles multiple camelCase words', () => {
			expect(humanizeId('userProfileSettings')).toBe('user Profile Settings')
		})
	})

	describe('snake_case conversion', () => {
		test('converts snake_case to spaces', () => {
			expect(humanizeId('user_profile')).toBe('user profile')
		})

		test('handles multiple underscores', () => {
			expect(humanizeId('user_profile_settings')).toBe('user profile settings')
		})
	})

	describe('kebab-case conversion', () => {
		test('converts kebab-case to spaces', () => {
			expect(humanizeId('user-profile')).toBe('user profile')
		})

		test('handles multiple dashes', () => {
			expect(humanizeId('user-profile-settings')).toBe('user profile settings')
		})
	})

	describe('mixed formats', () => {
		test('handles mixed camelCase and snake_case', () => {
			expect(humanizeId('user_profileSettings')).toBe('user profile Settings')
		})

		test('handles mixed kebab-case and camelCase', () => {
			expect(humanizeId('user-profileSettings')).toBe('user profile Settings')
		})
	})

	describe('edge cases', () => {
		test('trims whitespace', () => {
			expect(humanizeId('  user_profile  ')).toBe('user profile')
		})

		test('handles single word', () => {
			expect(humanizeId('profile')).toBe('profile')
		})

		test('handles empty string', () => {
			expect(humanizeId('')).toBe('')
		})

		test('handles multiple consecutive separators', () => {
			expect(humanizeId('user__profile')).toBe('user profile')
		})
	})
})

// ============================================================================
// humanizeName Tests
// ============================================================================

describe('humanizeName', () => {
	describe('basic conversion', () => {
		test('converts underscores to spaces', () => {
			expect(humanizeName('first_name')).toBe('first name')
		})

		test('converts dashes to spaces', () => {
			expect(humanizeName('first-name')).toBe('first name')
		})

		test('converts camelCase', () => {
			expect(humanizeName('firstName')).toBe('first Name')
		})
	})

	describe('array notation', () => {
		test('removes empty array brackets', () => {
			expect(humanizeName('items[]')).toBe('items')
		})

		test('converts indexed arrays', () => {
			expect(humanizeName('items[0]')).toBe('items 0')
		})

		test('handles numeric index only (non-numeric preserved)', () => {
			// Only numeric indices are converted, non-numeric brackets stay as-is
			expect(humanizeName('items[0][1]')).toBe('items 0 1')
		})

		test('handles multiple numeric arrays', () => {
			expect(humanizeName('rows[0][1]')).toBe('rows 0 1')
		})
	})

	describe('form field patterns', () => {
		test('preserves non-numeric brackets', () => {
			// Non-numeric brackets are preserved by the function
			expect(humanizeName('user[email]')).toBe('user[email]')
		})

		test('handles mixed numeric and named brackets', () => {
			// Numeric brackets converted, named ones preserved
			expect(humanizeName('items[0][name]')).toBe('items 0[name]')
		})
	})

	describe('edge cases', () => {
		test('handles empty string', () => {
			expect(humanizeName('')).toBe('')
		})

		test('trims whitespace', () => {
			expect(humanizeName('  name  ')).toBe('name')
		})
	})
})

// ============================================================================
// isMeaningfulId Tests
// ============================================================================

describe('isMeaningfulId', () => {
	describe('valid IDs', () => {
		test('accepts simple IDs', () => {
			expect(isMeaningfulId('submit-btn')).toBe(true)
		})

		test('accepts descriptive IDs', () => {
			expect(isMeaningfulId('user-profile')).toBe(true)
		})

		test('accepts camelCase IDs', () => {
			expect(isMeaningfulId('userProfile')).toBe(true)
		})

		test('accepts short IDs', () => {
			expect(isMeaningfulId('nav')).toBe(true)
		})
	})

	describe('auto-generated IDs', () => {
		test('rejects UUID-like IDs', () => {
			expect(isMeaningfulId('a1b2c3d4e5f6')).toBe(false)
		})

		test('rejects long hex strings', () => {
			expect(isMeaningfulId('abc12345def67890')).toBe(false)
		})

		test('rejects React auto-generated IDs', () => {
			expect(isMeaningfulId(':r1:')).toBe(false)
			expect(isMeaningfulId(':r42:')).toBe(false)
		})

		test('rejects component-number pattern', () => {
			expect(isMeaningfulId('dialog-123')).toBe(false)
			expect(isMeaningfulId('menu-0')).toBe(false)
		})

		test('rejects Radix UI auto IDs', () => {
			expect(isMeaningfulId('radix-123')).toBe(false)
			expect(isMeaningfulId('radix-dialog-content')).toBe(false)
		})

		test('rejects Headless UI auto IDs', () => {
			expect(isMeaningfulId('headlessui-menu')).toBe(false)
			expect(isMeaningfulId('headlessui-dialog-panel')).toBe(false)
		})

		test('rejects very long IDs', () => {
			expect(isMeaningfulId('a'.repeat(51))).toBe(false)
		})
	})

	describe('boundary cases', () => {
		test('accepts 50-char non-hex ID', () => {
			// 50 chars but contains non-hex chars, so not rejected as UUID-like
			expect(isMeaningfulId('x'.repeat(50))).toBe(true)
		})

		test('rejects 50-char hex string as UUID-like', () => {
			// All hex chars matches the UUID pattern
			expect(isMeaningfulId('a'.repeat(50))).toBe(false)
		})

		test('accepts 7-char hex (not 8+)', () => {
			expect(isMeaningfulId('abc1234')).toBe(true)
		})

		test('accepts meaningful ID with numbers', () => {
			expect(isMeaningfulId('step-2-details')).toBe(true)
		})
	})
})

// ============================================================================
// sanitizeText Tests
// ============================================================================

describe('sanitizeText', () => {
	describe('whitespace handling', () => {
		test('trims leading/trailing whitespace', () => {
			expect(sanitizeText('  hello  ')).toBe('hello')
		})

		test('collapses multiple spaces', () => {
			expect(sanitizeText('hello    world')).toBe('hello world')
		})

		test('handles newlines', () => {
			expect(sanitizeText('hello\nworld')).toBe('hello world')
		})

		test('handles tabs', () => {
			expect(sanitizeText('hello\tworld')).toBe('hello world')
		})

		test('handles mixed whitespace', () => {
			expect(sanitizeText('  hello  \n  world  ')).toBe('hello world')
		})
	})

	describe('length limiting', () => {
		test('truncates long text', () => {
			const longText = 'a'.repeat(150)
			expect(sanitizeText(longText).length).toBe(100)
		})

		test('preserves short text', () => {
			expect(sanitizeText('hello world')).toBe('hello world')
		})

		test('handles exactly 100 chars', () => {
			const text = 'a'.repeat(100)
			expect(sanitizeText(text).length).toBe(100)
		})
	})

	describe('HTML removal', () => {
		test('removes angle brackets', () => {
			expect(sanitizeText('hello <script>alert</script>')).toBe('hello scriptalert/script')
		})

		test('removes multiple tags', () => {
			expect(sanitizeText('<div>hello</div>')).toBe('divhello/div')
		})
	})

	describe('edge cases', () => {
		test('handles empty string', () => {
			expect(sanitizeText('')).toBe('')
		})

		test('handles only whitespace', () => {
			expect(sanitizeText('   ')).toBe('')
		})
	})
})

// ============================================================================
// getActionVerb Tests
// ============================================================================

describe('getActionVerb', () => {
	describe('basic events', () => {
		test('returns clicked for click', () => {
			expect(getActionVerb('click', 'button')).toBe('clicked')
		})

		test('returns submitted for submit', () => {
			expect(getActionVerb('submit', 'form')).toBe('submitted')
		})

		test('returns focused for focus', () => {
			expect(getActionVerb('focus', 'input')).toBe('focused')
		})

		test('returns left for blur', () => {
			expect(getActionVerb('blur', 'input')).toBe('left')
		})

		test('returns updated for input', () => {
			expect(getActionVerb('input', 'textarea')).toBe('updated')
		})
	})

	describe('change events', () => {
		test('returns changed for generic change', () => {
			expect(getActionVerb('change', 'input', 'text')).toBe('changed')
		})

		test('returns toggled for checkbox change', () => {
			expect(getActionVerb('change', 'input', 'checkbox')).toBe('toggled')
		})

		test('returns toggled for radio change', () => {
			expect(getActionVerb('change', 'input', 'radio')).toBe('toggled')
		})

		test('returns selected for select change', () => {
			expect(getActionVerb('change', 'select')).toBe('selected')
		})
	})

	describe('unknown events', () => {
		test('returns event type for unknown events', () => {
			expect(getActionVerb('mouseenter', 'div')).toBe('mouseenter')
		})

		test('returns custom event type', () => {
			expect(getActionVerb('custom_event', 'div')).toBe('custom_event')
		})
	})
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('element naming integration', () => {
	test('ID sanitization for analytics', () => {
		// Simulate generating analytics event name from ID
		const id = 'signUp_btn'
		const isValid = isMeaningfulId(id)
		expect(isValid).toBe(true)

		const humanized = humanizeId(id)
		expect(humanized).toBe('sign Up btn')
	})

	test('form field name processing', () => {
		const fieldNames = [
			'items[]',
			'items[0]',
			'address_line_1',
			'phoneNumber',
		]

		const humanized = fieldNames.map(humanizeName)
		expect(humanized).toEqual([
			'items',
			'items 0',
			'address line 1',
			'phone Number',
		])
	})

	test('button text sanitization', () => {
		const texts = [
			'  Sign Up  ',
			'Submit\nForm',
			'Click <here> to continue',
		]

		const sanitized = texts.map(sanitizeText)
		expect(sanitized).toEqual([
			'Sign Up',
			'Submit Form',
			'Click here to continue',
		])
	})
})
