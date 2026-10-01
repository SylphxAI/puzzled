import { describe, expect, test } from 'bun:test'
import {
	afterSignUpDestination,
	consumeSignUpCookie,
	readSignUpCookie,
	safeCallbackPath,
	signUpCookieHeader,
	signUpMethodFrom,
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

describe('new-account cookie', () => {
	test('the server cookie is one-shot, readable by the page, Secure and short-lived', () => {
		const header = signUpCookieHeader('oauth')
		expect(header).toBe('puzzled_signup=oauth; Max-Age=600; Path=/; SameSite=Lax; Secure')
		expect(header).not.toContain('HttpOnly')
	})

	test('a link cannot fire: no cookie means no method, whatever the address says', () => {
		const doc = { cookie: 'theme=dark' }
		expect(consumeSignUpCookie(doc)).toBeNull()
		expect(doc.cookie).toBe('theme=dark')
	})

	test('the cookie is read once and deleted', () => {
		const doc = { cookie: 'a=1; puzzled_signup=email' }
		expect(consumeSignUpCookie(doc)).toBe('email')
		expect(doc.cookie).toContain('puzzled_signup=; Max-Age=0')
	})

	test('only known methods are read', () => {
		expect(signUpMethodFrom('email')).toBe('email')
		expect(signUpMethodFrom('a@b.example')).toBeNull()
		expect(readSignUpCookie('puzzled_signup=x%40y')).toBeNull()
	})
})
