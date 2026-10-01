import { describe, expect, test } from 'bun:test'
import { passwordProblem, SIGN_IN_MIN_PASSWORD_LENGTH } from './auth-fields'

describe('sign-in password validation', () => {
	test('an existing 8-character password passes sign-in', () => {
		expect(passwordProblem('12345678', SIGN_IN_MIN_PASSWORD_LENGTH)).toBeNull()
	})
	test('an empty password is still refused', () => {
		expect(passwordProblem('', SIGN_IN_MIN_PASSWORD_LENGTH)).toBe('passwordRequired')
	})
	test('sign-up keeps the 12-character minimum', () => {
		expect(passwordProblem('12345678')).toBe('passwordTooShort')
	})
})
