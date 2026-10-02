import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
	CONSENT_DEFAULT_SCRIPT,
	cleanEventParams,
	consentSignals,
	createGoogleTag,
	deleteGoogleCookies,
	googleCookieNames,
	googleTagIds,
	rememberCheckoutQuote,
	setActiveGoogleTag,
	type TagDocument,
	type TagWindow,
	trackablePath,
	trackCheckoutReturn,
	trackSignUp,
} from './google-tag'

const IDS = { ga: 'G-TEST1234', ads: 'AW-123456789' }

function harness(choice: { analytics: boolean; marketing: boolean }, ids = IDS) {
	const scripts: string[] = []
	const calls: unknown[][] = []
	const store = new Map<string, string>()
	const win = {
		location: { origin: 'https://puzzled.gg', hostname: 'puzzled.gg' },
		dataLayer: [] as unknown[],
		gtag: (...args: unknown[]) => calls.push(args),
	} as unknown as TagWindow
	const doc: TagDocument = {
		cookie: '',
		head: { appendChild: (node) => scripts.push((node as { src: string }).src) },
		createElement: () => ({ src: '', async: false }),
	}
	const state = { ...choice }
	const tag = createGoogleTag({ ids, win, doc, consent: () => state })
	return { tag, scripts, calls, state, store, win }
}

const names = (calls: unknown[][]) =>
	calls.map((c) => (c[0] === 'event' ? `event:${c[1]}` : String(c[0])))

beforeEach(() => {
	setActiveGoogleTag(null)
})

afterEach(() => {
	setActiveGoogleTag(null)
	// biome-ignore lint/suspicious/noExplicitAny: test cleanup of the stub window
	;(globalThis as any).window = undefined
})

describe('ids', () => {
	test('nothing is configured without a valid id', () => {
		expect(googleTagIds({})).toBeNull()
		expect(googleTagIds({ GA_MEASUREMENT_ID: 'nope', GOOGLE_ADS_ID: 'AW-x' })).toBeNull()
		expect(googleTagIds({ GA_MEASUREMENT_ID: ' G-ABCD1234 ' })).toEqual({
			ga: 'G-ABCD1234',
			ads: null,
		})
	})
})

describe('consent mode', () => {
	test('inline defaults deny every signal and wait 500 ms', () => {
		expect(CONSENT_DEFAULT_SCRIPT).toContain('"ad_storage":"denied"')
		expect(CONSENT_DEFAULT_SCRIPT).toContain('"ad_user_data":"denied"')
		expect(CONSENT_DEFAULT_SCRIPT).toContain('"ad_personalization":"denied"')
		expect(CONSENT_DEFAULT_SCRIPT).toContain('"analytics_storage":"denied"')
		expect(CONSENT_DEFAULT_SCRIPT).toContain('"wait_for_update":500')
		expect(CONSENT_DEFAULT_SCRIPT).not.toContain('config')
	})

	test('signals follow the two choices and personalization is never granted', () => {
		expect(consentSignals({ analytics: true, marketing: false })).toEqual({
			ad_storage: 'denied',
			ad_user_data: 'denied',
			ad_personalization: 'denied',
			analytics_storage: 'granted',
		})
		expect(consentSignals({ analytics: false, marketing: true })).toEqual({
			ad_storage: 'granted',
			ad_user_data: 'granted',
			ad_personalization: 'denied',
			analytics_storage: 'denied',
		})
	})
})

describe('loading', () => {
	test('no script and no call without a stored grant', () => {
		const h = harness({ analytics: false, marketing: false })
		h.tag.sync()
		expect(h.tag.pageView('/')).toBe(false)
		expect(h.tag.event('sign_up', { method: 'email' })).toBe(false)
		expect(h.scripts).toEqual([])
		expect(h.calls).toEqual([])
	})

	test('consent update, js and the fixed address precede config', () => {
		const h = harness({ analytics: true, marketing: true })
		h.tag.sync()
		expect(names(h.calls)).toEqual(['consent', 'js', 'set', 'config', 'config'])
		expect(h.scripts).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-TEST1234'])
		expect(h.calls[2]?.[1]).toEqual({
			page_location: 'https://puzzled.gg/',
			page_referrer: '',
			page_title: 'Puzzled',
		})
		expect(h.calls[3]?.[2]).toMatchObject({
			send_page_view: false,
			allow_google_signals: false,
			allow_ad_personalization_signals: false,
		})
		h.tag.sync()
		expect(h.scripts).toHaveLength(1)
		expect(names(h.calls).filter((n) => n === 'config')).toHaveLength(2)
	})

	test('analytics only configures GA4; marketing only configures Ads', () => {
		const a = harness({ analytics: true, marketing: false })
		a.tag.sync()
		expect(a.calls.filter((c) => c[0] === 'config').map((c) => c[1])).toEqual(['G-TEST1234'])
		const m = harness({ analytics: false, marketing: true })
		m.tag.sync()
		expect(m.calls.filter((c) => c[0] === 'config').map((c) => c[1])).toEqual(['AW-123456789'])
		expect(m.scripts).toEqual(['https://www.googletagmanager.com/gtag/js?id=AW-123456789'])
	})

	test('withdrawing denies every signal and disables the tag', () => {
		const h = harness({ analytics: true, marketing: true })
		h.tag.sync()
		h.state.analytics = false
		h.state.marketing = false
		h.tag.sync()
		const last = h.calls[h.calls.length - 1]
		expect(last?.[1]).toBe('update')
		expect(last?.[2]).toMatchObject({ ad_storage: 'denied', analytics_storage: 'denied' })
		expect(h.win['ga-disable-G-TEST1234']).toBe(true)
		expect(h.win['ga-disable-AW-123456789']).toBe(true)
		expect(h.tag.event('sign_up', { method: 'email' })).toBe(false)
	})
})

describe('page views and addresses', () => {
	test('only public paths are reported, with no query, id or locale-private part', () => {
		expect(trackablePath('/')).toBe('/')
		expect(trackablePath('/en-GB/pricing')).toBe('/pricing')
		expect(trackablePath('/zh-HK/')).toBe('/')
		expect(trackablePath('/games/sudoku')).toBeNull()
		expect(trackablePath('/share/abc123')).toBeNull()
		expect(trackablePath('/settings/subscription')).toBeNull()
		expect(trackablePath('/daily/2026-10-01')).toBeNull()
	})

	test('a private route sends nothing and resets the address', () => {
		const h = harness({ analytics: true, marketing: false })
		h.tag.sync()
		h.calls.length = 0
		expect(h.tag.pageView('/pricing')).toBe(true)
		expect(h.tag.pageView('/pricing')).toBe(false)
		expect(h.tag.pageView('/games/sudoku?id=secret')).toBe(false)
		const events = h.calls.filter((c) => c[0] === 'event')
		expect(events).toHaveLength(1)
		expect(events[0]?.[2]).toMatchObject({ page_location: 'https://puzzled.gg/pricing' })
		const sets = h.calls.filter((c) => c[0] === 'set')
		expect(sets[sets.length - 1]?.[1]).toMatchObject({ page_location: 'https://puzzled.gg/' })
		expect(JSON.stringify(h.calls)).not.toContain('secret')
	})
})

describe('events', () => {
	test('go only to the destinations the visitor allowed', () => {
		const h = harness({ analytics: false, marketing: true })
		h.tag.sync()
		expect(h.tag.event('sign_up', { method: 'email' })).toBe(true)
		const event = h.calls.filter((c) => c[0] === 'event')[0]
		expect(event?.[2]).toEqual({ method: 'email', send_to: ['AW-123456789'] })
	})

	test('parameters carry no personal data', () => {
		expect(
			cleanEventParams({
				method: 'email',
				email: 'a@b.example',
				name: 'Ada',
				value: 39.99,
				currency: 'usd',
				transaction_id: 'cs_test_a1B2',
				plan: 'individual_yearly',
				user_id: 'not an id@x',
				items: [{ item_id: 'individual_yearly', item_name: 'x@y.z' }],
			}),
		).toEqual({
			method: 'email',
			value: 39.99,
			currency: 'USD',
			transaction_id: 'cs_test_a1B2',
			plan: 'individual_yearly',
			items: [{ item_id: 'individual_yearly' }],
		})
		expect(cleanEventParams({ user_id: 'u_abc123XYZ' })).toEqual({ user_id: 'u_abc123XYZ' })
	})
})

describe('conversions', () => {
	function install(choice = { analytics: true, marketing: true }) {
		const h = harness(choice)
		h.tag.sync()
		h.calls.length = 0
		const items = new Map<string, string>()
		// biome-ignore lint/suspicious/noExplicitAny: stub browser window
		;(globalThis as any).window = {
			localStorage: {
				getItem: (k: string) => items.get(k) ?? null,
				setItem: (k: string, v: string) => void items.set(k, v),
				removeItem: (k: string) => void items.delete(k),
			},
		}
		setActiveGoogleTag(h.tag)
		return { h, items }
	}
	const sent = (h: ReturnType<typeof harness>) =>
		h.calls.filter((c) => c[0] === 'event').map((c) => [c[1], c[2]])

	test('trial_start carries the post-trial price once per checkout session and clears the quote', () => {
		const { h, items } = install()
		rememberCheckoutQuote({ plan: 'individual_yearly', value: 39.99, currency: 'USD' })
		expect(trackCheckoutReturn({ sessionId: 'cs_test_1', status: 'trialing' })).toBe(true)
		expect(trackCheckoutReturn({ sessionId: 'cs_test_1', status: 'trialing' })).toBe(false)
		expect(sent(h)).toEqual([
			[
				'trial_start',
				{
					value: 39.99,
					currency: 'USD',
					plan: 'individual_yearly',
					items: [{ item_id: 'individual_yearly' }],
					send_to: ['G-TEST1234', 'AW-123456789'],
				},
			],
		])
		expect([...items.keys()].filter((k) => k.includes('checkout-quote'))).toEqual([])
	})

	test('purchase carries the Money session id as transaction id, once', () => {
		const { h } = install()
		rememberCheckoutQuote({ plan: 'individual_monthly', value: 4.99, currency: 'GBP' })
		expect(
			trackCheckoutReturn({ sessionId: 'cs_live_9', status: 'paid', userId: 'u_opaque123' }),
		).toBe(true)
		expect(sent(h)[0]).toEqual([
			'purchase',
			{
				transaction_id: 'cs_live_9',
				value: 4.99,
				currency: 'GBP',
				items: [{ item_id: 'individual_monthly' }],
				user_id: 'u_opaque123',
				send_to: ['G-TEST1234', 'AW-123456789'],
			},
		])
	})

	test('without consent nothing is stored or sent, and the quote is not consumed', () => {
		const { h, items } = install({ analytics: false, marketing: false })
		rememberCheckoutQuote({ plan: 'individual_yearly', value: 39.99, currency: 'USD' })
		expect(items.size).toBe(0)
		expect(trackCheckoutReturn({ sessionId: 'cs_test_2', status: 'trialing' })).toBe(false)
		expect(sent(h)).toEqual([])
	})

	test('no quote or a malformed session id fires nothing', () => {
		const { h } = install()
		expect(trackCheckoutReturn({ sessionId: 'cs_test_3', status: 'paid' })).toBe(false)
		rememberCheckoutQuote({ plan: 'individual_yearly', value: 39.99, currency: 'USD' })
		expect(trackCheckoutReturn({ sessionId: 'x y@z', status: 'paid' })).toBe(false)
		expect(sent(h)).toEqual([])
	})

	test('sign_up sends the method only', () => {
		const { h } = install()
		expect(trackSignUp('email')).toBe(true)
		expect(sent(h)[0]).toEqual([
			'sign_up',
			{ method: 'email', send_to: ['G-TEST1234', 'AW-123456789'] },
		])
	})

	test('with no tag configured the helpers are inert', () => {
		setActiveGoogleTag(null)
		expect(trackSignUp('email')).toBe(false)
		expect(trackCheckoutReturn({ sessionId: 'cs_test_4', status: 'paid' })).toBe(false)
	})
})

describe('cookies', () => {
	test('Google cookies are found and expired on the host and parents', () => {
		const doc = { cookie: '_ga=1; _ga_ABC123=2; _gcl_au=3; puzzled_attr=x; theme=dark' }
		expect(googleCookieNames(doc.cookie)).toEqual(['_ga', '_ga_ABC123', '_gcl_au'])
		const writes: string[] = []
		deleteGoogleCookies(
			{
				get cookie() {
					return doc.cookie
				},
				set cookie(v: string) {
					writes.push(v)
				},
			},
			'www.puzzled.gg',
		)
		expect(writes).toContain('_ga=; Path=/; Max-Age=0')
		expect(writes).toContain('_ga=; Path=/; Max-Age=0; Domain=.puzzled.gg')
		expect(writes.some((w) => w.startsWith('puzzled_attr') || w.startsWith('theme'))).toBe(false)
	})
})

describe('config privacy flags', () => {
	test('Ads config also turns off personalization signals', () => {
		const h = harness({ analytics: false, marketing: true })
		h.tag.sync()
		const cfg = h.calls.find((c) => c[0] === 'config')
		expect(cfg?.[2]).toMatchObject({
			allow_google_signals: false,
			allow_ad_personalization_signals: false,
		})
	})
})
