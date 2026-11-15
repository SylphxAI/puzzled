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
	currentUser: async () => null,
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
				prices: [{ currency: 'usd', unitAmountMinor: BigInt(99) }],
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
	getServerPlusAccess: async () => ({ entitled: false, source: 'none', planId: null }),
}))

const { default: PricingPage } = await import('./page')

describe('PricingPage SSR', () => {
	test('renders single Individual and Family hero cards without duplicates', async () => {
		const node = await PricingPage({
			params: Promise.resolve({ locale: 'en-US' }),
			searchParams: Promise.resolve({ callbackUrl: '/games/sudoku' }),
		})
		const html = renderToStaticMarkup(node)

		// No stray Loading... in pricing markup
		expect(html).not.toContain('Loading...')

		// Exact single render of #plus and #family hero cards, plus Free below
		expect(html.match(/id="plus"/g)?.length).toBe(1)
		expect(html.match(/id="family"/g)?.length).toBe(1)
		expect(html.match(/name="plus-interval"/g)?.length).toBe(3)
		expect(html.match(/name="family-interval"/g)?.length).toBe(2)
		expect(html.match(/Sign in to subscribe/g)?.length).toBe(2)

		// Authorized $64.99/yr Family and $39.99/yr Individual prices in SSR HTML
		expect(html).toContain('$39.99')
		expect(html).toContain('$64.99')
		expect(html).toContain('$7.99')
		expect(html).toContain('$0.99')
		expect(html).toContain('$0.00')
		expect(html).not.toContain('Yearly · $39.99 per year')
		expect(html).not.toContain('Sign in to subscribe ·')

		// No duplicate $39.99 pricing card below hero
		expect(html.match(/Choose Puzzled Plus/g)).toBeNull()

		// Preserves game callbackUrl through sign-in return destination
		const expectedReturn = encodeURIComponent(
			'/pricing?plan=individual_yearly&callbackUrl=%2Fgames%2Fsudoku#plus',
		)
		expect(html).toContain(`callbackUrl=${expectedReturn}`)
	})
})
