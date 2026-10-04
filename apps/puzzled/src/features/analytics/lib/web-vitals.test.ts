import { describe, expect, test } from 'bun:test'
import { createGoogleTag, type TagDocument, type TagWindow } from './google-tag'
import { routeTemplate, sampled, vitalParams } from './web-vitals'

describe('routeTemplate', () => {
	test('strips the locale and keeps known pages', () => {
		expect(routeTemplate('/zh-HK/daily')).toBe('/daily')
		expect(routeTemplate('/')).toBe('/')
		expect(routeTemplate('/en-GB')).toBe('/')
		expect(routeTemplate('/settings/profile/')).toBe('/settings/profile')
	})
	test('a game slug becomes the template', () => {
		expect(routeTemplate('/en-GB/games/word-search')).toBe('/games/[slug]')
	})
	test('anything else is other, never an id or token', () => {
		expect(routeTemplate('/admin/games/abc')).toBe('other')
		expect(routeTemplate('/share/9f3a-secret')).toBe('other')
		expect(routeTemplate('/games/a/b')).toBe('other')
	})
})

describe('sampled', () => {
	test('10% threshold', () => {
		expect(sampled(() => 0.05)).toBe(true)
		expect(sampled(() => 0.1)).toBe(false)
		expect(sampled(() => 0.9)).toBe(false)
	})
})

describe('vitalParams', () => {
	test('route template, name, rating and value only', () => {
		const p = vitalParams({
			pathname: '/games/x/y',
			name: 'INP',
			rating: 'poor',
			value: 312.12345,
		})
		expect(Object.keys(p).sort()).toEqual([
			'vital_name',
			'vital_rating',
			'vital_route',
			'vital_value',
		])
		expect(p.vital_route).toBe('other')
		expect(p.vital_value).toBe(312.123)
	})
})

function tag(consent: { analytics: boolean; marketing: boolean }) {
	const calls: unknown[][] = []
	const win = {
		location: { origin: 'https://puzzled.gg', hostname: 'puzzled.gg' },
		gtag: (...a: unknown[]) => void calls.push(a),
	} as unknown as TagWindow
	const doc = {
		cookie: '',
		head: { appendChild: () => {} },
		createElement: () => ({ src: '', async: false }),
	} as unknown as TagDocument
	const t = createGoogleTag({
		ids: { ga: 'G-ABCD1234', ads: 'AW-1234567' },
		win,
		doc,
		consent: () => consent,
	})
	t.sync()
	return { t, calls }
}

describe('web_vitals event through the Google tag', () => {
	const params = vitalParams({ pathname: '/daily', name: 'LCP', rating: 'good', value: 1200 })
	test('goes to GA only, never Ads, and carries only the vital parameters', () => {
		const { t, calls } = tag({ analytics: true, marketing: true })
		expect(
			t.event('web_vitals', { ...params, user_id: 'not allowed!' }, { analyticsOnly: true }),
		).toBe(true)
		const sent = calls.find((c) => c[1] === 'web_vitals')?.[2] as Record<string, unknown>
		expect(sent.send_to).toEqual(['G-ABCD1234'])
		expect(sent.vital_route).toBe('/daily')
		expect(sent.user_id).toBeUndefined()
	})
	test('nothing is sent without analytics consent', () => {
		const { t, calls } = tag({ analytics: false, marketing: true })
		expect(t.event('web_vitals', params, { analyticsOnly: true })).toBe(false)
		expect(calls.some((c) => c[1] === 'web_vitals')).toBe(false)
	})
})
