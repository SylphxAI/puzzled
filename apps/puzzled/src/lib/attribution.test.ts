import { describe, expect, test } from 'bun:test'
import {
	attributionCookieString,
	attributionCookieValue,
	cleanClickId,
	hasAttributionCookie,
	nextAttributionCookie,
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

const base = { landingPath: '/daily', now: 1790000000000, existing: null }
const decoded = (action: ReturnType<typeof nextAttributionCookie>) =>
	action.kind === 'set' ? new URLSearchParams(decodeURIComponent(action.value)) : null

describe('ad click id capture', () => {
	test('validates click ids', () => {
		expect(cleanClickId('Cj0KCQ_abc-123')).toBe('Cj0KCQ_abc-123')
		expect(cleanClickId('a b')).toBeNull()
		expect(cleanClickId('a&b=c')).toBeNull()
		expect(cleanClickId('x'.repeat(101))).toBeNull()
		expect(cleanClickId('')).toBeNull()
		expect(cleanClickId(null)).toBeNull()
	})

	test('stores the click id only with marketing consent', () => {
		const search = '?gclid=abc_1&utm_source=google&utm_medium=cpc'
		const on = decoded(nextAttributionCookie({ ...base, search, analytics: true, marketing: true }))
		expect(on?.get('g')).toBe('abc_1')
		expect(on?.get('s')).toBe('google')
		const analyticsOnly = decoded(
			nextAttributionCookie({ ...base, search, analytics: true, marketing: false }),
		)
		expect(analyticsOnly?.get('g')).toBeNull()
		expect(analyticsOnly?.get('s')).toBe('google')
		const marketingOnly = decoded(
			nextAttributionCookie({ ...base, search, analytics: false, marketing: true }),
		)
		expect(marketingOnly?.get('g')).toBe('abc_1')
		expect(marketingOnly?.get('s')).toBeNull()
		// Denied or undecided: nothing is written.
		expect(nextAttributionCookie({ ...base, search, analytics: false, marketing: false })).toEqual({
			kind: 'keep',
		})
	})

	test('rejects a malformed click id', () => {
		const search = '?gclid=%3Cscript%3E&wbraid=ok-1'
		const out = decoded(
			nextAttributionCookie({ ...base, search, analytics: false, marketing: true }),
		)
		expect(out?.get('g')).toBeNull()
		expect(out?.get('wb')).toBe('ok-1')
	})

	test('withdrawing marketing consent removes only the click id', () => {
		const existing = encodeURIComponent('s=google&g=abc&at=1')
		const out = decoded(
			nextAttributionCookie({ ...base, existing, search: '', analytics: true, marketing: false }),
		)
		expect(out?.get('g')).toBeNull()
		expect(out?.get('s')).toBe('google')
	})

	test('declining everything clears the cookie, even one holding a click id', () => {
		const existing = encodeURIComponent('g=abc&at=1')
		expect(
			nextAttributionCookie({ ...base, existing, search: '', analytics: false, marketing: false }),
		).toEqual({ kind: 'clear' })
		expect(
			nextAttributionCookie({ ...base, existing, search: '', analytics: true, marketing: false }),
		).toEqual({ kind: 'clear' })
	})

	test('a newer ad click replaces the old click id and keeps first-touch tags', () => {
		const existing = encodeURIComponent('s=tryit&g=old&at=1')
		const out = decoded(
			nextAttributionCookie({
				...base,
				existing,
				search: '?gclid=new&utm_source=google',
				analytics: true,
				marketing: true,
			}),
		)
		expect(out?.get('g')).toBe('new')
		expect(out?.get('s')).toBe('tryit')
	})

	test('a click id cookie lasts 90 days, plain tags 30', () => {
		expect(attributionCookieString(encodeURIComponent('g=abc'), true)).toContain('Max-Age=7776000')
		expect(attributionCookieString(encodeURIComponent('s=abc'), true)).toContain('Max-Age=2592000')
		expect(attributionCookieString(encodeURIComponent('g=abc'), true)).not.toContain('Domain')
	})

	test('a tag value that looks like an email address is dropped', () => {
		expect(attributionCookieValue('?utm_source=someone@example.com', '/', 1)).toBeNull()
		expect(
			decodeURIComponent(attributionCookieValue('?utm_source=spring&utm_term=a@b.c', '/', 1) ?? ''),
		).toContain('s=spring')
	})

	test('advertising-only consent stores the click id but no landing path or time', () => {
		const value = attributionCookieValue('?gclid=abc123&utm_source=x', '/pricing', 5, {
			clickId: true,
		})
		const decoded = new URLSearchParams(decodeURIComponent(value ?? ''))
		expect(decoded.get('g')).toBe('abc123')
		expect(decoded.get('s')).toBeNull()
		expect(decoded.get('p')).toBeNull()
		expect(decoded.get('at')).toBeNull()
	})

	test('analytics consent still stores the landing path and time with the tags', () => {
		const value = attributionCookieValue('?utm_source=x', '/pricing', 5, { tags: true })
		const decoded = new URLSearchParams(decodeURIComponent(value ?? ''))
		expect(decoded.get('p')).toBe('/pricing')
		expect(decoded.get('at')).toBe('5')
	})
})
