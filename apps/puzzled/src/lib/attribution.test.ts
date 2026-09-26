import { describe, expect, test } from 'bun:test'
import {
	attributionCookieString,
	attributionCookieValue,
	hasAttributionCookie,
} from './attribution'

describe('first-touch attribution cookie', () => {
	test('encodes the Tryit tags the api parses', () => {
		const value = attributionCookieValue(
			'?utm_source=tryit&utm_medium=referral&utm_campaign=daily&ref=res_42&x=1',
			'/daily',
			1790000000000,
		)
		expect(value).toBe(
			encodeURIComponent('s=tryit&m=referral&c=daily&r=res_42&p=%2Fdaily&at=1790000000000'),
		)
		// The same bytes the Rust parser test reads.
		expect(value).toBe(
			's%3Dtryit%26m%3Dreferral%26c%3Ddaily%26r%3Dres_42%26p%3D%252Fdaily%26at%3D1790000000000',
		)
	})

	test('an untagged landing stores nothing; hostile values are bounded', () => {
		expect(attributionCookieValue('?page=2', '/', 1)).toBeNull()
		expect(attributionCookieValue('?utm_source=%20%20', '/', 1)).toBeNull()
		const long = attributionCookieValue(`?ref=${'x'.repeat(300)}`, '//evil.example', 1)
		const decoded = new URLSearchParams(decodeURIComponent(long ?? ''))
		expect(decoded.get('r')?.length).toBe(100)
		expect(decoded.get('p')).toBeNull()
	})

	test('cookie strings keep 30 days, clear, and detect an existing first touch', () => {
		expect(attributionCookieString('abc', true)).toBe(
			'puzzled_attr=abc; Path=/; SameSite=Lax; Secure; Max-Age=2592000',
		)
		expect(attributionCookieString(null, false)).toBe(
			'puzzled_attr=; Path=/; SameSite=Lax; Max-Age=0',
		)
		expect(hasAttributionCookie('a=1; puzzled_attr=x')).toBe(true)
		expect(hasAttributionCookie('a=1; puzzled_attr_other=x')).toBe(false)
	})
})
