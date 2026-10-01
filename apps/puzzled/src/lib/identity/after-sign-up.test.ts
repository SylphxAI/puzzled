import { describe, expect, test } from 'bun:test'
import { afterSignUpDestination, safeCallbackPath } from './after-sign-up'

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
