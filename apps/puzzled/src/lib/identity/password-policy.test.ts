import { describe, expect, test } from 'bun:test'
import { isPasswordLongEnough, MIN_PASSWORD_LENGTH } from './password-policy'

describe('password policy', () => {
	test('matches the server minimum of twelve', () => {
		expect(MIN_PASSWORD_LENGTH).toBe(12)
	})
	test('accepts exactly the minimum and refuses one fewer', () => {
		expect(isPasswordLongEnough('a'.repeat(12))).toBe(true)
		expect(isPasswordLongEnough('a'.repeat(11))).toBe(false)
		expect(isPasswordLongEnough('a'.repeat(10))).toBe(false)
	})
})
