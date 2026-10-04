import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createGoogleTag, setActiveGoogleTag, type TagDocument, type TagWindow } from './google-tag'
import {
	funnelDay,
	trackCheckoutReturned,
	trackCheckoutStarted,
	trackOfferClicked,
	trackOfferShown,
	trackTrialStarted,
} from './plus-funnel'

function install(choice: { analytics: boolean; marketing: boolean }) {
	const calls: unknown[][] = []
	const win = {
		location: { origin: 'https://puzzled.gg', hostname: 'puzzled.gg' },
		dataLayer: [] as unknown[],
		gtag: (...args: unknown[]) => calls.push(args),
	} as unknown as TagWindow
	const doc: TagDocument = {
		cookie: '',
		head: { appendChild: () => undefined },
		createElement: () => ({ src: '', async: false }),
	}
	const state = { ...choice }
	const tag = createGoogleTag({
		ids: { ga: 'G-TEST1234', ads: 'AW-123456789' },
		win,
		doc,
		consent: () => state,
	})
	tag.sync()
	calls.length = 0
	const items = new Map<string, string>()
	// biome-ignore lint/suspicious/noExplicitAny: stub browser window
	;(globalThis as any).window = {
		localStorage: {
			getItem: (k: string) => items.get(k) ?? null,
			setItem: (k: string, v: string) => void items.set(k, v),
		},
	}
	setActiveGoogleTag(tag)
	const events = () => calls.filter((c) => c[0] === 'event').map((c) => [c[1], c[2]])
	return { events, state, tag }
}

beforeEach(() => setActiveGoogleTag(null))
afterEach(() => {
	setActiveGoogleTag(null)
	// biome-ignore lint/suspicious/noExplicitAny: test cleanup
	;(globalThis as any).window = undefined
})

describe('plus funnel', () => {
	test('sends to GA only, with fixed values, once per surface per day', () => {
		const { events } = install({ analytics: true, marketing: true })
		expect(trackOfferShown('result_card')).toBe(true)
		expect(trackOfferShown('result_card')).toBe(false)
		expect(trackOfferShown('day3')).toBe(true)
		expect(trackOfferClicked('pricing')).toBe(true)
		expect(trackCheckoutStarted({ plan: 'plus_yearly', interval: 'year', trial: true })).toBe(true)
		expect(trackCheckoutReturned('cancel')).toBe(true)
		expect(trackTrialStarted()).toBe(true)
		expect(events()).toEqual([
			['plus_offer_shown', { surface: 'result_card', send_to: ['G-TEST1234'] }],
			['plus_offer_shown', { surface: 'day3', send_to: ['G-TEST1234'] }],
			['plus_offer_clicked', { surface: 'pricing', send_to: ['G-TEST1234'] }],
			[
				'checkout_started',
				{ plan: 'plus_yearly', interval: 'year', trial: 'yes', send_to: ['G-TEST1234'] },
			],
			['checkout_returned', { outcome: 'cancel', send_to: ['G-TEST1234'] }],
			['trial_started', { send_to: ['G-TEST1234'] }],
		])
	})

	test('a new Hong Kong day allows each event again', () => {
		install({ analytics: true, marketing: false })
		const day1 = new Date('2026-10-03T10:00:00Z')
		const day2 = new Date('2026-10-04T10:00:00Z')
		expect(funnelDay(new Date('2026-10-03T17:00:00Z'))).toBe('2026-10-04')
		const fire = (d: Date) => import('./plus-funnel').then((m) => m.fireFunnelOnce('x', 's', {}, d))
		return fire(day1).then(async (a) => {
			expect(a).toBe(true)
			expect(await fire(day1)).toBe(false)
			expect(await fire(day2)).toBe(true)
		})
	})

	test('no analytics consent sends nothing and remembers nothing', () => {
		const { events, state } = install({ analytics: false, marketing: true })
		expect(trackOfferShown('pricing')).toBe(false)
		expect(events()).toEqual([])
		state.analytics = true
		// Marketing-only visitors never reach GA; once analytics is granted the event can still fire.
		const h = install({ analytics: true, marketing: true })
		expect(trackOfferShown('pricing')).toBe(true)
		expect(h.events().length).toBe(1)
	})
})
