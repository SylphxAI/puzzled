import { describe, expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveLocale } from '../../../../../scripts/i18n-resolved-catalogue'

const enUS = resolveLocale('en-US')
const catalogMessages = {
	plus: enUS.plus as Record<string, unknown>,
	games: enUS.games as Record<string, unknown>,
}

function lookup(
	namespace: string | undefined,
	key: string,
	values?: Record<string, string | number>,
) {
	const rootKey = namespace?.split('.')[0]
	let node: unknown = rootKey
		? (catalogMessages as Record<string, unknown>)[rootKey]
		: catalogMessages
	const parts = namespace ? [...namespace.split('.').slice(1), ...key.split('.')] : key.split('.')
	for (const part of parts) {
		node = (node as Record<string, unknown> | undefined)?.[part]
	}
	if (typeof node !== 'string') return `${namespace ?? ''}.${key}`
	let out = node
	if (values) {
		for (const [k, v] of Object.entries(values)) {
			out = out.replace(`{${k}}`, String(v))
		}
	}
	return out
}

function serializeHref(
	href: string | { pathname: string; query?: Record<string, string> },
): string {
	if (typeof href === 'string') return href
	const qs = href.query ? new URLSearchParams(href.query).toString() : ''
	return qs ? `${href.pathname}?${qs}` : href.pathname
}

let mockSignedIn = false
let mockSubscribed = false

mock.module('next/headers', () => ({
	cookies: async () => ({ get: () => undefined }),
	headers: async () => new Headers(),
}))

mock.module('next/navigation', () => ({
	useRouter: () => ({ refresh: () => undefined }),
}))

mock.module('next-intl', () => ({
	useTranslations: (ns?: string) => (key: string, values?: Record<string, string | number>) =>
		lookup(ns, key, values),
	useLocale: () => 'en-US',
}))

mock.module('next-intl/server', () => ({
	getTranslations: async (opts?: string | { locale?: string; namespace?: string }) => {
		const ns = typeof opts === 'string' ? opts : opts?.namespace
		return (key: string, values?: Record<string, string | number>) => lookup(ns, key, values)
	},
	setRequestLocale: () => undefined,
}))

function MockLink({
	href,
	children,
	className,
}: {
	href: string | { pathname: string; query?: Record<string, string> }
	children?: ReactNode
	className?: string
}) {
	return createElement('a', { href: serializeHref(href), className }, children)
}

mock.module('@/lib/i18n/routing', () => ({
	Link: MockLink,
}))

mock.module('@/lib/identity/server', () => ({
	currentUser: async () =>
		mockSignedIn ? { id: 'usr_test_1', email: 'player@example.com', emailVerified: true } : null,
}))

mock.module('@/lib/api/server', () => ({
	getServerPlans: async () => ({
		salesOpen: true,
		familyMaxMembers: 4,
		plans: [
			{
				id: 'individual_once',
				family: false,
				interval: 'once',
				trialDays: 0,
				accessDays: 3,
				prices: [{ currency: 'usd', unitAmountMinor: BigInt(299) }],
			},
			{
				id: 'individual_monthly',
				family: false,
				interval: 'month',
				trialDays: 0,
				accessDays: 0,
				prices: [{ currency: 'usd', unitAmountMinor: BigInt(499) }],
			},
			{
				id: 'individual_yearly',
				family: false,
				interval: 'year',
				trialDays: 0,
				accessDays: 0,
				prices: [{ currency: 'usd', unitAmountMinor: BigInt(3999) }],
			},
			{
				id: 'family_monthly',
				family: true,
				interval: 'month',
				trialDays: 0,
				accessDays: 0,
				prices: [{ currency: 'usd', unitAmountMinor: BigInt(799) }],
			},
			{
				id: 'family_yearly',
				family: true,
				interval: 'year',
				trialDays: 0,
				accessDays: 0,
				prices: [{ currency: 'usd', unitAmountMinor: BigInt(6499) }],
			},
		],
	}),
	getServerPlusAccess: async () => ({
		salesOpen: true,
		entitled: mockSubscribed,
		source: mockSubscribed ? 'plus' : 'none',
		planId: mockSubscribed ? 'individual_yearly' : null,
	}),
}))

const { default: PricingPage } = await import('./page')

describe('PricingPage SSR', () => {
	test('renders cold-guest recurring plans without 14-day waiver checkbox and with direct enabled checkout CTAs', async () => {
		mockSignedIn = false
		mockSubscribed = false
		const node = await PricingPage({
			params: Promise.resolve({ locale: 'en-US' }),
			searchParams: Promise.resolve({ callbackUrl: '/games/sudoku' }),
		})
		const html = renderToStaticMarkup(node)

		// No stray Loading... or /login gate in cold-guest pricing markup
		expect(html).not.toContain('Loading...')
		expect(html).not.toContain('Sign in to get Plus')
		expect(html).not.toContain('Sign in to start Family')
		expect(html).not.toContain('href="/login')

		// Pricing/checkout flow markers keep the cookie banner out of the CTA layer
		expect(html).toContain('data-pricing-page=""')
		expect(html.match(/data-checkout-surface=""/g)?.length).toBe(2)

		// Exact single render of #plus and #family hero cards, plus Free below
		expect(html.match(/id="plus"/g)?.length).toBe(1)
		expect(html.match(/id="family"/g)?.length).toBe(1)
		expect(html.match(/name="plus-interval"/g)?.length).toBe(3)
		expect(html.match(/name="family-interval"/g)?.length).toBe(2)

		// Recurring subscriptions (Yearly default on Plus and Family) must NOT render or require
		// the Reg 37 14-day cancellation waiver checkbox; they show Reg 36 renewal + proportionate terms
		// and immediately enabled checkout buttons.
		expect(html).not.toContain(
			'I want access now and understand I lose the 14-day cancellation right.',
		)
		expect(html).not.toContain('type="checkbox"')
		expect(
			html.match(
				/Access starts immediately; if you cancel within 14 days, you pay only a proportionate amount for the service supplied\./g,
			)?.length,
		).toBe(2)
		expect(html.match(/Continue to payment/g)?.length).toBe(2)
		expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Continue to payment/)
		expect(html).toContain('Renews every year at $39.99 until you cancel.')
		expect(html).toContain('Renews every year at $64.99 until you cancel.')

		// Authorized $64.99/yr Family and $39.99/yr Individual prices in SSR HTML
		expect(html).toContain('$39.99')
		expect(html).toContain('$64.99')
		expect(html).toContain('$7.99')
		expect(html).toContain('$2.99')
		expect(html).toContain('$0')
		expect(html).not.toContain('$0.00')
		expect(html.match(/Choose Tryit Plus/g)).toBeNull()
	})

	test('scopes the 14-day immediate-supply waiver checkbox strictly to the 3-Day Pass', async () => {
		mockSignedIn = false
		mockSubscribed = false
		const passNode = await PricingPage({
			params: Promise.resolve({ locale: 'en-US' }),
			searchParams: Promise.resolve({ plan: 'individual_once' }),
		})
		const passHtml = renderToStaticMarkup(passNode)

		// 3-Day Pass on #plus renders exactly one Reg 37 14-day waiver checkbox and disables its CTA
		// until ticked, while recurring #family beside it has no waiver checkbox and stays enabled.
		expect(
			passHtml.match(/I want access now and understand I lose the 14-day cancellation right\./g)
				?.length,
		).toBe(1)
		expect(passHtml.match(/type="checkbox"/g)?.length).toBe(1)
		expect(passHtml.match(/<button[^>]*disabled=""[^>]*>Continue to payment/g)?.length).toBe(1)
		expect(passHtml).toContain('One payment for 3 days of Tryit Plus. No renewal.')
		expect(
			passHtml.match(
				/Access starts immediately; if you cancel within 14 days, you pay only a proportionate amount for the service supplied\./g,
			)?.length,
		).toBe(1)

		// Monthly recurring plans (Individual and Family) never render the 14-day waiver checkbox.
		for (const plan of ['individual_monthly', 'family_monthly']) {
			const monthlyNode = await PricingPage({
				params: Promise.resolve({ locale: 'en-US' }),
				searchParams: Promise.resolve({ plan }),
			})
			const monthlyHtml = renderToStaticMarkup(monthlyNode)
			expect(monthlyHtml).not.toContain(
				'I want access now and understand I lose the 14-day cancellation right.',
			)
			expect(monthlyHtml).not.toContain('type="checkbox"')
			expect(monthlyHtml).not.toMatch(/<button[^>]*disabled=""[^>]*>Continue to payment/)
		}
	})

	test('preserves Japanese tokushoho disclosure link on cold-guest pricing', async () => {
		mockSignedIn = false
		mockSubscribed = false
		const node = await PricingPage({
			params: Promise.resolve({ locale: 'ja' }),
			searchParams: Promise.resolve({}),
		})
		const html = renderToStaticMarkup(node)
		expect(html).toContain('href="/tokushoho"')
		expect(html).toContain('特定商取引法に基づく表記')
	})

	test('renders currentPlan -> /settings/subscription for signed-in subscribed members', async () => {
		mockSignedIn = true
		mockSubscribed = true
		const node = await PricingPage({
			params: Promise.resolve({ locale: 'en-US' }),
			searchParams: Promise.resolve({}),
		})
		const html = renderToStaticMarkup(node)
		expect(html).toContain('You have Tryit Plus')
		expect(html).toContain('href="/settings/subscription"')
	})
})
