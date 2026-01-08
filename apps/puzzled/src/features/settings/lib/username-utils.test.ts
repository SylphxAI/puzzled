import { describe, expect, test } from 'bun:test'
import {
	generateRecoverySuggestions,
	generateUsernameSuggestions,
	isReservedUsername,
	normalizeUsername,
	validateUsernameFormat,
} from './username-utils'

describe('validateUsernameFormat', () => {
	describe('valid usernames', () => {
		test('accepts lowercase letters only', () => {
			expect(validateUsernameFormat('john')).toBeNull()
			expect(validateUsernameFormat('username')).toBeNull()
		})

		test('accepts numbers only', () => {
			expect(validateUsernameFormat('123')).toBeNull()
			expect(validateUsernameFormat('12345')).toBeNull()
		})

		test('accepts letters and numbers', () => {
			expect(validateUsernameFormat('john123')).toBeNull()
			expect(validateUsernameFormat('user42')).toBeNull()
			expect(validateUsernameFormat('abc123xyz')).toBeNull()
		})

		test('accepts underscores', () => {
			expect(validateUsernameFormat('john_doe')).toBeNull()
			expect(validateUsernameFormat('user_name_123')).toBeNull()
			expect(validateUsernameFormat('_underscore_')).toBeNull()
		})

		test('accepts minimum length (3)', () => {
			expect(validateUsernameFormat('abc')).toBeNull()
			expect(validateUsernameFormat('123')).toBeNull()
			expect(validateUsernameFormat('a_b')).toBeNull()
		})

		test('accepts maximum length (20)', () => {
			expect(validateUsernameFormat('a'.repeat(20))).toBeNull()
			expect(validateUsernameFormat('abcdefghij1234567890')).toBeNull()
		})
	})

	describe('invalid usernames - character restrictions', () => {
		test('rejects uppercase letters', () => {
			const error = validateUsernameFormat('John')
			expect(error).toBe('Username can only contain lowercase letters, numbers, and underscores')
		})

		test('rejects spaces', () => {
			const error = validateUsernameFormat('john doe')
			expect(error).toBe('Username can only contain lowercase letters, numbers, and underscores')
		})

		test('rejects special characters', () => {
			const chars = ['@', '#', '$', '%', '!', '-', '.', '+', '=']
			for (const char of chars) {
				const error = validateUsernameFormat(`user${char}name`)
				expect(error).toBe('Username can only contain lowercase letters, numbers, and underscores')
			}
		})

		test('rejects emojis', () => {
			const error = validateUsernameFormat('user😀')
			expect(error).toBe('Username can only contain lowercase letters, numbers, and underscores')
		})

		test('rejects unicode characters', () => {
			const error = validateUsernameFormat('用户名')
			expect(error).toBe('Username can only contain lowercase letters, numbers, and underscores')
		})
	})

	describe('invalid usernames - length restrictions', () => {
		test('rejects too short (< 3)', () => {
			expect(validateUsernameFormat('ab')).toBe('Username must be at least 3 characters')
			expect(validateUsernameFormat('a')).toBe('Username must be at least 3 characters')
			// Empty string fails regex first, not length check
			expect(validateUsernameFormat('')).toBe(
				'Username can only contain lowercase letters, numbers, and underscores',
			)
		})

		test('rejects too long (> 20)', () => {
			expect(validateUsernameFormat('a'.repeat(21))).toBe('Username must be at most 20 characters')
			expect(validateUsernameFormat('abcdefghij12345678901')).toBe(
				'Username must be at most 20 characters',
			)
		})
	})
})

describe('generateUsernameSuggestions', () => {
	test('generates suggestions from name', () => {
		const suggestions = generateUsernameSuggestions('John Doe', 'test@example.com', { seed: 42 })

		expect(suggestions.length).toBeGreaterThan(0)
		expect(suggestions.length).toBeLessThanOrEqual(3)
		expect(suggestions).toContain('john')
	})

	test('generates first_last format from full name', () => {
		const suggestions = generateUsernameSuggestions('John Doe', 'test@example.com', { seed: 42 })

		expect(suggestions.some((s) => s.includes('john'))).toBe(true)
	})

	test('generates suggestions from email when name is null', () => {
		const suggestions = generateUsernameSuggestions(null, 'cooluser@example.com', { seed: 42 })

		expect(suggestions.length).toBeGreaterThan(0)
		expect(suggestions.some((s) => s.includes('cooluser'))).toBe(true)
	})

	test('extracts base from email before @', () => {
		const suggestions = generateUsernameSuggestions(null, 'john.doe123@gmail.com', { seed: 42 })

		// Should clean up to only alphanumeric
		expect(suggestions.some((s) => s.includes('johndoe123'))).toBe(true)
	})

	test('respects length constraints', () => {
		const suggestions = generateUsernameSuggestions('John Doe', 'test@example.com', { seed: 42 })

		for (const s of suggestions) {
			expect(s.length).toBeGreaterThanOrEqual(3)
			expect(s.length).toBeLessThanOrEqual(20)
		}
	})

	test('returns unique suggestions', () => {
		const suggestions = generateUsernameSuggestions('John Doe', 'john@example.com', { seed: 42 })
		const uniqueSuggestions = [...new Set(suggestions)]

		expect(suggestions.length).toBe(uniqueSuggestions.length)
	})

	test('limits to 3 suggestions', () => {
		const suggestions = generateUsernameSuggestions('John Michael Doe', 'john.doe@example.com', {
			seed: 42,
		})

		expect(suggestions.length).toBeLessThanOrEqual(3)
	})

	test('handles single-word name', () => {
		const suggestions = generateUsernameSuggestions('John', 'test@example.com', { seed: 42 })

		expect(suggestions.length).toBeGreaterThan(0)
		expect(suggestions.some((s) => s.startsWith('john'))).toBe(true)
	})

	test('skips short email base (< 3 chars)', () => {
		const suggestions = generateUsernameSuggestions('John Doe', 'ab@example.com', { seed: 42 })

		// Should still generate from name
		expect(suggestions.length).toBeGreaterThan(0)
		// Should not include 'ab' since it's too short
		expect(suggestions.some((s) => s === 'ab')).toBe(false)
	})

	test('deterministic with seed', () => {
		const suggestions1 = generateUsernameSuggestions('John Doe', 'test@example.com', { seed: 42 })
		const suggestions2 = generateUsernameSuggestions('John Doe', 'test@example.com', { seed: 42 })

		expect(suggestions1).toEqual(suggestions2)
	})
})

describe('generateRecoverySuggestions', () => {
	test('generates number suffix variations', () => {
		const suggestions = generateRecoverySuggestions('kyle', { seed: 42, year: 2025 })

		expect(suggestions.length).toBeGreaterThan(0)
		// Should have number variations
		expect(suggestions.some((s) => /kyle\d+/.test(s))).toBe(true)
	})

	test('generates underscore number variations', () => {
		const suggestions = generateRecoverySuggestions('kyle', { seed: 42, year: 2025 })

		// Should have underscore + number
		expect(suggestions.some((s) => /kyle_\d+/.test(s))).toBe(true)
	})

	test('generates year suffix', () => {
		const suggestions = generateRecoverySuggestions('kyle', { seed: 42, year: 2025 })

		expect(suggestions).toContain('kyle25')
	})

	test('generates prefix variations like "the"', () => {
		const suggestions = generateRecoverySuggestions('kyle', { seed: 42, year: 2025 })

		expect(suggestions).toContain('thekyle')
	})

	test('respects length limit (20 chars)', () => {
		// Long base username
		const suggestions = generateRecoverySuggestions('verylongusername', { seed: 42, year: 2025 })

		for (const s of suggestions) {
			expect(s.length).toBeLessThanOrEqual(20)
		}
	})

	test('returns empty for very short base (< 2 chars)', () => {
		const suggestions = generateRecoverySuggestions('a', { seed: 42, year: 2025 })

		expect(suggestions).toEqual([])
	})

	test('cleans invalid characters from input', () => {
		const suggestions = generateRecoverySuggestions('Kyle@123!', { seed: 42, year: 2025 })

		// Should use cleaned version
		for (const s of suggestions) {
			expect(s).not.toContain('@')
			expect(s).not.toContain('!')
		}
	})

	test('limits to 4 suggestions', () => {
		const suggestions = generateRecoverySuggestions('kyle', { seed: 42, year: 2025 })

		expect(suggestions.length).toBeLessThanOrEqual(4)
	})

	test('returns unique suggestions', () => {
		const suggestions = generateRecoverySuggestions('kyle', { seed: 42, year: 2025 })
		const uniqueSuggestions = [...new Set(suggestions)]

		expect(suggestions.length).toBe(uniqueSuggestions.length)
	})

	test('deterministic with seed', () => {
		const suggestions1 = generateRecoverySuggestions('kyle', { seed: 42, year: 2025 })
		const suggestions2 = generateRecoverySuggestions('kyle', { seed: 42, year: 2025 })

		expect(suggestions1).toEqual(suggestions2)
	})

	test('handles usernames with underscores', () => {
		const suggestions = generateRecoverySuggestions('kyle_doe', { seed: 42, year: 2025 })

		expect(suggestions.length).toBeGreaterThan(0)
		// Base should preserve underscore
		expect(suggestions.some((s) => s.includes('kyle_doe'))).toBe(true)
	})
})

describe('normalizeUsername', () => {
	test('converts to lowercase', () => {
		expect(normalizeUsername('JOHN')).toBe('john')
		expect(normalizeUsername('John')).toBe('john')
		expect(normalizeUsername('JoHn')).toBe('john')
	})

	test('trims whitespace', () => {
		expect(normalizeUsername('  john  ')).toBe('john')
		expect(normalizeUsername('\tjohn\n')).toBe('john')
	})

	test('handles combined cases', () => {
		expect(normalizeUsername('  JOHN  ')).toBe('john')
		expect(normalizeUsername(' John_Doe ')).toBe('john_doe')
	})
})

describe('isReservedUsername', () => {
	test('detects admin-related reserved names', () => {
		expect(isReservedUsername('admin')).toBe(true)
		expect(isReservedUsername('administrator')).toBe(true)
		expect(isReservedUsername('root')).toBe(true)
		expect(isReservedUsername('system')).toBe(true)
	})

	test('detects support-related reserved names', () => {
		expect(isReservedUsername('support')).toBe(true)
		expect(isReservedUsername('help')).toBe(true)
		expect(isReservedUsername('info')).toBe(true)
		expect(isReservedUsername('contact')).toBe(true)
	})

	test('detects system-related reserved names', () => {
		expect(isReservedUsername('api')).toBe(true)
		expect(isReservedUsername('app')).toBe(true)
		expect(isReservedUsername('www')).toBe(true)
		expect(isReservedUsername('mail')).toBe(true)
	})

	test('detects route-related reserved names', () => {
		expect(isReservedUsername('settings')).toBe(true)
		expect(isReservedUsername('account')).toBe(true)
		expect(isReservedUsername('profile')).toBe(true)
		expect(isReservedUsername('login')).toBe(true)
		expect(isReservedUsername('signup')).toBe(true)
		expect(isReservedUsername('dashboard')).toBe(true)
	})

	test('detects app-specific reserved names', () => {
		expect(isReservedUsername('puzzled')).toBe(true)
		expect(isReservedUsername('puzzle')).toBe(true)
		expect(isReservedUsername('game')).toBe(true)
		expect(isReservedUsername('play')).toBe(true)
	})

	test('is case-insensitive', () => {
		expect(isReservedUsername('ADMIN')).toBe(true)
		expect(isReservedUsername('Admin')).toBe(true)
		expect(isReservedUsername('AdMiN')).toBe(true)
	})

	test('allows non-reserved usernames', () => {
		expect(isReservedUsername('john')).toBe(false)
		expect(isReservedUsername('cooluser')).toBe(false)
		expect(isReservedUsername('player42')).toBe(false)
		expect(isReservedUsername('kyle_doe')).toBe(false)
	})
})
