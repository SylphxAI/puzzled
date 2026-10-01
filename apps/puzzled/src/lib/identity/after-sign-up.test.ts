import { describe, expect, test } from 'bun:test'
import {
	afterSignUpDestination,
	safeCallbackPath,
	signUpMethodFrom,
	withNewAccountMarker,
	withoutNewAccountMarker,
} from './after-sign-up'

describe('safeCallbackPath', () => {
	test('accepts same-origin relative paths', () => {
		expect(safeCallbackPath('/games/sudoku')).toBe('/games/sudoku')
		expect(safeCallbackPath('/zh-HK/games/sudoku?x=1')).toBe('/zh-HK/games/sudoku?x=1')
	})

	test('rejects everything that could leave the site', () => {
		for (const bad of [
			'',
			null,
			undefined,
			'games/sudoku',
			'//evil.example',
			'/\\evil.example',
			'https://evil.example',
			'javascript:alert(1)',
			'/ok\nSet-Cookie: x',
			`/${'a'.repeat(300)}`,
		]) {
			expect(safeCallbackPath(bad)).toBeNull()
		}
	})
})

describe('afterSignUpDestination', () => {
	test('lands on the callback with the one-shot marker', () => {
		expect(afterSignUpDestination('/games/sudoku')).toBe('/games/sudoku?signedUp=1')
		expect(afterSignUpDestination('/games/sudoku?d=hard#top')).toBe(
			'/games/sudoku?d=hard&signedUp=1#top',
		)
	})

	test('falls back to home for a missing or unsafe callback', () => {
		expect(afterSignUpDestination(null)).toBe('/?signedUp=1')
		expect(afterSignUpDestination('//evil.example')).toBe('/?signedUp=1')
	})
})

describe('new-account marker', () => {
	test('adds the method once, keeping query and hash', () => {
		expect(withNewAccountMarker('/', 'oauth')).toBe('/?signupVia=oauth')
		expect(withNewAccountMarker('/games/x?d=1&signupVia=email#top', 'oauth')).toBe(
			'/games/x?d=1&signupVia=oauth#top',
		)
	})

	test('a forged marker is stripped', () => {
		expect(withoutNewAccountMarker('/a?signupVia=email')).toBe('/a')
		expect(withoutNewAccountMarker('/a?x=1&signupVia=email#h')).toBe('/a?x=1#h')
		expect(withoutNewAccountMarker('/a?x=1')).toBe('/a?x=1')
	})

	test('only known methods are read', () => {
		expect(signUpMethodFrom('email')).toBe('email')
		expect(signUpMethodFrom('oauth')).toBe('oauth')
		expect(signUpMethodFrom('a@b.example')).toBeNull()
		expect(signUpMethodFrom(null)).toBeNull()
	})
})
