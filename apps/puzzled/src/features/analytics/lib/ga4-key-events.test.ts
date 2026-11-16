import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { ATTRIBUTION_SESSION_KEY, CONSENT_KEY } from '@/lib/storage-keys'
import { resetGa4KeyEventsForTests, trackGa4KeyEvent } from './ga4-key-events'

const g = globalThis as unknown as Record<string, unknown>

function installBrowserStubs() {
	const localItems = new Map<string, string>()
	const sessionItems = new Map<string, string>()
	const gtagCalls: unknown[][] = []
	const gtag = (...args: unknown[]) => {
		gtagCalls.push(args)
	}
	const localStorage = {
		getItem: (k: string) => localItems.get(k) ?? null,
		setItem: (k: string, v: string) => void localItems.set(k, v),
		removeItem: (k: string) => void localItems.delete(k),
	}
	const sessionStorage = {
		getItem: (k: string) => sessionItems.get(k) ?? null,
		setItem: (k: string, v: string) => void sessionItems.set(k, v),
		removeItem: (k: string) => void sessionItems.delete(k),
	}
	g.localStorage = localStorage
	g.sessionStorage = sessionStorage
	g.window = {
		gtag,
		localStorage,
		sessionStorage,
	}
	return { localItems, sessionItems, gtagCalls }
}

describe('trackGa4KeyEvent', () => {
	beforeEach(() => {
		resetGa4KeyEventsForTests()
	})

	afterEach(() => {
		resetGa4KeyEventsForTests()
		g.window = undefined
		g.localStorage = undefined
		g.sessionStorage = undefined
	})

	test('pre-consent (pending or declined) emits 0 gtag calls even when window.gtag exists', () => {
		const { localItems, sessionItems, gtagCalls } = installBrowserStubs()

		// Pending consent (CONSENT_DEFAULT_SCRIPT already defined window.gtag)
		expect(trackGa4KeyEvent('sign_up', { method: 'email' })).toBe(false)
		expect(
			trackGa4KeyEvent('begin_checkout', {
				plan: 'plus',
				plan_sku: 'individual_yearly',
				billing_interval: 'year',
				checkout_trigger: 'pricing_card',
				option: 'subscription',
			}),
		).toBe(false)
		expect(
			trackGa4KeyEvent('purchase', {
				transaction_id: 'cs_pending_1',
				value: 39.99,
				currency: 'USD',
				plan: 'plus',
				plan_sku: 'individual_yearly',
				billing_interval: 'year',
			}),
		).toBe(false)

		// Explicitly declined
		localItems.set(CONSENT_KEY, 'declined')
		expect(trackGa4KeyEvent('sign_up', { method: 'oauth' })).toBe(false)
		expect(
			trackGa4KeyEvent('purchase', {
				transaction_id: 'cs_pending_1',
				value: 39.99,
				currency: 'USD',
			}),
		).toBe(false)

		expect(gtagCalls).toEqual([])
		expect(sessionItems.size).toBe(0)
	})

	test('returns false when window.gtag is missing or not a function', () => {
		const { localItems } = installBrowserStubs()
		localItems.set(CONSENT_KEY, 'accepted')
		;(g.window as Record<string, unknown>).gtag = undefined
		expect(trackGa4KeyEvent('sign_up', { method: 'email' })).toBe(false)
	})

	test('post-consent emits sign_up, begin_checkout, and purchase with custom dimensions', () => {
		const { localItems, sessionItems, gtagCalls } = installBrowserStubs()
		localItems.set(CONSENT_KEY, 'accepted')
		sessionItems.set(
			ATTRIBUTION_SESSION_KEY,
			encodeURIComponent('s=google&es=seo_daily-word-and-logic-puzzles-online'),
		)

		expect(trackGa4KeyEvent('sign_up', { method: 'oauth' })).toBe(true)
		expect(
			trackGa4KeyEvent('begin_checkout', {
				plan: 'plus',
				plan_sku: 'individual_yearly',
				billing_interval: 'year',
				checkout_trigger: 'pricing_card',
				option: 'subscription',
			}),
		).toBe(true)
		expect(
			trackGa4KeyEvent('purchase', {
				transaction_id: 'cs_live_42',
				value: 39.99,
				currency: 'gbp',
				plan: 'family',
				plan_sku: 'family_yearly',
				billing_interval: 'year',
				entry_surface: 'explicit_checkout_surface',
			}),
		).toBe(true)

		expect(gtagCalls).toEqual([
			[
				'event',
				'sign_up',
				{
					method: 'oauth',
					entry_surface: 'seo_daily-word-and-logic-puzzles-online',
				},
			],
			[
				'event',
				'begin_checkout',
				{
					plan: 'plus',
					plan_sku: 'individual_yearly',
					billing_interval: 'year',
					checkout_trigger: 'pricing_card',
					option: 'subscription',
					entry_surface: 'seo_daily-word-and-logic-puzzles-online',
				},
			],
			[
				'event',
				'purchase',
				{
					transaction_id: 'cs_live_42',
					value: 39.99,
					currency: 'GBP',
					plan: 'family',
					plan_sku: 'family_yearly',
					billing_interval: 'year',
					entry_surface: 'explicit_checkout_surface',
				},
			],
		])
	})

	test('strips undefined, empty, and PII fields', () => {
		const { localItems, gtagCalls } = installBrowserStubs()
		localItems.set(CONSENT_KEY, 'accepted')

		expect(
			trackGa4KeyEvent('begin_checkout', {
				plan: 'plus',
				plan_sku: undefined,
				billing_interval: 'month',
				checkout_trigger: '',
				entry_surface: 'user@example.com',
				option: 'subscription',
				email: 'user@example.com',
				name: 'Ada Lovelace',
				user_id: 'u_secret',
				session_id: 'ses_secret',
			}),
		).toBe(true)

		expect(gtagCalls).toEqual([
			[
				'event',
				'begin_checkout',
				{
					plan: 'plus',
					billing_interval: 'month',
					option: 'subscription',
				},
			],
		])
	})

	test('deduplicates purchase in sessionStorage across reloads and never burns pre-consent', () => {
		const { localItems, gtagCalls } = installBrowserStubs()

		// Pre-consent attempt must not consume the deduplication slot
		expect(
			trackGa4KeyEvent('purchase', {
				transaction_id: 'cs_reload_9',
				value: 39.99,
				currency: 'USD',
				plan: 'plus',
				plan_sku: 'individual_yearly',
				billing_interval: 'year',
			}),
		).toBe(false)
		expect(gtagCalls).toHaveLength(0)

		// Grant consent -> sends once
		localItems.set(CONSENT_KEY, 'accepted')
		expect(
			trackGa4KeyEvent('purchase', {
				transaction_id: 'cs_reload_9',
				value: 39.99,
				currency: 'USD',
				plan: 'plus',
				plan_sku: 'individual_yearly',
				billing_interval: 'year',
			}),
		).toBe(true)
		expect(gtagCalls).toHaveLength(1)

		// Same-document duplicate blocked
		expect(
			trackGa4KeyEvent('purchase', {
				transaction_id: 'cs_reload_9',
				value: 39.99,
				currency: 'USD',
			}),
		).toBe(false)

		// Page reload simulation (in-memory Set cleared, sessionStorage remains)
		resetGa4KeyEventsForTests()
		expect(
			trackGa4KeyEvent('purchase', {
				transaction_id: 'cs_reload_9',
				value: 39.99,
				currency: 'USD',
			}),
		).toBe(false)
		expect(gtagCalls).toHaveLength(1)
	})
})
